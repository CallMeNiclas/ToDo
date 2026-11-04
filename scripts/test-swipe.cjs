const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.stats');
  const cdp = await ctx.newCDPSession(p);
  const swipe = async (from, to) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: from }] });
    for (let y = from; y <= to; y += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(400);
  };
  await p.click('.task .t-title'); await p.waitForTimeout(400);
  await swipe(150, 200);
  console.log('after small swipe open:', await p.$eval('#drawer', (d) => d.classList.contains('open')));
  await swipe(150, 450);
  console.log('after big swipe open:', await p.$eval('#drawer', (d) => d.classList.contains('open')), 'hash:', await p.evaluate(() => location.hash));
  await b.close();
})();
