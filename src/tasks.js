// Core data layer shared by the REST API (web app) and the MCP server (Claude).
import { zonedToUtc, localNow, nextOccurrence } from './time.js';

export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export class InputError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- settings ----------
export async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
export async function setSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value)).run();
}
/** Returns an existing secret or creates one atomically-ish (first writer wins). */
export async function ensureSetting(env, key, make) {
  const existing = await getSetting(env, key);
  if (existing) return existing;
  const value = await make();
  await env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
  return getSetting(env, key);
}

export const USER_SETTINGS = {
  default_reminder_min: 15,   // push X minutes before tasks with a time
  p1_mail_time: '08:00',      // P1 tasks without time: mail on due day at
  mail_enabled: 1,
};
export async function getUserSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings WHERE key LIKE 'u.%'").all();
  const out = { ...USER_SETTINGS };
  for (const r of results) {
    const k = r.key.slice(2);
    if (k in out) out[k] = typeof USER_SETTINGS[k] === 'number' ? Number(r.value) : r.value;
  }
  return out;
}
export async function updateUserSettings(env, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in USER_SETTINGS)) continue;
    if (k === 'p1_mail_time' && !TIME_RE.test(v)) throw new InputError('Ungültige Uhrzeit');
    if (k !== 'p1_mail_time' && !Number.isFinite(Number(v))) throw new InputError('Ungültiger Wert');
    await setSetting(env, 'u.' + k, v);
  }
  return getUserSettings(env);
}

// ---------- serialization ----------
export function rowToTask(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    parent_id: r.parent_id,
    title: r.title,
    notes: r.notes,
    priority: r.priority,
    due_date: r.due_date,
    due_time: r.due_time,
    duration_min: r.duration_min,
    recurrence: r.recurrence ? JSON.parse(r.recurrence) : null,
    labels: JSON.parse(r.labels || '[]'),
    reminders: JSON.parse(r.reminders || '[]'),
    place_id: r.place_id,
    place_event: r.place_event,
    sort: r.sort,
    completed_at: r.completed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function normRecurrence(rec, dueDate) {
  if (rec === null || rec === undefined || rec === '') return null;
  if (typeof rec === 'string') rec = JSON.parse(rec);
  const freq = rec.freq;
  if (!['day', 'week', 'month', 'year'].includes(freq)) throw new InputError('recurrence.freq muss day|week|month|year sein');
  const out = { freq, interval: Math.max(1, Math.min(365, parseInt(rec.interval || 1, 10))) };
  if (freq === 'week' && Array.isArray(rec.days) && rec.days.length) {
    out.days = [...new Set(rec.days.map(Number).filter((d) => d >= 1 && d <= 7))].sort();
  }
  if (freq === 'month') {
    const d = parseInt(rec.day || (dueDate ? dueDate.slice(8, 10) : 0), 10);
    if (d >= 1 && d <= 31) out.day = d;
  }
  return out;
}

function normReminders(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const r of list.slice(0, 10)) {
    if (r && Number.isFinite(Number(r.before))) out.push({ before: Math.max(0, Math.min(10080, Math.round(Number(r.before)))) });
    else if (r && typeof r.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.at)) out.push({ at: r.at });
  }
  return out;
}

function normLabels(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((l) => String(l).trim().replace(/^@/, '')).filter(Boolean))].slice(0, 20);
}

