import { parseQuickAdd, fmtDuration, relDate, recurrenceLabel, addDays, isoWeekday } from './parse.js';

// ---------------------------------------------------------------- state
const S = {
  tasks: [], projects: [], places: [], settings: {}, today: '', doneToday: 0,
  google: false, vapid: '', email: '', cal: new Map(), route: { name: 'today' }, openId: null,
};
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const WD_LONG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WD_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ---------------------------------------------------------------- icons
const P = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  today: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><text x="12" y="19" text-anchor="middle" font-size="8" font-weight="700" stroke="none" fill="currentColor">{d}</text>',
  week: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  upcoming: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18M10 16h6M13 13l3 3-3 3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.67-.8a.5.5 0 0 1 .67.47v10.67a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  sub: '<path d="M3 5h12M3 12h12M3 19h12M19 5v14"/>',
  notes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
  grid: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
};
// ---------------------------------------------------------------- view symbols (filled, colored)
const VI = {
  dashboard: ['#0A84FF', '<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2" opacity=".7"/><rect x="3" y="13" width="8" height="8" rx="2.2" opacity=".7"/><rect x="13" y="13" width="8" height="8" rx="2.2"/>'],
  today: ['#FF9F0A', '<circle cx="12" cy="12" r="5"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/></g>'],
  week: ['#FF3B30', '<rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><rect x="3" y="4.5" width="18" height="5" rx="2" fill="#fff" opacity=".28"/><g fill="#fff"><circle cx="8" cy="13.5" r="1.2"/><circle cx="12" cy="13.5" r="1.2"/><circle cx="16" cy="13.5" r="1.2"/><circle cx="8" cy="17.3" r="1.2"/><circle cx="12" cy="17.3" r="1.2"/></g><rect x="7" y="2.5" width="2" height="4" rx="1"/><rect x="15" y="2.5" width="2" height="4" rx="1"/>'],
  upcoming: ['#2FA39A', '<path d="M12 3 2.8 7.7 12 12.4l9.2-4.7z"/><path d="M4.6 11.2 2.8 12.1 12 16.8l9.2-4.7-1.8-.9L12 15z" opacity=".75"/><path d="M4.6 15.6 2.8 16.5 12 21.2l9.2-4.7-1.8-.9L12 19.4z" opacity=".5"/>'],
  inbox: ['#0A84FF', '<rect x="3" y="3.5" width="18" height="17" rx="4"/><path d="M3 13.5h5.2l1.3 2.3h5l1.3-2.3H21V17a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17z" fill="#fff" opacity=".9"/>'],
  completed: ['#34C759', '<rect x="4" y="2.5" width="15" height="19" rx="3"/><rect x="4" y="2.5" width="3.2" height="19" rx="1.5" fill="#000" opacity=".12"/><path d="M8.8 12.3l2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
  focus: ['#AF52DE', '<circle cx="12" cy="13.2" r="8.6"/><rect x="9.5" y="1.6" width="5" height="2.6" rx="1.3"/><path d="M12 8.6v4.8l3 1.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
  search: ['#8E8E93', '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'],
  settings: ['#8E8E93', '<path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/>'],
  label: ['#8E8E93', '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.6" fill="#fff"/>'],
};
function viewIcon(name, cls = 'vi') {
  const v = VI[name];
  return v ? `<svg class="${cls}" viewBox="0 0 24 24" style="color:${v[0]}" fill="currentColor" stroke="none" aria-hidden="true">${v[1]}</svg>` : '';
}
/** project symbol: ring in the project color, like a progress circle */
function projectIcon(p, cls = 'vi') {
  // main projects (areas) get a cube, normal projects the progress ring
  if (p?.is_main) return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" style="color:${esc(p.color || '#8E8E93')}"><path d="M12 2.8 20.2 7.2v9.6L12 21.2 3.8 16.8V7.2z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3.8 7.2 12 11.6l8.2-4.4M12 11.6v9.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" style="color:${esc(p?.color || '#8E8E93')}"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8H12z" fill="currentColor" stroke="none"/></svg>`;
}
const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${P[name].replace('{d}', S.today ? +S.today.slice(8, 10) : '')}</svg>`;

// ---------------------------------------------------------------- offline storage
const store = {
  get(k, def) { try { const v = localStorage.getItem('todo.' + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('todo.' + k, JSON.stringify(v)); } catch { /* quota / private mode */ } },
};
class OfflineError extends Error {}
const net = { online: true, lastSync: store.get('lastSync', null), syncing: false };
let queue = store.get('queue', []);
const saveQueue = () => store.set('queue', queue);
const newId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

function setOnline(on) {
  if (net.online !== on) { net.online = on; renderSync(); }
}

// ---------------------------------------------------------------- api
// 502/503/504 come from Cloudflare itself (worker briefly unavailable), not from our code
const TRANSIENT = new Set([502, 503, 504]);
// changes in flight: a refresh that overlaps one would bring back the old state (e.g. a just-checked task)
const mut = { inflight: 0, seq: 0 };
async function api(path, opts = {}) {
  if ((opts.method || 'GET') === 'GET') return apiRaw(path, opts);
  mut.inflight++; mut.seq++;
  try { return await apiRaw(path, opts); } finally { mut.inflight--; mut.seq++; }
}
async function apiRaw(path, { method = 'GET', body } = {}) {
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch('/api' + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
        // a hanging request must not block all further refreshes
        signal: AbortSignal.timeout?.(method === 'GET' ? 15000 : 30000),
      });
    } catch {
      res = null;
    }
    if (res && !TRANSIENT.has(res.status)) break;
    if (attempt >= 2) {
      // still unavailable: behave like offline (cached data, queued changes)
      setOnline(false);
      throw new OfflineError(res ? 'Server kurz nicht erreichbar' : 'Keine Verbindung');
    }
    await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
  }
  setOnline(true);
  if (res.status === 401) { showLogin(); throw new Error('Nicht angemeldet'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
  return data;
}

function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
}

function applyBootstrap(b) {
  Object.assign(S, {
    tasks: b.tasks, projects: b.projects, places: b.places, settings: b.settings, today: b.today,
    doneToday: b.doneToday, google: b.googleConnected, vapid: b.vapidPublicKey, email: b.email,
    mode: b.mode || S.mode,
    focus: b.focus !== undefined ? b.focus : S.focus, focusAt: Date.now(),
  });
  renderMode();
  renderFocusPill();
  // tasks created offline that are not on the server yet
  for (const q of queue) if (q.op === 'create' && !S.tasks.some((t) => t.id === q.id)) S.tasks.push(q.task);
  for (const q of queue) if (q.op === 'complete') S.tasks = S.tasks.filter((t) => t.id !== q.id && t.parent_id !== q.id);
}

// signature of the server state without the ticking focus timer – unchanged data means no re-render
let lastSig = '';
const sigOf = (b) => JSON.stringify({ ...b, focus: b.focus ? [b.focus.id, b.focus.paused, b.focus.planned_min] : null });

function markSynced(b, sig = sigOf(b)) {
  net.lastSync = new Date().toISOString();
  store.set('lastSync', net.lastSync);
  if (sig !== lastSig) store.set('bootstrap', b);
  lastSig = sig;
  renderSync();
}

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function boot() {
  // instant start: show the last known state right away, fetch fresh data in the background
  const cached = store.get('bootstrap', null);
  if (cached && store.get('lastSync', null)) {
    applyBootstrap(cached);
    S.today = localToday();
    if (cached.today !== S.today) S.cal.clear();
    lastSig = sigOf(cached);
    start();
    refresh();
    return;
  }
  try {
    const b = await api('/bootstrap');
    applyBootstrap(b);
    markSynced(b);
  } catch (e) {
    if (!$('#login').hidden) return;
    const cached = store.get('bootstrap', null);
    if (e instanceof OfflineError && cached) {
      applyBootstrap(cached);
      S.today = localToday(); // the cached "today" may be stale
    } else {
      document.body.innerHTML = `<div class="login"><div class="login-card"><h1>${e instanceof OfflineError ? 'Offline' : 'Fehler'}</h1><p>${esc(e instanceof OfflineError ? 'Server nicht erreichbar und noch keine gespeicherten Daten auf diesem Gerät.' : e.message)}</p><a class="btn" href="/">Neu laden</a></div></div>`;
      return;
    }
  }
  start();
}

function start() {
  if (!/^#\/task\//.test(location.hash)) history.replaceState(null, '', '#/today');
  $('#login').hidden = true;
  $('#app').hidden = false;
  for (const [k, v] of Object.entries(store.get('cal', {}))) S.cal.set(k, { at: 0, data: v });
  setupUpdates();
  bindGlobal();
  bindDnd();
  bindTimelineDrag();
  route();
  renderSync();
  if (queue.length && net.online) sync();
  scheduleAutoRefresh();
  setInterval(() => { if (!net.online && document.visibilityState === 'visible') refresh(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refresh(); tickNow(); } });
  // desktop app window: clicking back into it does not change visibility – refresh on focus too
  let lastFocusRefresh = 0;
  window.addEventListener('focus', () => { if (Date.now() - lastFocusRefresh > 5000) { lastFocusRefresh = Date.now(); refresh(); tickNow(); } });
  setInterval(tickNow, 30000);
  // due pop-ups: check every 15 s, only while the app is in front
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') activeSince = Date.now(); });
  setInterval(checkDue, 15000);
  const showRunningFocus = () => { if (S.focus && !document.querySelector('.modal.open')) openFocusPanel(); };
  setTimeout(showRunningFocus, 600);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(showRunningFocus, 600); });
  setTimeout(checkDue, 3000);
  window.addEventListener('online', () => refresh());
  window.addEventListener('offline', () => setOnline(false));
}

// ---------------------------------------------------------------- app updates
// iOS keeps the home-screen app in memory – "opening" it only resumes the old page, so new
// versions would never arrive. Check for a new version on every resume and reload when idle.
let updateReady = false;
function appIdle() {
  const a = document.activeElement;
  const typing = a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || a.isContentEditable);
  return !typing && !S.openId && !$('#quick-add')?.classList.contains('open') && !document.querySelector('.modal.open') && !net.syncing && !mut.inflight && !saveTimers.size;
}
function applyUpdate() {
  if (!updateReady) return;
  if (appIdle()) location.reload();
}
function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); applyUpdate(); } });
    setInterval(check, 30 * 60000);
  }).catch(() => {});
  // a new service worker took over (it activates right away) → its cache holds the new version
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing old to replace
    updateReady = true;
    applyUpdate();
    // otherwise as soon as the user is done (drawer closed, nothing typed)
    const timer = setInterval(() => { if (appIdle()) { clearInterval(timer); location.reload(); } }, 3000);
  });
}

// auto refresh: every 30 s during working hours (work schedule from the settings), otherwise every 60 s
function inWorkHours(d = new Date()) {
  const st = S.settings || {};
  const days = String(st.work_days || '1,2,3,4,5').split(',').map(Number);
  const wd = d.getDay() || 7;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return days.includes(wd) && hm >= (st.work_start || '08:15') && hm < (st.work_end || '18:15');
}
function scheduleAutoRefresh() {
  setTimeout(() => {
    if (document.visibilityState === 'visible') refresh();
    scheduleAutoRefresh();
  }, inWorkHours() ? 30000 : 60000);
}

// the red "now" line in the day plan moves on its own – data refreshes no longer redraw unchanged views
function tickNow() {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const today = localDateOf(now.toISOString());
  for (const tl of $$('.timeline[data-date], .tl-col[data-date]')) {
    if (tl.dataset.date !== today) continue;
    const startH = +tl.dataset.start, px = +tl.dataset.px, endH = +tl.dataset.end;
    if (min < startH * 60 || min > endH * 60) continue;
    let line = tl.querySelector('.now-line');
    if (!line) { line = document.createElement('div'); line.className = 'now-line'; tl.appendChild(line); }
    line.style.top = ((min - startH * 60) / 60) * px + 'px';
    for (const b of tl.querySelectorAll('.block[data-end]')) b.classList.toggle('past', +b.dataset.end <= min);
  }
  if (S.today && today !== S.today) refresh(); // midnight passed
}

let refreshing = null;
/** force: re-render even when nothing changed (manual "Aktualisieren") */
function refresh(opts) {
  if (refreshing) return refreshing;
  refreshing = doRefresh(opts).finally(() => { refreshing = null; });
  return refreshing;
}
async function doRefresh({ force = false } = {}) {
  try {
    if (queue.length) await sync({ silent: true });
    const seq = mut.seq;
    const b = await api('/bootstrap');
    if (mut.inflight || mut.seq !== seq) { setTimeout(refresh, 1500); return; } // stale – try again shortly
    const sig = sigOf(b);
    if (sig === lastSig && !queue.length && !force) {
      // nothing changed – only keep the focus timer exact, skip the full re-render
      S.focus = b.focus; S.focusAt = Date.now();
      markSynced(b, sig);
      return;
    }
    const dayChanged = b.today !== S.today;
    applyBootstrap(b);
    revalidateDue();
    markSynced(b, sig);
    if (dayChanged) S.cal.clear();
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!typing) { render(); if (S.openId) renderDrawer(); }
    else renderNav();
    return true;
  } catch { return false; /* offline – ignore */ }
}

/** "Aktualisieren" in the menu: fetch everything fresh (tasks, calendar) */
async function manualRefresh() {
  const btn = $('#refresh-btn');
  if (btn?.classList.contains('spin')) return;
  btn?.classList.add('spin');
  for (const v of S.cal.values()) v.at = 0;
  doneStatsAt = 0;
  if (refreshing) await refreshing;
  const ok = await refresh({ force: true });
  btn?.classList.remove('spin');
  renderSync();
  toast(ok ? 'Aktualisiert' : 'Server nicht erreichbar – gespeicherter Stand');
}

/** Sends queued offline changes to the server, in order. */
async function sync({ silent = false } = {}) {
  if (net.syncing || !queue.length) return;
  net.syncing = true;
  renderSync();
  let sent = 0;
  try {
    while (queue.length) {
      const q = queue[0];
      try {
        if (q.op === 'create') await api('/tasks', { method: 'POST', body: { ...q.input, id: q.id } });
        if (q.op === 'complete') await api(`/tasks/${q.id}/complete`, { method: 'POST' });
        sent++;
      } catch (e) {
        if (e instanceof OfflineError) break;
        toast(`Nicht synchronisiert: ${q.op === 'create' ? '„' + q.task.title + '“' : 'Abhaken'} – ${e.message}`);
      }
      queue.shift();
      saveQueue();
    }
  } finally {
    net.syncing = false;
    renderSync();
  }
  if (sent && !silent) { toast(`${sent} Offline-Änderung(en) synchronisiert`); refresh(); }
  else if (sent) toast(`${sent} Offline-Änderung(en) synchronisiert`);
}

function fmtSync(iso) {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const day = localDateOf(iso) === S.today ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ';
  return day + time;
}

function renderSync() {
  const el = $('#sync');
  if (!el) return;
  const n = queue.length;
  let cls, label, short, title;
  if (net.syncing) { cls = 'busy'; label = 'Synchronisiere …'; short = 'Sync …'; title = label; }
  else if (!net.online) { cls = 'off'; label = `Offline · Stand ${fmtSync(net.lastSync)}`; short = `Offline · ${fmtSync(net.lastSync)}`; title = `Keine Verbindung (Stand ${fmtSync(net.lastSync)}). Hinzufügen und Abhaken geht trotzdem – wird später übertragen.`; }
  else if (n) { cls = 'wait'; label = `${n} ausstehend`; short = `${n} ⏳`; title = 'Tippen zum Synchronisieren'; }
  else { cls = 'ok'; label = `Verbunden · ${fmtSync(net.lastSync)}`; short = `Sync ${fmtSync(net.lastSync)}`; title = `Verbunden · letzte Synchronisierung ${fmtSync(net.lastSync)}`; }
  if (n && !net.syncing && !net.online) { label += ` · ${n} ausstehend`; short += ` · ${n}`; }
  el.className = 'sync ' + cls;
  el.title = title;
  el.setAttribute('aria-label', title);
  el.innerHTML = `<span class="sync-dot"></span><span class="sync-label">${esc(label)}</span><span class="sync-short">${esc(short)}</span>`;
  const rt = $('#refresh-time');
  if (rt) rt.textContent = net.lastSync ? fmtSync(net.lastSync) : '';
}

