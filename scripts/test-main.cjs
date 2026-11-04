const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 820 }, colorScheme: 'dark', locale: 'de-DE' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('dialog', (d) => d.accept());
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('.stats');
  const api = (path, method, body) => p.evaluate(([path, method, body]) => fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()), [path, method, body]);
  for (const n of ['F7 To-Dos', 'Zuhause', 'Wiederkehrend', 'Lager 2']) await api('/projects', 'POST', { name: n });
  await p.reload(); await p.waitForSelector('.stats');
  // 1) rename F7 To-Dos -> Fundus7 + Hauptprojekt
  await p.hover('#nav-projects .nav-item:has-text("F7 To-Dos")');
  await p.click('#nav-projects .nav-item:has-text("F7 To-Dos") [data-edit-project]');
  await p.fill('.modal.open:not(#quick-add) input[name=name]', 'Fundus7');
  await p.screenshot({ path: OUT + '/main-1.png' });
  await p.check('.modal.open:not(#quick-add) input[name=is_main]');
  await p.screenshot({ path: OUT + '/main-2.png' });
  await p.click('.modal.open:not(#quick-add) button.primary'); await p.waitForTimeout(400);
  // 2) assign Wiederkehrend + Lager 2 to Fundus7
  for (const n of ['Wiederkehrend', 'Lager 2']) {
    await p.hover(`#nav-projects .nav-item:has-text("${n}")`);
    await p.click(`#nav-projects .nav-item:has-text("${n}") [data-edit-project]`);
    await p.selectOption('.modal.open:not(#quick-add) select[name=parent_id]', { label: 'Fundus7' });
    await p.click('.modal.open:not(#quick-add) button.primary'); await p.waitForTimeout(400);
  }
  console.log('sidebar:', await p.$$eval('#nav-projects .nav-item', (els) => els.map((e) => e.style.paddingLeft + ' ' + e.querySelector('.nav-name').textContent)));
  await p.click('#nav-projects .nav-item:has-text("Fundus7")'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/main-3.png' });
  await p.click('[data-new-subproject]'); await p.waitForTimeout(200);
  console.log('new sub preselect:', await p.$eval('.modal.open:not(#quick-add) select[name=parent_id]', (s) => s.options[s.selectedIndex].text));
  await b.close();
})();
