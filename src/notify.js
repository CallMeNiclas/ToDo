// Delivery of reminders: push to all devices, e-mail for P1 tasks.
import { ensureSetting, getTask, getSetting, listOpenTasks } from './tasks.js';
import { generateVapidKeys, sendPush } from './push.js';
import { sendMail } from './google.js';
import { localNow, addDays } from './time.js';
import { computeMode, contextOf } from './mode.js';
import { listProjects } from './tasks.js';

export async function getVapid(env) {
  const json = await ensureSetting(env, 'vapid', async () => JSON.stringify(await generateVapidKeys()));
  return JSON.parse(json);
}

export async function pushAll(env, payload) {
  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
  if (!results.length) return { sent: 0, devices: 0 };
  const vapid = await getVapid(env);
  let sent = 0;
  await Promise.all(results.map(async (sub) => {
    try {
      const r = await sendPush(sub, payload, vapid, 'mailto:' + env.OWNER_EMAIL);
      if (r.ok) sent++;
      else if (r.gone) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
      else console.warn('push failed', r.status);
    } catch (e) {
      console.warn('push error', e.message);
    }
  }));
  return { sent, devices: results.length };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const PRIO = { 1: 'Prio 1', 2: 'Prio 2', 3: 'Prio 3', 4: '' };

function dueText(task) {
  if (!task.due_date) return '';
  const [y, m, d] = task.due_date.split('-');
  return `${d}.${m}.${y}${task.due_time ? ', ' + task.due_time + ' Uhr' : ''}`;
}

/** Short text Gmail shows in the inbox list, e.g. "Heute um 18:15 Uhr · 30 Min. · Prio 1" */
function previewText(task, tz) {
  const today = localNow(tz).date;
  let when = '';
  if (task.due_date) {
    const day = task.due_date === today ? 'Heute' : task.due_date === addDays(today, 1) ? 'Morgen' : dueText({ due_date: task.due_date });
    when = task.due_time ? `${day} um ${task.due_time} Uhr` : `${day} fällig`;
  }
  return [when, task.duration_min ? task.duration_min + ' Min.' : '', PRIO[task.priority], task.notes ? task.notes.split('\n')[0].slice(0, 80) : '']
    .filter(Boolean).join(' · ');
}

function mailHtml(task, origin, reason, preview) {
  // hidden preheader + filler so Gmail does not append the body text to the preview
  const pre = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent">${esc(preview)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`;
  return `${pre}<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <div style="font-size:12px;color:#dc2626;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${esc(reason)}</div>
  <h2 style="margin:8px 0 4px;font-size:20px">${esc(task.title)}</h2>
  <div style="color:#475569;font-size:14px">${esc(dueText(task))}${task.duration_min ? ' · ' + task.duration_min + ' Min.' : ''}</div>
  ${task.notes ? `<p style="white-space:pre-wrap;font-size:14px;color:#334155;border-left:3px solid #e2e8f0;padding-left:12px">${esc(task.notes)}</p>` : ''}
  ${origin ? `<p><a href="${esc(origin)}/#/task/${esc(task.id)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Aufgabe öffnen</a></p>` : ''}
</div>`;
}

async function notifyTask(env, task, { email, reason }) {
  const origin = await getSetting(env, 'origin');
  const isDeadline = reason.includes('Deadline');
  const body = [isDeadline ? reason : '', dueText(task), task.notes ? task.notes.slice(0, 120) : ''].filter(Boolean).join(' · ');
  const push = await pushAll(env, {
    title: (isDeadline ? '🎯 ' : task.priority === 1 ? '🔴 ' : '') + task.title,
    body: body || reason,
    tag: 'task-' + task.id,
    url: '/#/task/' + task.id,
  });
  let mailed = false;
  if (email) {
    try {
      await sendMail(env, `${isDeadline ? '🎯' : '⏰'} ${task.title}`, mailHtml(task, origin, reason, (reason !== 'Erinnerung' ? reason + ' · ' : '') + previewText(task, env.TIMEZONE)));
      mailed = true;
    } catch (e) {
      console.warn('mail failed', e.message);
    }
  }
  return { push, mailed };
}

/** Cron: deliver due notifications. */
export async function runDueNotifications(env) {
  const now = new Date();
  const { results } = await env.DB.prepare(
    `SELECT n.* FROM notifications n JOIN tasks t ON t.id = n.task_id
     WHERE n.sent_at IS NULL AND n.fire_at <= ? AND t.completed_at IS NULL ORDER BY n.fire_at LIMIT 20`,
  ).bind(now.toISOString()).all();
  const mode = results.length ? await computeMode(env, now) : null;
  const projects = mode?.holidayActive ? await listProjects(env) : null;
  for (const n of results) {
    // claim first so an overlapping run can't double-send
    const claim = await env.DB.prepare('UPDATE notifications SET sent_at = ? WHERE id = ? AND sent_at IS NULL').bind(now.toISOString(), n.id).run();
    if (!claim.meta.changes) continue;
    const late = now.getTime() - new Date(n.fire_at).getTime() > 3 * 3600 * 1000;
    if (late) continue; // skip anything hours late (e.g. after downtime)
    const task = await getTask(env, n.task_id);
    if (task && projects && contextOf(projects, task.project_id) === 'work') continue; // on holiday: no work reminders
    if (task) await notifyTask(env, task, { email: !!n.email, reason: n.kind === 'deadline' ? '🎯 Deadline heute' : 'Erinnerung' });
  }
  // housekeeping: drop sent notifications older than 30 days
  if (now.getUTCMinutes() === 0) {
    await env.DB.prepare('DELETE FROM notifications WHERE sent_at IS NOT NULL AND sent_at < ?')
      .bind(new Date(now.getTime() - 30 * 86400000).toISOString()).run();
  }
}

/** Location webhook (iOS Shortcuts automation): notify for tasks tied to a place. */
export async function handleLocationHook(request, env) {
  const url = new URL(request.url);
  let data = {};
  if (request.method === 'POST') {
    const ct = request.headers.get('Content-Type') || '';
    data = ct.includes('json') ? await request.json().catch(() => ({})) : Object.fromEntries(await request.formData().catch(() => new Map()));
  }
  const token = data.token || url.searchParams.get('token') || '';
  const expected = await getSetting(env, 'location_token');
  if (!expected || token !== expected) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const placeName = String(data.place || url.searchParams.get('place') || '').trim();
  const event = (data.event || url.searchParams.get('event')) === 'leave' ? 'leave' : 'arrive';
  const place = await env.DB.prepare('SELECT * FROM places WHERE name = ?').bind(placeName).first();
  if (!place) return Response.json({ error: 'Ort unbekannt: ' + placeName }, { status: 404 });
  const tasks = (await listOpenTasks(env)).filter((t) => t.place_id === place.id && t.place_event === event);
  for (const t of tasks) {
    await notifyTask(env, t, {
      email: t.priority === 1 && !t.recurrence,
      reason: (event === 'arrive' ? 'Angekommen: ' : 'Verlassen: ') + place.name,
    });
  }
  return Response.json({ ok: true, place: place.name, event, tasks: tasks.map((t) => t.title) });
}
