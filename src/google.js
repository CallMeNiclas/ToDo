// Google: sign-in (OpenID), Calendar (read-only) and Gmail (send to yourself).
import { getSetting, setSetting } from './tasks.js';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

export function googleAuthUrl(env, origin, state, { consent }) {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: origin + '/auth/callback',
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    login_hint: env.OWNER_EMAIL,
  });
  if (consent) p.set('prompt', 'consent');
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

export async function exchangeCode(env, origin, code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: origin + '/auth/callback',
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Google token exchange failed: ' + (data.error_description || data.error));
  // id_token comes straight from Google over TLS, so decoding without signature check is acceptable here
  const payload = JSON.parse(atob(data.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return { tokens: data, email: String(payload.email || '').toLowerCase(), verified: payload.email_verified === true };
}

export async function storeTokens(env, tokens) {
  if (tokens.refresh_token) await setSetting(env, 'google_refresh_token', tokens.refresh_token);
  if (tokens.scope) await setSetting(env, 'google_scopes', tokens.scope);
  if (tokens.access_token) {
    await setSetting(env, 'google_access_token', JSON.stringify({ token: tokens.access_token, exp: Date.now() + (tokens.expires_in - 60) * 1000 }));
  }
}

export class GoogleNotConnected extends Error {}

async function accessToken(env) {
  const cached = await getSetting(env, 'google_access_token');
  if (cached) {
    const c = JSON.parse(cached);
    if (c.exp > Date.now()) return c.token;
  }
  const refresh = await getSetting(env, 'google_refresh_token');
  if (!refresh) throw new GoogleNotConnected('Google ist nicht verbunden');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      await env.DB.prepare("DELETE FROM settings WHERE key IN ('google_refresh_token','google_access_token')").run();
      throw new GoogleNotConnected('Google-Verbindung abgelaufen – bitte neu anmelden');
    }
    throw new Error('Google token refresh failed: ' + (data.error_description || data.error));
  }
  await storeTokens(env, data);
  return data.access_token;
}

async function gfetch(env, url, init = {}) {
  const token = await accessToken(env);
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Event colours as shown in the current Google Calendar UI (colorId -> hex)
const EVENT_COLORS = {
  1: '#7986cb', // Lavendel
  2: '#33b679', // Salbei
  3: '#8e24aa', // Weintraube
  4: '#e67c73', // Flamingo
  5: '#f6bf26', // Banane
  6: '#f4511e', // Mandarine
  7: '#039be5', // Pfau
  8: '#616161', // Graphit
  9: '#3f51b5', // Blaubeere
  10: '#0b8043', // Basilikum
  11: '#d50000', // Tomate
};

/**
 * Events from all calendars that are switched on in Google Calendar.
 * from/to: ISO instants. Returns [{id,title,start,end,allDay,color,calendar,location,url}]
 */
export async function listEvents(env, fromIso, toIso) {
  const list = await gfetch(env, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader');
  const cals = (list.items || []).filter((c) => c.selected || c.primary);
  const all = await Promise.all(cals.map(async (cal) => {
    const p = new URLSearchParams({ timeMin: fromIso, timeMax: toIso, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    try {
      const data = await gfetch(env, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${p}`);
      return (data.items || [])
        .filter((e) => e.status !== 'cancelled')
        .filter((e) => !(e.attendees || []).some((a) => a.self && a.responseStatus === 'declined'))
        .map((e) => ({
          id: e.id,
          title: e.summary || '(ohne Titel)',
          allDay: !!e.start.date,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          color: EVENT_COLORS[e.colorId] || cal.backgroundColor || '#039be5',
          calendar: cal.summaryOverride || cal.summary,
          location: e.location || '',
          url: e.htmlLink,
        }));
    } catch {
      return [];
    }
  }));
  return all.flat().sort((a, b) => (a.start < b.start ? -1 : 1));
}

function b64urlUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sends an HTML mail from your Gmail account to yourself. */
export async function sendMail(env, subject, html) {
  const encSubject = '=?UTF-8?B?' + btoa(String.fromCharCode(...new TextEncoder().encode(subject))) + '?=';
  const raw = [
    `To: ${env.OWNER_EMAIL}`,
    `From: "NTD's" <${env.OWNER_EMAIL}>`,
    `Subject: ${encSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(String.fromCharCode(...new TextEncoder().encode(html))).replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');
  return gfetch(env, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64urlUtf8(raw) }),
  });
}
