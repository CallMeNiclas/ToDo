const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const d1 = new Date(Date.parse(from) + 86400000).toISOString().slice(0, 10);
    const ev = (d, s, e, title, color) => ({ id: title + d, title, allDay: false, start: `${d}T${s}:00+01:00`, end: `${d}T${e}:00+01:00`, color, calendar: 'x' });
    route.fulfill({ json: { connected: true, events: [ev(from, '19:00', '19:45', 'Morgen mit Claude durchsprechen', '#e67c73'), ev(from, '21:00', '22:00', 'Neue Folge VisionQuest', '#8e24aa'), ev(d1, '09:30', '16:00', 'Büro', '#039be5'), ev(d1, '10:00', '11:00', 'Wochenbesprechung', '#3f51b5'), ev(d1, '16:00', '16:30', 'Besprechung Mezzanine', '#3f51b5')] } });
  };
  let first = true;
  for (const [n, d] of [['desk', { viewport: { width: 1440, height: 1000 } }], ['ipad', devices['iPad Pro 11 landscape']], ['iphone', devices['iPhone 15 Pro Max']]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.route('**/api/calendar*', fakeCal);
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
    if (first) {
      first = false;
      const api = (path, method, body) => p.evaluate(([path, method, body]) => fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()), [path, method, body]);
      const mk = (o) => api('/tasks', 'POST', o);
      await mk({ title: 'Pauschalpreise Subunternehmer: Modell erarbeiten', due_date: '2026-11-04', due_time: '20:00', priority: 1 });
      await mk({ title: 'Inbox Zero - Gmail', due_date: '2026-11-04', due_time: '20:15', recurrence: { freq: 'day' } });
      await mk({ title: 'Tagesabschluss Gehirndump', due_date: '2026-11-04', due_time: '22:30', priority: 1, recurrence: { freq: 'day' } });
      await mk({ title: 'DXM-Rechnung prüfen', due_date: '2026-11-05', priority: 1, deadline: '2026-11-05' });
      await mk({ title: 'KW 47 Tourenplan erstellen', due_date: '2026-11-05', priority: 2, deadline: '2026-11-08' });
      await mk({ title: 'Speditionsaufträge KW 46', due_date: '2026-11-03', priority: 3, deadline: '2026-11-08', duration_min: 60 });
      for (let i = 0; i < 4; i++) { const t = await mk({ title: 'erledigt ' + i, due_date: '2026-11-04' }); await api(`/tasks/${t.id}/complete`, 'POST'); }
      await p.reload(); await p.waitForSelector('.dash');
    }
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/dash-${n}.png`, fullPage: n !== 'iphone' });
    if (n === 'iphone') { await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/dash-iphone-2.png` }); }
    if (n === 'desk') { await p.goto('http://localhost:8787/#/health'); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/health-desk.png`, fullPage: true }); }
    await ctx.close();
  }
  await b.close();
})();
