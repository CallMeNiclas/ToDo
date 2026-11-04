const B = 'http://localhost:8787';
let cookies = {};
const jar = (res) => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); cookies[k] = v.join('='); } };
const ck = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const f = async (path, opts = {}) => { const r = await fetch(B + path, { redirect: 'manual', ...opts, headers: { Cookie: ck(), ...(opts.headers || {}) } }); jar(r); return r; };
const j = async (path, method = 'GET', body) => { const r = await f('/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: B }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json(); if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + JSON.stringify(d)); return d; };
await f('/auth/dev');
// MCP via OAuth
const reg = await (await fetch(B + '/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Test', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], token_endpoint_auth_method: 'none' }) })).json();
const verifier = 'v'.repeat(50);
const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: challenge, code_challenge_method: 'S256', state: 'x', scope: 'tasks', resource: B + '/mcp' });
let r = await f('/authorize?' + q); const handle = (await r.text()).match(/name="handle" value="([^"]+)"/)[1];
r = await f('/authorize?' + q, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: B }, body: new URLSearchParams({ handle, decision: 'approve' }) });
const code = new URL(r.headers.get('location')).searchParams.get('code');
const tok = await (await fetch(B + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', client_id: reg.client_id, code_verifier: verifier, resource: B + '/mcp' }) })).json();
const call = async (name, args) => (await (await fetch(B + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })).json()).result;

const r1 = await call('add_tasks', { tasks: [
  { title: 'A: before ohne Uhrzeit', due_date: '2026-11-10', reminders: [{ before: 30 }] },
  { title: 'B: at mit Sekunden', due_date: '2026-11-10', reminders: [{ at: '2026-11-10T09:00:00' }] },
  { title: 'C: at UTC ohne Datum', reminders: [{ at: '2026-11-10T08:00:00Z' }] },
  { title: 'D: before + time', due_date: '2026-11-10', due_time: '14:00', reminders: [{ before: 60 }, { time: '08:30' }], deadline: '2026-11-08' },
  { title: 'E: Unsinn', due_date: '2026-11-10', reminders: [{ foo: 1 }] },
] } );
const sc = r1.structuredContent;
console.log('created:', sc.created.map((t) => `${t.title} -> ${JSON.stringify(t.reminders || [])}${t.deadline ? ' dl ' + t.deadline : ''}`));
console.log('failures:', sc.failures.map((f) => f.title + ': ' + f.error));
const ov = (await call('get_overview', {})).structuredContent;
console.log('deadlines_next_7_days:', ov.deadlines_next_7_days.map((t) => t.title + ' ' + t.deadline));
