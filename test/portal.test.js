// End-to-end tests for the request authorization and approval rules.
// Run with: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'esu-test-'));
process.env.SEED_DEMO = '1';
process.env.ADMIN_EMAIL = 'admin@esu.test';
process.env.ADMIN_PASSWORD = 'admin-password-1';
const app = require('../src/server');
const { one } = require('../src/db');

let server, base;
before(() => new Promise(r => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => server.close());

async function login(email, password = 'demo-password-1') {
  const res = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const page = await (await fetch(base + '/portal/account', { headers: { cookie } })).text();
  const csrf = (page.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  return { cookie, csrf, status: res.status };
}
const form = (s, url, data) => fetch(base + url, { method: 'POST', redirect: 'manual', headers: { cookie: s.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: s.csrf, ...data }) });
async function submit(s, data) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ _csrf: s.csrf, ...data })) fd.append(k, v);
  return fetch(base + '/portal/new', { method: 'POST', redirect: 'manual', headers: { cookie: s.cookie }, body: fd });
}
const loc = name => one('SELECT id FROM locations WHERE name = ?', name).id;
const lastReq = () => one('SELECT * FROM requests ORDER BY id DESC LIMIT 1');

test('wrong password is rejected and logged', async () => {
  const s = await login('super@demo.test', 'nope');
  assert.strictEqual(s.status, 401);
  assert.ok(one("SELECT * FROM audit_log WHERE action = 'login failed' AND email = 'super@demo.test'"));
});

test('portal requires login', async () => {
  const res = await fetch(base + '/portal', { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.match(res.headers.get('location'), /^\/login/);
});

test('general maintenance goes straight to dispatch and records the submitter', async () => {
  const s = await login('super@demo.test');
  const res = await submit(s, { location_id: loc('450 Atlantic Ave'), category: 'maintenance', priority: 'urgent', description: 'Lobby door closer is broken' });
  assert.strictEqual(res.status, 302);
  const r = lastReq();
  assert.strictEqual(r.status, 'open');
  assert.strictEqual(r.requires_approval, 0);
  assert.strictEqual(r.submitter_name, 'Sam Lee');
  assert.strictEqual(r.submitter_email, 'super@demo.test');
  assert.strictEqual(r.submitter_role, 'requester');
});

test('requester cannot submit for a building they are not authorized for', async () => {
  const s = await login('super@demo.test');
  const before = one('SELECT COUNT(*) n FROM requests').n;
  const res = await submit(s, { location_id: loc('88 Court St'), category: 'janitorial', priority: 'routine', description: 'Trying another building' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(one('SELECT COUNT(*) n FROM requests').n, before);
  assert.ok(one("SELECT * FROM audit_log WHERE action = 'blocked request'"));
});

test('carpet cleaning is held for approval; requester and admin scheduling are blocked until approved', async () => {
  const s = await login('super@demo.test');
  await submit(s, { location_id: loc('450 Atlantic Ave'), category: 'carpet', priority: 'routine', description: 'Hallway carpets floors 2-5' });
  const r = lastReq();
  assert.strictEqual(r.status, 'pending_approval');
  assert.strictEqual(r.requires_approval, 1);

  // A requester cannot approve
  const deny = await form(s, `/portal/requests/${r.id}/decision`, { decision: 'approve' });
  assert.strictEqual(deny.status, 403);
  assert.strictEqual(one('SELECT status FROM requests WHERE id = ?', r.id).status, 'pending_approval');

  // ESU staff cannot schedule it while it is pending
  const a = await login('admin@esu.test', 'admin-password-1');
  await form(a, `/admin/requests/${r.id}/status`, { status: 'scheduled', scheduled_for: 'Friday' });
  assert.strictEqual(one('SELECT status FROM requests WHERE id = ?', r.id).status, 'pending_approval');

  // The client approver approves it
  const ap = await login('approver@demo.test');
  const ok = await form(ap, `/portal/requests/${r.id}/decision`, { decision: 'approve', note: 'PO 4471' });
  assert.strictEqual(ok.status, 302);
  const after = one('SELECT r.*, u.email AS approver FROM requests r JOIN users u ON u.id = r.approved_by WHERE r.id = ?', r.id);
  assert.strictEqual(after.status, 'open');
  assert.strictEqual(after.approver, 'approver@demo.test');
  assert.strictEqual(after.decision_note, 'PO 4471');

  // Now it can be scheduled
  await form(a, `/admin/requests/${r.id}/status`, { status: 'scheduled', scheduled_for: 'Friday 7 PM' });
  assert.strictEqual(one('SELECT status FROM requests WHERE id = ?', r.id).status, 'scheduled');
});

test('an approver submitting specialty work records their own approval', async () => {
  const ap = await login('approver@demo.test');
  await submit(ap, { location_id: loc('210 W 29th St'), category: 'floor', priority: 'routine', description: 'Strip and wax lobby VCT' });
  const r = lastReq();
  assert.strictEqual(r.status, 'open');
  assert.ok(r.approved_by && r.approved_at);
});

test('requester cannot see requests for buildings outside their assignment', async () => {
  const r = lastReq(); // at 210 W 29th St, which Sam is not assigned to
  const s = await login('super@demo.test');
  const res = await fetch(`${base}/portal/requests/${r.id}`, { headers: { cookie: s.cookie } });
  assert.strictEqual(res.status, 404);
});

test('POST without CSRF token is rejected', async () => {
  const ap = await login('approver@demo.test');
  const res = await form({ ...ap, csrf: 'bad' }, '/portal/account', { current: 'x', password: 'yyyyyyyyyy', confirm: 'yyyyyyyyyy' });
  assert.strictEqual(res.status, 403);
});

test('disabled users cannot log in', async () => {
  const a = await login('admin@esu.test', 'admin-password-1');
  const u = one("SELECT * FROM users WHERE email = 'super@demo.test'");
  await form(a, `/admin/users/${u.id}`, { name: u.name, email: u.email, role: 'requester', active: '0' });
  const s = await login('super@demo.test');
  assert.strictEqual(s.status, 401);
});

test('public quote form saves the lead', async () => {
  const res = await fetch(base + '/quote', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Pat', email: 'pat@example.com', message: 'Office in Queens' }) });
  assert.strictEqual(res.status, 302);
  assert.ok(one("SELECT * FROM quotes WHERE email = 'pat@example.com'"));
});
