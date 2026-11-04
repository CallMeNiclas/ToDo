const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [n, d] of [['iphone', devices['iPhone 15 Pro Max']], ['desk', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash');
    await p.evaluate(() => fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"mode":"work"}' }));
    await p.reload(); await p.waitForSelector('.dash'); await p.waitForTimeout(900);
    await p.screenshot({ path: process.argv[2] + `/wm-${n}.png` });
    await ctx.close();
  }
  await b.close();
})();
