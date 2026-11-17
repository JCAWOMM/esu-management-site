const crypto = require('crypto');
const { one, run } = require('./db');

const SESSION_DAYS = 7;
const COOKIE = 'esu_sid';
const secure = process.env.NODE_ENV === 'production';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}
function randomPassword() {
  // readable temporary password, e.g. "Kq7m-x3Pa-9Rtw"
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const pick = () => chars[crypto.randomInt(chars.length)];
  return [0, 1, 2].map(() => Array.from({ length: 4 }, pick).join('')).join('-');
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(s => s.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(16).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  run('INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?,?,?,?)', token, userId, csrf, expires);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Attaches req.user and req.csrf when a valid session cookie is present.
function loadUser(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const s = one(`SELECT s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token);
    if (s && s.expires_at > Date.now() && s.active) {
      const { csrf, expires_at, password_hash, ...user } = s;
      req.user = user;
      req.csrf = csrf;
      if (user.client_id) {
        const c = one('SELECT active FROM clients WHERE id = ?', user.client_id);
        if (!c || !c.active) { req.user = null; }
      }
    } else if (s) {
      run('DELETE FROM sessions WHERE token = ?', token);
    }
  }
  res.locals.user = req.user || null;
  res.locals.csrf = req.csrf || '';
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  if (req.user.must_change_password && !req.path.startsWith('/account')) return res.redirect('/portal/account?first=1');
  next();
}
function requireClient(req, res, next) {
  if (req.user.role === 'admin') return res.redirect('/admin');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).send('Not authorized');
  next();
}
// Rejects state-changing requests that don't carry the session's CSRF token.
function checkCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  if (!req.user) return next();
  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (sent !== req.csrf) return res.status(403).send('Your session expired. Go back, refresh the page and try again.');
  next();
}

function audit(req, action, detail = '', user = req.user) {
  run('INSERT INTO audit_log (user_id, email, action, detail, ip) VALUES (?,?,?,?,?)',
    user ? user.id : null, user ? user.email : (req.body && req.body.email) || '', action, detail, clientIp(req));
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

// Simple in-memory login throttle: 8 failures per email+IP per 15 minutes.
const failures = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const list = (failures.get(key) || []).filter(t => now - t < 15 * 60e3);
  failures.set(key, list);
  return list.length >= 8;
}
function recordFailure(key) { failures.set(key, [...(failures.get(key) || []), Date.now()]); }

module.exports = { hashPassword, verifyPassword, randomPassword, createSession, destroySession, loadUser, requireLogin, requireClient, requireAdmin, checkCsrf, audit, clientIp, tooManyAttempts, recordFailure };