/** Validates and normalizes a (partial) task input into column values. */
async function toColumns(env, input, existing) {
  const c = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  if (has('title')) {
    const t = String(input.title || '').trim();
    if (!t) throw new InputError('Titel darf nicht leer sein');
    c.title = t.slice(0, 500);
  }
  if (has('notes')) c.notes = String(input.notes || '').slice(0, 20000);
  if (has('priority')) {
    const p = parseInt(input.priority, 10);
    if (!(p >= 1 && p <= 4)) throw new InputError('Priorität muss 1-4 sein');
    c.priority = p;
  }
  if (has('due_date')) {
    if (input.due_date && !DATE_RE.test(input.due_date)) throw new InputError('due_date: Format YYYY-MM-DD');
    c.due_date = input.due_date || null;
    if (!c.due_date) { c.due_time = null; c.recurrence = null; }
  }
  if (has('due_time') && !(has('due_date') && !c.due_date)) {
    if (input.due_time && !TIME_RE.test(input.due_time)) throw new InputError('due_time: Format HH:MM');
    c.due_time = input.due_time || null;
  }
  if (c.due_time && !(c.due_date || existing?.due_date)) throw new InputError('Uhrzeit braucht ein Datum');
  if (has('duration_min')) {
    const d = input.duration_min === null || input.duration_min === '' ? null : parseInt(input.duration_min, 10);
    if (d !== null && !(d > 0 && d <= 24 * 60 * 7)) throw new InputError('Dauer in Minuten (1-10080)');
    c.duration_min = d;
  }
  if (has('recurrence') && !(has('due_date') && !c.due_date)) {
    c.recurrence = normRecurrence(input.recurrence, c.due_date ?? existing?.due_date);
    if (c.recurrence && !(c.due_date ?? existing?.due_date)) throw new InputError('Wiederholung braucht ein Startdatum');
    c.recurrence = c.recurrence ? JSON.stringify(c.recurrence) : null;
  }
  if (has('labels')) c.labels = JSON.stringify(normLabels(input.labels));
  if (has('reminders')) c.reminders = JSON.stringify(normReminders(input.reminders));
  if (has('project_id')) {
    const pid = input.project_id || 'inbox';
    const p = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(pid).first();
    if (!p) throw new InputError('Projekt nicht gefunden: ' + pid);
    c.project_id = pid;
  }
  if (has('parent_id')) {
    if (input.parent_id) {
      if (existing && input.parent_id === existing.id) throw new InputError('Aufgabe kann nicht ihre eigene Unteraufgabe sein');
      const parent = await env.DB.prepare('SELECT id, project_id, parent_id FROM tasks WHERE id = ?').bind(input.parent_id).first();
      if (!parent) throw new InputError('Übergeordnete Aufgabe nicht gefunden');
      // prevent cycles
      let cur = parent;
      for (let i = 0; cur && i < 20; i++) {
        if (existing && cur.parent_id === existing.id) throw new InputError('Zirkuläre Unteraufgabe');
        cur = cur.parent_id ? await env.DB.prepare('SELECT id, parent_id FROM tasks WHERE id = ?').bind(cur.parent_id).first() : null;
      }
      c.parent_id = parent.id;
      if (!has('project_id')) c.project_id = parent.project_id;
    } else c.parent_id = null;
  }
  if (has('place_id')) {
    if (input.place_id) {
      const pl = await env.DB.prepare('SELECT id FROM places WHERE id = ?').bind(input.place_id).first();
      if (!pl) throw new InputError('Ort nicht gefunden');
      c.place_id = pl.id;
      c.place_event = input.place_event === 'leave' ? 'leave' : 'arrive';
    } else {
      c.place_id = null;
      c.place_event = null;
    }
  } else if (has('place_event') && existing?.place_id) {
    c.place_event = input.place_event === 'leave' ? 'leave' : 'arrive';
  }
  if (has('sort')) c.sort = parseInt(input.sort, 10) || 0;
  return c;
}

// ---------- queries ----------
export async function getTask(env, id) {
  const r = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  return r ? rowToTask(r) : null;
}

export async function listOpenTasks(env) {
  const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY sort, created_at').all();
  return results.map(rowToTask);
}

export async function listCompleted(env, limit = 50) {
  const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?').bind(limit).all();
  return results.map(rowToTask);
}

export async function completionsSince(env, isoUtc) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM completions WHERE completed_at >= ?').bind(isoUtc).first();
  return r.n;
}

