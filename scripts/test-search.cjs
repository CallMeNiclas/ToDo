const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], colorScheme: 'dark' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.stats');
  // complete one task so "Erledigt" has a hit
  await p.click('#search-btn'); await p.waitForSelector('#search-big');
  await p.fill('#search-big', 'offline'); await p.waitForTimeout(800);
  console.log('hits:', await p.$$eval('#search-results .task', (els) => els.length), 'marks:', await p.$$eval('mark', (m) => m.length));
  await p.screenshot({ path: OUT + '/search.png' });
  await p.goto('http://localhost:8787/#/today'); await p.waitForTimeout(300);
  await p.click('#fab'); await p.fill('#qa-input', 'Tom anrufen morgen 10 Uhr Priorität eins Projekt Arbeit eine halbe Stunde'); await p.waitForTimeout(200);
  console.log('mic visible:', await p.isVisible('#qa-mic'));
  await p.screenshot({ path: OUT + '/qa-mic.png' });
  await b.close();
})();
