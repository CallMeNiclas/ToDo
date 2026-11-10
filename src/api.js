// REST API for the web app. Every route requires the owner session.
import * as T from './tasks.js';
import { listEvents, GoogleNotConnected } from './google.js';
import { getVapid, pushAll } from './notify.js';
import { localNow, addDays, zonedToUtc } from './time.js';
import { b64url } from './push.js';
import { computeMode, setMode, setHoliday } from './mode.js';
import { activeFocus, focusView, startFocus, pauseFocus, stopFocus, extendFocus, setFocusNote, focusHistory } from './focus.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;
  const body = method === 'GET' || method === 'DELETE' ? {} : await request.json().catch(() => ({}));
  const m = (re) => path.match(re);
  let r;

  // remember public origin for links in mails
  if (!globalThis.__originSaved) {
    globalThis.__originSaved = true;
    if ((await T.getSetting(env, 'origin')) !== url.origin) await T.setSetting(env, 'origin', url.origin);
  }

  try {
    if (path === '/bootstrap' && method === 'GET') {
      const today = localNow(env.TIMEZONE).date;
      const startOfToday = zonedToUtc(today, '00:00', env.TIMEZONE).toISOString();
      // one round trip to D1 for everything the app needs to start
      const db = env.DB;
      const [rProjects, rTasks, rPlaces, rKv, rDone, rFocus] = await db.batch([
        db.prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY sort, created_at'),
        db.prepare('SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY sort, created_at'),
        db.prepare('SELECT * FROM places ORDER BY name'),
        db.prepare("SELECT key, value FROM settings WHERE key LIKE 'u.%' OR key IN ('google_refresh_token', 'vapid', 'holiday', 'mode_override')"),
        db.prepare('SELECT COUNT(*) AS n FROM completions WHERE completed_at >= ?').bind(startOfToday),
        db.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'),
      ]);
      const projects = rProjects.results;
      const tasks = rTasks.results.map(T.rowToTask);
      const places = rPlaces.results;
      const sv = Object.fromEntries(rKv.results.map((r) => [r.key, r.value]));
      const settings = T.userSettingsFrom(rKv.results);
      const doneToday = rDone.results[0]?.n || 0;
      const vapid = sv.vapid ? JSON.parse(sv.vapid) : await getVapid(env);
      const mode = await computeMode(env, new Date(), { settings, holiday: sv.holiday, override: sv.mode_override });
      const focus = focusView(rFocus.results[0] || null);
      return json({
        today, timezone: env.TIMEZONE, email: env.OWNER_EMAIL, projects, tasks, places, settings,
        doneToday, vapidPublicKey: vapid.publicKey, mode, focus,
        googleConnected: !!sv.google_refresh_token,
      });
    }
    if (path === '/tasks' && method === 'GET') return json({ tasks: await T.listOpenTasks(env), today: localNow(env.TIMEZONE).date });
    if (path === '/tasks/completed' && method === 'GET') return json({ tasks: await T.listCompleted(env, Math.min(200, +url.searchParams.get('limit') || 50)) });
    if (path === '/tasks' && method === 'POST') return json(await T.createTask(env, body), 201);
    if ((r = m(/^\/tasks\/([\w-]+)$/))) {
      if (method === 'GET') return json(await T.getTask(env, r[1]));
      if (method === 'PATCH') return json(await T.updateTask(env, r[1], body));
      if (method === 'DELETE') return json(await T.deleteTask(env, r[1]));
    }
    if ((r = m(/^\/tasks\/([\w-]+)\/complete$/)) && method === 'POST') return json(await T.completeTask(env, r[1]));
    if ((r = m(/^\/tasks\/([\w-]+)\/uncomplete$/)) && method === 'POST') return json(await T.uncompleteTask(env, r[1]));

    if (path === '/projects' && method === 'GET') return json(await T.listProjects(env));
    if (path === '/projects' && method === 'POST') return json(await T.createProject(env, body), 201);
    if ((r = m(/^\/projects\/([\w-]+)$/))) {
      if (method === 'PATCH') return json(await T.updateProject(env, r[1], body));
      if (method === 'DELETE') return json(await T.deleteProject(env, r[1]));
    }

    if (path === '/places' && method === 'POST') return json(await T.createPlace(env, body), 201);
    if ((r = m(/^\/places\/([\w-]+)$/)) && method === 'DELETE') return json(await T.deletePlace(env, r[1]));

    if (path === '/settings' && method === 'PATCH') return json(await T.updateUserSettings(env, body));
    if (path === '/location-token' && method === 'GET') {
      const token = await T.ensureSetting(env, 'location_token', () => b64url(crypto.getRandomValues(new Uint8Array(24))));
      return json({ token, url: url.origin + '/hooks/location' });
    }
    if (path === '/location-token' && method === 'POST') {
      const token = b64url(crypto.getRandomValues(new Uint8Array(24)));
      await T.setSetting(env, 'location_token', token);
      return json({ token, url: url.origin + '/hooks/location' });
    }

    if (path === '/focus' && method === 'GET') return json({ focus: await activeFocus(env) });
    if (path === '/focus/start' && method === 'POST') return json({ focus: await startFocus(env, body) });
    if (path === '/focus/pause' && method === 'POST') return json({ focus: await pauseFocus(env, true) });
    if (path === '/focus/resume' && method === 'POST') return json({ focus: await pauseFocus(env, false) });
    if (path === '/focus/extend' && method === 'POST') return json({ focus: await extendFocus(env, body.minutes || 5) });
    if (path === '/focus/stop' && method === 'POST') return json({ stopped: await stopFocus(env, { note: body.note }), focus: null });
    if (path === '/focus/note' && method === 'POST') return json({ focus: await setFocusNote(env, body.note) });
    if (path === '/focus/history' && method === 'GET') return json({ sessions: await focusHistory(env, +url.searchParams.get('limit') || 100) });
    if (path === '/mode' && method === 'GET') return json(await computeMode(env));
    if (path === '/mode' && method === 'POST') return json(await setMode(env, body.mode));
    if (path === '/holiday' && method === 'POST') return json(await setHoliday(env, body));
    if (path === '/stats/completions' && method === 'GET') {
      // completions per local day for the last N days
      const days = Math.min(90, +url.searchParams.get('days') || 7);
      const today = localNow(env.TIMEZONE).date;
      const from = addDays(today, -(days - 1));
      const { results } = await env.DB.prepare('SELECT completed_at FROM completions WHERE completed_at >= ?').bind(zonedToUtc(from, '00:00', env.TIMEZONE).toISOString()).all();
      const counts = {};
      for (let i = 0; i < days; i++) counts[addDays(from, i)] = 0;
      for (const r of results) { const d = localNow(env.TIMEZONE, new Date(r.completed_at)).date; if (d in counts) counts[d]++; }
      return json({ today, counts });
    }

    if (path === '/calendar' && method === 'GET') {
      const from = url.searchParams.get('from') || localNow(env.TIMEZONE).date;
      const to = url.searchParams.get('to') || addDays(from, 1);
      try {
        const events = await listEvents(env, zonedToUtc(from, '00:00', env.TIMEZONE).toISOString(), zonedToUtc(to, '00:00', env.TIMEZONE).toISOString());
        return json({ connected: true, events });
      } catch (e) {
        if (e instanceof GoogleNotConnected) return json({ connected: false, events: [], error: e.message });
        return json({ connected: true, events: [], error: e.message });
      }
    }

    if (path === '/push/subscribe' && method === 'POST') {
      const { endpoint, keys, device } = body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) throw new T.InputError('Ungültiges Abo');
      await env.DB.prepare(`INSERT INTO push_subscriptions (endpoint, p256dh, auth, device) VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`)
        .bind(endpoint, keys.p256dh, keys.auth, String(device || '').slice(0, 80)).run();
      return json({ ok: true });
    }
    if (path === '/push/unsubscribe' && method === 'POST') {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint || '').run();
      return json({ ok: true });
    }
    if (path === '/push/devices' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT device, created_at FROM push_subscriptions ORDER BY created_at').all();
      return json(results);
    }
    if (path === '/push/test' && method === 'POST') {
      return json(await pushAll(env, { title: '🔔 To-Do: Test-Benachrichtigung', body: 'Heute · Push funktioniert ✅', tag: 'test', url: '/' }));
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof T.InputError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Serverfehler: ' + e.message }, 500);
  }
}
