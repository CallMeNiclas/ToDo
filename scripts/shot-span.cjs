const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const ev = (d, s, e, t, c) => ({ id: t + d, title: t, allDay: false, start: `${d}T${s}:00+01:00`, end: `${d}T${e}:00+01:00`, color: c });
    route.fulfill({ json: { connected: true, events: [{ id: 'bf', title: '🎃 BF6 Dead-Space-Event (bis 07.11.)', allDay: true, start: '2026-10-20', end: '2026-11-08', color: '#f4511e' }, ev('2026-11-04', '19:00', '19:45', 'Morgen mit Claude', '#e67c73'), ev('2026-11-05', '10:00', '11:00', 'Wochenbesprechung', '#3f51b5')] } });
  };
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/api/calendar*', fakeCal);
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
  for (const n of [7, 3, 1]) {
    await p.goto('http://localhost:8787/#/week'); await p.waitForTimeout(600);
    await p.click(`[data-span="${n}"]`); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/span-${n}.png` });
  }
  console.log('mode pill on week hidden:', await p.$eval('#mode-pill', (e) => e.hidden));
  await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(600);
  console.log('mode pill on today hidden:', await p.$eval('#mode-pill', (e) => e.hidden));
  await p.screenshot({ path: `${OUT}/today-head.png`, clip: { x: 0, y: 0, width: 430, height: 120 } });
  await b.close();
})();