// ---------- mutations ----------
export async function createTask(env, input) {
  if (!input || !String(input.title || '').trim()) throw new InputError('Titel fehlt');
  // client-chosen id makes offline sync idempotent: re-sending the same task returns the existing one
  const clientId = typeof input.id === 'string' && /^[a-f0-9]{16}$/.test(input.id) ? input.id : null;
  if (clientId) {
    const existing = await getTask(env, clientId);
    if (existing) return existing;
  }
  const base = { priority: 4, ...input };
  delete base.id;
  if (!base.project_id && !base.parent_id) base.project_id = 'inbox';
  if (!base.project_id) delete base.project_id;
  const c = await toColumns(env, base, null);
  const id = clientId || uid();
  const cols = { id, ...c };
  const keys = Object.keys(cols);
  await env.DB.prepare(`INSERT INTO tasks (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .bind(...keys.map((k) => cols[k])).run();
  const task = await getTask(env, id);
  await scheduleNotifications(env, task);
  return task;
}

export async function updateTask(env, id, input) {
  const existing = await getTask(env, id);
  if (!existing) throw new InputError('Aufgabe nicht gefunden: ' + id);
  const c = await toColumns(env, input, existing);
  if (Object.keys(c).length) {
    c.updated_at = new Date().toISOString();
    const keys = Object.keys(c);
    await env.DB.prepare(`UPDATE tasks SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => c[k]), id).run();
    // subtasks follow their parent's project
    if (c.project_id && c.project_id !== existing.project_id) await moveChildren(env, id, c.project_id);
  }
  const task = await getTask(env, id);
  await scheduleNotifications(env, task);
  return task;
}

async function moveChildren(env, parentId, projectId) {
  const { results } = await env.DB.prepare('SELECT id FROM tasks WHERE parent_id = ?').bind(parentId).all();
  for (const r of results) {
    await env.DB.prepare('UPDATE tasks SET project_id = ? WHERE id = ?').bind(projectId, r.id).run();
    await moveChildren(env, r.id, projectId);
  }
}