// ---------------------------------------------------------------- derived
const open = () => S.tasks;
const byId = (id) => S.tasks.find((t) => t.id === id);
const project = (id) => S.projects.find((p) => p.id === id);
const byName = (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
const childProjects = (id) => S.projects.filter((p) => p.id !== 'inbox' && (p.parent_id || null) === id).sort(byName);
function mainOptions(selected, excludeId) {
  const mains = S.projects.filter((p) => p.is_main && p.id !== excludeId).sort(byName);
  return `<option value="">– keinem –</option>` + mains.map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
/** [{p, depth}] in tree order (without inbox) */
function projectTree(exclude) {
  const out = [];
  const walk = (pid, depth) => {
    for (const p of childProjects(pid)) {
      if (exclude && exclude.has(p.id)) continue;
      out.push({ p, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
/** id plus all sub-project ids */
function subtree(id) {
  const ids = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const p of S.projects) if (p.parent_id && ids.has(p.parent_id) && !ids.has(p.id)) { ids.add(p.id); grew = true; } }
  return ids;
}
function projectPath(id, sep = ' › ') {
  const parts = [];
  let p = project(id);
  for (let i = 0; p && i < 10; i++) { parts.unshift(p.name); p = p.parent_id ? project(p.parent_id) : null; }
  return parts.join(sep);
}
/** names the quick-add parser understands: plain names and paths ("Fundus7/To-Do's") */
const parseProjects = () => [...S.projects, ...S.projects.filter((p) => p.parent_id).map((p) => ({ id: p.id, name: projectPath(p.id, '/') }))];
function projectOptions(selected, { exclude, none } = {}) {
  const opts = [];
  if (none) opts.push(`<option value="">${esc(none)}</option>`);
  else { const ib = project('inbox'); if (ib) opts.push(`<option value="inbox" ${selected === 'inbox' ? 'selected' : ''}>${esc(ib.name)}</option>`); }
  for (const { p, depth } of projectTree(exclude)) {
    opts.push(`<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${'\u00a0\u00a0\u00a0'.repeat(depth)}${depth ? '↳ ' : ''}${esc(p.name)}</option>`);
  }
  return opts.join('');
}
let collapsed = store.get('collapsed', {});

// ---------------------------------------------------------------- focus modes
function ctxOf(pid) {
  let p = project(pid);
  for (let i = 0; p && i < 10; i++) { if (p.context) return p.context; p = p.parent_id ? project(p.parent_id) : null; }
  return null;
}
const curMode = () => S.mode?.mode || 'all';
const inScope = (t) => { const m = curMode(); if (m === 'all') return true; const c = ctxOf(t.project_id); return !c || c === m; };
const scoped = () => S.tasks.filter(inScope);
function isWorkEvent(e) {
  const colors = String(S.settings.work_colors || '').toLowerCase().split(',').filter(Boolean);
  if (colors.includes(String(e.color || '').toLowerCase())) return true;
  const kws = String(S.settings.work_keywords || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  const hay = `${e.title} ${e.location || ''}`.toLowerCase();
  return kws.some((k) => hay.includes(k));
}
const eventInScope = (e) => { const m = curMode(); return m === 'all' || (m === 'work' ? isWorkEvent(e) : !isWorkEvent(e)); };
const MODE_UI = {
  work: { label: 'Arbeit', emoji: '💼' },
  private: { label: 'Privat', emoji: '🏠' },
  all: { label: 'Alles', emoji: '🌐' },
  holiday: { label: 'Urlaub', emoji: '🌴' },
};
function modeKey() { return S.mode?.holidayActive ? 'holiday' : curMode(); }
function renderMode() {
  const k = modeKey();
  document.body.dataset.mode = k;
  const pill = $('#mode-pill');
  if (pill) {
    const ui = MODE_UI[k];
    const auto = S.mode?.source === 'schedule' ? ' · Zeitplan' : S.mode?.source === 'focus' ? ' · iPhone-Fokus' : '';
    pill.innerHTML = `<span class="mode-emoji">${ui.emoji}</span><span class="mode-label">${ui.label}</span>`;
    pill.title = `Modus: ${ui.label}${auto}`;
  }
}
function openModeMenu() {
  const m = S.mode || {};
  const wrap = document.createElement('div');
  wrap.className = 'modal open';
  const nextTxt = m.next ? `nächster Wechsel: ${MODE_UI[m.next.mode].label} um ${new Date(m.next.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${localDateOf(m.next.at) !== S.today ? ' (' + relDate(localDateOf(m.next.at), S.today) + ')' : ''}` : 'kein Zeitplan aktiv';
  const btn = (mode, extra = '') => `<button class="mode-opt${curMode() === mode && !m.holidayActive && m.source !== 'schedule' && m.source !== 'focus' ? ' on' : ''}" data-mode="${mode}">${MODE_UI[mode].emoji} <b>${MODE_UI[mode].label}</b>${extra}</button>`;
  wrap.innerHTML = `<div class="qa-card mode-card"><div style="font-weight:650;font-size:17px;padding:4px 6px 4px">Modus</div>
    <div class="muted" style="padding:0 6px 12px">Aktuell: ${MODE_UI[modeKey()].emoji} ${MODE_UI[modeKey()].label}${m.source === 'schedule' ? ' (Zeitplan)' : m.source === 'focus' ? ' (iPhone-Fokus)' : m.source === 'holiday' ? ` (bis ${m.holiday.to.split('-').reverse().join('.')})` : m.source === 'manual' ? ' (manuell)' : ''}</div>
    ${m.holidayActive ? '' : btn('work') + btn('private') + btn('all')}
    ${m.holidayActive ? '' : `<button class="mode-opt${m.source === 'schedule' || m.source === 'default' ? ' on' : ''}" data-mode="auto">⏱ <b>Automatisch</b><small>${esc(nextTxt)}</small></button>`}
    <button class="mode-opt" data-mode="holiday">🌴 <b>${m.holiday ? 'Urlaub bearbeiten / beenden' : 'Urlaub planen …'}</b>${m.holiday ? `<small>${m.holiday.from.split('-').reverse().join('.')} – ${m.holiday.to.split('-').reverse().join('.')}</small>` : ''}</button>
    <div class="qa-foot" style="margin-top:8px"><a class="btn sm ghost" href="#/settings" data-close>Einstellungen</a><div class="qa-btns"><button class="btn" data-close>Schließen</button></div></div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', async (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) return close();
    const o = e.target.closest('[data-mode]');
    if (!o) return;
    const mode = o.dataset.mode;
    close();
    if (offlineBlocked()) return;
    try {
      if (mode === 'holiday') {
        const h = m.holiday || {};
        const r = await dialog({ title: '🌴 Urlaub', fields: [{ name: 'from', label: 'Von', type: 'date', value: h.from || S.today }, { name: 'to', label: 'Bis (inklusive)', type: 'date', value: h.to || addDays(S.today, 7) }], ok: 'Speichern', danger: m.holiday ? 'Urlaub beenden' : undefined });
        if (!r) return;
        S.mode = await api('/holiday', { method: 'POST', body: r.__danger ? { clear: true } : r });
      } else {
        S.mode = await api('/mode', { method: 'POST', body: { mode } });
      }
      renderMode();
      render();
      toast(`Modus: ${MODE_UI[modeKey()].emoji} ${MODE_UI[modeKey()].label}`);
    } catch (err) { toast(err.message); }
  });
}
const endOfWeek = (d) => addDays(d, 7 - isoWeekday(d));
const mondayOf = (d) => addDays(d, 1 - isoWeekday(d));

function counts() {
  const t = S.today;
  const eow = endOfWeek(t);
  let overdue = 0, today = 0, week = 0, mins = 0;
  for (const x of scoped()) {
    if (!x.due_date) continue;
    if (x.due_date < t) overdue++;
    if (x.due_date === t) { today++; mins += x.duration_min || 0; }
    if (x.due_date <= eow) week++;
  }
  return { overdue, today, week, total: scoped().length, mins, inbox: scoped().filter((x) => x.project_id === 'inbox' && !x.parent_id).length };
}

function sortTasks(list) {
  return [...list].sort((a, b) =>
    (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
    (a.due_time || '99:99').localeCompare(b.due_time || '99:99') ||
    a.priority - b.priority || a.sort - b.sort || a.created_at.localeCompare(b.created_at));
}

function allLabels() {
  const m = new Map();
  for (const t of open()) for (const l of t.labels) m.set(l, (m.get(l) || 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
}

function fmtLongDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return `${WD_LONG[isoWeekday(d)]}, ${day}. ${MONTHS[m - 1]}${y !== +S.today.slice(0, 4) ? ' ' + y : ''}`;
}
function fmtShort(m) {
  if (m < 60) return m + ' Min.';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}:${String(r).padStart(2, '0')} Std.` : `${h} Std.`;
}
function fmtMins(m) {
  if (!m) return '0 Min.';
  return fmtDuration(m);
}

// ---------------------------------------------------------------- calendar
async function events(from, to) {
  const key = from + '_' + to;
  const c = S.cal.get(key);
  if (c && Date.now() - c.at < 3 * 60000) return c.data;
  if (c?.pending) return c.pending;
  const pending = api(`/calendar?from=${from}&to=${to}`).then((data) => {
    S.cal.set(key, { at: Date.now(), data });
    const saved = store.get('cal', {});
    saved[key] = data;
    const keys = Object.keys(saved);
    if (keys.length > 12) delete saved[keys[0]];
    store.set('cal', saved);
    return data;
  }).catch((e) => c?.data || { connected: S.google, events: [], error: e instanceof OfflineError ? '' : e.message, offline: e instanceof OfflineError });
  S.cal.set(key, { at: 0, pending, data: c?.data });
  return pending;
}
function cachedEvents(from, to) {
  return S.cal.get(from + '_' + to)?.data || null;
}
function localDateOf(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timeOf(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** events touching a given local date */
function eventsOn(evs, date) {
  return evs.filter(eventInScope).filter((e) => {
    if (e.allDay) return e.start <= date && e.end > date;
    const s = localDateOf(e.start);
    const en = localDateOf(new Date(new Date(e.end).getTime() - 1).toISOString());
    return s <= date && en >= date;
  });
}

// ---------------------------------------------------------------- router
function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, ...rest] = h.split('/');
  const arg = rest.join('/');
  if (name === 'task' && arg) return { name: 'task', id: arg };
  if (name === 'upcoming') return { name: 'week' }; // old view, merged into "Demnächst"
  if (['dashboard', 'today', 'week', 'inbox', 'completed', 'settings', 'focus'].includes(name)) return { name, arg };
  if (name === 'project' && arg) return { name, arg };
  if (name === 'label' && arg) return { name, arg };
  if (name === 'search') return { name, arg: arg || '' };
  return { name: 'today' };
}

function route() {
  const r = parseRoute();
  if (r.name === 'task') {
    // open detail over the current (or default) view
    if (!S.route || S.route.name === 'task') S.route = { name: 'today' };
    openTask(r.id, false);
    render();
    return;
  }
  S.route = r;
  if (S.openId) closeDrawer(false);
  render();
  $('#content').scrollTop = 0;
  window.scrollTo(0, 0);
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---------------------------------------------------------------- render
function render() {
  subCounts = null;
  renderNav();
  const r = S.route;
  $('#top-actions').innerHTML = '';
  $('#view-sub').textContent = '';
  const views = { dashboard: viewDashboard, today: viewToday, week: viewWeek, inbox: () => viewProject('inbox'), project: () => viewProject(r.arg), label: () => viewLabel(r.arg), search: () => viewSearch(r.arg), completed: viewCompleted, settings: viewSettings, focus: viewFocus };
  document.body.dataset.view = r.name;
  $('#mode-pill').hidden = !['dashboard', 'today'].includes(r.name);
  (views[r.name] || viewDashboard)();
  document.title = $('#view-title').textContent + ' · NTD’s';
  const c = counts();
  if ('setAppBadge' in navigator) {
    const n = c.today + c.overdue;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch?.(() => {});
  }
}

function renderNav() {
  const c = counts();
  const r = S.route;
  const active = (name, arg) => (r.name === name && (arg === undefined || r.arg === arg) ? ' active' : '');
  const item = (href, ic, label, count, cls = '', key = '') =>
    `<a href="${href}" class="nav-item${cls}" ${key}>${ic}<span>${esc(label)}</span>${count !== undefined && count !== '' ? `<span class="count">${count}</span>` : ''}</a>`;
  $('#nav-main').innerHTML =
    item('#/inbox', viewIcon('inbox'), 'Eingang', c.inbox || '', active('inbox')) +
    '<div class="nav-gap"></div>' +
    item('#/dashboard', viewIcon('dashboard'), 'Übersicht', '', active('dashboard')) +
    item('#/today', viewIcon('today'), 'Heute', c.today + c.overdue || '', active('today')).replace('class="count"', c.overdue ? 'class="count alert"' : 'class="count"') +
    item('#/week', viewIcon('week'), 'Demnächst', c.week || '', active('week')) +
    item('#/focus', viewIcon('focus'), 'Fokus', '', active('focus'));

  const perProject = new Map();
  for (const t of open()) if (!t.parent_id) perProject.set(t.project_id, (perProject.get(t.project_id) || 0) + 1);
  const hiddenUnder = (p) => { for (let q = p.parent_id && project(p.parent_id); q; q = q.parent_id && project(q.parent_id)) if (collapsed[q.id]) return true; return false; };
  $('#nav-projects').innerHTML = projectTree().filter(({ p }) => !hiddenUnder(p)).map(({ p, depth }) => {
    const hasKids = childProjects(p.id).length > 0;
    const n = hasKids && collapsed[p.id] ? [...subtree(p.id)].reduce((a, id) => a + (perProject.get(id) || 0), 0) : perProject.get(p.id) || 0;
    const toggle = hasKids
      ? `<button class="tree-toggle${collapsed[p.id] ? '' : ' open'}" data-toggle-project="${p.id}" aria-label="${collapsed[p.id] ? 'Aufklappen' : 'Zuklappen'}">${icon('right')}</button>`
      : '<span class="tree-toggle-space"></span>';
    return `<a href="#/project/${p.id}" class="nav-item${active('project', p.id)}" style="padding-left:${4 + depth * 18}px">${toggle}${projectIcon(p)}<span class="nav-name${p.is_main ? ' main' : ''}">${esc(p.name)}</span>${!p.parent_id && p.context ? `<span class="ctx-mark" title="${p.context === 'work' ? 'Arbeit' : 'Privat'}">${p.context === 'work' ? '💼' : '🏠'}</span>` : ''}<span class="count">${n || ''}</span><button class="icon-btn sm nav-edit" data-edit-project="${p.id}" aria-label="Projekt bearbeiten">${icon('more')}</button></a>`;
  }).join('') || '<div class="nav-item" style="color:var(--faint);cursor:default">Noch keine Projekte</div>';

  const labels = allLabels();
  $('#labels-head').hidden = !labels.length;
  $('#nav-labels').innerHTML = labels.map(([l, n]) =>
    `<a href="#/label/${encodeURIComponent(l)}" class="nav-item${active('label', l)}"><span class="hash">@</span><span>${esc(l)}</span><span class="count">${n}</span></a>`).join('');

  $$('#sidebar [data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r.name));

  $('#tabbar').innerHTML = tabConfig().map((k) => {
    const o = TAB_OPTIONS[k];
    const b = k === 'today' ? c.today + c.overdue : k === 'inbox' ? c.inbox : 0;
    return `<a href="#/${k}" class="${r.name === k ? 'active' : ''}">${icon(o.icon)}<span>${o.label}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`;
  }).join('') +
    `<a href="#" data-menu>${icon('menu')}<span>Mehr</span></a>`;
}

const TAB_OPTIONS = {
  dashboard: { label: 'Übersicht', icon: 'grid' },
  today: { label: 'Heute', icon: 'sun' },
  week: { label: 'Demnächst', icon: 'week' },
  inbox: { label: 'Eingang', icon: 'inbox' },
  search: { label: 'Suche', icon: 'search' },
  completed: { label: 'Erledigt', icon: 'done' },
  focus: { label: 'Fokus', icon: 'timer' },
};
const TAB_DEFAULT = ['dashboard', 'today', 'week', 'focus'];
function tabConfig() {
  const saved = store.get('tabs', TAB_DEFAULT);
  // removed views: fill the free place with "Fokus"
  const t = saved.map((k) => (k === 'upcoming' && !saved.includes('focus') ? 'focus' : k)).filter((k) => k in TAB_OPTIONS);
  return t.length ? t.slice(0, 4) : TAB_DEFAULT;
}
function renderTabSettings() {
  const box = $('#tab-settings');
  if (!box) return;
  const sel = tabConfig();
  const order = [...sel, ...Object.keys(TAB_OPTIONS).filter((k) => !sel.includes(k))];
  box.innerHTML = order.map((k) => {
    const on = sel.includes(k), i = sel.indexOf(k);
    return `<div class="dash-set-row${on ? '' : ' off'}">
      <label class="dlg-check" style="padding:0;flex:1"><input type="checkbox" ${on ? 'checked' : ''} data-act="tab-toggle" data-tab="${k}"><span><b>${TAB_OPTIONS[k].label}</b></span></label>
      ${on ? `<button class="icon-btn sm" data-act="tab-up" data-tab="${k}" ${i === 0 ? 'disabled' : ''} aria-label="Nach links"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg></button><button class="icon-btn sm" data-act="tab-down" data-tab="${k}" ${i === sel.length - 1 ? 'disabled' : ''} aria-label="Nach rechts"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>` : ''}
    </div>`;
  }).join('') + `<p class="muted small" style="margin-top:8px">${sel.length}/4 gewählt · „Mehr“ ist immer ganz rechts. Reihenfolge: oben = links.</p>`;
}

function setTitle(title, sub) {
  const r = S.route || {};
  const ic = r.name === 'project' ? projectIcon(project(r.arg), 'vi title-vi') : viewIcon(r.name, 'vi title-vi');
  $('#view-title').innerHTML = ic + `<span>${esc(title)}</span>`;
  $('#view-sub').textContent = sub || '';
}

function statsHtml() {
  const c = counts();
  const totalToday = c.today + c.overdue + S.doneToday;
  const pct = totalToday ? Math.round((S.doneToday / totalToday) * 100) : 0;
  const R = 17, L = 2 * Math.PI * R;
  return `<div class="stats">
    <a class="stat c1" href="#/today"><div class="ico">${icon('sun')}</div><div style="min-width:0"><div class="num">${c.today + c.overdue}</div><div class="lbl">Heute offen</div>${c.overdue ? `<div class="lbl alert">${c.overdue} überfällig</div>` : ''}</div></a>
    <a class="stat c2" href="#/week"><div class="ico">${icon('week')}</div><div style="min-width:0"><div class="num">${c.week}</div><div class="lbl">Demnächst (Woche)</div></div></a>
    <a class="stat c3" href="#/week"><div class="ico">${icon('layers')}</div><div style="min-width:0"><div class="num">${c.total}</div><div class="lbl">Insgesamt offen</div></div></a>
    <div class="stat"><svg class="ring" viewBox="0 0 42 42"><circle class="bg" cx="21" cy="21" r="${R}"/><circle class="fg" cx="21" cy="21" r="${R}" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - pct / 100)}"/></svg><div style="min-width:0"><div class="num">${S.doneToday}</div><div class="lbl">Heute erledigt</div>${totalToday ? `<div class="lbl">${pct}% geschafft</div>` : ''}</div></div>
  </div>`;
}

// ---------------------------------------------------------------- task row
function dueClass(t) {
  if (!t.due_date) return '';
  if (t.due_date < S.today) return 'overdue';
  if (t.due_date === S.today) return 'today';
  if (t.due_date === addDays(S.today, 1)) return 'tomorrow';
  return '';
}

function deadlineInfo(d) {
  const days = Math.round((Date.parse(d) - Date.parse(S.today)) / 86400000);
  const text = days < 0 ? `${-days} Tag${days === -1 ? '' : 'e'} drüber` : days === 0 ? 'Deadline heute' : days === 1 ? 'Deadline morgen' : days < 7 ? `Deadline ${relDate(d, S.today)}` : `Deadline ${+d.slice(8, 10)}.${+d.slice(5, 7)}.`;
  return { days, text, cls: days < 0 ? 'overdue' : days <= 2 ? 'soon' : '' };
}

// subtask counts, built once per render instead of scanning all tasks for every row
let subCounts = null;
function subCount(id) {
  if (!subCounts) { subCounts = new Map(); for (const x of S.tasks) if (x.parent_id) subCounts.set(x.parent_id, (subCounts.get(x.parent_id) || 0) + 1); }
  return subCounts.get(id) || 0;
}

function taskRow(t, { showProject = true, showDate = true, sub = false, showParent = true } = {}) {
  const meta = [];
  if (showDate && t.due_date) meta.push(`<span class="${dueClass(t)}">${icon('cal')}${relDate(t.due_date, S.today)}${t.due_time ? ' ' + t.due_time : ''}</span>`);
  else if (t.due_time) meta.push(`<span class="${dueClass(t)}">${icon('clock')}${t.due_time}</span>`);
  if (t.deadline) { const di = deadlineInfo(t.deadline); meta.push(`<span class="deadline ${di.cls}" title="Deadline ${esc(t.deadline)}">${icon('target')}${di.text}</span>`); }
  if (t.duration_min) meta.push(`<span>${icon('timer')}${fmtDuration(t.duration_min)}</span>`);
  if (t.recurrence) meta.push(`<span title="${esc(recurrenceLabel(t.recurrence))}">${icon('repeat')}</span>`);
  if (S.focus?.task_id === t.id) meta.push(`<span class="focus-on">${icon('timer')}Fokus läuft</span>`);
  const subs = subCount(t.id);
  if (subs) meta.push(`<span>${icon('sub')}${subs}</span>`);
  if (t.place_id) meta.push(`<span>${icon('pin')}${esc(S.places.find((p) => p.id === t.place_id)?.name || '')}</span>`);
  for (const l of t.labels) meta.push(`<span class="label">@${esc(l)}</span>`);
  if (t._pending) meta.push(`<span class="pending">${icon('clock')}wartet auf Sync</span>`);
  if (showParent && t.parent_id && byId(t.parent_id)) meta.push(`<span>↳ ${esc(byId(t.parent_id).title)}</span>`);
  const p = project(t.project_id);
  const showP = showProject && p && p.id !== 'inbox';
  const pName = projectPath(p?.id);
  if (showP) meta.push(`<span class="proj-meta"><span class="proj-dot" style="background:${esc(p.color)}"></span>${esc(pName)}</span>`);
  const right = showP ? `<div class="t-right"><span>${esc(pName)}</span><span class="proj-dot" style="width:8px;height:8px;border-radius:50%;background:${esc(p.color)}"></span></div>` : '';
  return `<div class="task prio-${t.priority}${sub ? ' sub' : ''}${t.completed_at ? ' completed' : ''}" data-task="${t.id}">
    <button class="check" data-check="${t.id}" aria-label="Erledigen">${icon('check')}</button>
    <div class="t-body"><div class="t-title">${esc(t.title)}</div>${t.notes ? `<div class="t-notes">${esc(t.notes.split('\n')[0])}</div>` : ''}${meta.length ? `<div class="t-meta">${meta.join('')}</div>` : ''}</div>
    ${right}
  </div>`;
}

function addInline(defaults, label = 'Aufgabe hinzufügen') {
  return `<button class="add-inline" data-add='${esc(JSON.stringify(defaults))}'>${icon('plus')}<span>${label}</span></button>`;
}

function emptyHtml(emoji, text) {
  return `<div class="empty"><span class="big">${emoji}</span>${text}</div>`;
}

// ---------------------------------------------------------------- views
function viewToday() {
  const t = S.today;
  const c = counts();
  const narrow = window.innerWidth <= 860;
  const [, mm, dd] = t.split('-').map(Number);
  const dateLabel = narrow ? `${WD_SHORT[isoWeekday(t)]}., ${dd}. ${MONTHS[mm - 1].slice(0, 3)}.` : fmtLongDate(t);
  setTitle('Heute', dateLabel + (c.mins ? ` · ${narrow ? fmtShort(c.mins) : fmtMins(c.mins) + ' geplant'}` : ''));
  const overdue = sortTasks(scoped().filter((x) => x.due_date && x.due_date < t));
  const today = sortTasks(scoped().filter((x) => x.due_date === t));
  const timed = today.filter((x) => x.due_time);
  const untimed = today.filter((x) => !x.due_time);

  let list = '';
  if (overdue.length) {
    list += `<div class="section"><div class="section-title overdue"><span>Überfällig<span class="n">${overdue.length}</span></span><button class="btn sm ghost" data-reschedule-overdue>Auf heute verschieben</button></div>${overdue.map((x) => taskRow(x)).join('')}</div>`;
  }
  if (timed.length) list += `<div class="section"><div class="section-title"><span>Mit Uhrzeit<span class="n">${timed.length}</span></span></div>${timed.map((x) => taskRow(x, { showDate: false })).join('')}</div>`;
  if (untimed.length || !timed.length) {
    list += `<div class="section"><div class="section-title"><span>${timed.length ? 'Ohne Uhrzeit' : 'Aufgaben'}<span class="n">${untimed.length || ''}</span></span></div>${untimed.map((x) => taskRow(x, { showDate: false })).join('')}${!today.length && !overdue.length ? emptyHtml('🌤️', 'Nichts mehr für heute – genieß den Tag.') : ''}${addInline({ due_date: t })}</div>`;
  } else {
    list += `<div class="section">${addInline({ due_date: t })}</div>`;
  }

  $('#content').innerHTML = `
  <div class="grid-today">
    <div class="panel">${list}</div>
    <div class="panel"><div class="panel-head"><h2>${icon('clock')}Tagesplan</h2><span class="meta" id="cal-meta"></span></div><div id="timeline"></div></div>
  </div>`;
  renderTimeline(t, today);
}

async function renderTimeline(date, dayTasks) {
  const box = $('#timeline');
  const draw = (data) => {
    if (!box.isConnected) return;
    const evs = data ? eventsOn(data.events, date) : [];
    const span = (e) => {
      const s = localDateOf(e.start) < date ? 0 : toMin(timeOf(e.start));
      const en = localDateOf(e.end) > date ? 24 * 60 : toMin(timeOf(e.end));
      return [s, en];
    };
    // timed events that cover the whole day are shown like all-day events
    const fullDay = (e) => { const [s, en] = span(e); return s === 0 && en >= 24 * 60; };
    const allDay = evs.filter((e) => e.allDay || fullDay(e));
    const timedEv = evs.filter((e) => !e.allDay && !fullDay(e));
    const items = [];
    for (const e of timedEv) {
      const [s, en] = span(e);
      items.push({ kind: 'event', s, e: Math.max(en, s + 15), title: e.title, sub: `${timeOf(e.start)}–${timeOf(e.end)}`, color: e.color, url: e.url });
    }
    for (const t of dayTasks.filter((x) => x.due_time)) {
      const s = toMin(t.due_time);
      items.push({ kind: 'task', s, e: Math.min(24 * 60, s + Math.max(15, t.duration_min || 30)), title: t.title, sub: `${t.due_time}${t.duration_min ? ' · ' + fmtDuration(t.duration_min) : ''}`, color: `var(--p${t.priority === 4 ? 'x' : t.priority})`, id: t.id, prio: t.priority });
    }
    const now = new Date();
    const nowMin = localDateOf(now.toISOString()) === date ? now.getHours() * 60 + now.getMinutes() : null;
    let startH = 8, endH = 20;
    for (const it of items) { startH = Math.min(startH, Math.floor(it.s / 60)); endH = Math.max(endH, Math.ceil(it.e / 60)); }
    if (nowMin !== null) { startH = Math.min(startH, Math.floor(nowMin / 60)); endH = Math.max(endH, Math.ceil(nowMin / 60) + 1); }
    startH = Math.max(0, startH); endH = Math.min(24, endH);
    const PX = 46;
    const y = (m) => ((m - startH * 60) / 60) * PX;
    layoutColumns(items);
    let html = '';
    if (allDay.length) html += `<div class="allday">${allDay.map((e) => `<span class="chip"><span class="dot" style="background:${esc(e.color)}"></span><span>${esc(e.title)}</span></span>`).join('')}</div>`;
    html += `<div class="timeline" data-date="${date}" data-start="${startH}" data-end="${endH}" data-px="${PX}" style="height:${(endH - startH) * PX}px">`;
    for (let h = startH; h <= endH; h++) html += `<div class="hour" style="top:${(h - startH) * PX}px"><span>${String(h).padStart(2, '0')}:00</span></div>`;
    for (const it of items) {
      const top = y(it.s), height = Math.max(20, y(it.e) - top - 2);
      const w = 100 / it.cols;
      const color = it.kind === 'task' ? (it.prio === 4 ? 'var(--accent)' : `var(--p${it.prio})`) : esc(it.color);
      const past = nowMin !== null && it.e <= nowMin ? ' past' : '';
      html += `<div class="block${it.kind === 'task' ? ' task-block' : ''}${past}" data-end="${it.e}" style="--c:${color};top:${top}px;height:${height}px;left:calc(${it.col * w}% + 2px);width:calc(${w}% - 4px)" ${it.id ? `data-task="${it.id}"` : `data-url="${esc(it.url || '')}"`}><b>${it.kind === 'task' ? '☐ ' : ''}${esc(it.title)}</b>${height > 34 ? `<small>${esc(it.sub)}</small>` : ''}</div>`;
    }
    if (nowMin !== null) html += `<div class="now-line" style="top:${y(nowMin)}px"></div>`;
    html += '</div>';
    if (data && !data.connected) html = `<div class="cal-note">Google Kalender ist nicht verbunden. <a href="/auth/login?reconnect=1&next=/%23/today" style="color:var(--accent)">Jetzt verbinden</a></div>` + html;
    else if (data?.error) html = `<div class="cal-note">Kalender konnte nicht geladen werden.</div>` + html;
    box.innerHTML = `<div class="timeline-wrap">${html}</div>`;
    const meta = $('#cal-meta');
    if (meta) meta.textContent = timedEv.length + allDay.length ? `${timedEv.length + allDay.length} Termin${timedEv.length + allDay.length === 1 ? '' : 'e'}` : 'Keine Termine';
  };
  const from = date, to = addDays(date, 1);
  draw(cachedEvents(from, to));
  draw(await events(from, to));
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function layoutColumns(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(0); }
      cols[c] = it.e; it.col = c;
    }
    for (const it of cluster) it.cols = cols.length;
  };
  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) { flush(); cluster = []; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
}

const SPANS = [[1, '1 Tag'], [3, '3 Tage'], [7, '7 Tage'], ['m', 'Monat']];
function spanSwitch(cur) {
  return `<div class="span-switch" role="tablist">${SPANS.map(([n, l]) => `<button class="${n === cur ? 'on' : ''}" data-span="${n}">${l}</button>`).join('')}</div>`;
}
function viewWeek() {
  if (store.get('weekSpan', 7) === 'm') return viewMonth();
  const span = [1, 3, 7].includes(+store.get('weekSpan', 7)) ? +store.get('weekSpan', 7) : 7;
  const argDate = S.route.arg && /^\d{4}-\d{2}-\d{2}$/.test(S.route.arg) ? S.route.arg : null;
  const start = span === 7 ? mondayOf(argDate || S.today) : argDate || S.today;
  const end = addDays(start, span - 1);
  const containsToday = start <= S.today && S.today <= end;
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  const tasksIn = scoped().filter((t) => t.due_date >= start && t.due_date <= end);
  const mins = tasksIn.reduce((n, t) => n + (t.duration_min || 0), 0);
  const range = span === 1 ? fmtLongDate(start) : `${d1}. ${MONTHS[m1 - 1].slice(0, 3)} – ${d2}. ${MONTHS[m2 - 1].slice(0, 3)}`;
  const label = span === 7 ? (containsToday ? 'Diese Woche' : `KW ${isoWeekNo(start)}`) : span === 3 ? '3 Tage' : relDate(start, S.today);
  setTitle('Demnächst', `${label} · ${range} · ${tasksIn.length} Aufg.${mins ? ' · ' + fmtShort(mins) : ''}`);
  const back = addDays(start, -span), fwd = addDays(start, span);
  $('#top-actions').innerHTML = `<div class="week-nav"><a class="icon-btn" href="#/week/${back}" aria-label="Zurück">${icon('left')}</a>${containsToday ? '' : '<a class="btn sm" href="#/week">Heute</a>'}<a class="icon-btn" href="#/week/${fwd}" aria-label="Weiter">${icon('right')}</a></div>`;
  const timeline = span < 7 || window.innerWidth >= 1000;
  const draw = (data) => {
    const evs = data?.events || [];
    let html = spanSwitch(span);
    if (timeline) {
      $('#content').innerHTML = html + weekTimelineHtml(start, span, evs, containsToday) + (data && !data.connected ? `<div class="cal-note">Termine fehlen: Google Kalender ist nicht verbunden.</div>` : '');
      tickNow();
      return;
    }
    html += `<div class="week span-${span}">`;
    for (let i = 0; i < span; i++) {
      const d = addDays(start, i);
      const isToday = d === S.today;
      let dayTasks = scoped().filter((t) => t.due_date === d && !(containsToday && d < S.today));
      if (isToday) dayTasks = [...scoped().filter((t) => t.due_date && t.due_date < S.today), ...dayTasks];
      dayTasks = sortTasks(dayTasks);
      const dayEv = eventsOn(evs, d);
      const load = dayTasks.filter((t) => t.due_date === d).reduce((n, t) => n + (t.duration_min || 0), 0);
      if (span === 7 && d < S.today && !dayTasks.length && !dayEv.length && window.innerWidth < 860) continue;
      html += `<div class="day-col${isToday ? ' is-today' : ''}${d < S.today ? ' is-past' : ''}" data-day="${d}">
        <div class="day-head"><div><div class="wd">${WD_SHORT[isoWeekday(d)]}${span === 1 ? ' · ' + relDate(d, S.today) : ''}</div><div class="dn">${+d.slice(8, 10)}.</div></div><div class="load">${dayTasks.length ? dayTasks.length + (dayTasks.length === 1 ? ' Aufgabe' : ' Aufgaben') : ''}${load ? '<br>' + fmtShort(load) : ''}</div></div>
        <div class="day-body">
          ${dayEv.map((e) => `<div class="ev" style="--c:${esc(e.color)}" data-url="${esc(e.url || '')}"><b>${esc(e.title)}</b><small>${e.allDay ? 'ganztägig' : timeOf(e.start) + '–' + timeOf(e.end)}</small></div>`).join('')}
          ${dayTasks.map((t) => `<div class="wtask prio-${t.priority}" data-task="${t.id}" draggable="true"><button class="check" data-check="${t.id}" aria-label="Erledigen"></button><div class="tt">${esc(t.title)}<small>${[t.due_date < d ? '<span style="color:var(--danger)">überfällig</span>' : '', t.due_time || '', t.duration_min ? fmtDuration(t.duration_min) : '', t.recurrence ? '↻' : '', t.deadline ? `<span class="deadline ${deadlineInfo(t.deadline).cls}">🎯 ${+t.deadline.slice(8, 10)}.${+t.deadline.slice(5, 7)}.</span>` : ''].filter(Boolean).join(' · ')}</small></div></div>`).join('')}
          ${d >= S.today ? addInline({ due_date: d }, 'Hinzufügen') : ''}
        </div></div>`;
    }
    html += '</div>';
    if (data && !data.connected) html += `<div class="cal-note">Termine fehlen: Google Kalender ist nicht verbunden.</div>`;
    $('#content').innerHTML = html;
    bindWeekDnD();
  };
  const from = start, to = addDays(start, span);
  draw(cachedEvents(from, to));
  const routeAtStart = location.hash;
  events(from, to).then((d) => { if (location.hash === routeAtStart && S.route.name === 'week') draw(d); });
}

// ---------------------------------------------------------------- week as a time line
// Columns per day with an hour grid: calendar events (fixed) and tasks with a time (draggable).
// Tasks without a time sit in the head of their day and can be dragged into the grid.
const TL_PX = 52;      // pixels per hour
const TL_SNAP = 15;    // minutes
function weekTimelineHtml(start, span, evs, containsToday) {
  const days = [];
  for (let i = 0; i < span; i++) days.push(addDays(start, i));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cols = days.map((d) => {
    const isToday = d === S.today;
    let tasks = scoped().filter((t) => t.due_date === d && !(containsToday && d < S.today));
    if (isToday) tasks = [...scoped().filter((t) => t.due_date && t.due_date < S.today && !t.parent_id), ...tasks];
    tasks = sortTasks(tasks);
    const dayEv = eventsOn(evs, d);
    const spanOf = (e) => [localDateOf(e.start) < d ? 0 : toMin(timeOf(e.start)), localDateOf(e.end) > d ? 24 * 60 : toMin(timeOf(e.end))];
    const fullDay = (e) => { const [a, b] = spanOf(e); return a === 0 && b >= 24 * 60; };
    const allDayEv = dayEv.filter((e) => e.allDay || fullDay(e));
    const items = [], bands = [];
    for (const e of dayEv.filter((x) => !x.allDay && !fullDay(x))) {
      const [a, b] = spanOf(e);
      const it = { kind: 'event', s: a, e: Math.max(b, a + 15), title: e.title, sub: `${timeOf(e.start)}–${timeOf(e.end)}`, color: e.color, url: e.url };
      (b - a >= 180 ? bands : items).push(it);
    }
    for (const t of tasks.filter((x) => x.due_time && x.due_date === d)) {
      const a = toMin(t.due_time);
      items.push({ kind: 'task', s: a, e: Math.min(24 * 60, a + Math.max(15, t.duration_min || 30)), t });
    }
    const untimed = tasks.filter((t) => !t.due_time || t.due_date !== d);
    return { d, isToday, items, bands, allDayEv, untimed };
  });
  // visible hours: at least 7–21, stretched to fit everything
  let h0 = 7, h1 = 21;
  for (const c of cols) for (const it of [...c.items, ...c.bands]) { h0 = Math.min(h0, Math.floor(it.s / 60)); h1 = Math.max(h1, Math.ceil(it.e / 60)); }
  if (containsToday) { h0 = Math.min(h0, Math.floor(nowMin / 60)); h1 = Math.max(h1, Math.ceil(nowMin / 60) + 1); }
  h0 = Math.max(0, h0); h1 = Math.min(24, h1);
  const H = (h1 - h0) * TL_PX;
  const y = (m) => ((m - h0 * 60) / 60) * TL_PX;
  const chip = (t, d) => `<div class="tl-chip prio-${t.priority}" data-task="${t.id}" data-drag-task="${t.id}"><button class="check" data-check="${t.id}" aria-label="Erledigen"></button><span>${esc(t.title)}</span>${t.due_date < d ? '<small class="tl-over">überfällig</small>' : t.duration_min ? `<small>${fmtDuration(t.duration_min)}</small>` : ''}</div>`;
  let html = `<div class="tl-week" style="--cols:${span}">`;
  // heads + all-day / untimed
  html += `<div class="tl-row tl-heads"><div class="tl-gut"></div>${cols.map((c) => `<div class="tl-head${c.isToday ? ' is-today' : ''}${c.d < S.today ? ' is-past' : ''}"><span class="wd">${WD_SHORT[isoWeekday(c.d)]}</span><span class="dn">${+c.d.slice(8, 10)}.</span>${span === 1 ? `<span class="rel">${relDate(c.d, S.today)}</span>` : ''}</div>`).join('')}</div>`;
  html += `<div class="tl-row tl-top"><div class="tl-gut"><span>ohne<br>Zeit</span></div>${cols.map((c) => `<div class="tl-cell" data-drop-day="${c.d}">
      ${c.allDayEv.map((e) => `<div class="tl-allday" style="--c:${esc(e.color)}" data-url="${esc(e.url || '')}">${esc(e.title)}</div>`).join('')}
      ${c.untimed.slice(0, 4).map((t) => chip(t, c.d)).join('')}
      ${c.untimed.length > 4 ? `<details class="tl-more"><summary>+ ${c.untimed.length - 4} weitere</summary>${c.untimed.slice(4).map((t) => chip(t, c.d)).join('')}</details>` : ''}
      ${c.d >= S.today ? `<button class="tl-add" data-add='${esc(JSON.stringify({ due_date: c.d }))}' aria-label="Aufgabe hinzufügen">${icon('plus')}</button>` : ''}
    </div>`).join('')}</div>`;
  // grid
  html += `<div class="tl-row tl-grid" style="height:${H}px"><div class="tl-gut">${Array.from({ length: h1 - h0 + 1 }, (_, i) => `<span style="top:${i * TL_PX}px">${String(h0 + i).padStart(2, '0')}:00</span>`).join('')}</div>`;
  for (const c of cols) {
    layoutColumns(c.items);
    html += `<div class="tl-col${c.isToday ? ' is-today' : ''}" data-date="${c.d}" data-start="${h0}" data-end="${h1}" data-px="${TL_PX}">`;
    for (let h = h0; h <= h1; h++) html += `<div class="tl-hr" style="top:${(h - h0) * TL_PX}px"></div>`;
    for (const b of c.bands) html += `<div class="tl-band" style="--c:${esc(b.color)};top:${y(b.s)}px;height:${y(b.e) - y(b.s)}px" data-url="${esc(b.url || '')}"><span>${esc(b.title)} · ${b.sub}</span></div>`;
    for (const it of c.items) {
      const top = y(it.s), height = Math.max(22, y(it.e) - top - 2), w = 100 / it.cols;
      const pos = `top:${top}px;height:${height}px;left:calc(${it.col * w}% + 2px);width:calc(${w}% - 4px)`;
      const past = c.d < S.today || (c.isToday && it.e <= nowMin) ? ' past' : '';
      if (it.kind === 'event') {
        html += `<div class="block${past}" data-end="${it.e}" style="--c:${esc(it.color)};${pos}" data-url="${esc(it.url || '')}"><b>${esc(it.title)}</b>${height > 34 ? `<small>${esc(it.sub)}</small>` : ''}</div>`;
      } else {
        const t = it.t, color = t.priority === 4 ? 'var(--accent)' : `var(--p${t.priority})`;
        html += `<div class="block task-block tl-task${past}" data-end="${it.e}" style="--c:${color};${pos}" data-task="${t.id}" data-drag-task="${t.id}"><b><button class="check mini" data-check="${t.id}" aria-label="Erledigen"></button>${esc(t.title)}</b>${height > 34 ? `<small>${t.due_time}${t.duration_min ? ' · ' + fmtDuration(t.duration_min) : ''}</small>` : ''}</div>`;
      }
    }
    if (c.isToday && nowMin >= h0 * 60 && nowMin <= h1 * 60) html += `<div class="now-line" style="top:${y(nowMin)}px"></div>`;
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

// dragging tasks on the time line: mouse = press + move, touch = hold 0.35 s
const tl = { src: null, ghost: null, mark: null, sx: 0, sy: 0, offY: 0, timer: null, active: false, endAt: 0, drop: null };
function tlStart(el, x, y) {
  const t = byId(el.dataset.dragTask);
  if (!t) return;
  tl.active = true; tl.src = el;
  const r = el.getBoundingClientRect();
  tl.offY = el.classList.contains('tl-task') ? y - r.top : 0;
  const g = el.cloneNode(true);
  g.classList.add('tl-ghost');
  g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${Math.max(140, r.width)}px;height:${r.height}px;--c:${getComputedStyle(el).getPropertyValue('--c') || 'var(--accent)'}`;
  g.dataset.dx = x - r.left;
  document.body.appendChild(g);
  tl.ghost = g;
  el.classList.add('tl-src');
  document.body.classList.add('dnd-on');
  navigator.vibrate?.(15);
  tlMove(x, y);
}
function tlMove(x, y) {
  if (!tl.active) return;
  tl.ghost.style.left = (x - +tl.ghost.dataset.dx) + 'px';
  tl.ghost.style.top = (y - tl.offY - (tl.offY ? 0 : 12)) + 'px';
  tl.mark?.remove(); tl.mark = null; tl.drop = null;
  $$('.tl-cell.drop').forEach((c) => c.classList.remove('drop'));
  const el = document.elementFromPoint(x, y);
  const col = el?.closest('.tl-col');
  const cell = el?.closest('.tl-cell');
  const t = byId(tl.src.dataset.dragTask);
  if (col) {
    const r = col.getBoundingClientRect();
    const h0 = +col.dataset.start, px = +col.dataset.px;
    let m = h0 * 60 + ((y - tl.offY - r.top) / px) * 60;
    m = Math.max(0, Math.min(24 * 60 - TL_SNAP, Math.round(m / TL_SNAP) * TL_SNAP));
    const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const dur = Math.max(15, t?.duration_min || 30);
    tl.mark = document.createElement('div');
    tl.mark.className = 'tl-mark';
    tl.mark.style.top = ((m - h0 * 60) / 60) * px + 'px';
    tl.mark.style.height = (dur / 60) * px + 'px';
    tl.mark.textContent = hm;
    col.appendChild(tl.mark);
    tl.drop = { date: col.dataset.date, time: hm };
  } else if (cell) {
    cell.classList.add('drop');
    tl.drop = { date: cell.dataset.dropDay, time: cell.dataset.keepTime ? (t?.due_time || null) : null };
  }
  // auto-scroll near the edges
  const edge = 70;
  if (y < edge) window.scrollBy(0, -10); else if (y > window.innerHeight - edge - 60) window.scrollBy(0, 10);
}
async function tlEnd(cancel) {
  clearTimeout(tl.timer); tl.timer = null;
  if (!tl.active) { tl.src = null; return; }
  tl.active = false; tl.endAt = Date.now();
  document.body.classList.remove('dnd-on');
  tl.ghost?.remove(); tl.mark?.remove(); tl.mark = null;
  $$('.tl-cell.drop').forEach((c) => c.classList.remove('drop'));
  tl.src?.classList.remove('tl-src');
  const id = tl.src?.dataset.dragTask, drop = tl.drop;
  tl.src = null; tl.drop = null;
  const t = id && byId(id);
  if (cancel || !t || !drop) return;
  if (t.due_date === drop.date && (t.due_time || null) === drop.time) return;
  const patch = { due_date: drop.date, due_time: drop.time };
  if (!drop.time && t.due_time) patch.reminders = (t.reminders || []).filter((r) => r.at);
  try {
    await saveTask(id, patch);
    toast(drop.time ? `${relDate(drop.date, S.today)}, ${drop.time} Uhr` : `${relDate(drop.date, S.today)} · ohne Uhrzeit`);
  } catch { /* saveTask shows the error */ }
}
function bindTimelineDrag() {
  const pick = (e) => (e.target.closest('.tl-week [data-drag-task], .mo [data-drag-task]') && !e.target.closest('button') ? e.target.closest('[data-drag-task]') : null);
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const el = pick(e);
    if (!el) return;
    tl.src = el; tl.sx = e.clientX; tl.sy = e.clientY;
  });
  document.addEventListener('mousemove', (e) => {
    if (!tl.src) return;
    if (!tl.active) { if (Math.hypot(e.clientX - tl.sx, e.clientY - tl.sy) < 6) return; tlStart(tl.src, e.clientX, e.clientY); }
    e.preventDefault();
    tlMove(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => tlEnd(false));
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const el = pick(e);
    if (!el) return;
    const p = e.touches[0];
    tl.sx = p.clientX; tl.sy = p.clientY;
    clearTimeout(tl.timer);
    tl.timer = setTimeout(() => tlStart(el, tl.sx, tl.sy), 350);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const p = e.touches[0];
    if (!tl.active) { if (tl.timer && Math.hypot(p.clientX - tl.sx, p.clientY - tl.sy) > 8) { clearTimeout(tl.timer); tl.timer = null; } return; }
    e.preventDefault();
    tlMove(p.clientX, p.clientY);
  }, { passive: false });
  document.addEventListener('touchend', () => tlEnd(false));
  document.addEventListener('touchcancel', () => tlEnd(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tl.active) tlEnd(true); });
  document.addEventListener('click', (e) => { if (Date.now() - tl.endAt < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', (e) => { if (tl.active || tl.timer) e.preventDefault(); });
}

// ---------------------------------------------------------------- month
function viewMonth() {
  const arg = S.route.arg && /^\d{4}-\d{2}-\d{2}$/.test(S.route.arg) ? S.route.arg : S.today;
  const first = arg.slice(0, 8) + '01';
  const [y, m] = first.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const gridStart = mondayOf(first);
  const gridEnd = addDays(mondayOf(last), 6);
  const weeks = Math.round((Date.parse(gridEnd) - Date.parse(gridStart)) / 86400000 + 1) / 7;
  const inMonth = scoped().filter((t) => t.due_date >= first && t.due_date <= last);
  setTitle('Demnächst', `${MONTHS[m - 1]} ${y} · ${inMonth.length} Aufg.`);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const isCur = S.today >= first && S.today <= last;
  $('#top-actions').innerHTML = `<div class="week-nav"><a class="icon-btn" href="#/week/${prev}" aria-label="Voriger Monat">${icon('left')}</a>${isCur ? '' : '<a class="btn sm" href="#/week">Heute</a>'}<a class="icon-btn" href="#/week/${next}" aria-label="Nächster Monat">${icon('right')}</a></div>`;
  const draw = (data) => {
    const evs = data?.events || [];
    let html = spanSwitch('m') + `<div class="mo"><div class="mo-wd">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<span>${WD_SHORT[d]}</span>`).join('')}</div><div class="mo-grid" style="--weeks:${weeks}">`;
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const out = d < first || d > last;
      let ts = scoped().filter((t) => t.due_date === d);
      if (d === S.today) ts = [...scoped().filter((t) => t.due_date && t.due_date < S.today && !t.parent_id), ...ts];
      ts = sortTasks(ts);
      const ev = eventsOn(evs, d);
      const items = [
        ...ev.map((e) => `<div class="mo-ev" style="--c:${esc(e.color)}" data-url="${esc(e.url || '')}">${e.allDay ? '' : `<i>${timeOf(e.start)}</i>`}${esc(e.title)}</div>`),
        ...ts.map((t) => `<div class="tl-chip mo-task prio-${t.priority}" data-task="${t.id}" data-drag-task="${t.id}"><button class="check" data-check="${t.id}" aria-label="Erledigen"></button><span>${t.due_time ? `<i>${t.due_time}</i>` : ''}${esc(t.title)}</span></div>`),
      ];
      const max = 4;
      const dots = [...ev.slice(0, 3).map((e) => `<i style="background:${esc(e.color)}"></i>`), ...ts.slice(0, 4).map((t) => `<i class="t prio-${t.priority}"></i>`)].join('');
      html += `<div class="mo-day tl-cell${out ? ' out' : ''}${d === S.today ? ' is-today' : ''}${d < S.today ? ' past' : ''}" data-drop-day="${d}" data-keep-time="1">
        <button class="mo-num" data-open-day="${d}">${+d.slice(8, 10)}</button>
        <div class="mo-items">${items.slice(0, max).join('')}${items.length > max ? `<button class="mo-more" data-open-day="${d}">+ ${items.length - max} weitere</button>` : ''}</div>
        <button class="mo-dots" data-open-day="${d}">${dots}${items.length ? `<b>${items.length}</b>` : ''}</button>
      </div>`;
    }
    html += '</div></div>';
    if (data && !data.connected) html += `<div class="cal-note">Termine fehlen: Google Kalender ist nicht verbunden.</div>`;
    $('#content').innerHTML = html;
  };
  draw(cachedEvents(gridStart, addDays(gridEnd, 1)));
  const routeAtStart = location.hash;
  events(gridStart, addDays(gridEnd, 1)).then((d) => { if (location.hash === routeAtStart && S.route.name === 'week' && store.get('weekSpan', 7) === 'm') draw(d); });
}

function isoWeekNo(d) {
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function bindWeekDnD() {
  $$('.wtask[draggable]').forEach((el) => {
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.task); e.dataTransfer.effectAllowed = 'move'; });
  });
  $$('.day-col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const t = byId(id);
      if (t && t.due_date !== col.dataset.day) {
        await saveTask(id, { due_date: col.dataset.day, ...(t.due_time ? { due_time: t.due_time } : {}) });
        toast(`Verschoben auf ${relDate(col.dataset.day, S.today)}`);
      }
    });
  });
}

function sortManual(list) {
  const base = sortTasks(list);
  const pos = new Map(base.map((t, i) => [t.id, i]));
  return base.sort((a, b) => (a.sort || 0) - (b.sort || 0) || pos.get(a.id) - pos.get(b.id));
}
function nestedList(list, opts) {
  const ids = new Set(list.map((t) => t.id));
  const roots = (opts?.manual ? sortManual : sortTasks)(list.filter((t) => !t.parent_id || !ids.has(t.parent_id)));
  const out = [];
  const walk = (t, depth) => {
    out.push(taskRow(t, { ...opts, sub: depth > 0, showParent: false }));
    for (const c of sortTasks(list.filter((x) => x.parent_id === t.id))) walk(c, depth + 1);
  };
  roots.forEach((t) => walk(t, 0));
  return out.join('');
}

function viewProject(id) {
  const p = project(id);
  if (!p) { setTitle('Projekt nicht gefunden'); $('#content').innerHTML = emptyHtml('🤷', 'Dieses Projekt gibt es nicht mehr.'); return; }
  const ids = subtree(id);
  const all = open().filter((t) => ids.has(t.project_id));
  const own = all.filter((t) => t.project_id === id);
  const mins = all.reduce((n, t) => n + (t.duration_min || 0), 0);
  const kids = childProjects(id);
  const parentPath = p.parent_id ? projectPath(p.parent_id) : '';
  const nTop = all.filter((t) => !t.parent_id).length;
  setTitle(p.name, `${parentPath ? parentPath + ' › ' : ''}${nTop} offene Aufgaben${kids.length ? ' inkl. Unterprojekte' : ''}${mins ? ' · ' + fmtShort(mins) : ''}`);
  if (id !== 'inbox') {
    $('#top-actions').innerHTML = `${p.is_main ? `<button class="btn sm ghost" data-new-subproject="${id}">${icon('plus')}<span class="hide-narrow">Unterprojekt</span></button>` : ''}<button class="icon-btn" data-edit-project="${id}" aria-label="Projekt bearbeiten">${icon('more')}</button>`;
  }
  let html = `<div class="panel"><div class="section" data-drop-project="${id}">${own.length ? nestedList(own, { showProject: false, manual: true }) : kids.length ? '' : emptyHtml(id === 'inbox' ? '📥' : '✨', id === 'inbox' ? 'Eingang ist leer.' : 'Keine offenen Aufgaben.')}${addInline({ project_id: id })}</div></div>`;
  for (const k of kids) {
    const kidIds = subtree(k.id);
    const list = open().filter((t) => kidIds.has(t.project_id));
    const grandKids = childProjects(k.id).length;
    html += `<div class="panel subproject">
      <div class="panel-head"><a class="sub-head" href="#/project/${k.id}">${projectIcon(k)}<h2>${esc(k.name)}</h2><span class="meta">${list.filter((t) => !t.parent_id).length || ''}${grandKids ? ` · ${grandKids} Unterprojekt${grandKids === 1 ? '' : 'e'}` : ''}</span>${icon('right')}</a></div>
      <div class="section" data-drop-project="${k.id}" style="padding-top:0">${list.length ? nestedList(list, { showProject: grandKids > 0, manual: true }) : '<div class="empty" style="padding:10px 16px">Keine offenen Aufgaben.</div>'}${addInline({ project_id: k.id })}</div></div>`;
  }
  $('#content').innerHTML = html;
}

function viewLabel(name) {
  const list = open().filter((t) => t.labels.includes(name));
  setTitle('@' + name, `${list.length} offene Aufgaben`);
  $('#content').innerHTML = `<div class="panel"><div class="section">${list.length ? sortTasks(list).map((t) => taskRow(t)).join('') : emptyHtml('🏷️', 'Keine Aufgaben mit diesem Label.')}${addInline({ labels: [name] })}</div></div>`;
}

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
function matches(t, words) {
  const hay = norm([t.title, t.notes, t.labels.join(' '), project(t.project_id)?.name].join(' '));
  return words.every((w) => hay.includes(w));
}
function highlight(text, words) {
  let html = esc(text);
  for (const w of words) {
    if (w.length < 2) continue;
    const n = norm(text);
    const i = n.indexOf(w);
    if (i < 0) continue;
    // positions match because normalize only strips combining marks
    const plain = text.slice(i, i + w.length);
    html = html.replace(esc(plain), `<mark>${esc(plain)}</mark>`);
  }
  return html;
}
let completedCache = { at: 0, tasks: [] };

function viewSearch(q) {
  q = (q || '').trim();
  setTitle('Suche');
  $('#content').innerHTML = `<label class="search-big">${icon('search')}<input id="search-big" type="search" placeholder="Aufgabe suchen …" autocomplete="off" enterkeyhint="search" value="${esc(q)}"></label><div id="search-results"></div>`;
  const inp = $('#search-big');
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const v = inp.value.trim();
      history.replaceState(null, '', '#/search' + (v ? '/' + encodeURIComponent(v) : ''));
      S.route = { name: 'search', arg: v };
      renderSearchResults(v);
    }, 120);
  });
  renderSearchResults(q);
  if (!q || window.innerWidth > 860) setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 30);
}

