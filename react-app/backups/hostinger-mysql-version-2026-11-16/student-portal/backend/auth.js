/* Logins (Owner / Employee) and signed session tokens — checked by the server on every request.
   Passwords are stored as PBKDF2-SHA256 hashes with a random salt ("pbkdf2$iterations$salt$hash", same format as the browser).
   Older SHA-256 hashes are still accepted. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sessionSecret, DATA_DIR as HERE, SESSION_HOURS } from '../connectivity/config/env.js';

const SALT = 'student-portal:';
const ITERATIONS = 310000; // same as the front end (OWASP 2023); older hashes keep their own count
const legacy = (pw) => crypto.createHash('sha256').update(SALT + String(pw ?? '')).digest('hex');
const same = (x, y) => { const a = Buffer.from(String(x)); const b = Buffer.from(String(y)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

export function makeHash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(String(pw ?? ''), Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${h}`;
}
export function verifyHash(pw, stored) {
  const s = String(stored || '');
  if (!s) return false;
  if (s.startsWith('pbkdf2$')) {
    const [, it, salt, h] = s.split('$');
    try { return same(crypto.pbkdf2Sync(String(pw ?? ''), Buffer.from(salt, 'hex'), Number(it) || ITERATIONS, 32, 'sha256').toString('hex'), h); } catch { return false; }
  }
  return same(legacy(pw), s);
}
export const hashPassword = makeHash;

const authOf = (a, role) => (role === 'Employee' ? a.employee_auth : a.auth) || {};
/** Owner: "admin" until the owner sets their own login. Employee: no default. */
export const usernameOf = (a, role) => {
  const x = authOf(a, role);
  if (role === 'Owner') return String((x.hash && x.username) || 'admin');
  return String(x.hash ? x.username || '' : '');
};
export const employeeReady = (a) => !!a.employee_auth?.hash;
/* the token stops working when that login's details change */
export const versionOf = (a, role) => String(authOf(a, role).changed_at || 'default');

export function checkPassword(a, role, username, password) {
  const auth = authOf(a, role);
  if (role === 'Employee' && !auth.hash) return false;
  if (String(username || '').trim().toLowerCase() !== usernameOf(a, role).toLowerCase()) return false;
  if (!auth.hash) return password === (process.env.FIRST_OWNER_PASSWORD || 'admin'); // starting owner login, works only until the owner sets their own
  return verifyHash(password, auth.hash);
}

/* same rules as the page (src/os/auth.js) */
const COMMON = ['password', 'admin', 'administrator', 'employee', 'welcome', 'qwerty', '12345678', '123456789', '1234567890', 'abcd1234', 'password1', 'admin123', 'admin@123', 'priority', 'student', 'portal'];
export function passwordProblem(pw, username = '') {
  const p = String(pw || '');
  if (p.length < 8) return 'The password needs at least 8 characters';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Use letters and numbers in the password';
  if (/^\s|\s$/.test(p)) return 'The password cannot start or end with a space';
  if (username && p.toLowerCase() === String(username).trim().toLowerCase()) return 'The password cannot be the same as the username';
  if (COMMON.includes(p.toLowerCase())) return 'That password is too easy to guess — choose another';
  return '';
}
export function usernameProblem(u) {
  const s = String(u || '').trim();
  if (!s) return 'Enter a username';
  if (s.length < 3) return 'The username needs at least 3 characters';
  if (!/^[A-Za-z0-9._@-]+$/.test(s)) return 'Use only letters, numbers and . _ @ - in the username (no spaces)';
  return '';
}
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newRecoveryCode = () => [...crypto.randomBytes(16)].map((b) => ALPHA[b % ALPHA.length]).join('').match(/.{4}/g).join('-');
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const SECRET = sessionSecret();
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const HOURS = SESSION_HOURS;

export function makeToken(a, role, user) {
  const body = b64(JSON.stringify({ u: user, r: role, v: versionOf(a, role), j: crypto.randomBytes(12).toString('base64url'), exp: Date.now() + HOURS * 3600e3 }));
  return `${body}.${sign(body)}`;
}

/* ---------- logged-out tokens stop working at once (kept in server/.revoked.json until they would expire anyway) ---------- */
const REVOKED_FILE = path.join(HERE, '.revoked.json');
const revoked = new Map(); // token id -> expiry
try { for (const [j, exp] of Object.entries(JSON.parse(fs.readFileSync(REVOKED_FILE, 'utf8')))) if (exp > Date.now()) revoked.set(j, exp); } catch { /* none yet */ }
function saveRevoked() {
  for (const [j, exp] of revoked) if (exp < Date.now()) revoked.delete(j);
  try { fs.writeFileSync(REVOKED_FILE, JSON.stringify(Object.fromEntries(revoked))); } catch (e) { console.error('Could not save logged-out sessions:', e.message); }
}
function body(token) {
  const [b, sig] = String(token || '').split('.');
  if (!b || !sig || !same(sign(b), sig)) return null;
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; }
}
/** log out: this token can no longer be used */
export function revokeToken(token) {
  const t = body(token);
  if (!t?.j) return false;
  revoked.set(t.j, t.exp); saveRevoked();
  return true;
}

/* ---------- one-minute, one-use tickets for the live-update stream (so the login token never goes into a URL) ---------- */
const tickets = new Map();
export function newTicket(token) {
  const id = crypto.randomBytes(24).toString('base64url');
  tickets.set(id, { token, exp: Date.now() + 60e3 });
  for (const [k, v] of tickets) if (v.exp < Date.now()) tickets.delete(k);
  return id;
}
export function useTicket(id) {
  const t = tickets.get(String(id || ''));
  tickets.delete(String(id || ''));
  return t && t.exp > Date.now() ? t.token : null;
}
/** { user, role } when the token is genuine, not expired and its login is unchanged; otherwise null */
export function readToken(token, a) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !same(sign(body), sig)) return null;
  let t; try { t = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!t || t.exp < Date.now() || !['Owner', 'Employee'].includes(t.r)) return null;
  if (t.j && revoked.has(t.j)) return null;
  if (t.r === 'Employee' && !employeeReady(a)) return null;
  if (String(t.u).toLowerCase() !== usernameOf(a, t.r).toLowerCase() || t.v !== versionOf(a, t.r)) return null;
  return { user: usernameOf(a, t.r), role: t.r };
}

/* 5 wrong passwords (or recovery codes) in a row from one address → wait 10 minutes */
const fails = new Map();
const MAX = 5; const WAIT = 10 * 60e3;
export function tooMany(ip) { const f = fails.get(ip); return !!f && f.n >= MAX && Date.now() - f.at < WAIT; }
export function failed(ip) { const f = fails.get(ip) || { n: 0, at: 0 }; const n = Date.now() - f.at > WAIT ? 1 : f.n + 1; fails.set(ip, { n, at: Date.now() }); return Math.max(0, MAX - n); }
export function cleared(ip) { fails.delete(ip); }