/** Completes a task. Recurring tasks move to their next date instead. */
export async function completeTask(env, id) {
  const t = await getTask(env, id);
  if (!t) throw new InputError('Aufgabe nicht gefunden: ' + id);
  if (t.completed_at) return { task: t, recurred: false };
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO completions (task_id, title) VALUES (?, ?)').bind(t.id, t.title).run();
  if (t.recurrence && t.due_date) {
    const today = localNow(env.TIMEZONE).date;
    const next = nextOccurrence(t.recurrence, t.due_date, today);
    await env.DB.prepare('UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?').bind(next, now, id).run();
    // reopen completed subtasks for the next round
    await env.DB.prepare('UPDATE tasks SET completed_at = NULL WHERE parent_id = ?').bind(id).run();
    const task = await getTask(env, id);
    await scheduleNotifications(env, task);
    return { task, recurred: true };
  }
  await env.DB.prepare('UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id).run();
  // complete open subtasks too
  await env.DB.prepare('UPDATE tasks SET completed_at = ?, updated_at = ? WHERE parent_id = ? AND completed_at IS NULL').bind(now, now, id).run();
  await env.DB.prepare('DELETE FROM notifications WHERE sent_at IS NULL AND task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_id = ?)').bind(id, id).run();
  return { task: await getTask(env, id), recurred: false };
}

export async function uncompleteTask(env, id) {
  const t = await getTask(env, id);
  if (!t) throw new InputError('Aufgabe nicht gefunden: ' + id);
  await env.DB.prepare('UPDATE tasks SET completed_at = NULL, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  if (t.parent_id) await env.DB.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').bind(t.parent_id).run();
  const task = await getTask(env, id);
  await scheduleNotifications(env, task);
  return task;
}

export async function deleteTask(env, id) {
  const t = await getTask(env, id);
  if (!t) throw new InputError('Aufgabe nicht gefunden: ' + id);
  // D1 enforces foreign keys, so children + notifications cascade
  await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return { deleted: id };
}

// ---------- projects & places ----------
export async function listProjects(env) {
  const { results } = await env.DB.prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY sort, created_at').all();
  return results;
}
export async function createProject(env, { name, color }) {
  name = String(name || '').trim();
  if (!name) throw new InputError('Projektname fehlt');
  const id = uid();
  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 AS s FROM projects').first();
  await env.DB.prepare('INSERT INTO projects (id, name, color, sort) VALUES (?, ?, ?, ?)')
    .bind(id, name.slice(0, 100), /^#[0-9a-f]{6}$/i.test(color || '') ? color : pickColor(max.s), max.s).run();
  return env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
}
export async function updateProject(env, id, { name, color, sort }) {
  const p = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  if (!p) throw new InputError('Projekt nicht gefunden');
  const n = name !== undefined ? String(name).trim().slice(0, 100) || p.name : p.name;
  const c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : p.color;
  const s = sort !== undefined ? parseInt(sort, 10) || 0 : p.sort;
  await env.DB.prepare('UPDATE projects SET name = ?, color = ?, sort = ? WHERE id = ?').bind(n, c, s, id).run();
  return env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
}
export async function deleteProject(env, id) {
  if (id === 'inbox') throw new InputError('Der Eingang kann nicht gelöscht werden');
  const p = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
  if (!p) throw new InputError('Projekt nicht gefunden');
  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
  return { deleted: id };
}
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#84cc16', '#f97316'];
const pickColor = (i) => PALETTE[i % PALETTE.length];

export async function listPlaces(env) {
  const { results } = await env.DB.prepare('SELECT * FROM places ORDER BY name').all();
  return results;
}
export async function createPlace(env, { name }) {
  name = String(name || '').trim().slice(0, 60);
  if (!name) throw new InputError('Ortsname fehlt');
  const existing = await env.DB.prepare('SELECT * FROM places WHERE name = ?').bind(name).first();
  if (existing) return existing;
  const id = uid();
  await env.DB.prepare('INSERT INTO places (id, name) VALUES (?, ?)').bind(id, name).run();
  return env.DB.prepare('SELECT * FROM places WHERE id = ?').bind(id).first();
}
export async function deletePlace(env, id) {
  await env.DB.prepare('DELETE FROM places WHERE id = ?').bind(id).run();
  return { deleted: id };
}

// ---------- notification schedule ----------
/**
 * Regenerates the pending notifications for a task.
 * - Push: custom reminders, or (if none) default X min before tasks with a time.
 * - E-mail additionally, but only for priority 1 tasks that do not recur.
 *   P1 tasks without a time get a mail (and push) on the due day at p1_mail_time.
 */
export async function scheduleNotifications(env, task) {
  await env.DB.prepare('DELETE FROM notifications WHERE task_id = ? AND sent_at IS NULL').bind(task.id).run();
  if (task.completed_at || !task.due_date) return;
  const s = await getUserSettings(env);
  const tz = env.TIMEZONE;
  const email = task.priority === 1 && !task.recurrence && s.mail_enabled ? 1 : 0;
  const instants = [];
  const dueAt = task.due_time ? zonedToUtc(task.due_date, task.due_time, tz) : null;
  for (const r of task.reminders) {
    if (r.at) instants.push(zonedToUtc(r.at.slice(0, 10), r.at.slice(11, 16), tz));
    else if (dueAt && r.before !== undefined) instants.push(new Date(dueAt.getTime() - r.before * 60000));
  }
  if (!task.reminders.length) {
    if (dueAt) instants.push(new Date(dueAt.getTime() - s.default_reminder_min * 60000));
    else if (email) instants.push(zonedToUtc(task.due_date, s.p1_mail_time, tz));
  }
  const now = Date.now();
  for (const at of instants) {
    if (at.getTime() < now - 60000) continue; // never notify for the past
    await env.DB.prepare('INSERT OR IGNORE INTO notifications (task_id, fire_at, email) VALUES (?, ?, ?)')
      .bind(task.id, at.toISOString(), email).run();
  }
}