async function renderSearchResults(q) {
  const box = $('#search-results');
  if (!box) return;
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) { box.innerHTML = `<div class="panel">${emptyHtml('🔍', 'Nach Titel, Notizen, Labels oder Projekt suchen.')}</div>`; return; }
  const openHits = sortTasks(open().filter((x) => matches(x, words)));
  const row = (x) => taskRow(x).replace(`<div class="t-title">${esc(x.title)}</div>`, `<div class="t-title">${highlight(x.title, words)}</div>`);
  const draw = (done) => {
    if (!box.isConnected) return;
    const doneHits = done ? done.filter((x) => matches(x, words)).slice(0, 30) : null;
    box.innerHTML = `<div class="panel"><div class="section"><div class="section-title"><span>Offen<span class="n">${openHits.length}</span></span></div>${openHits.length ? openHits.map(row).join('') : '<div class="empty" style="padding:14px 16px">Keine offenen Treffer.</div>'}</div>
      ${doneHits === null ? '' : `<div class="section"><div class="section-title"><span>Erledigt<span class="n">${doneHits.length}</span></span></div>${doneHits.map((x) => row(x)).join('') || '<div class="empty" style="padding:14px 16px">Keine erledigten Treffer.</div>'}</div>`}</div>`;
  };
  draw(Date.now() - completedCache.at < 60000 ? completedCache.tasks : null);
  if (Date.now() - completedCache.at >= 60000 && net.online) {
    try {
      const r = await api('/tasks/completed?limit=200');
      completedCache = { at: Date.now(), tasks: r.tasks };
      if (S.route.name === 'search' && S.route.arg === q) draw(r.tasks);
    } catch { /* offline */ }
  }
}

