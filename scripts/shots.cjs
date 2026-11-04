const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const ev = (d, s, e, title, color) => ({ id: title + d, title, allDay: false, start: `${d}T${s}:00+01:00`, end: `${d}T${e}:00+01:00`, color, calendar: 'Privat' });
    const d0 = from; const d1 = new Date(Date.parse(from) + 86400000).toISOString().slice(0, 10);
    route.fulfill({ json: { connected: true, events: [ev(d0, '09:00', '10:00', 'Daily Standup', '#0ea5e9'), ev(d0, '12:30', '13:30', 'Mittagessen mit Tom', '#10b981'), ev(d0, '16:00', '17:30', 'Kundentermin', '#f59e0b'), ev(d1, '10:00', '11:00', 'Zahnarzt', '#ec4899'), { id: 'a', title: 'Geburtstag Lisa', allDay: true, start: d0, end: d1, color: '#8b5cf6' }] } });
  };
  for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone', devices['iPhone 15 Pro']]]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ ...opts, colorScheme: scheme });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
      p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
      await p.route('**/api/calendar*', fakeCal);
      await p.goto('http://localhost:8787/auth/dev');
      await p.waitForSelector('.stats');
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/${name}-${scheme}-today.png`, fullPage: name === 'desktop' });
      if (scheme === 'light') {
        await p.goto('http://localhost:8787/#/week'); await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${name}-week.png` });
        await p.goto('http://localhost:8787/#/upcoming'); await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${name}-upcoming.png` });
        await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(400);
        await p.click('.task .t-title'); await p.waitForTimeout(400);
        await p.screenshot({ path: `${OUT}/${name}-detail.png` });
        await p.keyboard.press('Escape');
        await p.keyboard.press('q'); await p.fill('#qa-input', 'Steuererklärung abgeben Freitag 10 Uhr p1 #Arbeit 2h'); await p.waitForTimeout(200);
        await p.screenshot({ path: `${OUT}/${name}-quickadd.png` });
        await p.keyboard.press('Escape');
        await p.goto('http://localhost:8787/#/settings'); await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${name}-settings.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
  await b.close();
})();
