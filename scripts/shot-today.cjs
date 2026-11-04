const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForTimeout(600);
  await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(700);
  await p.evaluate(() => window.scrollTo(0, 560)); await p.waitForTimeout(200);
  await p.screenshot({ path: process.argv[2] });
  await b.close();
})();