async function viewCompleted() {
  setTitle('Erledigt', 'Zuletzt abgeschlossen');
  $('#content').innerHTML = '<div class="panel"><div class="empty">Lädt …</div></div>';
  const { tasks } = await api('/tasks/completed?limit=100');
  if (S.route.name !== 'completed') return;
  const groups = new Map();
  for (const t of tasks) {
    const d = localDateOf(t.completed_at);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(t);
  }
  $('#content').innerHTML = tasks.length ? [...groups.entries()].map(([d, ts]) =>
    `<div class="panel day-group"><div class="panel-head"><h2>${esc(relDate(d, S.today))}</h2><span class="meta">${ts.length}</span></div><div class="section" style="padding-top:0">${ts.map((t) => taskRow(t, { showDate: false })).join('')}</div></div>`).join('')
    : `<div class="panel">${emptyHtml('🎯', 'Noch nichts erledigt.')}</div>`;
}

let doneStats = store.get('doneStats', null);
let doneStatsAt = 0;
async function loadDoneStats() {
  if (Date.now() - doneStatsAt < 60000 && doneStats) return doneStats;
  doneStatsAt = Date.now();
  try { doneStats = await api('/stats/completions?days=7'); store.set('doneStats', doneStats); } catch { /* offline */ }
  return doneStats;
}
const fmtNum = (n) => (n == null ? '–' : Math.round(n).toLocaleString('de-DE'));

function barsSvg(items, { goal, height = 110, color = 'var(--accent)', hitColor = 'var(--ok)', fmt = fmtNum } = {}) {
  const max = Math.max(goal || 0, ...items.map((i) => i.value || 0), 1);
  const plot = height - 20;
  const cols = items.map((it) => {
    const h = Math.round(((it.value || 0) / max) * plot);
    return `<div class="bcol" title="${esc(it.title || it.label)}: ${esc(fmt(it.value))}"><div class="bbar-wrap" style="height:${plot}px"><div class="bbar" style="height:${Math.max(h, it.value ? 2 : 0)}px;background:${it.hit ? hitColor : color};opacity:${it.value ? 1 : 0.25}"></div></div><span class="blbl">${esc(it.label)}</span></div>`;
  }).join('');
  const goalY = goal ? plot - Math.round((goal / max) * plot) : null;
  return `<div class="bchart" style="height:${height}px">${goalY !== null ? `<div class="bgoal" style="top:${goalY}px"></div>` : ''}${cols}</div>`;
}

// ---------------------------------------------------------------- dashboard
const DASH_CARDS = {
  stats: 'Kennzahlen',
  today: 'Aufgaben heute',
  agenda: 'Termine',
  deadlines: 'Deadlines',
  done: 'Erledigt (7 Tage)',
};
function dashConfig() {
  const narrow = window.innerWidth <= 860;
  const key = narrow ? 'dash.phone' : 'dash.wide';
  const def = { order: Object.keys(DASH_CARDS), hidden: {} };
  const c = store.get(key, def);
  for (const k of Object.keys(DASH_CARDS)) if (!c.order.includes(k)) c.order.push(k);
  c.order = c.order.filter((k) => k in DASH_CARDS);
  return { ...c, key };
}

