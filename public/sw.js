// Service worker: offline app shell, push notifications, notification clicks.
const CACHE = 'todo-shell-v27';
const SHELL = ['/', '/css/app.css', '/js/app.js', '/js/parse.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache so a new version really gets the new files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

// Stale-while-revalidate: the app shell comes straight from the cache (instant start, also offline),
// a fresh copy is fetched in the background and used from the next start on.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/(api|auth|mcp|authorize|oauth|hooks|\.well-known)(\/|$)/.test(url.pathname)) return;
  const isPage = req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  if (req.mode === 'navigate' && !isPage) return;
  const cacheable = isPage || SHELL.includes(url.pathname) || url.pathname.startsWith('/icons/');
  if (!cacheable) return;
  const key = isPage ? '/' : url.pathname;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let cached = await cache.match(key, { ignoreSearch: true });
    // a response that went through a redirect must not answer a navigation
    if (cached?.redirected) cached = new Response(await cached.blob(), { status: cached.status, headers: cached.headers });
    const fresh = (async () => {
      const res = (isPage && (await event.preloadResponse)) || (await fetch(req));
      if (res.ok && !res.redirected) await cache.put(key, res.clone());
      return res;
    })();
    if (cached) { event.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
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
