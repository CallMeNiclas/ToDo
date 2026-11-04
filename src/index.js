import { OAuthProvider, AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { handleApi } from './api.js';
import { handleAuth, getSession, devLogin } from './auth.js';
import { handleMcp } from './mcp.js';
import { handleLocationHook, runDueNotifications } from './notify.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title, inner, status = 200, headers = new Headers()) {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#f6f7fb;--card:#fff;--fg:#0f172a;--muted:#64748b;--accent:#4f46e5;--line:#e2e8f0}
@media (prefers-color-scheme:dark){:root{--bg:#0b0d12;--card:#151821;--fg:#e6e8ee;--muted:#94a3b8;--line:#262b38;--accent:#818cf8}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px;max-width:420px;width:100%}
h1{font-size:20px;margin:0 0 8px}p{color:var(--muted)}.warn{color:#dc2626;font-weight:600}
.row{display:flex;gap:8px;margin-top:20px}button{flex:1;padding:11px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--fg);font:inherit;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
</style></head><body><div class="card">${inner}</div></body></html>`, { status, headers });
}

const SCOPES = ['tasks'];

// /authorize: the owner (signed in with Google) approves Claude's access.
async function authorize(request, env) {
  const oauth = env.OAUTH_PROVIDER;
  const session = await getSession(request, env);
  if (!session) {
    const u = new URL(request.url);
    return Response.redirect(`${u.origin}/auth/login?next=${encodeURIComponent(u.pathname + u.search)}`, 302);
  }
  try {
    if (request.method === 'GET') {
      const req = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(req);
      const consent = await oauth.beginConsent(req);
      return page('Zugriff erlauben', `
<h1>${esc(details.clientName)} Zugriff auf deine To-Dos geben?</h1>
<p>${details.clientDomain ? `Herausgeber: <strong>${esc(details.clientDomain)}</strong>.` : 'Diese App hat sich selbst registriert, ihr Name ist nicht geprüft.'}
Der Zugang wird an <strong>${esc(details.redirectHost)}</strong> gesendet.</p>
${details.redirectIsLoopback ? '<p class="warn">Der Zugang geht an ein Programm auf deinem Computer. Nur fortfahren, wenn du das gerade selbst gestartet hast.</p>' : ''}
<p>Erlaubt: Aufgaben, Projekte und Orte lesen und ändern, Kalendertermine lesen.</p>
<form method="post"><input type="hidden" name="handle" value="${esc(consent.handle)}">
<div class="row"><button name="decision" value="deny">Ablehnen</button><button class="primary" name="decision" value="approve">Erlauben</button></div></form>`, 200, consent.headers);
    }
    if (request.method === 'POST') {
      const form = await request.formData();
      const handle = String(form.get('handle'));
      if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(request, handle, { scope: SCOPES });
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: session.email,
        metadata: {},
        scope: approved.request.scope,
        props: { email: session.email },
      });
      approved.headers.set('Location', redirectTo);
      return new Response(null, { status: 302, headers: approved.headers });
    }
    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      const message = error instanceof AuthorizationError ? error.description : 'Diese App konnte nicht verifiziert werden.';
      return page('Fehler', `<h1>Autorisierung fehlgeschlagen</h1><p>${esc(message)}</p>`, 400);
    }
    throw error;
  }
}

const defaultHandler = {
  async fetch(request, env, ctx) {
    try {
      return await handleDefault(request, env, ctx);
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      const hint = /no such table/i.test(msg)
        ? 'Die Datenbank ist noch nicht eingerichtet (Migration fehlt).'
        : /invalid_client|unauthorized_client/i.test(msg)
          ? 'Client-ID oder Clientschlüssel stimmen nicht. Bitte in Cloudflare prüfen.'
          : '';
      if (new URL(request.url).pathname.startsWith('/api/')) return Response.json({ error: msg }, { status: 500 });
      return page('Fehler', `<h1>Da ist etwas schiefgelaufen</h1>${hint ? `<p><b>${esc(hint)}</b></p>` : ''}<p>Technische Meldung:</p><pre style="white-space:pre-wrap;font-size:13px">${esc(msg)}</pre><div class="row"><a href="/"><button class="primary">Erneut versuchen</button></a></div>`, 500);
    }
  },
};

async function handleDefault(request, env) {
  {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/authorize') return authorize(request, env);
    if (p.startsWith('/auth/')) {
      if (p === '/auth/dev') return (await devLogin(request, env)) || new Response('Not found', { status: 404 });
      return handleAuth(request, env);
    }
    if (p.startsWith('/hooks/location')) return handleLocationHook(request, env);
    if (p.startsWith('/api/')) {
      // CSRF: mutating API calls must come from our own origin
      if (request.method !== 'GET') {
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin) return Response.json({ error: 'bad origin' }, { status: 403 });
      }
      if (!(await getSession(request, env))) return Response.json({ error: 'unauthorized' }, { status: 401 });
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
}

const mcpHandler = {
  async fetch(request, env, ctx) {
    if (ctx.props?.email !== env.OWNER_EMAIL.toLowerCase()) return new Response('Forbidden', { status: 403 });
    return handleMcp(request, env);
  },
};

const providers = new Map();
function provider(origin) {
  if (!providers.has(origin)) {
    providers.set(origin, new OAuthProvider({
      apiRoute: '/mcp',
      apiHandler: mcpHandler,
      defaultHandler,
      authorizeEndpoint: '/authorize',
      tokenEndpoint: '/oauth/token',
      clientRegistrationEndpoint: '/oauth/register',
      scopesSupported: SCOPES,
      requiredScopes: SCOPES,
      clientIdMetadataDocumentEnabled: true,
      resourceMetadata: { resource: origin + '/mcp', authorization_servers: [origin] },
    }));
  }
  return providers.get(origin);
}

export default {
  fetch(request, env, ctx) {
    return provider(new URL(request.url).origin).fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDueNotifications(env));
  },
};