function viewDashboard() {
  const t = S.today;
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  if (window.innerWidth <= 860) {
    setTitle('Übersicht', `${hello}, Nic`);
  } else setTitle(`${hello}, Nic`, fmtLongDate(t));
  const cfg = dashConfig();
  const cards = cfg.order.filter((k) => !cfg.hidden[k]);
  $('#content').innerHTML = `${cards.includes('stats') ? '<section class="dc-stats" data-card="stats"></section>' : ''}<div class="dash dash-flow">${cards.filter((k) => k !== 'stats').map((k) => `<section class="dcard dc-${k}" data-card="${k}"></section>`).join('')}</div>
    <div class="dash-foot"><a href="#/settings" class="btn sm ghost">${icon('grid')}Übersicht anpassen</a></div>`;
  const fill = (k, html) => { const el = $(`.dc-${k}`); if (el) el.innerHTML = html; };
  const link = (href, label) => `<a class="dcard-link" href="${href}">${esc(label)}${icon('right')}</a>`;

  // stats
  fill('stats', statsHtml());

  // tasks today
  const overdue = sortTasks(scoped().filter((x) => x.due_date && x.due_date < t));
  const today = sortTasks(scoped().filter((x) => x.due_date === t));
  const list = [...overdue, ...today];
  fill('today', `<div class="dcard-head"><h2>${icon('sun')}Aufgaben heute</h2>${link('#/today', `Alle ${list.length}`)}</div>
    ${list.length ? `<div class="dcard-list">${list.slice(0, 6).map((x) => taskRow(x, { showDate: x.due_date !== t })).join('')}</div>${list.length > 6 ? `<a class="dcard-more" href="#/today">+ ${list.length - 6} weitere</a>` : ''}` : emptyHtml('🌤️', 'Nichts mehr für heute.')}`);

  // deadlines
  const dls = scoped().filter((x) => x.deadline && x.deadline <= addDays(t, 7)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  fill('deadlines', `<div class="dcard-head"><h2>${icon('target')}Deadlines</h2><span class="meta">nächste 7 Tage</span></div>
    ${dls.length ? `<div class="dcard-list">${dls.slice(0, 6).map((x) => taskRow(x)).join('')}</div>` : emptyHtml('🎯', 'Keine Deadlines in den nächsten 7 Tagen.')}`);

  // agenda
  const drawAgenda = (data) => {
    const evs = data?.events || [];
    const now = new Date();
    const todayEv = eventsOn(evs, t).filter((e) => e.allDay || new Date(e.end) > now);
    const tomorrowEv = eventsOn(evs, addDays(t, 1));
    const row = (e) => `<div class="ag-row" data-url="${esc(e.url || '')}"><span class="ag-time">${e.allDay ? 'ganzt.' : timeOf(e.start)}</span><span class="dot" style="background:${esc(e.color)}"></span><span class="ag-title">${esc(e.title)}</span></div>`;
    fill('agenda', `<div class="dcard-head"><h2>${icon('cal')}Termine</h2>${link('#/today', 'Tagesplan')}</div>
      ${data && !data.connected ? '<div class="empty">Google Kalender nicht verbunden.</div>' : ''}
      <div class="ag-group">Heute</div>${todayEv.length ? todayEv.map(row).join('') : '<div class="ag-empty">Keine weiteren Termine</div>'}
      <div class="ag-group">Morgen</div>${tomorrowEv.length ? tomorrowEv.slice(0, 5).map(row).join('') : '<div class="ag-empty">Keine Termine</div>'}`);
  };
  drawAgenda(cachedEvents(t, addDays(t, 2)));
  events(t, addDays(t, 2)).then((d) => { if (S.route.name === 'dashboard') drawAgenda(d); });

  // completions
  const drawDone = (st) => {
    if (!st) { fill('done', `<div class="dcard-head"><h2>${icon('done')}Erledigt</h2></div><div class="empty">Lädt …</div>`); return; }
    const items = Object.entries(st.counts).map(([d, n]) => ({ label: WD_SHORT[isoWeekday(d)], value: n, title: d }));
    const sum = items.reduce((n, i) => n + i.value, 0);
    fill('done', `<div class="dcard-head"><h2>${icon('done')}Erledigt</h2><span class="meta">7 Tage · ${sum}</span></div>
      ${barsSvg(items, { height: 100, color: 'var(--ok)', fmt: (v) => String(v) })}<div class="muted center">Ø ${(sum / 7).toFixed(1).replace('.', ',')} pro Tag</div>`);
  };
  drawDone(doneStats);
  loadDoneStats().then((st) => { if (S.route.name === 'dashboard') drawDone(st); });
}

// ---------------------------------------------------------------- focus timer
let focusTick = null;
function focusRemaining() {
  const f = S.focus;
  if (!f) return 0;
  const drift = f.paused ? 0 : Math.floor((Date.now() - (S.focusAt || Date.now())) / 1000);
  return f.remaining_sec - drift;
}
const fmtClock = (sec) => { const neg = sec < 0; sec = Math.abs(sec); const m = Math.floor(sec / 60), s2 = sec % 60; return `${neg ? '+' : ''}${m}:${String(s2).padStart(2, '0')}`; };
function renderFocusPill() {
  const pill = $('#focus-pill');
  if (!pill) return;
  clearInterval(focusTick);
  if (!S.focus) { pill.hidden = true; document.querySelector('.focus-modal')?.remove(); return; }
  pill.hidden = false;
  const draw = () => {
    if (!S.focus) return;
    const r = focusRemaining();
    pill.classList.toggle('over', r < 0);
    pill.classList.toggle('paused', !!S.focus.paused);
    pill.innerHTML = `${icon(S.focus.paused ? 'pause' : 'timer')}<span>${fmtClock(r)}</span>`;
    drawFocusPanel();
    const live = $('.fh-live-time');
    if (live) live.textContent = fmtClock(r);
  };
  draw();
  focusTick = setInterval(draw, 1000);
}
async function focusAction(path, body) {
  try {
    const r = await api('/focus/' + path, { method: 'POST', body });
    S.focus = r.focus; S.focusAt = Date.now();
    renderFocusPill();
    if (r.stopped?.task_id) { const t = byId(r.stopped.task_id); if (t) t.focus_sec = (t.focus_sec || 0) + r.stopped.elapsed_sec; }
    render();
    if (S.openId) renderDrawer();
    return r;
  } catch (e) { toast(e.message); throw e; }
}
async function startFocusFor(t) {
  if (offlineBlocked()) return;
  const opts = [...new Set([15, 25, 45, 60, 90, ...(t?.duration_min ? [t.duration_min] : [])])].sort((a, b) => a - b);
  const r = await dialog({
    title: `⏱ Fokus${t ? ': ' + t.title : ''}`,
    fields: [{ name: 'min', label: 'Dauer', type: 'select', options: opts.map((m) => `<option value="${m}" ${m === (t?.duration_min || 25) ? 'selected' : ''}>${fmtDuration(m)}${m === t?.duration_min ? ' (geplant)' : ''}</option>`).join('') }],
    ok: 'Starten',
  });
  if (!r) return;
  await focusAction('start', { task_id: t?.id, minutes: +r.min });
  openFocusPanel();
}
// Focus presenter: big centered card while a focus runs. Not blocking – "Ausblenden"
// (or a tap next to it) shrinks it to the pill at the top, a tap on the pill brings it back.
let focusNoteTimer = null;
let focusNoteDirty = false;
function focusNoteValue() { return $('#focus-note')?.value ?? S.focus?.note ?? ''; }
function saveFocusNote(now = false) {
  clearTimeout(focusNoteTimer);
  if (!focusNoteDirty || !S.focus) return Promise.resolve();
  const send = () => {
    focusNoteDirty = false;
    const note = focusNoteValue();
    if (S.focus) S.focus.note = note;
    return api('/focus/note', { method: 'POST', body: { note } }).catch(() => { focusNoteDirty = true; });
  };
  if (now) return send();
  focusNoteTimer = setTimeout(send, 800);
  return Promise.resolve();
}
function closeFocusPanel() {
  saveFocusNote(true);
  document.querySelector('.focus-modal')?.remove();
}
function drawFocusPanel() {
  const card = document.querySelector('.focus-modal .fp-card');
  const f = S.focus;
  if (!card || !f) return;
  const r = focusRemaining();
  const total = Math.max(60, f.planned_min * 60);
  card.classList.toggle('over', r < 0);
  card.classList.toggle('paused', !!f.paused);
  $('#focus-big').textContent = fmtClock(r);
  $('#fp-bar').style.width = Math.min(100, Math.max(0, ((total - r) / total) * 100)) + '%';
  $('#fp-state').textContent = r < 0 ? 'Zeit ist um' : f.paused ? 'Pausiert' : `von ${fmtDuration(f.planned_min)}`;
}
function openFocusPanel() {
  const f = S.focus;
  if (!f) return;
  document.querySelector('.focus-modal')?.remove();
  const t = f.task_id ? byId(f.task_id) : null;
  const wrap = document.createElement('div');
  wrap.className = 'modal open focus-modal';
  wrap.innerHTML = `<div class="fp-card" role="dialog" aria-label="Fokus">
    <div class="fp-top"><span class="fp-kicker">${viewIcon('focus', 'vi fp-vi')}Fokus</span><button class="fp-hide" data-f="hide">Ausblenden</button></div>
    <h2 class="fp-title">${esc(f.title)}</h2>
    <div class="fp-time"><div id="focus-big" class="focus-big">${fmtClock(focusRemaining())}</div><div id="fp-state" class="fp-state"></div></div>
    <div class="fp-track"><div id="fp-bar" class="fp-bar"></div></div>
    <div class="fp-add"><button class="btn" data-f="add" data-min="5">+5 Min.</button><button class="btn" data-f="add" data-min="10">+10 Min.</button><button class="btn" data-f="add" data-min="15">+15 Min.</button></div>
    <textarea id="focus-note" class="fp-note" rows="3" placeholder="Notiz zu diesem Fokus … (wird im Fokus-Tab gespeichert)">${esc(f.note || '')}</textarea>
    <div class="fp-main">
      <button class="btn" data-f="${f.paused ? 'resume' : 'pause'}">${icon(f.paused ? 'play' : 'pause')}${f.paused ? 'Weiter' : 'Pause'}</button>
      <button class="btn" data-f="stop">${icon('stop')}Beenden</button>
      ${t ? `<button class="btn primary" data-f="done">${icon('check')}Erledigt</button>` : ''}
    </div>
    ${t ? '<button class="due-open" data-f="open">Aufgabe öffnen</button>' : ''}
  </div>`;
  document.body.appendChild(wrap);
  drawFocusPanel();
  const note = $('#focus-note');
  note.addEventListener('input', () => { focusNoteDirty = true; saveFocusNote(); });
  note.addEventListener('blur', () => saveFocusNote(true));
  wrap.addEventListener('click', async (e) => {
    if (e.target === wrap) return closeFocusPanel();
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const a = b.dataset.f;
    if (a === 'hide') return closeFocusPanel();
    if (a === 'open') { closeFocusPanel(); return openTask(f.task_id); }
    if (a === 'stop' || a === 'done') {
      const noteText = focusNoteValue();
      clearTimeout(focusNoteTimer); focusNoteDirty = false;
      wrap.remove();
      const r = await focusAction('stop', { note: noteText });
      const min = Math.max(1, Math.round((r.stopped?.elapsed_sec || 0) / 60));
      if (a === 'done' && f.task_id && byId(f.task_id)) await complete(f.task_id);
      else toast(`Fokus beendet · ${fmtDuration(min)}${noteText.trim() ? ' · Notiz gespeichert' : ''}`);
      focusHistoryCache = null;
      if (S.route.name === 'focus') viewFocus();
      return;
    }
    await saveFocusNote(true);
    if (a === 'add') { await focusAction('extend', { minutes: +b.dataset.min }); toast(`+${b.dataset.min} Min.`); }
    else await focusAction(a);
    openFocusPanel();
  });
}

// ---------------------------------------------------------------- focus history view
let focusHistoryCache = store.get('focusHistory', null);
async function viewFocus() {
  setTitle('Fokus', 'Deine Fokus-Zeiten und Notizen');
  const draw = (list) => {
    if (S.route.name !== 'focus') return;
    if (!list) { $('#content').innerHTML = '<div class="empty">Lädt …</div>'; return; }
    const head = S.focus ? `<button class="fh-live" data-focus-panel>${viewIcon('focus')}<span><b>Läuft gerade:</b> ${esc(S.focus.title)}</span><span class="fh-live-time">${fmtClock(focusRemaining())}</span></button>` : '';
    if (!list.length) { $('#content').innerHTML = head + emptyHtml('⏱', 'Noch keine Fokus-Zeiten. Starte einen Fokus in einer Aufgabe.'); return; }
    const byDay = new Map();
    for (const x of list) { const d = localDateOf(x.ended_at); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(x); }
    let html = head;
    for (const [d, xs] of byDay) {
      const sum = xs.reduce((n, x) => n + (x.actual_sec || 0), 0);
      html += `<div class="section-title">${relDate(d, S.today)}<span class="n">${fmtDuration(Math.max(1, Math.round(sum / 60)))}</span></div>`;
      html += xs.map((x) => `<div class="fh-row"${x.task_id ? ` data-task="${x.task_id}"` : ''}>
        <div class="fh-time">${timeOf(x.started_at)}</div>
        <div class="fh-body"><div class="fh-title">${x.task_completed_at ? '✓ ' : ''}${esc(x.title)}</div>
          <div class="fh-meta">${fmtDuration(Math.max(1, Math.round((x.actual_sec || 0) / 60)))} von ${fmtDuration(x.planned_min)}</div>
          ${x.note ? `<div class="fh-note">${esc(x.note)}</div>` : ''}</div></div>`).join('');
    }
    $('#content').innerHTML = html;
  };
  draw(focusHistoryCache);
  try {
    const r = await api('/focus/history?limit=150');
    focusHistoryCache = r.sessions; store.set('focusHistory', focusHistoryCache);
    draw(focusHistoryCache);
  } catch { /* offline: cached */ }
}

// ---------------------------------------------------------------- settings
const GCOLORS = [['#7986cb','Lavendel'],['#33b679','Salbei'],['#8e24aa','Weintraube'],['#e67c73','Flamingo'],['#f6bf26','Banane'],['#f4511e','Mandarine'],['#039be5','Pfau'],['#616161','Graphit'],['#3f51b5','Blaubeere'],['#0b8043','Basilikum'],['#d50000','Tomate']];

function renderDashSettings() {
  const box = $('#dash-settings');
  if (!box) return;
  const cfg = dashConfig();
  box.innerHTML = cfg.order.map((k, i) => `<div class="dash-set-row${cfg.hidden[k] ? ' off' : ''}">
    <label class="dlg-check" style="padding:0;flex:1"><input type="checkbox" ${cfg.hidden[k] ? '' : 'checked'} data-act="dash-toggle" data-card="${k}"><span><b>${esc(DASH_CARDS[k])}</b></span></label>
    <button class="icon-btn sm" data-act="dash-up" data-card="${k}" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg></button>
    <button class="icon-btn sm" data-act="dash-down" data-card="${k}" ${i === cfg.order.length - 1 ? 'disabled' : ''} aria-label="Nach unten"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>
  </div>`).join('');
}

async function viewSettings() {
  setTitle('Einstellungen');
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let subscribed = false;
  if (pushSupported) {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = !!(reg && (await reg.pushManager.getSubscription()));
  }
  const s = S.settings;
  const origin = location.origin;
  $('#content').innerHTML = `<div class="settings">
    <div class="panel">
      <h2>Benachrichtigungen</h2>
      <p>Push-Nachrichten auf jedem Gerät einzeln aktivieren (iPhone, iPad, PC).</p>
      ${isIos && !standalone ? '<p style="color:var(--p2)"><b>iPhone/iPad:</b> Öffne diese Seite in Safari → Teilen → „Zum Home-Bildschirm“. Starte die App dann vom Home-Bildschirm und aktiviere hier Push.</p>' : ''}
      <div class="row"><label>Dieses Gerät</label>${pushSupported ? (subscribed ? '<span class="status ok">Push aktiv</span> <button class="btn sm" data-act="push-test">Test senden</button> <button class="btn sm ghost" data-act="push-off">Deaktivieren</button>' : '<button class="btn primary sm" data-act="push-on">Push aktivieren</button>') : '<span class="status off">Hier nicht verfügbar</span>'}</div>
      <div class="row"><label>Pop-up bei Fälligkeit</label><button class="btn sm" data-act="due-test">Pop-up testen</button></div>
      <div class="row"><label>Standard-Erinnerung</label><select data-setting="default_reminder_min">${[0, 5, 10, 15, 30, 60, 120].map((m) => `<option value="${m}" ${+s.default_reminder_min === m ? 'selected' : ''}>${m ? m + ' Min. vorher' : 'Zur Fälligkeit'}</option>`).join('')}</select></div>
      <div class="row"><label>Mail bei Prio 1 (nicht wiederkehrend)</label><select data-setting="mail_enabled"><option value="1" ${+s.mail_enabled ? 'selected' : ''}>An</option><option value="0" ${+s.mail_enabled ? '' : 'selected'}>Aus</option></select></div>
      <div class="row"><label>Mail-Zeit für Prio 1 ohne Uhrzeit</label><input type="time" data-setting="p1_mail_time" value="${esc(s.p1_mail_time)}"></div>
    </div>

    <div class="panel">
      <h2>Google Kalender &amp; Gmail</h2>
      <p>Termine werden nur gelesen. Mails gehen von deinem Gmail-Konto an dich selbst.</p>
      <div class="row">${S.google ? '<span class="status ok">Verbunden</span>' : '<span class="status off">Nicht verbunden</span>'}<a class="btn sm" href="/auth/login?reconnect=1&next=/%23/settings">${S.google ? 'Neu verbinden' : 'Verbinden'}</a></div>
    </div>

    <div class="panel">
      <h2>Claude-Anbindung</h2>
      <p>Damit Claude deine Aufgaben direkt lesen und bearbeiten kann:</p>
      <ol>
        <li>claude.ai → Einstellungen → Connectors → „Eigenen Connector hinzufügen“</li>
        <li>Name: <b>To-Do</b>, URL: (unten kopieren)</li>
        <li>„Verbinden“ → mit Google anmelden → „Erlauben“</li>
      </ol>
      <div class="row"><span class="code">${esc(origin)}/mcp</span><button class="btn sm" data-copy="${esc(origin)}/mcp">${icon('copy')}Kopieren</button></div>
    </div>

    <div class="panel">
      <h2>Orte &amp; Standort-Erinnerungen</h2>
      <p>Lege Orte an und verknüpfe sie in einer Aufgabe. Auf dem iPhone löst eine Kurzbefehle-Automation die Erinnerung aus.</p>
      <div class="row" id="places">${S.places.map((p) => `<span class="pill neutral">${icon('pin')}${esc(p.name)}<button data-del-place="${p.id}" aria-label="Ort löschen">${icon('x')}</button></span>`).join('') || '<span style="color:var(--muted);font-size:14px">Noch keine Orte</span>'}</div>
      <div class="row"><input id="new-place" placeholder="z. B. Zuhause, Büro, REWE" style="flex:1;max-width:280px"><button class="btn sm" data-act="add-place">${icon('plus')}Ort hinzufügen</button></div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:14px">Kurzbefehl einrichten (iPhone)</summary>
        <ol>
          <li>App <b>Kurzbefehle</b> → <b>Automation</b> → <b>+</b> → <b>Ankommen</b> (oder <b>Verlassen</b>) → Ort wählen → „Sofort ausführen“.</li>
          <li>Aktion <b>„Inhalte von URL abrufen“</b> hinzufügen.</li>
          <li>URL: siehe unten · Methode: <b>POST</b> · Anfragetext: <b>JSON</b> mit den Feldern:<br><code>token</code> = Token unten, <code>place</code> = Ortsname exakt wie hier, <code>event</code> = <code>arrive</code> oder <code>leave</code>.</li>
          <li>Für jeden Ort und jedes Ereignis eine eigene Automation anlegen.</li>
        </ol>
        <div class="row"><span class="code" id="hook-url">…</span></div>
        <div class="row"><span class="code" id="hook-token">…</span><button class="btn sm" data-act="copy-token">${icon('copy')}Token kopieren</button><button class="btn sm ghost" data-act="new-token">Neu erzeugen</button></div>
      </details>
    </div>

    <div class="panel" id="focus-settings">
      <h2>Fokus-Modus: Arbeit / Privat</h2>
      <p>Der Modus filtert Übersicht, Heute, Woche und Demnächst. Projekte ordnest du über „•••“ → <b>Bereich</b> zu (Unterprojekte erben). Projekte ohne Bereich erscheinen in beiden Modi.</p>
      <div class="row"><label>Zeitplan</label><select data-setting="work_schedule"><option value="1" ${+s.work_schedule ? 'selected' : ''}>An</option><option value="0" ${+s.work_schedule ? '' : 'selected'}>Aus</option></select></div>
      <div class="row"><label>Arbeitstage</label><div class="days-pick" id="work-days">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="${String(s.work_days).split(',').includes(String(d)) ? 'on' : ''}" data-workday="${d}">${WD_SHORT[d]}</button>`).join('')}</div></div>
      <div class="row"><label>Arbeitszeit</label><input type="time" data-setting="work_start" value="${esc(s.work_start)}"> bis <input type="time" data-setting="work_end" value="${esc(s.work_end)}"></div>
      <div class="row"><label>Termine = Arbeit, wenn Farbe</label><div class="color-pick">${GCOLORS.map(([c, n]) => `<button type="button" class="${String(s.work_colors).toLowerCase().split(',').includes(c) ? 'on' : ''}" data-workcolor="${c}" title="${n}" style="--c:${c}"><span></span>${n}</button>`).join('')}</div></div>
      <div class="row"><label>… oder Stichwort in Titel/Ort</label><input data-setting="work_keywords" value="${esc(s.work_keywords)}" placeholder="z. B. Trippelsberg, Fundus, Messe" style="flex:1;min-width:200px"></div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:14px">iPhone-Fokus koppeln (Kurzbefehle)</summary>
        <ol>
          <li>App <b>Kurzbefehle</b> → <b>Automation</b> → <b>+</b> → <b>Fokus</b> → <b>Arbeit</b> → „Wenn aktiviert“ → <b>Sofort ausführen</b>.</li>
          <li>Aktion <b>„Inhalte von URL abrufen“</b>, URL: die erste Adresse unten, Methode <b>POST</b>.</li>
          <li>Zweite Automation: Fokus <b>Arbeit</b> → „Wenn deaktiviert“ → gleiche Aktion mit der zweiten Adresse.</li>
        </ol>
        <div class="row"><span class="code" id="mode-url-work">…</span><button class="btn sm" data-copy-el="mode-url-work">${icon('copy')}</button></div>
        <div class="row"><span class="code" id="mode-url-private">…</span><button class="btn sm" data-copy-el="mode-url-private">${icon('copy')}</button></div>
        <p class="muted small">Ein Wechsel über den Fokus oder manuell in der App gilt bis zum nächsten geplanten Wechsel. Danach übernimmt wieder der Zeitplan.</p>
      </details>
    </div>

    <div class="panel">
      <h2>Menüleiste unten</h2>
      <p>Welche 4 Punkte die Leiste auf dem Handy zeigt (gilt für <b>dieses Gerät</b>).</p>
      <div id="tab-settings"></div>
    </div>

    <div class="panel">
      <h2>Fokus-Timer</h2>
      <p>Starte den Timer in einer Aufgabe (▶︎ Fokus). Während er läuft, zeigt NTD's den Fokus groß an – mit +5/+10/+15 Min. und einer Notiz. Zeit und Notiz landen im Tab <b>Fokus</b>, am Ende kommt eine Push-Nachricht.</p>
    </div>

    <div class="panel">
      <h2>Übersicht anpassen</h2>
      <p>Welche Kacheln die Startseite zeigt und in welcher Reihenfolge. Gilt nur für <b>dieses Gerät</b> (${window.innerWidth <= 860 ? 'Handy-Ansicht' : 'große Ansicht'}).</p>
      <div id="dash-settings"></div>
    </div>

    <div class="panel">
      <h2>Konto</h2>
      <div class="row"><span>${esc(S.email)}</span><a class="btn sm" href="/auth/logout">Abmelden</a></div>
    </div>
  </div>`;
  renderDashSettings();
  renderTabSettings();
  api('/location-token').then((d) => {
    const base = location.origin + '/hooks/mode?token=' + d.token + '&mode=';
    if ($('#mode-url-work')) { $('#mode-url-work').textContent = base + 'work'; $('#mode-url-private').textContent = base + 'private'; }
    if (!$('#hook-url')) return;
    $('#hook-url').textContent = d.url;
    $('#hook-token').textContent = d.token;
  });
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows-PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Browser';
}

async function settingsAction(act, el) {
  if (act === 'push-on') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('Benachrichtigungen wurden nicht erlaubt.');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(S.vapid) });
    await api('/push/subscribe', { method: 'POST', body: { ...sub.toJSON(), device: deviceName() } });
    toast('Push aktiviert ✅');
    viewSettings();
  } else if (act === 'push-off') {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
    toast('Push deaktiviert');
    viewSettings();
  } else if (act === 'due-test') {
    const now = Date.now();
    showDue({ id: 'test', title: 'Subunternehmerplanung 2027', notes: 'So sieht das Pop-up aus, wenn eine Aufgabe fällig wird.', priority: 1, due_date: S.today, due_time: hmOf(now), duration_min: 30, project_id: (S.projects.find((x) => x.id !== 'inbox') || {}).id, reminders: [] }, null, { test: true });
  } else if (act === 'push-test') {
    const r = await api('/push/test', { method: 'POST' });
    toast(`Gesendet an ${r.sent} von ${r.devices} Gerät(en)`);
  } else if (act === 'add-place') {
    const name = $('#new-place').value.trim();
    if (!name) return;
    const p = await api('/places', { method: 'POST', body: { name } });
    if (!S.places.find((x) => x.id === p.id)) S.places.push(p);
    S.places.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    viewSettings();
  } else if (act === 'tab-toggle' || act === 'tab-up' || act === 'tab-down') {
    let sel = tabConfig();
    const k = el.dataset.tab;
    if (act === 'tab-toggle') {
      if (sel.includes(k)) { if (sel.length <= 1) { toast('Mindestens ein Punkt'); return renderTabSettings(); } sel = sel.filter((x) => x !== k); }
      else { if (sel.length >= 4) { toast('Maximal 4 – erst einen anderen abwählen'); return renderTabSettings(); } sel.push(k); }
    } else {
      const i = sel.indexOf(k), j = act === 'tab-up' ? i - 1 : i + 1;
      if (j >= 0 && j < sel.length) [sel[i], sel[j]] = [sel[j], sel[i]];
    }
    store.set('tabs', sel);
    renderTabSettings(); renderNav();
  } else if (act === 'dash-up' || act === 'dash-down' || act === 'dash-toggle') {
    const cfg = dashConfig();
    const k = el.dataset.card;
    const i = cfg.order.indexOf(k);
    if (act === 'dash-toggle') { if (cfg.hidden[k]) delete cfg.hidden[k]; else cfg.hidden[k] = 1; }
    else { const j = act === 'dash-up' ? i - 1 : i + 1; if (j >= 0 && j < cfg.order.length) [cfg.order[i], cfg.order[j]] = [cfg.order[j], cfg.order[i]]; }
    store.set(cfg.key, { order: cfg.order, hidden: cfg.hidden });
    renderDashSettings();
  } else if (act === 'copy-token') {
    copy($('#hook-token').textContent);
  } else if (act === 'new-token') {
    if (!confirm('Neuen Token erzeugen? Bestehende Kurzbefehle müssen dann angepasst werden.')) return;
    const d = await api('/location-token', { method: 'POST' });
    $('#hook-token').textContent = d.token;
  }
}

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Kopiert'), () => toast(text));
}

// ---------------------------------------------------------------- mutations
const taskSig = (t) => (t ? JSON.stringify(Object.keys(t).filter((k) => k !== 'updated_at' && k !== '_pending').sort().map((k) => [k, t[k]])) : '');

function upsert(task) {
  const i = S.tasks.findIndex((t) => t.id === task.id);
  if (task.completed_at) { if (i >= 0) S.tasks.splice(i, 1); return; }
  if (i >= 0) S.tasks[i] = task; else S.tasks.push(task);
}

function offlineBlocked() {
  if (net.online) return false;
  toast('Offline – nur Hinzufügen und Abhaken möglich');
  return true;
}

async function saveTask(id, patch, { silent = false } = {}) {
  if (offlineBlocked()) { if (S.openId === id) renderDrawer(); throw new OfflineError('offline'); }
  // optimistic: show simple changes immediately
  const cur = byId(id);
  const prev = cur ? { ...cur } : null;
  const simple = ['title', 'notes', 'priority', 'due_date', 'due_time', 'duration_min', 'deadline', 'labels', 'project_id', 'recurrence'];
  if (cur && Object.keys(patch).every((k) => simple.includes(k))) {
    Object.assign(cur, patch);
    if (patch.due_date === null) { cur.due_time = null; cur.recurrence = null; }
    if (!silent) { render(); if (S.openId === id) renderDrawer(); }
  }
  try {
    const before = taskSig(byId(id));
    const t = await api('/tasks/' + id, { method: 'PATCH', body: patch });
    upsert(t);
    if (patch.project_id) {
      // children follow parent
      for (const c of S.tasks.filter((x) => x.parent_id === id)) c.project_id = patch.project_id;
    }
    // the optimistic render usually already shows the result – only redraw when the server changed something
    const same = !patch.project_id && before === taskSig(byId(id));
    if (!silent && !same) { render(); if (S.openId === id) renderDrawer(); }
    return t;
  } catch (e) {
    if (prev && cur) { const i = S.tasks.indexOf(cur); if (i >= 0) S.tasks[i] = prev; render(); if (S.openId === id) renderDrawer(); }
    toast(e.message);
    throw e;
  }
}

// picker wheels fire many change events – send only the last value
const saveTimers = new Map();
function debouncedSave(id, patch) {
  const key = id + Object.keys(patch).join();
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(() => { saveTimers.delete(key); saveTask(id, patch).catch(() => {}); }, 500));
}

function localTask(id, input) {
  const now = new Date().toISOString();
  return {
    id, project_id: input.project_id || (input.parent_id ? byId(input.parent_id)?.project_id : null) || 'inbox', parent_id: input.parent_id || null,
    title: input.title, notes: input.notes || '', priority: input.priority || 4, due_date: input.due_date || null,
    due_time: input.due_time || null, duration_min: input.duration_min || null, recurrence: input.recurrence || null,
    labels: input.labels || [], reminders: [], place_id: null, place_event: null, sort: 0, completed_at: null,
    created_at: now, updated_at: now, _pending: true,
  };
}

async function createTask(input) {
  const id = newId();
  let t;
  try {
    t = await api('/tasks', { method: 'POST', body: { ...input, id } });
  } catch (e) {
    if (!(e instanceof OfflineError)) throw e;
    t = localTask(id, input);
    queue.push({ op: 'create', id, input, task: t });
    saveQueue();
    renderSync();
  }
  upsert(t);
  render();
  if (S.openId) renderDrawer();
  return t;
}

// client copy of the server's recurrence logic, used to move recurring tasks instantly
function nextOccurrenceLocal(rule, due, today) {
  const n = Math.max(1, rule.interval || 1);
  const step = (d) => {
    if (rule.freq === 'day') return addDays(d, n);
    if (rule.freq === 'week') {
      const days = (rule.days || []).slice().sort();
      if (!days.length) return addDays(d, 7 * n);
      const wd = isoWeekday(d);
      const later = days.find((x) => x > wd);
      return later ? addDays(d, later - wd) : addDays(d, 7 * (n - 1) + (7 - wd) + days[0]);
    }
    const months = rule.freq === 'year' ? 12 * n : n;
    const [y, m] = d.split('-').map(Number);
    const day = rule.day || +due.slice(8, 10);
    const first = new Date(Date.UTC(y, m - 1 + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
  };
  let next = step(due || today);
  for (let i = 0; next <= today && i < 1000; i++) next = step(next);
  return next;
}

async function complete(id) {
  const before = byId(id);
  if (!before) return;
  const snapshot = S.tasks.map((t) => ({ ...t }));
  $$(`[data-task="${id}"]`).forEach((r) => r.classList.add('done-anim'));
  if (!net.online || before._pending) {
    // offline (or not yet uploaded): queue it
    const qi = queue.findIndex((q) => q.op === 'create' && q.id === id);
    if (qi >= 0 && !before.recurrence) { queue.splice(qi, 1); } else queue.push({ op: 'complete', id });
    saveQueue();
    S.tasks = S.tasks.filter((t) => t.id !== id && t.parent_id !== id);
    S.doneToday++;
    if (S.openId === id) closeDrawer();
    renderSync();
    toast(net.online ? 'Erledigt' : 'Erledigt (offline) – wird synchronisiert');
    setTimeout(render, 180);
    if (net.online) sync({ silent: true });
    return;
  }
  // optimistic: update the UI right away, tell the server in the background
  const recurring = before.recurrence && before.due_date;
  if (recurring) {
    const t = byId(id);
    t.due_date = nextOccurrenceLocal(before.recurrence, before.due_date, S.today);
  } else {
    S.tasks = S.tasks.filter((t) => t.id !== id && t.parent_id !== id);
    if (S.openId === id) closeDrawer();
  }
  S.doneToday++;
  setTimeout(() => { render(); if (S.openId && S.openId !== id) renderDrawer(); }, 180);
  let pending = null;
  const undo = async () => {
    S.tasks = snapshot; S.doneToday = Math.max(0, S.doneToday - 1); render();
    await pending?.catch(() => {}); // wait until the server has the completion, then revert it
    if (recurring) await saveTask(id, { due_date: before.due_date, ...(before.due_time ? { due_time: before.due_time } : {}) }, { silent: true }).catch(() => {});
    else await api(`/tasks/${id}/uncomplete`, { method: 'POST' }).catch((e) => toast(e.message));
  };
  toast(recurring ? `Erledigt · nächstes Mal ${relDate(byId(id).due_date, S.today)}` : 'Erledigt', 'Rückgängig', undo);
  try {
    pending = api(`/tasks/${id}/complete`, { method: 'POST' });
    const r = await pending;
    if (r.recurred && byId(id)?.due_date !== before.due_date) upsert(r.task);
  } catch (e) {
    if (e instanceof OfflineError) {
      queue.push({ op: 'complete', id }); saveQueue(); renderSync();
      return;
    }
    S.tasks = snapshot; S.doneToday = Math.max(0, S.doneToday - 1);
    render();
    toast('Abhaken fehlgeschlagen: ' + e.message);
  }
}

// ---------------------------------------------------------------- drawer
let drawerTask = null;

async function openTask(id, push = true) {
  S.openId = id;
  drawerTask = byId(id) || null;
  if (!drawerTask) {
    try { drawerTask = await api('/tasks/' + id); } catch { drawerTask = null; }
  }
  if (!drawerTask) { toast('Aufgabe nicht gefunden'); S.openId = null; return; }
  if (push && location.hash !== '#/task/' + id) history.pushState(null, '', '#/task/' + id);
  renderDrawer();
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer(back = true) {
  S.openId = null;
  drawerTask = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  if (back && location.hash.startsWith('#/task/')) {
    history.replaceState(null, '', routeHash(S.route));
  }
}
function routeHash(r) {
  if (!r || r.name === 'dashboard') return '#/dashboard';
  return '#/' + r.name + (r.arg ? '/' + encodeURIComponent(r.arg) : '');
}

const REC_PRESETS = [
  ['', 'Keine'], ['day', 'Täglich'], ['workdays', 'Werktags'], ['week', 'Wöchentlich'], ['2week', 'Alle 2 Wochen'], ['month', 'Monatlich'], ['year', 'Jährlich'], ['custom', 'Benutzerdefiniert …'],
];
function recPreset(r) {
  if (!r) return '';
  const n = r.interval || 1;
  if (r.freq === 'day' && n === 1) return 'day';
  if (r.freq === 'week' && n === 1 && (r.days || []).join() === '1,2,3,4,5') return 'workdays';
  if (r.freq === 'week' && (r.days || []).length <= 1 && n === 1) return 'week';
  if (r.freq === 'week' && (r.days || []).length <= 1 && n === 2) return '2week';
  if (r.freq === 'month' && n === 1) return 'month';
  if (r.freq === 'year' && n === 1) return 'year';
  return 'custom';
}
const REMINDER_PRESETS = [[0, 'Zur Fälligkeit'], [5, '5 Min. vorher'], [15, '15 Min. vorher'], [30, '30 Min. vorher'], [60, '1 Std. vorher'], [120, '2 Std. vorher'], [1440, '1 Tag vorher']];
const reminderLabel = (r) => r.at ? `${relDate(r.at.slice(0, 10), S.today)} ${r.at.slice(11, 16)}` : (REMINDER_PRESETS.find((p) => p[0] === r.before)?.[1] || `${r.before} Min. vorher`);
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

// Re-rendering the drawer replaces its inputs – that would close an open date/time picker
// (iOS fires "change" while the wheel is still spinning). Defer until focus leaves the field.
let drawerDeferred = false;
const PICKER = 'input[type=date], input[type=time], input[type=datetime-local]';
function renderDrawer() {
  const a = document.activeElement;
  if (a && a.matches?.(PICKER) && $('#drawer-panel')?.contains(a)) { drawerDeferred = true; return; }
  drawerDeferred = false;
  renderDrawerNow();
}
function renderDrawerNow() {
  subCounts = null;
  const t = S.openId && (byId(S.openId) || (drawerTask?.id === S.openId ? drawerTask : null));
  if (!t) return;
  drawerTask = t;
  const p = project(t.project_id);
  const parent = t.parent_id ? byId(t.parent_id) : null;
  const subs = sortTasks(open().filter((x) => x.parent_id === t.id));
  const rp = recPreset(t.recurrence);
  const labelsAll = allLabels().map(([l]) => l).filter((l) => !t.labels.includes(l));
  const durOpts = [...new Set([...DURATIONS, ...(t.duration_min ? [t.duration_min] : [])])].sort((a, b) => a - b);
  $('#drawer-panel').innerHTML = `
  <div class="d-top"><div class="crumb">${p ? `<span class="dot" style="width:9px;height:9px;border-radius:50%;background:${esc(p.color)}"></span>${esc(projectPath(p.id))}` : ''}${parent ? ` <span>›</span> <a href="#/task/${parent.id}" style="overflow:hidden;text-overflow:ellipsis">${esc(parent.title)}</a>` : ''}</div>
    <button class="icon-btn" data-act="delete" aria-label="Löschen">${icon('trash')}</button>
    <button class="icon-btn" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
  <div class="d-title-row task prio-${t.priority}${t.completed_at ? ' completed' : ''}" style="padding:0;cursor:default;background:none">
    <button class="check" data-check="${t.id}" aria-label="Erledigen">${icon('check')}</button>
    <textarea class="d-title" id="d-title" rows="1">${esc(t.title)}</textarea>
  </div>
  <textarea class="d-notes" id="d-notes" placeholder="Beschreibung / Notizen …">${esc(t.notes)}</textarea>
  <div class="d-grid">
    <label>${icon('folder')}Projekt</label>
    <div class="row"><select data-f="project_id">${projectOptions(t.project_id)}</select></div>

    <label>${icon('cal')}Datum</label>
    <div class="row"><input type="date" data-f="due_date" value="${t.due_date || ''}">${t.due_date ? `<button class="icon-btn sm" data-quick-date="" aria-label="Datum entfernen">${icon('x')}</button>` : ''}<button class="btn sm ghost" data-quick-date="${S.today}">Heute</button><button class="btn sm ghost" data-quick-date="${addDays(S.today, 1)}">Morgen</button></div>

    <label>${icon('clock')}Uhrzeit</label>
    <div class="row"><input type="time" data-f="due_time" value="${t.due_time || ''}" ${t.due_date ? '' : 'disabled'}>${t.due_time ? `<button class="icon-btn sm" data-clear="due_time" aria-label="Uhrzeit entfernen">${icon('x')}</button>` : ''}</div>

    <label>${icon('target')}Deadline</label>
    <div class="row"><input type="date" data-f="deadline" value="${t.deadline || ''}">${t.deadline ? `<button class="icon-btn sm" data-clear="deadline" aria-label="Deadline entfernen">${icon('x')}</button><span class="deadline-hint ${deadlineInfo(t.deadline).cls}">${deadlineInfo(t.deadline).text}</span>` : ''}</div>

    <label>${icon('play')}Fokus</label>
    <div class="row">${S.focus?.task_id === t.id ? `<button class="btn sm primary" data-focus-panel>${icon('timer')}läuft · Steuern</button>` : `<button class="btn sm" data-focus-start="${t.id}">${icon('play')}Fokus starten</button>`}${t.focus_sec ? `<span class="muted small">${fmtDuration(Math.max(1, Math.round(t.focus_sec / 60)))} fokussiert${t.duration_min ? ` · geplant ${fmtDuration(t.duration_min)}` : ''}</span>` : ''}</div>

    <label>${icon('timer')}Dauer</label>
    <div class="row"><select data-f="duration_min"><option value="">–</option>${durOpts.map((m) => `<option value="${m}" ${t.duration_min === m ? 'selected' : ''}>${fmtDuration(m)}</option>`).join('')}<option value="custom">Andere …</option></select></div>

    <label>${icon('flag')}Priorität</label>
    <div class="prio-pick">${[1, 2, 3, 4].map((n) => `<button class="prio-${n}${t.priority === n ? ' on' : ''}" data-prio="${n}" title="Priorität ${n}" aria-label="Priorität ${n}"><svg viewBox="0 0 24 24">${P.flag}</svg></button>`).join('')}</div>

    <label>${icon('repeat')}Wiederholen</label>
    <div class="row"><select data-f="recurrence" ${t.due_date ? '' : 'disabled title="Erst ein Datum setzen"'}>${REC_PRESETS.map(([v, l]) => `<option value="${v}" ${rp === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${t.recurrence ? `<span style="font-size:12.5px;color:var(--muted)">${esc(recurrenceLabel(t.recurrence))}</span>` : ''}</div>
    ${rp === 'custom' ? `<span></span><div class="row">alle <input type="number" min="1" max="99" value="${t.recurrence.interval || 1}" data-rec="interval" style="width:62px"><select data-rec="freq">${[['day', 'Tage'], ['week', 'Wochen'], ['month', 'Monate'], ['year', 'Jahre']].map(([v, l]) => `<option value="${v}" ${t.recurrence.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${t.recurrence.freq === 'week' ? `<div class="days-pick">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button class="${(t.recurrence.days || []).includes(d) ? 'on' : ''}" data-rec-day="${d}">${WD_SHORT[d]}</button>`).join('')}</div>` : ''}</div>` : ''}


    <label>${icon('tag')}Labels</label>
    <div class="row">${t.labels.map((l) => `<span class="pill">@${esc(l)}<button data-del-label="${esc(l)}" aria-label="Label entfernen">${icon('x')}</button></span>`).join('')}<input class="tag-input" id="label-input" placeholder="+ Label" list="label-list"><datalist id="label-list">${labelsAll.map((l) => `<option value="${esc(l)}">`).join('')}</datalist></div>

    <label>${icon('bell')}Erinnerung</label>
    <div class="row">${t.reminders.map((r, i) => `<span class="pill neutral">${esc(reminderLabel(r))}<button data-del-reminder="${i}" aria-label="Erinnerung entfernen">${icon('x')}</button></span>`).join('')}
      ${!t.reminders.length ? `<span style="font-size:12.5px;color:var(--muted)">${t.due_time ? `Standard (${+S.settings.default_reminder_min ? S.settings.default_reminder_min + ' Min. vorher' : 'zur Fälligkeit'})` : t.priority === 1 && t.due_date && !t.recurrence ? `Mail um ${esc(S.settings.p1_mail_time)} am Fälligkeitstag` : 'Keine'}</span>` : ''}
      <select id="add-reminder" style="max-width:150px"><option value="">+ Hinzufügen</option>${t.due_time ? REMINDER_PRESETS.map(([m, l]) => `<option value="${m}">${l}</option>`).join('') : ''}<option value="at">Datum &amp; Uhrzeit …</option></select>
      ${t.priority === 1 && !t.recurrence && t.due_date ? '<span style="font-size:12px;color:var(--p1)">+ Mail (Prio 1)</span>' : ''}</div>

    <label>${icon('pin')}Ort</label>
    <div class="row"><select data-f="place_id"><option value="">–</option>${S.places.map((x) => `<option value="${x.id}" ${x.id === t.place_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__new">Neuer Ort …</option></select>
      ${t.place_id ? `<select data-f="place_event"><option value="arrive" ${t.place_event !== 'leave' ? 'selected' : ''}>beim Ankommen</option><option value="leave" ${t.place_event === 'leave' ? 'selected' : ''}>beim Verlassen</option></select>` : ''}</div>
  </div>

  ${!t.parent_id || true ? `<div class="d-section-title"><span>Unteraufgaben${subs.length ? ` · ${subs.length}` : ''}</span></div>
  <div class="subtasks">${subs.map((s) => taskRow(s, { showProject: false, showParent: false })).join('')}
    <form id="sub-form" class="row" style="display:flex;gap:8px;padding:6px 4px"><input id="sub-input" placeholder="+ Unteraufgabe (Enter)" style="flex:1"></form></div>` : ''}

  <div class="d-foot"><span>Erstellt ${new Date(t.created_at).toLocaleDateString('de-DE')}</span><span>${t.completed_at ? 'Erledigt ' + new Date(t.completed_at).toLocaleString('de-DE') : ''}</span></div>`;
  autosize($('#d-title'));
  autosize($('#d-notes'));
}

function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

let textTimer = null;
function bindDrawer() {
  const panel = $('#drawer-panel');
  $('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') closeDrawer(); });
  // swipe down to close (phones: bottom sheet)
  let startY = null, dy = 0, t0 = 0, dragging = false;
  panel.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 860 || panel.scrollTop > 0 || e.touches.length > 1) return;
    const el = e.target;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && document.activeElement === el) return;
    startY = e.touches[0].clientY; dy = 0; t0 = Date.now(); dragging = false;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const d = e.touches[0].clientY - startY;
    if (!dragging) {
      if (d > 8 && panel.scrollTop <= 0) { dragging = true; panel.style.transition = 'none'; document.activeElement?.blur?.(); }
      else if (d < -4) { startY = null; return; }
      else return;
    }
    dy = Math.max(0, d - 8);
    panel.style.transform = `translateY(${dy}px)`;
    $('#drawer').style.setProperty('--shade', String(Math.max(0, 1 - dy / 400)));
    e.preventDefault();
  }, { passive: false });
  const endDrag = () => {
    if (startY === null) return;
    startY = null;
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
    panel.style.transform = '';
    $('#drawer').style.removeProperty('--shade');
    if (dy > 110 || (fast && dy > 30)) closeDrawer();
  };
  panel.addEventListener('touchend', endDrag);
  panel.addEventListener('touchcancel', endDrag);
  panel.addEventListener('input', (e) => {
    if (e.target.id === 'd-title' || e.target.id === 'd-notes') {
      autosize(e.target);
      clearTimeout(textTimer);
      const id = S.openId;
      const field = e.target.id === 'd-title' ? 'title' : 'notes';
      const val = e.target.value;
      textTimer = setTimeout(() => { if (field === 'title' && !val.trim()) return; saveTask(id, { [field]: field === 'title' ? val.replace(/\n/g, ' ') : val }, { silent: true }).then(() => render()); }, 600);
    }
  });
  panel.addEventListener('keydown', (e) => {
    if (e.target.id === 'd-title' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.target.id === 'label-input' && e.key === 'Enter') { e.preventDefault(); addLabel(e.target.value); }
  });
  panel.addEventListener('focusout', () => setTimeout(() => { if (drawerDeferred) renderDrawer(); }, 0));
  panel.addEventListener('change', async (e) => {
    const t = drawerTask;
    if (!t) return;
    const f = e.target.dataset.f;
    if (e.target.id === 'label-input') return addLabel(e.target.value);
    if (e.target.id === 'add-reminder') {
      const v = e.target.value;
      if (v === '') return;
      let r;
      if (v === 'at') {
        const def = `${t.due_date || S.today}T${t.due_time || '09:00'}`;
        const at = await dialog({ title: 'Erinnerung', fields: [{ name: 'at', type: 'datetime-local', value: def }], ok: 'Hinzufügen' });
        if (!at) return renderDrawer();
        r = { at: at.at.slice(0, 16) };
      } else r = { before: +v };
      return saveTask(t.id, { reminders: [...t.reminders, r] });
    }
    if (e.target.dataset.rec) {
      const rec = { ...t.recurrence };
      if (e.target.dataset.rec === 'interval') rec.interval = Math.max(1, +e.target.value || 1);
      if (e.target.dataset.rec === 'freq') { rec.freq = e.target.value; if (rec.freq !== 'week') delete rec.days; else rec.days = [isoWeekday(t.due_date)]; }
      return saveTask(t.id, { recurrence: rec });
    }
    if (!f) return;
    let v = e.target.value;
    if (f === 'duration_min') {
      if (v === 'custom') {
        const r = await dialog({ title: 'Dauer', fields: [{ name: 'min', label: 'Minuten', type: 'number', value: t.duration_min || 30 }], ok: 'Speichern' });
        if (!r) return renderDrawer();
        v = +r.min || null;
      } else v = v ? +v : null;
      return saveTask(t.id, { duration_min: v });
    }
    if (f === 'recurrence') {
      const d = isoWeekday(t.due_date);
      const map = { '': null, day: { freq: 'day' }, workdays: { freq: 'week', days: [1, 2, 3, 4, 5] }, week: { freq: 'week', days: [d] }, '2week': { freq: 'week', interval: 2, days: [d] }, month: { freq: 'month' }, year: { freq: 'year' }, custom: { freq: 'week', interval: 1, days: [d] } };
      return saveTask(t.id, { recurrence: map[v] });
    }
    if (f === 'place_id' && v === '__new') {
      const r = await dialog({ title: 'Neuer Ort', fields: [{ name: 'name', label: 'Name', placeholder: 'z. B. Zuhause' }], ok: 'Anlegen' });
      if (!r?.name) return renderDrawer();
      const pl = await api('/places', { method: 'POST', body: { name: r.name } });
      if (!S.places.find((x) => x.id === pl.id)) S.places.push(pl);
      return saveTask(t.id, { place_id: pl.id, place_event: 'arrive' });
    }
    if (f === 'due_date') return debouncedSave(t.id, v ? { due_date: v } : { due_date: null, recurrence: null });
    if (f === 'due_time' || f === 'deadline') return debouncedSave(t.id, { [f]: v || null });
    return saveTask(t.id, { [f]: v || null });
  });
  panel.addEventListener('submit', async (e) => {
    if (e.target.id !== 'sub-form') return;
    e.preventDefault();
    const inp = $('#sub-input');
    const text = inp.value.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, { today: S.today, projects: parseProjects() });
    inp.value = '';
    const { tokens, ...fields } = parsed;
    await createTask({ ...fields, title: fields.title || text, parent_id: S.openId });
    setTimeout(() => $('#sub-input')?.focus(), 30);
  });
}

function addLabel(raw) {
  const l = raw.trim().replace(/^@/, '');
  if (!l || !drawerTask || drawerTask.labels.includes(l)) return;
  saveTask(drawerTask.id, { labels: [...drawerTask.labels, l] });
}

// ---------------------------------------------------------------- quick add
let qaDefaults = {};
let qaSkip = new Set();
function openQuickAdd(defaults = {}) {
  qaDefaults = { ...defaults };
  qaSkip = new Set();
  $('#quick-add').classList.add('open');
  $('#quick-add').setAttribute('aria-hidden', 'false');
  $('#qa-input').value = '';
  $('#qa-notes').value = '';
  renderQaTokens();
  setTimeout(() => $('#qa-input').focus(), 20);
}
// ---------------------------------------------------------------- speech input
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function toggleMic() {
  if (rec) { rec.stop(); return; }
  if (!SR) return toast('Spracheingabe wird von diesem Browser nicht unterstützt – nutze das 🎤 der Tastatur.');
  const inp = $('#qa-input');
  const base = inp.value.trim();
  rec = new SR();
  rec.lang = 'de-DE';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  $('#qa-mic').classList.add('on');
  rec.onresult = (e) => {
    const text = [...e.results].map((r) => r[0].transcript).join(' ').trim();
    inp.value = (base ? base + ' ' : '') + text.replace(/[.!?]+$/, '');
    renderQaTokens();
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Mikrofon nicht erlaubt – in den Einstellungen freigeben.');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Spracheingabe: ' + e.error);
  };
  rec.onend = () => { rec = null; $('#qa-mic')?.classList.remove('on'); inp.focus(); };
  try { rec.start(); } catch { rec = null; $('#qa-mic').classList.remove('on'); }
}

function closeQuickAdd() {
  if (rec) rec.abort();
  $('#quick-add').classList.remove('open');
  $('#quick-add').setAttribute('aria-hidden', 'true');
}
function qaParsed() {
  return parseQuickAdd($('#qa-input').value, { today: S.today, projects: parseProjects(), skip: qaSkip });
}
function renderQaTokens() {
  if (!$('#qa-input').value.trim()) qaSkip.clear();
  const p = qaParsed();
  const tokens = p.tokens.map((t) => ({ ...t, key: t.type }));
  if (!p.due_date && qaDefaults.due_date) tokens.unshift({ type: 'date', label: relDate(qaDefaults.due_date, S.today), key: 'def:due_date' });
  if (!p.project_id && qaDefaults.project_id && qaDefaults.project_id !== 'inbox') tokens.push({ type: 'project', label: '#' + projectPath(qaDefaults.project_id), key: 'def:project_id' });
  if (qaDefaults.labels) qaDefaults.labels.forEach((l) => tokens.push({ type: 'label', label: '@' + l, key: 'def:label:' + l }));
  $('#qa-tokens').innerHTML = tokens.map((t) => `<span class="pill t-${t.type}">${esc(t.label)}<button type="button" data-qa-skip="${esc(t.key)}" aria-label="${esc(t.label)} entfernen" title="Entfernen">${icon('x')}</button></span>`).join('');
}
/** removes a recognised token: parsed ones stay as plain text in the title, defaults are dropped */
function dismissQaToken(key) {
  if (key === 'def:due_date') delete qaDefaults.due_date;
  else if (key === 'def:project_id') delete qaDefaults.project_id;
  else if (key.startsWith('def:label:')) qaDefaults.labels = (qaDefaults.labels || []).filter((l) => l !== key.slice(10));
  else {
    qaSkip.add(key);
    // the user wants no date at all, not the view's default
    if (key === 'date') delete qaDefaults.due_date;
    if (key === 'project') delete qaDefaults.project_id;
  }
  renderQaTokens();
  $('#qa-input').focus();
}
async function submitQuickAdd(e) {
  e.preventDefault();
  const raw = $('#qa-input').value.trim();
  if (!raw) return;
  const { tokens, ...p } = qaParsed();
  const input = { ...qaDefaults, ...p, title: p.title || raw, notes: $('#qa-notes').value };
  if (qaDefaults.labels && p.labels) input.labels = [...new Set([...qaDefaults.labels, ...p.labels])];
  try {
    const t = await createTask(input);
    closeQuickAdd();
    if (t._pending) toast(`„${t.title}“ offline gespeichert – wird synchronisiert`);
    else toast(`„${t.title}“ hinzugefügt`, 'Öffnen', () => openTask(t.id));
  } catch (err) {
    toast(err.message);
  }
}

// ---------------------------------------------------------------- drag & drop (project lists)
// Mouse: press and move. Touch: hold ~0.35 s, then drag. Drop reorders the list or moves the
// task into another project section (e.g. a sub-project).
const dnd = { src: null, ghost: null, line: null, target: null, before: null, endAt: 0, sx: 0, sy: 0, timer: null, active: false, scrollRaf: 0, y: 0 };
function dndRows(section) { return [...section.querySelectorAll(':scope > .task:not(.sub)')].filter((r) => r !== dnd.src); }
function dndStart(row, x, y) {
  dnd.active = true;
  dnd.src = row;
  const r = row.getBoundingClientRect();
  const g = row.cloneNode(true);
  g.classList.add('dnd-ghost');
  g.style.width = r.width + 'px';
  g.style.left = r.left + 'px';
  g.dataset.dx = x - r.left; g.dataset.dy = y - r.top;
  document.body.appendChild(g);
  dnd.ghost = g;
  dnd.line = document.createElement('div');
  dnd.line.className = 'dnd-line';
  row.classList.add('dnd-src');
  // its subtasks travel with it
  let n = row.nextElementSibling;
  while (n && n.classList.contains('sub')) { n.classList.add('dnd-src'); n = n.nextElementSibling; }
  document.body.classList.add('dnd-on');
  navigator.vibrate?.(15);
  dndMove(x, y);
}
function dndMove(x, y) {
  if (!dnd.active) return;
  dnd.y = y;
  dnd.ghost.style.top = (y - +dnd.ghost.dataset.dy) + 'px';
  dnd.ghost.style.left = (x - +dnd.ghost.dataset.dx) + 'px';
  const el = document.elementFromPoint(x, y);
  const sec = el?.closest('.section[data-drop-project]');
  if (!sec) return;
  const rows = dndRows(sec);
  let before = rows.find((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; }) || null;
  dnd.target = sec; dnd.before = before;
  if (before) sec.insertBefore(dnd.line, before);
  else { const add = sec.querySelector(':scope > .add-inline'); add ? sec.insertBefore(dnd.line, add) : sec.appendChild(dnd.line); }
  // auto-scroll near the edges
  cancelAnimationFrame(dnd.scrollRaf);
  const edge = 70, vh = window.innerHeight;
  const step = () => {
    if (!dnd.active) return;
    const d = dnd.y < edge ? -12 : dnd.y > vh - edge - 70 ? 12 : 0;
    if (d) { window.scrollBy(0, d); dnd.scrollRaf = requestAnimationFrame(step); }
  };
  step();
}
async function dndEnd(cancel) {
  clearTimeout(dnd.timer); dnd.timer = null;
  if (!dnd.active) { dnd.src = null; return; }
  dnd.active = false;
  dnd.endAt = Date.now();
  cancelAnimationFrame(dnd.scrollRaf);
  document.body.classList.remove('dnd-on');
  dnd.ghost?.remove(); dnd.line?.remove();
  $$('.dnd-src').forEach((r) => r.classList.remove('dnd-src'));
  const id = dnd.src?.dataset.task, sec = dnd.target;
  dnd.src = null;
  if (cancel || !id || !sec) return;
  const t = byId(id);
  if (!t) return;
  const ids = dndRows(sec).map((r) => r.dataset.task).filter((x) => x !== id);
  const at = dnd.before ? ids.indexOf(dnd.before.dataset.task) : ids.length;
  ids.splice(at < 0 ? ids.length : at, 0, id);
  const projectId = sec.dataset.dropProject;
  const moved = t.project_id !== projectId;
  // optimistic
  ids.forEach((x, i) => { const y = byId(x); if (y) y.sort = (i + 1) * 10; });
  if (moved) { t.project_id = projectId; for (const c of S.tasks) if (c.parent_id === id) c.project_id = projectId; }
  render();
  try {
    await api('/tasks/reorder', { method: 'POST', body: { ids, ...(moved ? { move: { id, project_id: projectId } } : {}) } });
    if (moved) toast(`Verschoben nach ${projectPath(projectId)}`);
  } catch (e) {
    toast(e instanceof OfflineError ? 'Offline – Sortieren geht nur mit Verbindung' : e.message);
    refresh({ force: true });
  }
}
function bindDnd() {
  const pickRow = (e) => {
    const row = e.target.closest('.section[data-drop-project] > .task:not(.sub)');
    if (!row || e.target.closest('button, a, input, select, textarea')) return null;
    return row;
  };
  // mouse
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const row = pickRow(e);
    if (!row) return;
    dnd.src = row; dnd.sx = e.clientX; dnd.sy = e.clientY;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dnd.src) return;
    if (!dnd.active) {
      if (Math.hypot(e.clientX - dnd.sx, e.clientY - dnd.sy) < 6) return;
      dndStart(dnd.src, e.clientX, e.clientY);
    }
    e.preventDefault();
    dndMove(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => dndEnd(false));
  // touch: long press
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const row = pickRow(e);
    if (!row) return;
    const tt = e.touches[0];
    dnd.sx = tt.clientX; dnd.sy = tt.clientY;
    clearTimeout(dnd.timer);
    dnd.timer = setTimeout(() => dndStart(row, dnd.sx, dnd.sy), 350);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const tt = e.touches[0];
    if (!dnd.active) {
      if (dnd.timer && Math.hypot(tt.clientX - dnd.sx, tt.clientY - dnd.sy) > 8) { clearTimeout(dnd.timer); dnd.timer = null; }
      return;
    }
    e.preventDefault(); // no scrolling while dragging
    dndMove(tt.clientX, tt.clientY);
  }, { passive: false });
  document.addEventListener('touchend', () => dndEnd(false));
  document.addEventListener('touchcancel', () => dndEnd(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dnd.active) dndEnd(true); });
  // the click that ends a drag must not open the task
  document.addEventListener('click', (e) => { if (Date.now() - dnd.endAt < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  // long press on iOS would otherwise open the text selection / callout
  document.addEventListener('contextmenu', (e) => { if (dnd.active || dnd.timer) e.preventDefault(); });
}

// ---------------------------------------------------------------- due pop-up
// When a task becomes due while the app is in use, a pop-up asks what to do with it.
// Only for moments that pass while the app is actually open: coming back from the
// background never replays what was missed (the push covered that).
const DUE_WINDOW = 10 * 60000;          // never show anything older than 10 min
let activeSince = Date.now();           // when the app last became visible
let dueOpen = null;                     // {t, key, test}
let dueSeen = store.get('dueSeen', {}); // key -> shown at (per device)
let dueSnooze = store.get('dueSnooze', {}); // task id -> ms
const pad2 = (n) => String(n).padStart(2, '0');
const localDT = (d, t) => new Date(`${d}T${t}:00`).getTime();
const ymdOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hmOf = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

function dueMoments(t) {
  const out = [];
  if (t.due_date && t.due_time) out.push(localDT(t.due_date, t.due_time));
  for (const r of t.reminders || []) if (r.at) out.push(localDT(r.at.slice(0, 10), r.at.slice(11, 16)));
  return out;
}

function checkDue() {
  if (document.visibilityState !== 'visible' || dueOpen) return;
  if (document.querySelector('.modal.open')) return; // quick add / dialog open – try again shortly
  const now = Date.now();
  const from = Math.max(activeSince, now - DUE_WINDOW);
  let best = null;
  for (const t of S.tasks) {
    if (t.completed_at || t._pending) continue;
    for (const m of dueMoments(t)) {
      const key = t.id + '@' + m;
      if (m >= from && m <= now && !dueSeen[key] && (!best || m < best.m)) best = { t, key, m };
    }
    const sn = dueSnooze[t.id];
    if (sn && sn <= now) {
      delete dueSnooze[t.id];
      store.set('dueSnooze', dueSnooze);
      if (sn >= from && (!best || sn < best.m)) best = { t, key: t.id + '@snooze' + sn, m: sn };
    }
  }
  if (best) showDue(best.t, best.key);
}

function markDueSeen(key) {
  if (!key) return;
  const cutoff = Date.now() - 3 * 86400000;
  for (const [k, v] of Object.entries(dueSeen)) if (v < cutoff) delete dueSeen[k];
  dueSeen[key] = Date.now();
  store.set('dueSeen', dueSeen);
}

function showDue(t, key, { test = false } = {}) {
  dueOpen = { t, key, test };
  markDueSeen(key);
  const p = project(t.project_id);
  const now = Date.now();
  const meta = [
    t.due_time ? `${relDate(t.due_date, S.today)} · ${t.due_time} Uhr` : '',
    p && p.id !== 'inbox' ? `<span class="proj-dot" style="background:${esc(p.color)}"></span>${esc(projectPath(p.id))}` : '',
    t.priority < 4 ? `<span class="due-prio p${t.priority}">P${t.priority}</span>` : '',
    t.duration_min ? fmtDuration(t.duration_min) : '',
  ].filter(Boolean).join('<span class="sep">·</span>');
  const evening = new Date().getHours() < 18;
  const wrap = document.createElement('div');
  wrap.className = 'modal open due-modal';
  wrap.setAttribute('role', 'alertdialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="due-card prio-${t.priority}">
    <div class="due-kicker">🔔 To-Do fällig${test ? ' · Test' : ''}</div>
    <h2 class="due-title">${esc(t.title)}</h2>
    ${meta ? `<div class="due-meta">${meta}</div>` : ''}
    ${t.notes ? `<p class="due-notes">${esc(t.notes.split('\n')[0].slice(0, 160))}</p>` : ''}
    <div class="due-main">
      <button class="btn primary" data-due="done">${icon('check')}Erledigt</button>
      <button class="btn" data-due="focus">${icon('timer')}Fokus starten</button>
    </div>
    <div class="due-label">Später erinnern</div>
    <div class="due-later">
      <button class="btn" data-due="snooze">10 Min.</button>
      <button class="btn" data-due="hour">+1 Std.</button>
      ${evening ? '<button class="btn" data-due="evening">Heute 19:00</button>' : ''}
      <button class="btn" data-due="tomorrow">Morgen</button>
    </div>
    <button class="due-open" data-due="open">Aufgabe öffnen</button>
  </div>`;
  document.body.appendChild(wrap);
  // blocking: no backdrop click, no Escape – something has to be chosen
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.preventDefault(); });
  wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-due]'); if (b) dueAction(b.dataset.due); });
  setTimeout(() => wrap.querySelector('[data-due="done"]')?.focus(), 30);
}

