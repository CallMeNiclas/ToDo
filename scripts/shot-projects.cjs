const { chromium, devices } = require('playwright');
const [OUT, PID] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const [n, d] of [['desk', { viewport: { width: 1440, height: 900 } }], ['iphone', devices['iPhone 15 Pro Max']]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.stats');
    await p.goto('http://localhost:8787/#/project/' + PID); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/proj-${n}.png` });
    if (n === 'iphone') { await p.click('#menu-btn'); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/proj-${n}-menu.png` }); }
    else { await p.click(`[data-edit-project="${PID}"] >> nth=-1`); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/proj-dialog.png` }); }
    await ctx.close();
  }
  await b.close();
})();
