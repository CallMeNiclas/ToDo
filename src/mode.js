// Focus modes: "work" / "private" / "all", driven by (in order of precedence)
//  1. holiday (date range)  → private
//  2. the latest of: manual switch in the app, iOS Focus via Shortcut, or a scheduled switch
//     (a manual/Focus switch holds until the next scheduled boundary)
//  3. the work schedule (e.g. Mon–Fri 08:15–18:15)
import { getSetting, setSetting, getUserSettings, InputError } from './tasks.js';
import { localNow, zonedToUtc, addDays, isoWeekday } from './time.js';

const MODES = ['work', 'private', 'all'];

function scheduleState(s, tz, now) {
  if (!s.work_schedule) return { scheduled: null, lastBoundary: 0, nextBoundary: null };
  const days = String(s.work_days).split(',').map(Number).filter(Boolean);
  const today = localNow(tz, now).date;
  const boundaries = [];
  for (let i = -8; i <= 8; i++) {
    const d = addDays(today, i);
    if (!days.includes(isoWeekday(d))) continue;
    boundaries.push({ at: zonedToUtc(d, s.work_start, tz).getTime(), mode: 'work' });
    boundaries.push({ at: zonedToUtc(d, s.work_end, tz).getTime(), mode: 'private' });
  }
  boundaries.sort((a, b) => a.at - b.at);
  const t = now.getTime();
  const past = boundaries.filter((b) => b.at <= t);
  const last = past[past.length - 1];
  const next = boundaries.find((b) => b.at > t);
  return { scheduled: last ? last.mode : 'private', lastBoundary: last ? last.at : 0, nextBoundary: next || null };
}

/** pre: optional {settings, holiday, override} (raw setting strings) already loaded by the caller */
export async function computeMode(env, now = new Date(), pre) {
  const tz = env.TIMEZONE;
  const [s, holidayRaw, overrideRaw] = pre
    ? [pre.settings, pre.holiday, pre.override]
    : await Promise.all([getUserSettings(env), getSetting(env, 'holiday'), getSetting(env, 'mode_override')]);
  const holiday = JSON.parse(holidayRaw || 'null');
  const override = JSON.parse(overrideRaw || 'null');
  const today = localNow(tz, now).date;
  const sched = scheduleState(s, tz, now);
  const base = { holiday, schedule: !!s.work_schedule, next: sched.nextBoundary ? { at: new Date(sched.nextBoundary.at).toISOString(), mode: sched.nextBoundary.mode } : null };
  if (holiday && holiday.from <= today && today <= holiday.to) {
    return { ...base, mode: 'private', holidayActive: true, source: 'holiday' };
  }
  if (override && MODES.includes(override.mode) && new Date(override.at).getTime() > sched.lastBoundary) {
    return { ...base, mode: override.mode, source: override.source || 'manual', since: override.at };
  }
  if (sched.scheduled) return { ...base, mode: sched.scheduled, source: 'schedule' };
  return { ...base, mode: 'all', source: 'default' };
}

/** mode: work|private|all, or 'auto' to drop the manual switch */
export async function setMode(env, mode, source = 'manual') {
  if (mode === 'auto') await env.DB.prepare("DELETE FROM settings WHERE key = 'mode_override'").run();
  else if (MODES.includes(mode)) await setSetting(env, 'mode_override', JSON.stringify({ mode, at: new Date().toISOString(), source }));
  else throw new InputError('Modus muss work, private, all oder auto sein');
  return computeMode(env);
}

export async function setHoliday(env, { from, to, clear }) {
  if (clear) { await env.DB.prepare("DELETE FROM settings WHERE key = 'holiday'").run(); return computeMode(env); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || to < from) throw new InputError('Urlaub: von/bis als YYYY-MM-DD, bis >= von');
  await setSetting(env, 'holiday', JSON.stringify({ from, to }));
  return computeMode(env);
}

/** project id → 'work' | 'private' | null, inherited from the main project */
export function contextOf(projects, id) {
  let p = projects.find((x) => x.id === id);
  for (let i = 0; p && i < 10; i++) {
    if (p.context) return p.context;
    p = p.parent_id ? projects.find((x) => x.id === p.parent_id) : null;
  }
  return null;
}

/** iOS Shortcut: POST /hooks/mode?token=…&mode=work|private|all|auto (token = Kurzbefehl-Schlüssel) */
export async function handleModeHook(request, env) {
  const url = new URL(request.url);
  let data = {};
  if (request.method === 'POST') data = await request.json().catch(() => ({}));
  const token = data.token || url.searchParams.get('token') || '';
  const expected = await getSetting(env, 'location_token');
  if (!expected || token !== expected) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const mode = String(data.mode || url.searchParams.get('mode') || '').toLowerCase();
  const map = { arbeit: 'work', privat: 'private', alles: 'all', aus: 'auto', off: 'auto' };
  try {
    return Response.json({ ok: true, ...(await setMode(env, map[mode] || mode, 'focus')) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