function closeDue() {
  document.querySelector('.due-modal')?.remove();
  dueOpen = null;
  setTimeout(checkDue, 400); // next one, if several became due at once
}

async function dueAction(act) {
  const { t, test } = dueOpen || {};
  if (!t) return closeDue();
  if (test) {
    closeDue();
    return toast(`Test: „${{ done: 'Erledigt', focus: 'Fokus starten', snooze: '10 Min.', hour: '+1 Std.', evening: 'Heute 19:00', tomorrow: 'Morgen', open: 'Aufgabe öffnen' }[act]}“ gewählt`);
  }
  closeDue();
  const now = Date.now();
  try {
    if (act === 'done') return await complete(t.id);
    if (act === 'focus') return await startFocusFor(t);
    if (act === 'open') return openTask(t.id);
    if (act === 'snooze') {
      dueSnooze[t.id] = now + 10 * 60000;
      store.set('dueSnooze', dueSnooze);
      return toast('Erinnert in 10 Min.');
    }
    let patch;
    if (act === 'hour') { const at = Math.ceil((now + 60 * 60000) / 300000) * 300000; patch = { due_date: ymdOf(at), due_time: hmOf(at) }; }
    if (act === 'evening') patch = { due_date: S.today, due_time: '19:00' };
    if (act === 'tomorrow') patch = { due_date: addDays(S.today, 1), due_time: t.due_time || '09:00' };
    if (patch) {
      await saveTask(t.id, patch);
      toast(`Verschoben auf ${relDate(patch.due_date, S.today)}, ${patch.due_time} Uhr`);
    }
  } catch { /* saveTask/complete already show the error */ }
}

