// Delivery of reminders: push to all devices, e-mail for P1 tasks.
import { ensureSetting, getTask, getSetting, listOpenTasks } from './tasks.js';
import { generateVapidKeys, sendPush } from './push.js';
import { sendMail } from './google.js';

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

function mailHtml(task, origin, reason) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <div style="font-size:12px;color:#dc2626;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${esc(reason)}</div>
  <h2 style="margin:8px 0 4px;font-size:20px">${esc(task.title)}</h2>
  <div style="color:#475569;font-size:14px">${esc(dueText(task))}${task.duration_min ? ' · ' + task.duration_min + ' Min.' : ''}</div>
  ${task.notes ? `<p style="white-space:pre-wrap;font-size:14px;color:#334155;border-left:3px solid #e2e8f0;padding-left:12px">${esc(task.notes)}</p>` : ''}
  ${origin ? `<p><a href="${esc(origin)}/#/task/${esc(task.id)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Aufgabe öffnen</a></p>` : ''}
</div>`;
}

async function notifyTask(env, task, { email, reason }) {
  const origin = await getSetting(env, 'origin');
  const body = [dueText(task), task.notes ? task.notes.slice(0, 120) : ''].filter(Boolean).join(' · ');
  const push = await pushAll(env, {
    title: (task.priority === 1 ? '🔴 ' : '') + task.title,
    body: body || reason,
    tag: 'task-' + task.id,
    url: '/#/task/' + task.id,
  });
  let mailed = false;
  if (email) {
    try {
      await sendMail(env, `⏰ ${task.title}`, mailHtml(task, origin, reason));
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
  for (const n of results) {
    // claim first so an overlapping run can't double-send
    const claim = await env.DB.prepare('UPDATE notifications SET sent_at = ? WHERE id = ? AND sent_at IS NULL').bind(now.toISOString(), n.id).run();
    if (!claim.meta.changes) continue;
    const late = now.getTime() - new Date(n.fire_at).getTime() > 3 * 3600 * 1000;
    if (late) continue; // skip anything hours late (e.g. after downtime)
    const task = await getTask(env, n.task_id);
    if (task) await notifyTask(env, task, { email: !!n.email, reason: 'Erinnerung' });
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
