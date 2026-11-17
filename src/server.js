const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const { one, all, run, tx, UPLOAD_DIR } = require('./db');
const A = require('./auth');
const R = require('./rules');
const mail = require('./mail');
const { layout } = require('./views/layout');
const { home } = require('./views/home');
const P = require('./views/portal');
const AD = require('./views/admin');
const seed = require('./seed');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(A.loadUser);

const render = (req, res, opts, status = 200) =>
  res.status(status).send(layout({ ...opts, user: req.user, csrf: req.csrf }));
const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const csrf = A.checkCsrf;

// ---------- Public site ----------
app.get('/', (req, res) => render(req, res, { body: home({ sent: req.query.sent === '1' }) }));

app.post('/quote', (req, res) => {
  const f = req.body;
  if (f.website) return res.redirect('/?sent=1#quote'); // spam bot filled the hidden field
  const form = { name: str(f.name, 120), company: str(f.company, 160), email: str(f.email, 160), phone: str(f.phone, 40), borough: str(f.borough, 40), services: [].concat(f.services || []).map(s => str(s, 80)), message: str(f.message, 3000) };
  if (!form.name || !/^\S+@\S+\.\S+$/.test(form.email)) {
    return render(req, res, { body: home({ error: 'Please enter your name and a valid email address.', form }) }, 400);
  }
  run('INSERT INTO quotes (name, company, email, phone, borough, services, message) VALUES (?,?,?,?,?,?,?)',
    form.name, form.company, form.email, form.phone, form.borough, form.services.join(', '), form.message);
  mail.send(mail.OFFICE, `New quote request: ${form.company || form.name}`,
    `${form.name}${form.company ? ` (${form.company})` : ''}\n${form.email} ${form.phone}\nArea: ${form.borough}\nServices: ${form.services.join(', ')}\n\n${form.message}\n\n${mail.SITE_URL}/admin/quotes`);
  res.redirect('/?sent=1#quote');
});

// ---------- Login ----------
app.get('/login', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/portal');
  render(req, res, { title: 'Client login', body: P.loginPage({ next: str(req.query.next, 200) }) });
});
app.post('/login', (req, res) => {
  const email = str(req.body.email, 160).toLowerCase();
  const next = str(req.body.next, 200);
  const key = email + '|' + A.clientIp(req);
  const fail = msg => render(req, res, { title: 'Client login', body: P.loginPage({ error: msg, next, email }) }, 401);
  if (A.tooManyAttempts(key)) return fail('Too many attempts. Please wait 15 minutes and try again.');
  const u = one('SELECT * FROM users WHERE email = ?', email);
  if (!u || !A.verifyPassword(String(req.body.password || ''), u.password_hash)) {
    A.recordFailure(key);
    A.audit(req, 'login failed', u ? 'wrong password' : 'unknown email', null);
    return fail('That email and password don\'t match an authorized account.');
  }
  const clientOk = !u.client_id || (one('SELECT active FROM clients WHERE id = ?', u.client_id) || {}).active;
  if (!u.active || !clientOk) {
    A.audit(req, 'login blocked', 'account disabled', u);
    return fail('This account is disabled. Contact ESU Management.');
  }
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", u.id);
  A.createSession(res, u.id);
  A.audit(req, 'login', '', u);
  const dest = next.startsWith('/') && !next.startsWith('//') ? next : (u.role === 'admin' ? '/admin' : '/portal');
  res.redirect(dest);
});
app.post('/logout', csrf, (req, res) => { A.destroySession(req, res); res.redirect('/'); });

// ---------- Account ----------
app.get('/portal/account', A.requireLogin, (req, res) =>
  render(req, res, { title: 'Password', body: P.accountPage({ user: req.user, csrf: req.csrf, first: req.user.must_change_password }) }));
