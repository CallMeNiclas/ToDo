const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const fakeCal = (route) => {
    const u = new URL(route.request().url()); const from = u.searchParams.get('from');
    const ev = (s, e, t) => ({ id: t, title: t, allDay: false, start: `${from}T${s}:00+01:00`, end: `${from}T${e}:00+01:00`, color: '#3f51b5' });
    route.fulfill({ json: { connected: true, events: [ev('09:30', '16:00', 'Büro'), ev('10:00', '11:00', 'Wochenbesprechung mit sehr langem Titel der nicht passt'), ev('11:00', '11:30', 'JvB + NH: Aufgabenverteilung Lager/Logistik'), { id: 'a', title: '🎃 BF6 Dead-Space-Event (bis 07.11.) mit extra langem Namen', allDay: true, start: from, end: '2026-11-08', color: '#f4511e' }] } });
  };
  for (const [n, d] of [['iPhone', devices['iPhone 15 Pro Max']], ['iPad', devices['iPad Pro 11']], ['iPadL', devices['iPad Pro 11 landscape']]]) {
    const ctx = await b.newContext({ ...d, colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    await p.route('**/api/calendar*', fakeCal);
    await p.goto('http://localhost:8787/auth/dev'); await p.waitForTimeout(800);
    for (const v of ['dashboard', 'today', 'week', 'upcoming', 'health', 'settings']) {
      await p.goto('http://localhost:8787/#/' + v); await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll('body *')].filter((el) => { const rc = el.getBoundingClientRect(); return rc.right > W + 1 && rc.width > 0 && getComputedStyle(el).position !== 'fixed'; })
          .filter((el) => !el.closest('.sidebar, .drawer, .modal, .toast-wrap')).slice(0, 4).map((el) => el.tagName + '.' + el.className.toString().slice(0, 30) + ' →' + Math.round(el.getBoundingClientRect().right));
        return { W, sw: document.documentElement.scrollWidth, offenders };
      });
      if (r.sw > r.W || r.offenders.length) console.log(n, v, JSON.stringify(r));
    }
    console.log(n, 'checked');
    await ctx.close();
  }
  await b.close();
})();
