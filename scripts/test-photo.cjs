const { chromium, devices } = require('playwright');
const [OUT, F7, PRIV] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const ev = (s, e, t, c) => ({ id: t, title: t, allDay: false, start: `${from}T${s}:00+01:00`, end: `${from}T${e}:00+01:00`, color: c });
    route.fulfill({ json: { connected: true, events: [ev('09:30', '16:00', 'Büro', '#039be5'), ev('10:00', '11:00', 'Wochenbesprechung', '#3f51b5'), ev('19:00', '19:45', 'Morgen mit Claude', '#e67c73'), ev('20:30', '21:30', 'BVB – Bayern', '#f6bf26')] } });
  };
  let up = true;
  for (const [n, d] of [['iphone', devices['iPhone 15 Pro Max']], ['desk', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.route('**/api/calendar*', fakeCal);
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
    if (!up) {
      up = true;
      await p.goto('http://localhost:8787/#/settings'); await p.waitForTimeout(600);
      await p.setInputFiles('input[data-logo="work"]', F7); await p.waitForTimeout(1500);
      await p.setInputFiles('input[data-logo="private"]', PRIV); await p.waitForTimeout(1500);
      console.log('styles', JSON.stringify(await p.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()).then((b) => b.logoStyles))));
    }
    for (const m of ['work', 'private']) {
      await p.evaluate((m) => fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: m }) }), m);
      await p.goto('http://localhost:8787/#/dashboard'); await p.reload(); await p.waitForSelector('.dash'); await p.waitForTimeout(1200);
      await p.screenshot({ path: `${OUT}/photo-${n}-${m}.png` });
    }
    await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/photo-${n}-today.png` });
    await ctx.close();
  }
  await b.close();
})();
