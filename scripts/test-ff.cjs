const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
  const api = (path, method, body) => p.evaluate(([path, method, body]) => fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()), [path, method, body]);
  await api('/mode', 'POST', { mode: 'all' });
  const d = await api('/tasks', 'POST', { title: 'Inbox Zero - Gmail', due_date: '2026-11-04', due_time: '20:15', recurrence: { freq: 'day' } });
  const w = await api('/tasks', 'POST', { title: 'Wochenplan verschicken', due_date: '2026-11-05', recurrence: { freq: 'week', days: [4] } });
  const t = await api('/tasks', 'POST', { title: 'Angebot Müller', due_date: '2026-11-04', duration_min: 45 });
  console.log(JSON.stringify({ d: d.id, w: w.id, t: t.id }));
  require('fs').writeFileSync(OUT + '/ids.json', JSON.stringify({ d: d.id, w: w.id, t: t.id }));
  await b.close();
})();
