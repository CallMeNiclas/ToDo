const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.stack.split('\n').slice(0, 3).join(' | ')));
  await p.route('**/api/calendar*', (r) => r.fulfill({ json: { connected: true, events: [] } }));
  // simulate a slow server (1.5 s) for completes to prove the UI no longer waits
  await p.route('**/api/tasks/*/complete', async (r) => { await new Promise((res) => setTimeout(res, 1500)); r.continue(); });
  await p.goto('http://localhost:8787/auth/dev'); await p.waitForSelector('#app:not([hidden])');
  const api = (path, method, body) => p.evaluate(([path, method, body]) => fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()), [path, method, body]);
  await api('/mode', 'POST', { mode: 'all' });
  const a = await api('/tasks', 'POST', { title: 'SNAP Einmalig', due_date: '2026-11-05' });
  const r = await api('/tasks', 'POST', { title: 'SNAP Täglich', due_date: '2026-11-05', recurrence: { freq: 'day' } });
  await p.goto('http://localhost:8787/#/today'); await p.reload(); await p.waitForTimeout(800);
  let t0 = Date.now();
  await p.click(`[data-check="${a.id}"]`);
  await p.waitForFunction((id) => !document.querySelector(`.task[data-task="${id}"]`), a.id, { timeout: 5000 });
  console.log('one-off removed from list after', Date.now() - t0, 'ms (server needs 1500 ms)');
  t0 = Date.now();
  await p.click(`[data-check="${r.id}"]`);
  await p.waitForFunction((id) => !document.querySelector(`.task[data-task="${id}"]`), r.id, { timeout: 5000 });
  console.log('recurring moved after', Date.now() - t0, 'ms');
  await p.waitForTimeout(2000);
  const tasks = await api('/tasks');
  const rt = tasks.tasks.find((t) => t.id === r.id);
  console.log('server: one-off gone', !tasks.tasks.some((t) => t.id === a.id), '| recurring next due', rt.due_date);
  // undo for one-off
  const b2 = await api('/tasks', 'POST', { title: 'SNAP Undo', due_date: '2026-11-05' });
  await p.reload(); await p.waitForTimeout(800);
  await p.click(`[data-check="${b2.id}"]`); await p.waitForTimeout(300);
  await p.click('.toast button'); await p.waitForTimeout(2500);
  const after = await api('/tasks');
  console.log('undo restored on server:', after.tasks.some((t) => t.id === b2.id), '| visible:', !!(await p.$(`.task[data-task="${b2.id}"]`)));
  await b.close();
})();