// a task handled on another device closes its pop-up here as well
function revalidateDue() {
  if (!dueOpen || dueOpen.test) return;
  const cur = byId(dueOpen.t.id);
  if (!cur || cur.completed_at || (cur.due_date !== dueOpen.t.due_date || cur.due_time !== dueOpen.t.due_time)) {
    if (!dueOpen.key.includes('@snooze')) { document.querySelector('.due-modal')?.remove(); dueOpen = null; }
  }
}

// ---------------------------------------------------------------- dialogs & toasts
function dialog({ title, fields, ok = 'OK', danger }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal open';
    wrap.innerHTML = `<form class="qa-card" style="max-width:420px"><div style="font-weight:650;font-size:16px;padding:4px 6px 10px">${esc(title)}</div>
      ${fields.map((f) => f.type === 'checkbox' ? `<label class="dlg-check"><input type="checkbox" name="${f.name}" ${f.checked ? 'checked' : ''} ${f.toggles ? `data-toggles="${f.toggles}"` : ''}><span><b>${esc(f.label)}</b>${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</span></label>`
        : f.type === 'select' ? `<label class="dlg-field" data-field="${f.name}" style="display:block;padding:4px 6px 10px"><div style="font-size:13px;color:var(--muted);margin-bottom:4px">${esc(f.label)}</div><select name="${f.name}" style="width:100%;font-size:15px;padding:9px 11px">${f.options}</select></label>`
        : f.type === 'color' ? `<div style="padding:4px 6px 10px"><div style="font-size:13px;color:var(--muted);margin-bottom:6px">${esc(f.label)}</div><div class="days-pick" style="flex-wrap:wrap;gap:6px">${COLORS.map((c) => `<button type="button" data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c === f.value ? 'var(--fg)' : 'transparent'}"></button>`).join('')}</div><input type="hidden" name="${f.name}" value="${esc(f.value || COLORS[0])}"></div>`
        : `<label style="display:block;padding:4px 6px 10px">${f.label ? `<div style="font-size:13px;color:var(--muted);margin-bottom:4px">${esc(f.label)}</div>` : ''}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" style="width:100%;border:1px solid var(--line);font-size:15px;padding:9px 11px"></label>`).join('')}
      <div class="qa-foot">${danger ? `<button type="button" class="btn danger" data-danger>${esc(danger)}</button>` : ''}<div class="qa-btns"><button type="button" class="btn" data-cancel>Abbrechen</button><button class="btn primary">${esc(ok)}</button></div></div></form>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form');
    const done = (v) => { wrap.remove(); resolve(v); };
    const syncToggles = () => form.querySelectorAll('[data-toggles]').forEach((cb) => {
      const target = form.querySelector(`[data-field="${cb.dataset.toggles}"]`);
      if (target) target.hidden = cb.checked;
    });
    form.addEventListener('change', syncToggles);
    syncToggles();
    form.addEventListener('submit', (e) => { e.preventDefault(); done(Object.fromEntries(new FormData(form))); });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-cancel]')) done(null);
      if (e.target.closest('[data-danger]')) done({ __danger: true });
      const c = e.target.closest('[data-color]');
      if (c) {
        form.querySelector('input[type=hidden]').value = c.dataset.color;
        form.querySelectorAll('[data-color]').forEach((b) => { b.style.borderColor = b === c ? 'var(--fg)' : 'transparent'; });
      }
    });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
    setTimeout(() => form.querySelector('input:not([type=hidden])')?.focus(), 20);
  });
}
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

