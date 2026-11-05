const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForTimeout(1500);
  await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(800);
  await b.close();
})();
