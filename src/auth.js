// Owner-only session: Google sign-in, then an HMAC-signed cookie.
import { ensureSetting } from './tasks.js';
import { googleAuthUrl, exchangeCode, storeTokens } from './google.js';
import { b64url, unb64url } from './push.js';
import { getSetting } from './tasks.js';

const COOKIE = 'todo_session';
const MAX_AGE = 60 * 24 * 3600; // 60 days
const enc = new TextEncoder();

async function hmacKey(env) {
  const secret = await ensureSetting(env, 'session_secret', () => b64url(crypto.getRandomValues(new Uint8Array(32))));
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

async function verify(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), unb64url(sig), enc.encode(body));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookieAttrs(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

/** Returns {email} for a valid owner session, else null. */
export async function getSession(request, env) {
  const s = await verify(env, getCookie(request, COOKIE));
  if (!s || s.email !== env.OWNER_EMAIL.toLowerCase()) return null;
  return s;
}

function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (url.pathname === '/auth/login') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return new Response('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlen. Siehe SETUP.md.', { status: 500 });
    }
    const state = b64url(crypto.getRandomValues(new Uint8Array(18)));
    const next = safeNext(url.searchParams.get('next'));
    const hasRefresh = !!(await getSetting(env, 'google_refresh_token'));
    const headers = new Headers({ Location: googleAuthUrl(env, origin, state, { consent: !hasRefresh || url.searchParams.has('reconnect') }) });
    headers.append('Set-Cookie', `todo_oauth_state=${state}|${encodeURIComponent(next)}; Max-Age=600${cookieAttrs(request)}`);
    return new Response(null, { status: 302, headers });
  }

  if (url.pathname === '/auth/callback') {
    const [state, nextEnc] = (getCookie(request, 'todo_oauth_state') || '').split('|');
    if (!state || state !== url.searchParams.get('state')) return new Response('Ungültiger Login-Status. Bitte erneut versuchen.', { status: 400 });
    if (url.searchParams.get('error')) return new Response('Login abgebrochen: ' + url.searchParams.get('error'), { status: 400 });
    const { tokens, email, verified } = await exchangeCode(env, origin, url.searchParams.get('code'));
    if (!verified || email !== env.OWNER_EMAIL.toLowerCase()) {
      return new Response('Kein Zugriff für ' + email, { status: 403 });
    }
    await storeTokens(env, tokens);
    const token = await sign(env, { email, exp: Date.now() + MAX_AGE * 1000 });
    const headers = new Headers({ Location: safeNext(decodeURIComponent(nextEnc || '/')) });
    headers.append('Set-Cookie', `${COOKIE}=${token}; Max-Age=${MAX_AGE}${cookieAttrs(request)}`);
    headers.append('Set-Cookie', `todo_oauth_state=; Max-Age=0${cookieAttrs(request)}`);
    return new Response(null, { status: 302, headers });
  }

  if (url.pathname === '/auth/logout') {
    const headers = new Headers({ Location: '/' });
    headers.append('Set-Cookie', `${COOKIE}=; Max-Age=0${cookieAttrs(request)}`);
    return new Response(null, { status: 302, headers });
  }

  return new Response('Not found', { status: 404 });
}

/** For local development only: `wrangler dev` with DEV_LOGIN=1 lets you sign in without Google. */
export async function devLogin(request, env) {
  if (env.DEV_LOGIN !== '1' || !['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)) return null;
  const token = await sign(env, { email: env.OWNER_EMAIL.toLowerCase(), exp: Date.now() + MAX_AGE * 1000 });
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', `${COOKIE}=${token}; Max-Age=${MAX_AGE}${cookieAttrs(request)}`);
  return new Response(null, { status: 302, headers });
}
