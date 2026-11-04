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
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
};
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
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    setOnline(false);
    throw new OfflineError('Keine Verbindung');
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
  });
  // tasks created offline that are not on the server yet
  for (const q of queue) if (q.op === 'create' && !S.tasks.some((t) => t.id === q.id)) S.tasks.push(q.task);
  for (const q of queue) if (q.op === 'complete') S.tasks = S.tasks.filter((t) => t.id !== q.id && t.parent_id !== q.id);
}

function markSynced(b) {
  net.lastSync = new Date().toISOString();
  store.set('lastSync', net.lastSync);
  store.set('bootstrap', b);
  renderSync();
}

async function boot() {
  try {
    const b = await api('/bootstrap');
    applyBootstrap(b);
    markSynced(b);
  } catch (e) {
    if (!$('#login').hidden) return;
    const cached = store.get('bootstrap', null);
    if (e instanceof OfflineError && cached) {
      applyBootstrap(cached);
      // the cached "today" may be stale
      const d = new Date();
      S.today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      document.body.innerHTML = `<div class="login"><div class="login-card"><h1>${e instanceof OfflineError ? 'Offline' : 'Fehler'}</h1><p>${esc(e instanceof OfflineError ? 'Keine Verbindung und noch keine gespeicherten Daten auf diesem Gerät.' : e.message)}</p><a class="btn" href="/">Neu laden</a></div></div>`;
      return;
    }
  }
  $('#login').hidden = true;
  $('#app').hidden = false;
  for (const [k, v] of Object.entries(store.get('cal', {}))) S.cal.set(k, { at: 0, data: v });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  bindGlobal();
  route();
  renderSync();
  if (queue.length && net.online) sync();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, net.online ? 60000 : 60000);
  setInterval(() => { if (!net.online && document.visibilityState === 'visible') refresh(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('online', () => refresh());
  window.addEventListener('offline', () => setOnline(false));
}

let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    if (queue.length) await sync({ silent: true });
    const b = await api('/bootstrap');
    const dayChanged = b.today !== S.today;
    applyBootstrap(b);
    markSynced(b);
    if (dayChanged) S.cal.clear();
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!typing) { render(); if (S.openId) renderDrawer(); }
    else renderNav();
  } catch { /* offline – ignore */ } finally { refreshing = false; }
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
}

// ---------------------------------------------------------------- derived
const open = () => S.tasks;
const byId = (id) => S.tasks.find((t) => t.id === id);
const project = (id) => S.projects.find((p) => p.id === id);
const endOfWeek = (d) => addDays(d, 7 - isoWeekday(d));
const mondayOf = (d) => addDays(d, 1 - isoWeekday(d));