function toast(msg, actionLabel, action) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  $('#toasts').appendChild(el);
  const t = setTimeout(() => el.remove(), actionLabel ? 6000 : 3000);
  if (actionLabel) el.querySelector('button').addEventListener('click', () => { clearTimeout(t); el.remove(); action(); });
}

function projectFields(p, parentId) {
  const hasKids = p ? childProjects(p.id).length > 0 : false;
  return [
    { name: 'name', label: 'Name', value: p ? p.name : '', placeholder: 'z. B. Fundus7' },
    { name: 'is_main', type: 'checkbox', label: 'Hauptprojekt', hint: 'Kann Unterprojekte enthalten', checked: p ? !!p.is_main : false, toggles: 'parent_id' },
    ...(hasKids ? [] : [{ name: 'parent_id', label: 'Einem Hauptprojekt zuordnen', type: 'select', options: mainOptions(p ? p.parent_id : parentId, p?.id) }]),
    { name: 'context', label: 'Bereich (für Fokus-Modus)', type: 'select', options: ['', 'work', 'private'].map((v) => `<option value="${v}" ${(p?.context || '') === v ? 'selected' : ''}>${v === 'work' ? '💼 Arbeit' : v === 'private' ? '🏠 Privat' : '– beides / neutral –'}</option>`).join(''), hint: 'Unterprojekte erben den Bereich des Hauptprojekts' },
    { name: 'color', label: 'Farbe', type: 'color', value: p ? p.color : parentId ? project(parentId)?.color : COLORS[S.projects.length % COLORS.length] },
  ];
}

async function editProject(id) {
  if (offlineBlocked()) return;
  const p = project(id);
  const sub = subtree(id);
  const r = await dialog({ title: 'Projekt bearbeiten', fields: projectFields(p), ok: 'Speichern', danger: 'Löschen' });
  if (!r) return;
  if (r.__danger) {
    const n = open().filter((t) => sub.has(t.project_id)).length;
    const k = sub.size - 1;
    if (!confirm(`Projekt „${p.name}“${k ? ` mit ${k} Unterprojekt(en)` : ''}${n ? ` und ${n} offenen Aufgabe(n)` : ''} löschen?`)) return;
    await api('/projects/' + id, { method: 'DELETE' });
    S.projects = S.projects.filter((x) => !sub.has(x.id));
    S.tasks = S.tasks.filter((t) => !sub.has(t.project_id));
    if (S.route.name === 'project') go(p.parent_id ? '#/project/' + p.parent_id : '#/today'); else render();
    return;
  }
  const isMain = r.is_main === 'on';
  const kids = childProjects(id);
  if (p.is_main && !isMain && kids.length && !confirm(`„${p.name}“ ist dann kein Hauptprojekt mehr. Die ${kids.length} Unterprojekt(e) werden zu normalen Projekten. Fortfahren?`)) return;
  try {
    const body = { name: r.name, color: r.color, is_main: isMain, context: r.context || null };
    if ('parent_id' in r) body.parent_id = isMain ? null : r.parent_id || null;
    const u = await api('/projects/' + id, { method: 'PATCH', body });
    Object.assign(p, u);
    if (!isMain) for (const k of kids) k.parent_id = null;
    if (u.parent_id) { delete collapsed[u.parent_id]; store.set('collapsed', collapsed); }
    render();
  } catch (e) { toast(e.message); }
}

async function newProject(parentId = '') {
  if (offlineBlocked()) return;
  const parent = parentId ? project(parentId) : null;
  const r = await dialog({ title: parent ? `Neues Unterprojekt in „${parent.name}“` : 'Neues Projekt', fields: projectFields(null, parentId), ok: 'Anlegen' });
  if (!r?.name?.trim()) return;
  const isMain = r.is_main === 'on';
  try {
    const p = await api('/projects', { method: 'POST', body: { name: r.name, color: r.color, is_main: isMain, parent_id: isMain ? null : r.parent_id || null, context: r.context || null } });
    S.projects.push(p);
    if (p.parent_id) { delete collapsed[p.parent_id]; store.set('collapsed', collapsed); }
    go('#/project/' + p.id);
  } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- global events
function bindGlobal() {
  window.addEventListener('hashchange', route);
  bindDrawer();
  $('#qa-form').addEventListener('submit', submitQuickAdd);
  $('#qa-input').addEventListener('input', renderQaTokens);
  $('#qa-tokens').addEventListener('pointerdown', (e) => { if (e.target.closest('[data-qa-skip]')) e.preventDefault(); }); // keep keyboard open
  $('#qa-tokens').addEventListener('click', (e) => { const b = e.target.closest('[data-qa-skip]'); if (b) dismissQaToken(b.dataset.qaSkip); });
  $('#qa-cancel').addEventListener('click', closeQuickAdd);
  if (!SR) $('#qa-mic').hidden = true;
  $('#qa-mic').addEventListener('click', toggleMic);
  $('#quick-add').addEventListener('click', (e) => { if (e.target.id === 'quick-add') closeQuickAdd(); });
  $('#qa-notes').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitQuickAdd(e); });
  $('#quick-add-btn').addEventListener('click', () => openQuickAdd(defaultsForRoute()));
  $('#fab').addEventListener('click', () => openQuickAdd(defaultsForRoute()));
  $('#menu-btn').addEventListener('click', () => $('#app').classList.toggle('menu-open'));
  $('#scrim').addEventListener('click', () => $('#app').classList.remove('menu-open'));
  $('#sidebar').addEventListener('click', (e) => { if (e.target.closest('a')) $('#app').classList.remove('menu-open'); });
  let st;
  $('#add-project').addEventListener('click', () => newProject());

  document.addEventListener('click', async (e) => {
    const el = e.target;
    const chk = el.closest('[data-check]');
    if (chk) { e.preventDefault(); e.stopPropagation(); return complete(chk.dataset.check); }
    const tg = el.closest('[data-toggle-project]');
    if (tg) {
      e.preventDefault(); e.stopPropagation();
      const pid = tg.dataset.toggleProject;
      if (collapsed[pid]) delete collapsed[pid]; else collapsed[pid] = 1;
      store.set('collapsed', collapsed);
      return renderNav();
    }
    const nsp = el.closest('[data-new-subproject]');
    if (nsp) return newProject(nsp.dataset.newSubproject);
    const ep = el.closest('[data-edit-project]');
    if (ep) { e.preventDefault(); e.stopPropagation(); return editProject(ep.dataset.editProject); }
    if (el.closest('[data-menu]')) { e.preventDefault(); $('#app').classList.add('menu-open'); return; }
    const add = el.closest('[data-add]');
    if (add) return openQuickAdd(JSON.parse(add.dataset.add));
    const act = el.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'close') return closeDrawer();
      if (a === 'delete') {
        const t = drawerTask;
        if (offlineBlocked()) return;
        if (!confirm(`„${t.title}“ löschen?`)) return;
        await api('/tasks/' + t.id, { method: 'DELETE' });
        S.tasks = S.tasks.filter((x) => x.id !== t.id && x.parent_id !== t.id);
        closeDrawer();
        render();
        return toast('Gelöscht');
      }
      try { return await settingsAction(a, act); } catch (err) { return toast(err.message); }
    }
    const prio = el.closest('[data-prio]');
    if (prio) return saveTask(drawerTask.id, { priority: +prio.dataset.prio });
    const qd = el.closest('[data-quick-date]');
    if (qd) return saveTask(drawerTask.id, qd.dataset.quickDate ? { due_date: qd.dataset.quickDate } : { due_date: null, recurrence: null });
    const cl = el.closest('[data-clear]');
    if (cl) return saveTask(drawerTask.id, { [cl.dataset.clear]: null, ...(cl.dataset.clear === 'due_time' ? { reminders: drawerTask.reminders.filter((r) => r.at) } : {}) });
    const dl = el.closest('[data-del-label]');
    if (dl) return saveTask(drawerTask.id, { labels: drawerTask.labels.filter((l) => l !== dl.dataset.delLabel) });
    const dr = el.closest('[data-del-reminder]');
    if (dr) return saveTask(drawerTask.id, { reminders: drawerTask.reminders.filter((_, i) => i !== +dr.dataset.delReminder) });
    const rd = el.closest('[data-rec-day]');
    if (rd) {
      const d = +rd.dataset.recDay;
      const days = new Set(drawerTask.recurrence.days || []);
      days.has(d) ? days.delete(d) : days.add(d);
      if (!days.size) return;
      return saveTask(drawerTask.id, { recurrence: { ...drawerTask.recurrence, days: [...days].sort() } });
    }
    const dp = el.closest('[data-del-place]');
    if (dp) {
      if (!confirm('Ort löschen?')) return;
      await api('/places/' + dp.dataset.delPlace, { method: 'DELETE' });
      S.places = S.places.filter((p) => p.id !== dp.dataset.delPlace);
      return viewSettings();
    }
    if (el.closest('#search-btn')) return go('#/search');
    if (el.closest('#refresh-btn')) return manualRefresh();
    if (el.closest('#mode-pill')) return openModeMenu();
    const sp = el.closest('[data-span]');
    if (sp) { store.set('weekSpan', sp.dataset.span === 'm' ? 'm' : +sp.dataset.span); return go('#/week'); }
    const od = el.closest('[data-open-day]');
    if (od) { store.set('weekSpan', 1); return go('#/week/' + od.dataset.openDay); }
    if (el.closest('#focus-pill') || el.closest('[data-focus-panel]')) return openFocusPanel();
    const fs = el.closest('[data-focus-start]');
    if (fs) return startFocusFor(byId(fs.dataset.focusStart));
    if (el.closest('#sync')) { if (queue.length) return sync(); return refresh(); }
    const wd = el.closest('[data-workday]');
    if (wd) {
      wd.classList.toggle('on');
      const days = $$('#work-days [data-workday].on').map((b) => b.dataset.workday).join(',');
      S.settings = await api('/settings', { method: 'PATCH', body: { work_days: days } });
      S.mode = await api('/mode'); renderMode();
      return toast('Gespeichert');
    }
    const wc = el.closest('[data-workcolor]');
    if (wc) {
      wc.classList.toggle('on');
      const cols = $$('[data-workcolor].on').map((b) => b.dataset.workcolor).join(',');
      S.settings = await api('/settings', { method: 'PATCH', body: { work_colors: cols } });
      S.cal.clear();
      return toast('Gespeichert');
    }
    const ce = el.closest('[data-copy-el]');
    if (ce) return copy($('#' + ce.dataset.copyEl).textContent);
    const cp = el.closest('[data-copy]');
    if (cp) return copy(cp.dataset.copy);
    if (el.closest('[data-reschedule-overdue]')) {
      const list = open().filter((t) => t.due_date && t.due_date < S.today);
      for (const t of list) await saveTask(t.id, { due_date: S.today, ...(t.due_time ? { due_time: t.due_time } : {}) }, { silent: true });
      render();
      return toast(`${list.length} Aufgabe(n) auf heute verschoben`);
    }
    const url = el.closest('[data-url]');
    if (url && url.dataset.url) return window.open(url.dataset.url, '_blank', 'noopener');
    const row = el.closest('[data-task]');
    if (row && !el.closest('a')) return openTask(row.dataset.task);
  });

  document.addEventListener('change', async (e) => {
    const k = e.target.dataset?.setting;
    if (!k) return;
    try {
      S.settings = await api('/settings', { method: 'PATCH', body: { [k]: e.target.value } });
      if (k.startsWith('work_')) { S.mode = await api('/mode'); renderMode(); }
      toast('Gespeichert');
    } catch (err) { toast(err.message); }
  });

  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === 'Escape') {
      if ($('#quick-add').classList.contains('open')) return closeQuickAdd();
      if (S.openId) return closeDrawer();
      $('#app').classList.remove('menu-open');
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'q' || e.key === 'n') { e.preventDefault(); openQuickAdd(defaultsForRoute()); }
    if (e.key === '/') { e.preventDefault(); go('#/search'); }
  });
}

function defaultsForRoute() {
  const r = S.route;
  if (r.name === 'today' || r.name === 'dashboard') return { due_date: S.today };
  if (r.name === 'project') return { project_id: r.arg };
  if (r.name === 'label') return { labels: [r.arg] };
  return {};
}

// iOS Safari ignores user-scalable=no in some cases: block pinch gestures explicitly
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('input, textarea, select, button, a, [data-task], [data-check]')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

boot();
