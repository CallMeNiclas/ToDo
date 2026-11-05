// Streaks for recurring tasks, computed from the completion log.
// An occurrence counts as done if the task was completed between that occurrence
// and the next one. Today's occurrence never breaks a streak (there is still time).
import { listOpenTasks } from './tasks.js';
import { localNow, addDays, isoWeekday } from './time.js';

function occurrencesBack(rule, due, fromDate) {
  // all scheduled dates <= due, going back to fromDate (descending)
  const out = [];
  const n = Math.max(1, rule.interval || 1);
  if (rule.freq === 'day') {
    for (let d = due; d >= fromDate; d = addDays(d, -n)) out.push(d);
  } else if (rule.freq === 'week') {
    const days = rule.days?.length ? rule.days : [isoWeekday(due)];
    if (n === 1) {
      for (let d = due; d >= fromDate; d = addDays(d, -1)) if (days.includes(isoWeekday(d))) out.push(d);
    } else {
      const monday = addDays(due, 1 - isoWeekday(due));
      for (let w = monday; addDays(w, 6) >= fromDate; w = addDays(w, -7 * n)) {
        for (const wd of [...days].sort().reverse()) { const d = addDays(w, wd - 1); if (d <= due && d >= fromDate) out.push(d); }
      }
    }
  } else if (rule.freq === 'month' || rule.freq === 'year') {
    const step = rule.freq === 'year' ? 12 * n : n;
    const [y, m] = due.split('-').map(Number);
    const day = rule.day || +due.slice(8, 10);
    for (let k = 0; k < 400; k++) {
      const first = new Date(Date.UTC(y, m - 1 - k * step, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
      if (d < fromDate) break;
      out.push(d);
    }
  }
  return out;
}

/** completions needed for streaks (only habit tasks) – exported so bootstrap can batch it */
export function habitCompletionsStmt(env) {
  return env.DB.prepare('SELECT c.task_id, c.completed_at FROM completions c JOIN tasks t ON t.id = c.task_id WHERE t.habit = 1 AND c.completed_at >= ?')
    .bind(new Date(Date.now() - 410 * 86400000).toISOString());
}

/** pre: optional {tasks, completions} already loaded by the caller */
export async function habits(env, { days = 84, pre } = {}) {
  const tz = env.TIMEZONE;
  const today = localNow(tz).date;
  const from = addDays(today, -400);
  const tasks = (pre?.tasks || await listOpenTasks(env)).filter((t) => t.habit && t.recurrence && t.due_date);
  if (!tasks.length) return { today, habits: [] };
  const results = pre?.completions || (await habitCompletionsStmt(env).all()).results;
  const byTask = new Map();
  for (const r of results) {
    const d = localNow(tz, new Date(r.completed_at)).date;
    if (!byTask.has(r.task_id)) byTask.set(r.task_id, []);
    byTask.get(r.task_id).push(d);
  }
  const out = [];
  for (const t of tasks) {
    const comps = (byTask.get(t.id) || []).sort();
    // the current due date is the next open occurrence; everything before it is history
    const anchor = t.due_date > today ? t.due_date : today;
    const occ = occurrencesBack(t.recurrence, anchor, from).filter((d) => d <= today); // desc
    const status = []; // {date, done}
    for (let i = 0; i < occ.length; i++) {
      const s = occ[i];
      const next = i === 0 ? addDays(anchor, 1) : occ[i - 1];
      const done = comps.some((c) => c >= s && c < next);
      status.push({ date: s, done });
    }
    // only count history since the habit "started" (first completion)
    const firstDone = comps[0];
    const relevant = firstDone ? status.filter((x) => x.date >= addDays(firstDone, -0) || x.done) : [];
    let current = 0;
    for (let i = 0; i < relevant.length; i++) {
      const x = relevant[i];
      if (x.done) current++;
      else if (i === 0 && x.date === today) continue; // today still open
      else break;
    }
    let best = 0, run = 0;
    for (const x of [...relevant].reverse()) { if (x.done) { run++; best = Math.max(best, run); } else if (x.date !== today) run = 0; }
    const last30 = relevant.filter((x) => x.date > addDays(today, -30) && !(x.date === today && !x.done));
    const done30 = last30.filter((x) => x.done).length;
    const grid = {};
    for (const x of status) {
      if (x.date <= addDays(today, -days)) continue;
      if (!firstDone || x.date < firstDone) continue; // before the habit started: neutral
      grid[x.date] = x.done ? 1 : x.date === today ? 0 : -1;
    }
    out.push({
      task_id: t.id, title: t.title, project_id: t.project_id, recurrence: t.recurrence, due_date: t.due_date,
      current, best, done_30: done30, due_30: last30.length, rate_30: last30.length ? Math.round((done30 / last30.length) * 100) : null,
      started: firstDone || null, grid,
    });
  }
  out.sort((a, b) => b.current - a.current || (b.rate_30 ?? -1) - (a.rate_30 ?? -1));
  return { today, habits: out };
}