function counts() {
  const t = S.today;
  const eow = endOfWeek(t);
  let overdue = 0, today = 0, week = 0, mins = 0;
  for (const x of open()) {
    if (!x.due_date) continue;
    if (x.due_date < t) overdue++;
    if (x.due_date === t) { today++; mins += x.duration_min || 0; }
    if (x.due_date <= eow) week++;
  }
  return { overdue, today, week, total: open().length, mins, inbox: open().filter((x) => x.project_id === 'inbox' && !x.parent_id).length };
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
  return evs.filter((e) => {
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
  if (['today', 'week', 'upcoming', 'inbox', 'completed', 'settings'].includes(name)) return { name, arg };
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
  renderNav();
  const r = S.route;
  $('#top-actions').innerHTML = '';
  $('#view-sub').textContent = '';
  const views = { today: viewToday, week: viewWeek, upcoming: viewUpcoming, inbox: () => viewProject('inbox'), project: () => viewProject(r.arg), label: () => viewLabel(r.arg), search: () => viewSearch(r.arg), completed: viewCompleted, settings: viewSettings };
  (views[r.name] || viewToday)();
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
    item('#/today', icon('today'), 'Heute', c.today + c.overdue || '', active('today')).replace('class="count"', c.overdue ? 'class="count alert"' : 'class="count"') +
    item('#/week', icon('week'), 'Diese Woche', c.week || '', active('week')) +
    item('#/upcoming', icon('upcoming'), 'Demnächst', '', active('upcoming')) +
    item('#/inbox', icon('inbox'), 'Eingang', c.inbox || '', active('inbox'));

  const perProject = new Map();
  for (const t of open()) if (!t.parent_id) perProject.set(t.project_id, (perProject.get(t.project_id) || 0) + 1);
  $('#nav-projects').innerHTML = S.projects.filter((p) => p.id !== 'inbox').map((p) =>
    `<a href="#/project/${p.id}" class="nav-item${active('project', p.id)}"><span class="dot" style="background:${esc(p.color)}"></span><span>${esc(p.name)}</span><span class="count">${perProject.get(p.id) || ''}</span><button class="icon-btn sm nav-edit" data-edit-project="${p.id}" aria-label="Projekt bearbeiten">${icon('more')}</button></a>`).join('') ||
    '<div class="nav-item" style="color:var(--faint);cursor:default">Noch keine Projekte</div>';

  const labels = allLabels();
  $('#labels-head').hidden = !labels.length;
  $('#nav-labels').innerHTML = labels.map(([l, n]) =>
    `<a href="#/label/${encodeURIComponent(l)}" class="nav-item${active('label', l)}"><span class="hash">@</span><span>${esc(l)}</span><span class="count">${n}</span></a>`).join('');

  $$('.sidebar-foot .nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === r.name));

  $('#tabbar').innerHTML = [
    ['#/today', 'today', 'Heute', c.today + c.overdue],
    ['#/week', 'week', 'Woche', 0],
    ['#/upcoming', 'upcoming', 'Demnächst', 0],
    ['#/inbox', 'inbox', 'Eingang', 0],
  ].map(([h, n, l, b]) => `<a href="${h}" class="${r.name === n ? 'active' : ''}">${icon(n)}<span>${l}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('') +
    `<a href="#" data-menu>${icon('menu')}<span>Mehr</span></a>`;
}

function setTitle(title, sub) {
  $('#view-title').textContent = title;
  $('#view-sub').textContent = sub || '';
}

function statsHtml() {
  const c = counts();
  const totalToday = c.today + c.overdue + S.doneToday;
  const pct = totalToday ? Math.round((S.doneToday / totalToday) * 100) : 0;
  const R = 17, L = 2 * Math.PI * R;
  return `<div class="stats">
    <a class="stat c1" href="#/today"><div class="ico">${icon('today')}</div><div style="min-width:0"><div class="num">${c.today + c.overdue}</div><div class="lbl">Heute offen</div>${c.overdue ? `<div class="lbl alert">${c.overdue} überfällig</div>` : ''}</div></a>
    <a class="stat c2" href="#/week"><div class="ico">${icon('week')}</div><div style="min-width:0"><div class="num">${c.week}</div><div class="lbl">Diese Woche</div></div></a>
    <a class="stat c3" href="#/upcoming"><div class="ico">${icon('layers')}</div><div style="min-width:0"><div class="num">${c.total}</div><div class="lbl">Insgesamt offen</div></div></a>
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

function taskRow(t, { showProject = true, showDate = true, sub = false, showParent = true } = {}) {
  const meta = [];
  if (showDate && t.due_date) meta.push(`<span class="${dueClass(t)}">${icon('cal')}${relDate(t.due_date, S.today)}${t.due_time ? ' ' + t.due_time : ''}</span>`);
  else if (t.due_time) meta.push(`<span class="${dueClass(t)}">${icon('clock')}${t.due_time}</span>`);
  if (t.duration_min) meta.push(`<span>${icon('timer')}${fmtDuration(t.duration_min)}</span>`);
  if (t.recurrence) meta.push(`<span title="${esc(recurrenceLabel(t.recurrence))}">${icon('repeat')}</span>`);
  const subs = open().filter((s) => s.parent_id === t.id).length;
  if (subs) meta.push(`<span>${icon('sub')}${subs}</span>`);
  if (t.place_id) meta.push(`<span>${icon('pin')}${esc(S.places.find((p) => p.id === t.place_id)?.name || '')}</span>`);
  for (const l of t.labels) meta.push(`<span class="label">@${esc(l)}</span>`);
  if (t._pending) meta.push(`<span class="pending">${icon('clock')}wartet auf Sync</span>`);
  if (showParent && t.parent_id && byId(t.parent_id)) meta.push(`<span>↳ ${esc(byId(t.parent_id).title)}</span>`);
  const p = project(t.project_id);
  const showP = showProject && p && p.id !== 'inbox';
  if (showP) meta.push(`<span class="proj-meta"><span class="proj-dot" style="background:${esc(p.color)}"></span>${esc(p.name)}</span>`);
  const right = showP ? `<div class="t-right"><span>${esc(p.name)}</span><span class="proj-dot" style="width:8px;height:8px;border-radius:50%;background:${esc(p.color)}"></span></div>` : '';
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
  setTitle('Heute', fmtLongDate(t) + (c.mins ? ` · ${fmtMins(c.mins)} geplant` : ''));
  const overdue = sortTasks(open().filter((x) => x.due_date && x.due_date < t));
  const today = sortTasks(open().filter((x) => x.due_date === t));
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

  $('#content').innerHTML = `${statsHtml()}
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
    html += `<div class="timeline" style="height:${(endH - startH) * PX}px">`;
    for (let h = startH; h <= endH; h++) html += `<div class="hour" style="top:${(h - startH) * PX}px"><span>${String(h).padStart(2, '0')}:00</span></div>`;
    for (const it of items) {
      const top = y(it.s), height = Math.max(20, y(it.e) - top - 2);
      const w = 100 / it.cols;
      const color = it.kind === 'task' ? (it.prio === 4 ? 'var(--accent)' : `var(--p${it.prio})`) : esc(it.color);
      const past = nowMin !== null && it.e <= nowMin ? ' past' : '';
      html += `<div class="block${it.kind === 'task' ? ' task-block' : ''}${past}" style="--c:${color};top:${top}px;height:${height}px;left:calc(${it.col * w}% + 2px);width:calc(${w}% - 4px)" ${it.id ? `data-task="${it.id}"` : `data-url="${esc(it.url || '')}"`}><b>${it.kind === 'task' ? '☐ ' : ''}${esc(it.title)}</b>${height > 34 ? `<small>${esc(it.sub)}</small>` : ''}</div>`;
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

function viewWeek() {
  const monday = S.route.arg && /^\d{4}-\d{2}-\d{2}$/.test(S.route.arg) ? mondayOf(S.route.arg) : mondayOf(S.today);
  const sunday = addDays(monday, 6);
  const isThis = monday === mondayOf(S.today);
  const [, m1, d1] = monday.split('-').map(Number);
  const [, m2, d2] = sunday.split('-').map(Number);
  const tasksInWeek = open().filter((t) => t.due_date >= monday && t.due_date <= sunday);
  const mins = tasksInWeek.reduce((n, t) => n + (t.duration_min || 0), 0);
  setTitle(isThis ? 'Diese Woche' : `KW ${isoWeekNo(monday)}`, `${d1}. ${MONTHS[m1 - 1].slice(0, 3)} – ${d2}. ${MONTHS[m2 - 1].slice(0, 3)} · ${tasksInWeek.length} Aufgaben${mins ? ' · ' + fmtMins(mins) : ''}`);
  $('#top-actions').innerHTML = `<div class="week-nav"><a class="icon-btn" href="#/week/${addDays(monday, -7)}" aria-label="Vorherige Woche">${icon('left')}</a>${isThis ? '' : '<a class="btn sm" href="#/week">Heute</a>'}<a class="icon-btn" href="#/week/${addDays(monday, 7)}" aria-label="Nächste Woche">${icon('right')}</a></div>`;
  const draw = (data) => {
    const evs = data?.events || [];
    let html = isThis ? statsHtml() : '';
    html += '<div class="week">';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const isToday = d === S.today;
      const thisWeek = monday <= S.today && S.today <= sunday;
      let dayTasks = open().filter((t) => t.due_date === d && !(thisWeek && d < S.today));
      if (isToday) dayTasks = [...open().filter((t) => t.due_date && t.due_date < S.today), ...dayTasks];
      dayTasks = sortTasks(dayTasks);
      const dayEv = eventsOn(evs, d);
      const load = dayTasks.filter((t) => t.due_date === d).reduce((n, t) => n + (t.duration_min || 0), 0);
      if (d < S.today && !dayTasks.length && !dayEv.length && window.innerWidth < 860) continue;
      html += `<div class="day-col${isToday ? ' is-today' : ''}${d < S.today ? ' is-past' : ''}" data-day="${d}">
        <div class="day-head"><div><div class="wd">${WD_SHORT[i + 1]}</div><div class="dn">${+d.slice(8, 10)}.</div></div><div class="load">${dayTasks.length ? dayTasks.length + (dayTasks.length === 1 ? ' Aufgabe' : ' Aufgaben') : ''}${load ? '<br>' + fmtShort(load) : ''}</div></div>
        <div class="day-body">
          ${dayEv.map((e) => `<div class="ev" style="--c:${esc(e.color)}" data-url="${esc(e.url || '')}"><b>${esc(e.title)}</b><small>${e.allDay ? 'ganztägig' : timeOf(e.start) + '–' + timeOf(e.end)}</small></div>`).join('')}
          ${dayTasks.map((t) => `<div class="wtask prio-${t.priority}" data-task="${t.id}" draggable="true"><button class="check" data-check="${t.id}" aria-label="Erledigen"></button><div class="tt">${esc(t.title)}<small>${[t.due_date < d ? '<span style="color:var(--danger)">überfällig</span>' : '', t.due_time || '', t.duration_min ? fmtDuration(t.duration_min) : '', t.recurrence ? '↻' : ''].filter(Boolean).join(' · ')}</small></div></div>`).join('')}
          ${d >= S.today ? addInline({ due_date: d }, 'Hinzufügen') : ''}
        </div></div>`;
    }
    html += '</div>';
    if (data && !data.connected) html += `<div class="cal-note">Termine fehlen: Google Kalender ist nicht verbunden.</div>`;
    $('#content').innerHTML = html;
    bindWeekDnD();
  };
  const from = monday, to = addDays(monday, 7);
  draw(cachedEvents(from, to));
  const routeAtStart = location.hash;
  events(from, to).then((d) => { if (location.hash === routeAtStart && S.route.name === 'week') draw(d); });
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

function viewUpcoming() {
  setTitle('Demnächst', 'Ab morgen');
  const start = addDays(S.today, 1);
  const days = 14;
  const future = sortTasks(open().filter((t) => t.due_date && t.due_date >= start));
  const dates = new Set();
  for (let i = 0; i < days; i++) dates.add(addDays(start, i));
  for (const t of future) dates.add(t.due_date);
  const sorted = [...dates].sort();
  const draw = (data) => {
    const evs = data?.events || [];
    let html = statsHtml();
    for (const d of sorted) {
      const ts = future.filter((t) => t.due_date === d);
      const ev = eventsOn(evs, d);
      const mins = ts.reduce((n, t) => n + (t.duration_min || 0), 0);
      const rel = relDate(d, S.today);
      const long = fmtLongDate(d);
      html += `<div class="panel day-group"><div class="panel-head"><h2>${esc(rel === long.split(',')[0] ? long : rel)} ${rel !== long && rel !== long.split(',')[0] ? `<span class="rel">${esc(long)}</span>` : ''}</h2><span class="meta">${[ts.length ? ts.length + ' Aufg.' : '', mins ? fmtMins(mins) : ''].filter(Boolean).join(' · ')}</span></div>
        ${ev.length ? `<div class="ev-line">${ev.map((e) => `<span class="chip" data-url="${esc(e.url || '')}"><span class="dot" style="background:${esc(e.color)}"></span><span>${e.allDay ? '' : timeOf(e.start) + ' '}${esc(e.title)}</span></span>`).join('')}</div>` : ''}
        <div class="section" style="padding-top:0">${ts.map((t) => taskRow(t, { showDate: false })).join('')}${addInline({ due_date: d })}</div></div>`;
    }
    $('#content').innerHTML = html;
  };
  const from = start, to = addDays(start, days);
  draw(cachedEvents(from, to));
  events(from, to).then((d) => { if (S.route.name === 'upcoming') draw(d); });
}

function nestedList(list, opts) {
  const ids = new Set(list.map((t) => t.id));
  const roots = sortTasks(list.filter((t) => !t.parent_id || !ids.has(t.parent_id)));
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
  const list = open().filter((t) => t.project_id === id);
  const mins = list.reduce((n, t) => n + (t.duration_min || 0), 0);
  setTitle(p.name, `${list.filter((t) => !t.parent_id).length} offene Aufgaben${mins ? ' · ' + fmtMins(mins) : ''}`);
  if (id !== 'inbox') $('#top-actions').innerHTML = `<button class="icon-btn" data-edit-project="${id}" aria-label="Projekt bearbeiten">${icon('more')}</button>`;
  const dated = list.filter((t) => t.due_date || (t.parent_id && list.find((x) => x.id === t.parent_id)?.due_date));
  $('#content').innerHTML = `<div class="panel"><div class="section">${list.length ? nestedList(list, { showProject: false }) : emptyHtml(id === 'inbox' ? '📥' : '✨', id === 'inbox' ? 'Eingang ist leer.' : 'Keine offenen Aufgaben.')}${addInline({ project_id: id })}</div></div>`;
  void dated;
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
      $('#search').value = v;
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

// ---------------------------------------------------------------- settings
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

    <div class="panel">
      <h2>Konto</h2>
      <div class="row"><span>${esc(S.email)}</span><a class="btn sm" href="/auth/logout">Abmelden</a></div>
    </div>
  </div>`;
  api('/location-token').then((d) => {
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
  try {
    const t = await api('/tasks/' + id, { method: 'PATCH', body: patch });
    upsert(t);
    if (patch.project_id) {
      // children follow parent
      for (const c of S.tasks.filter((x) => x.parent_id === id)) c.project_id = patch.project_id;
    }
    if (!silent) { render(); if (S.openId === id) renderDrawer(); }
    return t;
  } catch (e) {
    toast(e.message);
    throw e;
  }
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

async function complete(id) {
  const before = byId(id);
  if (!before) return;
  const rows = $$(`[data-task="${id}"]`);
  rows.forEach((r) => r.classList.add('done-anim'));
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
    setTimeout(render, 220);
    if (net.online) sync({ silent: true });
    return;
  }
  try {
    const r = await api(`/tasks/${id}/complete`, { method: 'POST' });
    S.doneToday++;
    if (r.recurred) {
      upsert(r.task);
      toast(`Erledigt · nächstes Mal ${relDate(r.task.due_date, S.today)}`, 'Rückgängig', async () => {
        await saveTask(id, { due_date: before.due_date, ...(before.due_time ? { due_time: before.due_time } : {}) });
        S.doneToday = Math.max(0, S.doneToday - 1);
        render();
      });
    } else {
      const removed = S.tasks.filter((t) => t.id === id || t.parent_id === id);
      S.tasks = S.tasks.filter((t) => !removed.includes(t));
      toast('Erledigt', 'Rückgängig', async () => {
        const t = await api(`/tasks/${id}/uncomplete`, { method: 'POST' });
        upsert(t);
        S.doneToday = Math.max(0, S.doneToday - 1);
        refresh();
        render();
      });
      if (S.openId === id) closeDrawer();
    }
    setTimeout(() => { render(); if (S.openId && S.openId !== id) renderDrawer(); }, 220);
  } catch (e) {
    rows.forEach((x) => x.classList.remove('done-anim'));
    if (e instanceof OfflineError) return complete(id);
    toast(e.message);
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
  if (!r || r.name === 'today') return '#/today';
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

function renderDrawer() {
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
  <div class="d-top"><div class="crumb">${p ? `<span class="dot" style="width:9px;height:9px;border-radius:50%;background:${esc(p.color)}"></span>${esc(p.name)}` : ''}${parent ? ` <span>›</span> <a href="#/task/${parent.id}" style="overflow:hidden;text-overflow:ellipsis">${esc(parent.title)}</a>` : ''}</div>
    <button class="icon-btn" data-act="delete" aria-label="Löschen">${icon('trash')}</button>
    <button class="icon-btn" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
  <div class="d-title-row task prio-${t.priority}${t.completed_at ? ' completed' : ''}" style="padding:0;cursor:default;background:none">
    <button class="check" data-check="${t.id}" aria-label="Erledigen">${icon('check')}</button>
    <textarea class="d-title" id="d-title" rows="1">${esc(t.title)}</textarea>
  </div>
  <textarea class="d-notes" id="d-notes" placeholder="Beschreibung / Notizen …">${esc(t.notes)}</textarea>
  <div class="d-grid">
    <label>${icon('folder')}Projekt</label>
    <div class="row"><select data-f="project_id">${S.projects.map((x) => `<option value="${x.id}" ${x.id === t.project_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>

    <label>${icon('cal')}Datum</label>
    <div class="row"><input type="date" data-f="due_date" value="${t.due_date || ''}">${t.due_date ? `<button class="icon-btn sm" data-quick-date="" aria-label="Datum entfernen">${icon('x')}</button>` : ''}<button class="btn sm ghost" data-quick-date="${S.today}">Heute</button><button class="btn sm ghost" data-quick-date="${addDays(S.today, 1)}">Morgen</button></div>

    <label>${icon('clock')}Uhrzeit</label>
    <div class="row"><input type="time" data-f="due_time" value="${t.due_time || ''}" ${t.due_date ? '' : 'disabled'}>${t.due_time ? `<button class="icon-btn sm" data-clear="due_time" aria-label="Uhrzeit entfernen">${icon('x')}</button>` : ''}</div>

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
    if (f === 'due_date') return saveTask(t.id, v ? { due_date: v } : { due_date: null, recurrence: null });
    return saveTask(t.id, { [f]: v || null });
  });
  panel.addEventListener('submit', async (e) => {
    if (e.target.id !== 'sub-form') return;
    e.preventDefault();
    const inp = $('#sub-input');
    const text = inp.value.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, { today: S.today, projects: S.projects });
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
function openQuickAdd(defaults = {}) {
  qaDefaults = defaults;
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
  return parseQuickAdd($('#qa-input').value, { today: S.today, projects: S.projects });
}
function renderQaTokens() {
  const p = qaParsed();
  const tokens = [...p.tokens];
  if (!p.due_date && qaDefaults.due_date) tokens.unshift({ type: 'date', label: relDate(qaDefaults.due_date, S.today) });
  if (!p.project_id && qaDefaults.project_id && qaDefaults.project_id !== 'inbox') tokens.push({ type: 'project', label: '#' + (project(qaDefaults.project_id)?.name || '') });
  if (qaDefaults.labels) qaDefaults.labels.forEach((l) => tokens.push({ type: 'label', label: '@' + l }));
  $('#qa-tokens').innerHTML = tokens.map((t) => `<span class="pill t-${t.type}">${esc(t.label)}</span>`).join('');
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

// ---------------------------------------------------------------- dialogs & toasts
function dialog({ title, fields, ok = 'OK', danger }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal open';
    wrap.innerHTML = `<form class="qa-card" style="max-width:420px"><div style="font-weight:650;font-size:16px;padding:4px 6px 10px">${esc(title)}</div>
      ${fields.map((f) => f.type === 'color' ? `<div style="padding:4px 6px 10px"><div style="font-size:13px;color:var(--muted);margin-bottom:6px">${esc(f.label)}</div><div class="days-pick" style="flex-wrap:wrap;gap:6px">${COLORS.map((c) => `<button type="button" data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c === f.value ? 'var(--fg)' : 'transparent'}"></button>`).join('')}</div><input type="hidden" name="${f.name}" value="${esc(f.value || COLORS[0])}"></div>`
        : `<label style="display:block;padding:4px 6px 10px">${f.label ? `<div style="font-size:13px;color:var(--muted);margin-bottom:4px">${esc(f.label)}</div>` : ''}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" style="width:100%;border:1px solid var(--line);font-size:15px;padding:9px 11px"></label>`).join('')}
      <div class="qa-foot">${danger ? `<button type="button" class="btn danger" data-danger>${esc(danger)}</button>` : ''}<div class="qa-btns"><button type="button" class="btn" data-cancel>Abbrechen</button><button class="btn primary">${esc(ok)}</button></div></div></form>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form');
    const done = (v) => { wrap.remove(); resolve(v); };
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

async function editProject(id) {
  const p = project(id);
  const r = await dialog({ title: 'Projekt bearbeiten', fields: [{ name: 'name', label: 'Name', value: p.name }, { name: 'color', label: 'Farbe', type: 'color', value: p.color }], ok: 'Speichern', danger: 'Löschen' });
  if (!r) return;
  if (r.__danger) {
    const n = open().filter((t) => t.project_id === id).length;
    if (!confirm(`Projekt „${p.name}“${n ? ` und ${n} offene Aufgabe(n)` : ''} löschen?`)) return;
    await api('/projects/' + id, { method: 'DELETE' });
    S.projects = S.projects.filter((x) => x.id !== id);
    S.tasks = S.tasks.filter((t) => t.project_id !== id);
    if (S.route.name === 'project') go('#/today'); else render();
    return;
  }
  const u = await api('/projects/' + id, { method: 'PATCH', body: { name: r.name, color: r.color } });
  Object.assign(p, u);
  render();
}

// ---------------------------------------------------------------- global events
function bindGlobal() {
  window.addEventListener('hashchange', route);
  bindDrawer();
  $('#qa-form').addEventListener('submit', submitQuickAdd);
  $('#qa-input').addEventListener('input', renderQaTokens);
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
  $('#search').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => {
      const q = e.target.value.trim();
      if (S.route.name === 'search' && $('#search-big')) {
        $('#search-big').value = q;
        S.route.arg = q;
        history.replaceState(null, '', '#/search' + (q ? '/' + encodeURIComponent(q) : ''));
        renderSearchResults(q);
      } else if (q) go('#/search/' + encodeURIComponent(q));
    }, 150);
  });
  $('#add-project').addEventListener('click', async () => {
    const r = await dialog({ title: 'Neues Projekt', fields: [{ name: 'name', label: 'Name', placeholder: 'z. B. Arbeit' }, { name: 'color', label: 'Farbe', type: 'color', value: COLORS[S.projects.length % COLORS.length] }], ok: 'Anlegen' });
    if (!r?.name?.trim()) return;
    const p = await api('/projects', { method: 'POST', body: r });
    S.projects.push(p);
    go('#/project/' + p.id);
  });

  document.addEventListener('click', async (e) => {
    const el = e.target;
    const chk = el.closest('[data-check]');
    if (chk) { e.preventDefault(); e.stopPropagation(); return complete(chk.dataset.check); }
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
    if (el.closest('#sync')) { if (queue.length) return sync(); return refresh(); }
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
    if (e.key === '/') { e.preventDefault(); if (window.innerWidth > 860) $('#search').focus(); else go('#/search'); }
  });
}

function defaultsForRoute() {
  const r = S.route;
  if (r.name === 'today') return { due_date: S.today };
  if (r.name === 'project') return { project_id: r.arg };
  if (r.name === 'label') return { labels: [r.arg] };
  return {};
}

boot();
