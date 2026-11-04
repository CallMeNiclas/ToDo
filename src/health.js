// Apple Health via the iOS app "Health Auto Export" (REST API automation, JSON v2).
// Payload: { data: { metrics: [{ name, units, data: [{ date, qty, ... }] }], workouts: [...] } }
import { getSetting, getUserSettings } from './tasks.js';
import { localNow, addDays } from './time.js';

// how a metric's samples combine into one value per day
const SUM = new Set(['step_count', 'active_energy', 'basal_energy_burned', 'walking_running_distance', 'apple_exercise_time', 'flights_climbed', 'apple_stand_time', 'mindful_minutes']);
const LAST = new Set(['weight_body_mass', 'body_fat_percentage', 'body_mass_index', 'vo2_max']);
// everything else (heart rate, resting heart rate, HRV …) → average

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

export async function handleHealthHook(request, env) {
  const url = new URL(request.url);
  const expected = await getSetting(env, 'health_token');
  const auth = request.headers.get('Authorization') || '';
  const token = url.searchParams.get('token') || auth.replace(/^Bearer\s+/i, '') || request.headers.get('X-Token') || '';
  if (!expected || token !== expected) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (request.method !== 'POST') return Response.json({ ok: true, hint: 'POST JSON from Health Auto Export' });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'invalid json' }, { status: 400 }); }
  const metrics = body?.data?.metrics || body?.metrics || [];
  const stmts = [];
  const counts = {};
  for (const m of metrics) {
    const name = String(m.name || '').slice(0, 60);
    if (!name || !Array.isArray(m.data)) continue;
    for (const d of m.data) {
      const ts = String(d.date || d.sleepEnd || d.endDate || '').slice(0, 40);
      if (!/^\d{4}-\d{2}-\d{2}/.test(ts)) continue;
      let qty = num(d.qty);
      let extra = null;
      if (name === 'sleep_analysis') {
        const total = num(d.totalSleep) ?? num(d.asleep) ?? ((num(d.core) || 0) + (num(d.deep) || 0) + (num(d.rem) || 0) || null);
        qty = total;
        extra = JSON.stringify({ core: num(d.core), deep: num(d.deep), rem: num(d.rem), awake: num(d.awake), inBed: num(d.inBed), start: d.sleepStart || d.inBedStart || null, end: d.sleepEnd || d.inBedEnd || null });
      } else if (qty === null && (num(d.Avg) !== null || num(d.avg) !== null)) {
        qty = num(d.Avg) ?? num(d.avg);
        extra = JSON.stringify({ min: num(d.Min) ?? num(d.min), max: num(d.Max) ?? num(d.max) });
      }
      if (qty === null) continue;
      stmts.push(env.DB.prepare(`INSERT INTO health_samples (metric, ts, day, qty, unit, extra, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(metric, ts) DO UPDATE SET qty = excluded.qty, unit = excluded.unit, extra = excluded.extra, updated_at = excluded.updated_at`)
        .bind(name, ts, ts.slice(0, 10), qty, m.units || null, extra, new Date().toISOString()));
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  if (stmts.length) await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('health_last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(new Date().toISOString()).run();
  return Response.json({ ok: true, stored: stmts.length, metrics: counts });
}

/** Daily values for the last `days` days: { days: [{date, step_count, sleep: {...}, ...}], goal, lastSync, metrics } */
export async function healthSummary(env, days = 14) {
  days = Math.max(1, Math.min(365, days));
  const today = localNow(env.TIMEZONE).date;
  const from = addDays(today, -(days - 1));
  const { results } = await env.DB.prepare('SELECT metric, ts, day, qty, unit, extra FROM health_samples WHERE day >= ? ORDER BY ts').bind(from).all();
  const byDay = new Map();
  for (let i = 0; i < days; i++) byDay.set(addDays(from, i), { date: addDays(from, i) });
  const units = {};
  const acc = new Map(); // key day|metric -> {sum, n, last}
  for (const r of results) {
    if (!byDay.has(r.day)) continue;
    units[r.metric] = r.unit;
    if (r.metric === 'sleep_analysis') {
      const x = r.extra ? JSON.parse(r.extra) : {};
      byDay.get(r.day).sleep = { hours: r.qty, ...x };
      continue;
    }
    const k = r.day + '|' + r.metric;
    const a = acc.get(k) || { sum: 0, n: 0, last: null };
    a.sum += r.qty; a.n += 1; a.last = r.qty;
    acc.set(k, a);
  }
  for (const [k, a] of acc) {
    const [day, metric] = k.split('|');
    byDay.get(day)[metric] = SUM.has(metric) ? Math.round(a.sum * 100) / 100 : LAST.has(metric) ? a.last : Math.round((a.sum / a.n) * 10) / 10;
  }
  const s = await getUserSettings(env);
  return {
    today,
    goal: s.step_goal,
    lastSync: await getSetting(env, 'health_last_sync'),
    units,
    days: [...byDay.values()],
  };
}