app.post('/portal/account', A.requireLogin, csrf, (req, res) => {
  const u = one('SELECT * FROM users WHERE id = ?', req.user.id);
  const { current, password, confirm } = req.body;
  let error;
  if (!A.verifyPassword(String(current || ''), u.password_hash)) error = 'Your current password is incorrect.';
  else if (String(password).length < 10) error = 'Use at least 10 characters.';
  else if (password !== confirm) error = 'The new passwords don\'t match.';
  else if (password === current) error = 'Choose a password different from the temporary one.';
  if (error) return render(req, res, { body: P.accountPage({ user: req.user, csrf: req.csrf, error, first: u.must_change_password }) }, 400);
  run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', A.hashPassword(password), u.id);
  A.audit(req, 'password changed');
  res.redirect(u.role === 'admin' ? '/admin' : '/portal?msg=' + encodeURIComponent('Password saved.'));
});

// ---------- Shared request helpers ----------
const REQ_SELECT = `SELECT r.*, c.name AS client_name, l.name AS location_name, l.address AS location_address, ap.name AS approver_name
  FROM requests r JOIN clients c ON c.id = r.client_id JOIN locations l ON l.id = r.location_id LEFT JOIN users ap ON ap.id = r.approved_by`;

const userLocationIds = userId => all('SELECT location_id FROM user_locations WHERE user_id = ?', userId).map(r => r.location_id);

function authorizedLocations(user) {
  return all(`SELECT l.* FROM locations l JOIN user_locations ul ON ul.location_id = l.id
    WHERE ul.user_id = ? AND l.client_id = ? AND l.active = 1 ORDER BY l.name`, user.id, user.client_id);
}
function canView(user, r) {
  if (user.role === 'admin') return true;
  return r.client_id === user.client_id && userLocationIds(user.id).includes(r.location_id);
}
function canApprove(user, r) {
  if (user.role === 'admin') return true;
  return user.role === 'approver' && canView(user, r);
}
function addEvent(requestId, user, action, note = '') {
  run('INSERT INTO request_events (request_id, user_id, actor_name, action, note) VALUES (?,?,?,?,?)',
    requestId, user ? user.id : null, user ? `${user.name}${user.role === 'admin' ? ' (ESU)' : ''}` : 'System', action, note);
}
function approverEmails(r) {
  return all(`SELECT DISTINCT u.email FROM users u JOIN user_locations ul ON ul.user_id = u.id
    WHERE u.role = 'approver' AND u.active = 1 AND u.client_id = ? AND ul.location_id = ?`, r.client_id, r.location_id).map(x => x.email);
}
function loadRequest(id) { return one(REQ_SELECT + ' WHERE r.id = ?', Number(id)); }
function showRequest(req, res, r, msg) {
  const isAdmin = req.user.role === 'admin';
  render(req, res, {
    title: r.ticket, active: isAdmin ? 'admin' : 'portal',
    body: P.requestDetail({
      r, user: req.user, csrf: req.csrf, isAdmin, msg,
      base: isAdmin ? '/admin/requests' : '/portal/requests',
      canApprove: canApprove(req.user, r),
      photos: all('SELECT * FROM request_photos WHERE request_id = ?', r.id),
      events: all('SELECT * FROM request_events WHERE request_id = ? ORDER BY id', r.id),
    }),
  });
}

// ---------- Client portal ----------
app.get('/portal', A.requireLogin, A.requireClient, (req, res) => {
  const u = req.user;
  const locs = authorizedLocations(u);
  const ids = locs.map(l => l.id);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const rows = all(`${REQ_SELECT} WHERE r.client_id = ? AND r.location_id IN (${ph}) ORDER BY r.id DESC LIMIT 200`, u.client_id, ...ids);
  render(req, res, {
    title: 'My requests', active: 'portal',
    body: P.clientDashboard({
      user: u, client: one('SELECT * FROM clients WHERE id = ?', u.client_id), locations: locs, rows,
      pendingForMe: u.role === 'approver' ? rows.filter(r => r.status === 'pending_approval') : [],
      msg: str(req.query.msg, 200),
    }),
  });
});

