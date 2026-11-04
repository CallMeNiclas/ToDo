// Service worker: offline app shell, push notifications, notification clicks.
const CACHE = 'todo-shell-v18';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/parse.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Network first (always fresh when online), cache as fallback when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/(api|auth|mcp|authorize|oauth|hooks|\.well-known)(\/|$)/.test(url.pathname)) return;
  const isPage = req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  if (req.mode === 'navigate' && !isPage) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && (isPage || SHELL.includes(url.pathname) || url.pathname.startsWith('/icons/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(isPage ? '/index.html' : req, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(isPage ? '/index.html' : req, { ignoreSearch: true });
      if (cached) return cached;
      throw err;
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data?.text() || 'Erinnerung' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Erinnerung', {
    body: data.body || '',
    tag: data.tag,
    renotify: !!data.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.navigate ? c.navigate(url) : c.postMessage({ url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
