const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
const ids = JSON.parse(require('fs').readFileSync(OUT + '/ids.json'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.dash'); await p.waitForTimeout(800);
  const h = await p.evaluate(() => fetch('/api/habits').then((r) => r.json()));
  for (const x of h.habits) console.log('habit', x.title, 'current', x.current, 'best', x.best, 'rate', x.rate_30);
  // habits view
  await p.goto('http://localhost:8787/#/habits'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/shots/habits.png' });
  // focus: open task, start 25 min
  await p.goto('http://localhost:8787/#/task/' + ids.t); await p.waitForTimeout(600);
  await p.click('[data-focus-start]'); await p.waitForTimeout(300);
  await p.click('.modal.open:not(#quick-add) button.primary'); await p.waitForTimeout(1500);
  console.log('pill:', await p.textContent('#focus-pill'), 'hidden:', await p.$eval('#focus-pill', (e) => e.hidden));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.goto('http://localhost:8787/#/dashboard'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/shots/focus-dash.png' });
  await p.click('#focus-pill'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/shots/focus-panel.png' });
  await p.click('[data-f="stop"]'); await p.waitForTimeout(1000);
  const tk = await p.evaluate((id) => fetch('/api/tasks/' + id).then((r) => r.json()), ids.t);
  console.log('focus_sec booked:', tk.focus_sec, 'pill hidden:', await p.$eval('#focus-pill', (e) => e.hidden));
  // tabbar config
  await p.evaluate(() => localStorage.setItem('todo.tabs', JSON.stringify(['dashboard', 'today', 'habits', 'health'])));
  await p.reload(); await p.waitForTimeout(800);
  console.log('tabs:', await p.$$eval('#tabbar a span:first-of-type', (els) => els.map((e) => e.textContent).join(', ')));
  await p.goto('http://localhost:8787/#/settings'); await p.waitForTimeout(700);
  const y = await p.$eval('#tab-settings', (e) => e.getBoundingClientRect().top + window.scrollY - 160);
  await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/shots/tab-settings.png' });
  await b.close();
})();
