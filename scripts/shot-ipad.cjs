const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const d1 = new Date(Date.parse(from) + 86400000).toISOString().slice(0, 10);
    const ev = (d, s, e, t, c) => ({ id: t + d, title: t, allDay: false, start: `${d}T${s}:00+01:00`, end: `${d}T${e}:00+01:00`, color: c });
    route.fulfill({ json: { connected: true, events: [ev(from, '09:30', '16:00', 'Büro', '#039be5'), ev(from, '10:00', '11:00', 'Wochenbesprechung', '#3f51b5'), ev(from, '19:00', '19:45', 'Morgen mit Claude durchsprechen', '#e67c73'), ev(d1, '10:00', '11:00', 'Wochenbesprechung', '#3f51b5')] } });
  };
  const ipad = devices['iPad Pro 11'];
  for (const [n, vp] of [['p', { width: 1032, height: 1376 }], ['l', { width: 1376, height: 1032 }]]) {
    const ctx = await b.newContext({ ...ipad, viewport: vp, screen: vp, colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.route('**/api/calendar*', fakeCal);
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
    await p.evaluate(() => fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"mode":"all"}' }));
    for (const v of ['dashboard', 'today', 'week', 'upcoming', 'health', 'habits']) {
      await p.goto('http://localhost:8787/#/' + v); await p.reload(); await p.waitForTimeout(1100);
      await p.screenshot({ path: `${OUT}/ipad-${n}-${v}.png` });
    }
    await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(700);
    await p.click('.task .t-title'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/ipad-${n}-detail.png` });
    await ctx.close();
  }
  await b.close();
})();