app.get('/portal/new', A.requireLogin, A.requireClient, (req, res) =>
  render(req, res, { title: 'New request', active: 'portal', body: P.newRequestPage({ user: req.user, csrf: req.csrf, locations: authorizedLocations(req.user) }) }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6)),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|gif|webp|heic|heif)$/.test(file.mimetype)),
});
const removeFiles = files => (files || []).forEach(f => fs.rm(f.path, { force: true }, () => {}));

app.post('/portal/new', A.requireLogin, A.requireClient, (req, res, next) => {
  upload.array('photos', 5)(req, res, err => {
    if (err) {
      removeFiles(req.files);
      return render(req, res, { body: P.newRequestPage({ user: req.user, csrf: req.csrf, locations: authorizedLocations(req.user), error: err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be under 8 MB.' : 'Up to 5 photos per request.', form: req.body || {} }) }, 400);
    }
    next();
  });
}, (req, res, next) => { if (req.body._csrf !== req.csrf) { removeFiles(req.files); return res.status(403).send('Your session expired. Go back, refresh and try again.'); } next(); }, (req, res) => {
  const u = req.user;
  const f = req.body;
  const locations = authorizedLocations(u);
  const fail = (error, status = 400) => {
    removeFiles(req.files);
    render(req, res, { title: 'New request', active: 'portal', body: P.newRequestPage({ user: u, csrf: req.csrf, locations, error, form: f }) }, status);
  };

  // Authorization: the building must belong to this user's company AND be assigned to this user.
  const loc = locations.find(l => String(l.id) === String(f.location_id));
  if (!loc) {
    A.audit(req, 'blocked request', `not authorized for location id ${str(f.location_id, 20)}`);
    return fail('You are not authorized to request service for that building.', 403);
  }
  const cat = R.CATEGORY[f.category];
  if (!cat) return fail('Please choose a request type.');
  if (!R.PRIORITY[f.priority]) return fail('Please choose a priority.');
  const description = str(f.description, 4000);
  if (description.length < 5) return fail('Please describe the work needed.');

  const selfApproved = cat.approval && u.role === 'approver';
  const status = cat.approval && !selfApproved ? 'pending_approval' : 'open';

  const id = tx(() => {
    const r = run(`INSERT INTO requests (ticket, client_id, location_id, submitted_by, submitter_name, submitter_email, submitter_phone, submitter_title, submitter_role, submitter_ip,
        category, priority, description, access_notes, onsite_contact, requires_approval, status, approved_by, approved_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ${selfApproved ? "datetime('now')" : 'NULL'})`,
      'TMP-' + crypto.randomBytes(6).toString('hex'), u.client_id, loc.id, u.id, u.name, u.email, u.phone, u.title, u.role, A.clientIp(req),
      cat.key, f.priority, description, str(f.access_notes, 1000), str(f.onsite_contact, 200), cat.approval ? 1 : 0, status, selfApproved ? u.id : null);
    const newId = Number(r.lastInsertRowid);
    run('UPDATE requests SET ticket = ? WHERE id = ?', 'ESU-' + String(1000 + newId), newId);
    for (const file of req.files || []) {
      run('INSERT INTO request_photos (request_id, filename, original_name, mime) VALUES (?,?,?,?)', newId, file.filename, str(file.originalname, 200), file.mimetype);
    }
    addEvent(newId, u, 'submitted the request');
    if (selfApproved) addEvent(newId, u, 'approved it (submitted by an approver)');
    else if (status === 'pending_approval') addEvent(newId, null, 'held for approval: specialty work');
    return newId;
  });

  const r = loadRequest(id);
  const summary = `${r.ticket} · ${r.client_name} · ${r.location_name}\nType: ${cat.label}\nPriority: ${R.PRIORITY[r.priority].label}\nSubmitted by: ${u.name} (${u.email}, ${u.role})\n\n${description}`;
  if (status === 'pending_approval') {
    mail.send(approverEmails(r), `Approval needed: ${cat.label} at ${r.location_name} (${r.ticket})`, `${summary}\n\nReview and approve: ${mail.SITE_URL}/portal/requests/${id}`);
    mail.send(mail.OFFICE, `[Pending approval] ${r.ticket} ${cat.label} at ${r.location_name}`, `${summary}\n\n${mail.SITE_URL}/admin/requests/${id}`);
  } else {
    mail.send(mail.OFFICE, `${r.priority === 'emergency' ? '[EMERGENCY] ' : ''}New request ${r.ticket}: ${cat.label} at ${r.location_name}`, `${summary}\n\n${mail.SITE_URL}/admin/requests/${id}`);
  }
  mail.send(u.email, `We received your request ${r.ticket}`, `Thanks, ${u.name}. Your request ${r.ticket} for ${r.location_name} was received.\nStatus: ${R.STATUSES[status]}\n\nTrack it: ${mail.SITE_URL}/portal/requests/${id}`);

  const msg = status === 'pending_approval'
    ? `Request ${r.ticket} submitted. It is waiting for approval from an approver at your company before it can be scheduled.`
    : `Request ${r.ticket} submitted and sent to ESU dispatch.`;
  res.redirect(`/portal/requests/${id}?msg=${encodeURIComponent(msg)}`);
});

app.get('/portal/requests/:id', A.requireLogin, A.requireClient, (req, res) => {
  const r = loadRequest(req.params.id);
  if (!r || !canView(req.user, r)) return res.status(404).send('Request not found');
  showRequest(req, res, r, str(req.query.msg, 300));
});

function decide(req, res) {
  const r = loadRequest(req.params.id);
  if (!r || !canView(req.user, r)) return res.status(404).send('Request not found');
  if (!canApprove(req.user, r)) {
    A.audit(req, 'blocked approval', `${r.ticket}: user is not an approver for this building`);
    return res.status(403).send('Only an approver for this building can approve specialty work.');
  }
  if (r.status !== 'pending_approval') return res.redirect(req.baseUrl + req.path.replace(/\/decision$/, ''));
  const approve = req.body.decision === 'approve';
  const note = str(req.body.note, 500);
  run(`UPDATE requests SET status = ?, approved_by = ?, approved_at = datetime('now'), decision_note = ?, updated_at = datetime('now') WHERE id = ?`,
    approve ? 'open' : 'declined', req.user.id, note, r.id);
  addEvent(r.id, req.user, approve ? 'approved the request' : 'declined the request', note);
  mail.send([r.submitter_email, mail.OFFICE], `${r.ticket} ${approve ? 'approved' : 'declined'}`,
    `${r.ticket} (${r.location_name}) was ${approve ? 'approved' : 'declined'} by ${req.user.name}.${note ? `\nNote: ${note}` : ''}\n\n${mail.SITE_URL}/portal/requests/${r.id}`);
  const base = req.user.role === 'admin' ? '/admin/requests' : '/portal/requests';
  res.redirect(`${base}/${r.id}?msg=${encodeURIComponent(approve ? 'Approved. ESU can now schedule this work.' : 'Request declined.')}`);
}
app.post('/portal/requests/:id/decision', A.requireLogin, A.requireClient, csrf, decide);

app.post('/portal/requests/:id/cancel', A.requireLogin, A.requireClient, csrf, (req, res) => {
  const r = loadRequest(req.params.id);
  if (!r || !canView(req.user, r) || r.submitted_by !== req.user.id || !['open', 'pending_approval'].includes(r.status)) return res.status(403).send('This request cannot be cancelled.');
  run("UPDATE requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", r.id);
  addEvent(r.id, req.user, 'cancelled the request');
  mail.send(mail.OFFICE, `${r.ticket} cancelled by client`, `${req.user.name} cancelled ${r.ticket} at ${r.location_name}.`);
  res.redirect(`/portal/requests/${r.id}?msg=${encodeURIComponent('Request cancelled.')}`);
});

app.get('/photos/:id', A.requireLogin, (req, res) => {
  const p = one('SELECT * FROM request_photos WHERE id = ?', Number(req.params.id));
  const r = p && loadRequest(p.request_id);
  if (!r || !canView(req.user, r)) return res.status(404).end();
  res.type(p.mime).sendFile(path.join(UPLOAD_DIR, p.filename));
});

// ---------- ESU admin ----------
const admin = express.Router();
admin.use(A.requireLogin, A.requireAdmin);

admin.get('/', (req, res) => {
  const status = str(req.query.status, 30), client = str(req.query.client, 10);
  const where = [], params = [];
  if (status && status !== 'all') { where.push('r.status = ?'); params.push(status); }
  else if (!status) where.push("r.status NOT IN ('completed','declined','cancelled')");
  if (client) { where.push('r.client_id = ?'); params.push(Number(client)); }
  const rows = all(`${REQ_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE r.status WHEN 'pending_approval' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, CASE r.priority WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, r.id DESC LIMIT 500`, ...params);
  const counts = Object.fromEntries(all('SELECT status, COUNT(*) n FROM requests GROUP BY status').map(x => [x.status, x.n]));
  counts.quotes = one("SELECT COUNT(*) n FROM quotes WHERE status = 'new'").n;
  render(req, res, { title: 'Admin', active: 'admin', body: AD.adminRequests({ rows, counts, clients: all('SELECT id, name FROM clients ORDER BY name'), filter: { status, client }, msg: str(req.query.msg, 200) }) });
});

admin.get('/requests/:id', (req, res) => {
  const r = loadRequest(req.params.id);
  if (!r) return res.status(404).send('Not found');
  showRequest(req, res, r, str(req.query.msg, 300));
});
admin.post('/requests/:id/decision', csrf, decide);
admin.post('/requests/:id/status', csrf, (req, res) => {
  const r = loadRequest(req.params.id);
  if (!r) return res.status(404).send('Not found');
  const status = req.body.status;
  if (r.status === 'pending_approval' || r.status === 'declined') {
    return res.redirect(`/admin/requests/${r.id}?msg=${encodeURIComponent('This request has not been approved, so it cannot be scheduled.')}`);
  }
  if (!R.WORK_STATUSES.includes(status)) return res.status(400).send('Bad status');
  const scheduled = str(req.body.scheduled_for, 80) || null;
  const note = str(req.body.note, 1000);
  run("UPDATE requests SET status = ?, scheduled_for = ?, updated_at = datetime('now') WHERE id = ?", status, scheduled, r.id);
  const changes = [];
  if (status !== r.status) changes.push(`changed status to ${R.STATUSES[status]}`);
  if ((scheduled || '') !== (r.scheduled_for || '')) changes.push(`scheduled it for ${scheduled || '(cleared)'}`);
  if (changes.length || note) addEvent(r.id, req.user, changes.join(' and ') || 'added a note', note);
  if (status !== r.status && ['scheduled', 'completed'].includes(status)) {
    mail.send(r.submitter_email, `${r.ticket} ${R.STATUSES[status].toLowerCase()}`, `Your request ${r.ticket} at ${r.location_name} is now ${R.STATUSES[status]}${scheduled ? ` (${scheduled})` : ''}.${note ? `\n\n${note}` : ''}\n\n${mail.SITE_URL}/portal/requests/${r.id}`);
  }
  res.redirect(`/admin/requests/${r.id}?msg=${encodeURIComponent('Saved.')}`);
});

admin.get('/clients', (req, res) => {
  const clients = all(`SELECT c.*, (SELECT COUNT(*) FROM locations WHERE client_id = c.id) locs, (SELECT COUNT(*) FROM users WHERE client_id = c.id AND active = 1) users,
    (SELECT COUNT(*) FROM requests WHERE client_id = c.id AND status IN ('open','pending_approval','scheduled','in_progress')) open FROM clients c ORDER BY c.name`);
  render(req, res, { title: 'Clients', active: 'admin', body: AD.adminClients({ clients, csrf: req.csrf, msg: str(req.query.msg, 200) }) });
});
admin.post('/clients', csrf, (req, res) => {
  const name = str(req.body.name, 160);
  if (!name) return res.redirect('/admin/clients');
  if (one('SELECT id FROM clients WHERE name = ?', name)) return res.redirect('/admin/clients?msg=' + encodeURIComponent('A client with that name already exists.'));
  const r = run('INSERT INTO clients (name) VALUES (?)', name);
  res.redirect(`/admin/clients/${r.lastInsertRowid}?msg=${encodeURIComponent('Client added. Now add their buildings and authorized users.')}`);
});

function showClient(req, res, id, extra = {}) {
  const client = one('SELECT * FROM clients WHERE id = ?', Number(id));
  if (!client) return res.status(404).send('Not found');
  const users = all('SELECT * FROM users WHERE client_id = ? ORDER BY active DESC, name', client.id);
  const userLocs = {};
  for (const u of users) userLocs[u.id] = userLocationIds(u.id);
  render(req, res, { title: client.name, active: 'admin', body: AD.adminClient({ client, users, userLocs, csrf: req.csrf, msg: str(req.query.msg, 200), locations: all('SELECT * FROM locations WHERE client_id = ? ORDER BY name', client.id), ...extra }) });
}
admin.get('/clients/:id', (req, res) => showClient(req, res, req.params.id));
admin.post('/clients/:id/locations', csrf, (req, res) => {
  const c = one('SELECT id FROM clients WHERE id = ?', Number(req.params.id));
  const name = str(req.body.name, 160);
  if (c && name) run('INSERT INTO locations (client_id, name, address, borough) VALUES (?,?,?,?)', c.id, name, str(req.body.address, 240), str(req.body.borough, 40));
  res.redirect(`/admin/clients/${req.params.id}?msg=${encodeURIComponent('Building added.')}`);
});
admin.post('/clients/:id/active', csrf, (req, res) => {
  run('UPDATE clients SET active = ? WHERE id = ?', req.body.active === '1' ? 1 : 0, Number(req.params.id));
  res.redirect(`/admin/clients/${req.params.id}?msg=${encodeURIComponent('Saved.')}`);
});

function setUserLocations(userId, clientId, raw) {
  const valid = new Set(all('SELECT id FROM locations WHERE client_id = ?', clientId).map(l => l.id));
  run('DELETE FROM user_locations WHERE user_id = ?', userId);
  for (const id of [].concat(raw || []).map(Number).filter(n => valid.has(n))) run('INSERT INTO user_locations (user_id, location_id) VALUES (?,?)', userId, id);
}
const cleanRole = r => (r === 'approver' ? 'approver' : 'requester');

admin.post('/clients/:id/users', csrf, (req, res) => {
  const clientId = Number(req.params.id);
  const email = str(req.body.email, 160).toLowerCase();
  if (!one('SELECT id FROM clients WHERE id = ?', clientId)) return res.status(404).send('Not found');
  if (!/^\S+@\S+\.\S+$/.test(email) || !str(req.body.name)) return showClient(req, res, clientId, { error: 'Name and a valid email are required.' });
  if (one('SELECT id FROM users WHERE email = ?', email)) return showClient(req, res, clientId, { error: 'A user with that email already exists.' });
  const password = A.randomPassword();
  tx(() => {
    const r = run('INSERT INTO users (client_id, name, title, email, phone, role, password_hash) VALUES (?,?,?,?,?,?,?)',
      clientId, str(req.body.name, 120), str(req.body.title, 120), email, str(req.body.phone, 40), cleanRole(req.body.role), A.hashPassword(password));
    setUserLocations(Number(r.lastInsertRowid), clientId, req.body.locations);
  });
  A.audit(req, 'user created', `${email} (${cleanRole(req.body.role)})`);
  showClient(req, res, clientId, { tempPassword: { email, password } });
});

admin.post('/users/:id', csrf, (req, res) => {
  const u = one('SELECT * FROM users WHERE id = ? AND client_id IS NOT NULL', Number(req.params.id));
  if (!u) return res.status(404).send('Not found');
  if (req.body.reset) {
    const password = A.randomPassword();
    run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', A.hashPassword(password), u.id);
    run('DELETE FROM sessions WHERE user_id = ?', u.id);
    A.audit(req, 'password reset', u.email);
    return showClient(req, res, u.client_id, { tempPassword: { email: u.email, password } });
  }
  const email = str(req.body.email, 160).toLowerCase();
  const clash = one('SELECT id FROM users WHERE email = ? AND id != ?', email, u.id);
  if (clash || !/^\S+@\S+\.\S+$/.test(email)) return showClient(req, res, u.client_id, { error: 'That email is invalid or already in use.' });
  const active = req.body.active === '0' ? 0 : 1;
  tx(() => {
    run('UPDATE users SET name = ?, title = ?, email = ?, phone = ?, role = ?, active = ? WHERE id = ?',
      str(req.body.name, 120) || u.name, str(req.body.title, 120), email, str(req.body.phone, 40), cleanRole(req.body.role), active, u.id);
    setUserLocations(u.id, u.client_id, req.body.locations);
    if (!active) run('DELETE FROM sessions WHERE user_id = ?', u.id);
  });
  A.audit(req, 'user updated', `${email}: role ${cleanRole(req.body.role)}, ${active ? 'active' : 'disabled'}`);
  res.redirect(`/admin/clients/${u.client_id}?msg=${encodeURIComponent(`Saved ${email}.`)}`);
});

admin.get('/staff', (req, res) =>
  render(req, res, { title: 'Staff', active: 'admin', body: AD.adminStaff({ staff: all("SELECT * FROM users WHERE role = 'admin' ORDER BY name"), csrf: req.csrf, msg: str(req.query.msg, 200) }) }));
admin.post('/staff', csrf, (req, res) => {
  const email = str(req.body.email, 160).toLowerCase();
  const staff = () => all("SELECT * FROM users WHERE role = 'admin' ORDER BY name");
  if (!/^\S+@\S+\.\S+$/.test(email) || one('SELECT id FROM users WHERE email = ?', email)) {
    return render(req, res, { body: AD.adminStaff({ staff: staff(), csrf: req.csrf, msg: 'That email is invalid or already in use.' }) }, 400);
  }
  const password = A.randomPassword();
  run("INSERT INTO users (client_id, name, email, role, password_hash) VALUES (NULL, ?, ?, 'admin', ?)", str(req.body.name, 120), email, A.hashPassword(password));
  A.audit(req, 'staff created', email);
  render(req, res, { title: 'Staff', active: 'admin', body: AD.adminStaff({ staff: staff(), csrf: req.csrf, tempPassword: { email, password } }) });
});

admin.get('/quotes', (req, res) =>
  render(req, res, { title: 'Quotes', active: 'admin', body: AD.adminQuotes({ quotes: all("SELECT * FROM quotes ORDER BY status = 'new' DESC, id DESC LIMIT 300"), csrf: req.csrf }) }));
admin.post('/quotes/:id', csrf, (req, res) => {
  run('UPDATE quotes SET status = ? WHERE id = ?', req.body.status === 'contacted' ? 'contacted' : 'new', Number(req.params.id));
  res.redirect('/admin/quotes');
});
admin.get('/log', (req, res) =>
  render(req, res, { title: 'Security log', active: 'admin', body: AD.adminLog({ rows: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500') }) }));

app.use('/admin', admin);

app.get('/healthz', (req, res) => res.send('ok'));
app.use((req, res) => render(req, res, { title: 'Not found', body: '<section class="section"><div class="wrap narrow"><h1>Page not found</h1><p><a href="/">Go to the home page</a></p></div></section>' }, 404));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Something went wrong. Please try again.'); });

seed.run();
const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`ESU site running on http://localhost:${PORT}`));
module.exports = app;
