// Focus timer: one active session; time is booked onto the task when it ends.
import { uid, getTask, InputError } from './tasks.js';
import { pushAll } from './notify.js';

const nowIso = () => new Date().toISOString();

export function focusView(s) {
  if (!s) return null;
  const now = Date.now();
  const pausedNow = s.paused_at ? Math.floor((now - Date.parse(s.paused_at)) / 1000) : 0;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(s.started_at)) / 1000) - s.paused_sec - pausedNow);
  return { id: s.id, task_id: s.task_id, title: s.title, planned_min: s.planned_min, started_at: s.started_at, paused: !!s.paused_at, elapsed_sec: elapsed, remaining_sec: s.planned_min * 60 - elapsed, note: s.note || '' };
}

export async function activeFocus(env) {
  return focusView(await env.DB.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1').first());
}

export async function startFocus(env, { task_id, minutes }) {
  const min = Math.round(Number(minutes));
  if (!(min >= 1 && min <= 600)) throw new InputError('Dauer 1–600 Minuten');
  const task = task_id ? await getTask(env, task_id) : null;
  if (task_id && !task) throw new InputError('Aufgabe nicht gefunden');
  await stopFocus(env); // only one at a time
  const id = uid();
  await env.DB.prepare('INSERT INTO focus_sessions (id, task_id, title, planned_min, started_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, task?.id || null, task?.title || 'Fokus', min, nowIso()).run();
  return activeFocus(env);
}

export async function pauseFocus(env, pause) {
  const s = await env.DB.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL LIMIT 1').first();
  if (!s) throw new InputError('Kein Fokus aktiv');
  if (pause && !s.paused_at) await env.DB.prepare('UPDATE focus_sessions SET paused_at = ? WHERE id = ?').bind(nowIso(), s.id).run();
  if (!pause && s.paused_at) {
    const add = Math.floor((Date.now() - Date.parse(s.paused_at)) / 1000);
    await env.DB.prepare('UPDATE focus_sessions SET paused_at = NULL, paused_sec = paused_sec + ? WHERE id = ?').bind(add, s.id).run();
  }
  return activeFocus(env);
}

export async function extendFocus(env, minutes) {
  const s = await env.DB.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL LIMIT 1').first();
  if (!s) throw new InputError('Kein Fokus aktiv');
  await env.DB.prepare('UPDATE focus_sessions SET planned_min = MAX(1, planned_min + ?) WHERE id = ?').bind(Math.round(minutes), s.id).run();
  return activeFocus(env);
}

const cleanNote = (n) => String(n ?? '').slice(0, 5000);

// The note column is added on first use instead of via a migration file, so the code also
// works if the deploy does not run migrations (ALTER is a no-op error once it exists).
let noteCol = false;
async function ensureNoteCol(env) {
  if (noteCol) return;
  try { await env.DB.prepare('SELECT note FROM focus_sessions LIMIT 1').first(); }
  catch { await env.DB.prepare("ALTER TABLE focus_sessions ADD COLUMN note TEXT NOT NULL DEFAULT ''").run().catch(() => {}); }
  noteCol = true;
}

/** Saves the note of the running session (autosave while typing). */
export async function setFocusNote(env, note) {
  await ensureNoteCol(env);
  const s = await env.DB.prepare('SELECT id FROM focus_sessions WHERE ended_at IS NULL LIMIT 1').first();
  if (!s) throw new InputError('Kein Fokus aktiv');
  await env.DB.prepare('UPDATE focus_sessions SET note = ? WHERE id = ?').bind(cleanNote(note), s.id).run();
  return activeFocus(env);
}

/** Finished sessions, newest first – the "Fokus" view. */
export async function focusHistory(env, limit = 100) {
  await ensureNoteCol(env);
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.task_id, f.title, f.planned_min, f.started_at, f.ended_at, f.actual_sec, f.note, t.completed_at AS task_completed_at
     FROM focus_sessions f LEFT JOIN tasks t ON t.id = f.task_id
     WHERE f.ended_at IS NOT NULL ORDER BY f.ended_at DESC LIMIT ?`,
  ).bind(Math.min(500, limit)).all();
  return results;
}

/** Ends the active session and books the time on the task. `note` (optional) is saved with it. */
export async function stopFocus(env, { note } = {}) {
  await ensureNoteCol(env);
  const s = await env.DB.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL LIMIT 1').first();
  if (!s) return null;
  const v = focusView(s);
  await env.DB.prepare('UPDATE focus_sessions SET ended_at = ?, paused_at = NULL, actual_sec = ?, note = ? WHERE id = ?')
    .bind(nowIso(), v.elapsed_sec, note === undefined ? (s.note || '') : cleanNote(note), s.id).run();
  if (s.task_id) await env.DB.prepare('UPDATE tasks SET focus_sec = focus_sec + ? WHERE id = ?').bind(v.elapsed_sec, s.task_id).run();
  return { ...v, ended: true };
}

/** Cron: notify once when the planned time is up (session keeps running until stopped). */
export async function checkFocus(env) {
  const s = await env.DB.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL AND paused_at IS NULL LIMIT 1').first();
  if (!s) return;
  const v = focusView(s);
  const key = 'focus_notified_' + s.id;
  if (v.remaining_sec > 0) return;
  const done = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (done) return;
  await env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, '1').run();
  await pushAll(env, { title: '⏱ Fokuszeit vorbei', body: `${s.title} · ${s.planned_min} Min.`, tag: 'focus', url: s.task_id ? '/#/task/' + s.task_id : '/' });
}
