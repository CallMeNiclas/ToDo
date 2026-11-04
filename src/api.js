// REST API for the web app. Every route requires the owner session.
import * as T from './tasks.js';
import { listEvents, GoogleNotConnected } from './google.js';
import { getVapid, pushAll } from './notify.js';
import { localNow, addDays, zonedToUtc } from './time.js';
import { b64url } from './push.js';
import { healthSummary } from './health.js';
import { computeMode, setMode, setHoliday } from './mode.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;
  const body = method === 'GET' || method === 'DELETE' ? {} : await request.json().catch(() => ({}));
  const m = (re) => path.match(re);
  let r;

  // remember public origin for links in mails
  if ((await T.getSetting(env, 'origin')) !== url.origin) await T.setSetting(env, 'origin', url.origin);

  try {
    if (path === '/bootstrap' && method === 'GET') {
      const today = localNow(env.TIMEZONE).date;
      const startOfToday = zonedToUtc(today, '00:00', env.TIMEZONE).toISOString();
      const [projects, tasks, places, settings, doneToday, vapid] = await Promise.all([
        T.listProjects(env), T.listOpenTasks(env), T.listPlaces(env), T.getUserSettings(env),
        T.completionsSince(env, startOfToday), getVapid(env),
      ]);
      return json({
        today, timezone: env.TIMEZONE, email: env.OWNER_EMAIL, projects, tasks, places, settings,
        doneToday, vapidPublicKey: vapid.publicKey, mode: await computeMode(env),
        logos: Object.fromEntries(await Promise.all(['work', 'private', 'holiday'].map(async (m) => [m, (await T.getSetting(env, 'logo_v_' + m)) || null]))),
        googleConnected: !!(await T.getSetting(env, 'google_refresh_token')),
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

    if (path === '/mode' && method === 'GET') return json(await computeMode(env));
    if (path === '/mode' && method === 'POST') return json(await setMode(env, body.mode));
    if (path === '/holiday' && method === 'POST') return json(await setHoliday(env, body));
    if ((r = m(/^\/logo\/(work|private|holiday)$/))) {
      const key = 'logo_' + r[1];
      if (method === 'GET') {
        const v = await T.getSetting(env, key);
        if (!v) return new Response('not found', { status: 404 });
        const [, type, b64] = v.match(/^data:([^;]+);base64,(.*)$/) || [];
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return new Response(bin, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable' } });
      }
      if (method === 'POST') {
        const d = String(body.dataUrl || '');
        if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(d) || d.length > 700000) throw new T.InputError('Bild als PNG/JPG/WebP, max. ca. 500 KB');
        await T.setSetting(env, key, d);
        const v = Date.now().toString(36);
        await T.setSetting(env, 'logo_v_' + r[1], v);
        return json({ ok: true, v });
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM settings WHERE key IN (?, ?)').bind(key, 'logo_v_' + r[1]).run();
        return json({ ok: true });
      }
    }
    if (path === '/health' && method === 'GET') return json(await healthSummary(env, +url.searchParams.get('days') || 14));
    if (path === '/health-token' && (method === 'GET' || method === 'POST')) {
      const token = method === 'POST'
        ? await (async () => { const t = b64url(crypto.getRandomValues(new Uint8Array(24))); await T.setSetting(env, 'health_token', t); return t; })()
        : await T.ensureSetting(env, 'health_token', () => b64url(crypto.getRandomValues(new Uint8Array(24))));
      return json({ token, url: `${url.origin}/hooks/health?token=${token}` });
    }
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
      return json(await pushAll(env, { title: 'Test-Benachrichtigung', body: 'Push funktioniert ✅', tag: 'test', url: '/' }));
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof T.InputError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Serverfehler: ' + e.message }, 500);
  }
}
