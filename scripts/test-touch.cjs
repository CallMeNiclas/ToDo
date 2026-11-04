const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const [n, d] of [['iphone', devices['iPhone 15 Pro Max']], ['ipad', devices['iPad Pro 11 landscape']]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.stats');
    await p.screenshot({ path: `${OUT}/touch-${n}.png` });
    await p.click('.task .t-title'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/touch-${n}-detail.png` });
    await ctx.close();
  }
  await b.close();
})();
