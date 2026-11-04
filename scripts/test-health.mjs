const B = 'http://localhost:8787';
let cookie = '';
let r = await fetch(B + '/auth/dev', { redirect: 'manual' }); cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const api = async (p, m = 'GET', b) => (await fetch(B + '/api' + p, { method: m, headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: B }, body: b ? JSON.stringify(b) : undefined })).json();
const { url } = await api('/health-token');
console.log('unauth:', (await fetch(B + '/hooks/health?token=x', { method: 'POST', body: '{}' })).status);
const day = (n) => { const d = new Date(Date.UTC(2026, 10, 4 - n)); return d.toISOString().slice(0, 10); };
const steps = [6240, 11850, 9320, 12400, 4300, 10100, 13050, 8800, 7600, 10450, 9900, 12010, 5600, 10800];
const payload = { data: { metrics: [
  { name: 'step_count', units: 'count', data: steps.map((q, i) => ({ date: `${day(i)} 00:00:00 +0100`, qty: q, source: 'iPhone' })) },
  { name: 'sleep_analysis', units: 'hr', data: steps.map((_, i) => ({ date: `${day(i)} 00:00:00 +0100`, totalSleep: 6 + (i % 4) * 0.5, core: 3.6, deep: 0.9 + (i % 3) * 0.2, rem: 1.4, awake: 0.3, inBed: 7.9, sleepStart: `${day(i + 1)} 23:${10 + i} :00 +0100`.replace(' :', ':'), sleepEnd: `${day(i)} 06:4${i % 10}:00 +0100`, source: 'Apple Watch' })) },
  { name: 'active_energy', units: 'kcal', data: [{ date: `${day(0)} 00:00:00 +0100`, qty: 412.5 }] },
  { name: 'resting_heart_rate', units: 'count/min', data: [{ date: `${day(0)} 00:00:00 +0100`, qty: 58 }] },
  { name: 'weight_body_mass', units: 'kg', data: [{ date: `${day(1)} 00:00:00 +0100`, qty: 92.05 }] },
] } };
let res = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json();
console.log('ingest:', JSON.stringify(res));
// re-send today with higher steps (sync later in the day) -> must replace, not add
payload.data.metrics[0].data = [{ date: `${day(0)} 00:00:00 +0100`, qty: 7123 }];
payload.data.metrics.splice(1);
await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const h = await api('/health?days=7');
console.log('today steps (expect 7123):', h.days.at(-1).step_count, '| sleep today:', JSON.stringify(h.days.at(-1).sleep), '| weight y:', h.days.at(-2).weight_body_mass, '| goal', h.goal);
