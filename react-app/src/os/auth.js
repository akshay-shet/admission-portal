/* Logins: password hashing, password rules, recovery codes and the wrong-password lock.
   Passwords are stored only as PBKDF2-SHA256 hashes with a random salt per login ("pbkdf2$iterations$salt$hash").
   Older SHA-256 hashes (before Nov 2026) are still accepted. */
const SALT = 'student-portal:';
export const ITERATIONS = 310000; // OWASP 2023 figure for PBKDF2-SHA256; older hashes keep their own count
export const MIN_LENGTH = 8;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

async function legacyHash(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + String(pw ?? '')));
  return hex(buf);
}
async function pbkdf2(pw, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw ?? '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations }, key, 256);
  return hex(bits);
}
/** a new hash for a password (or a recovery code) */
export async function makeHash(pw) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2$${ITERATIONS}$${salt}$${await pbkdf2(pw, salt, ITERATIONS)}`;
}
const sameText = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
/** true when the password matches the stored hash (new or old format) */
export async function verifyHash(pw, stored) {
  const s = String(stored || '');
  if (!s) return false;
  try {
    if (s.startsWith('pbkdf2$')) {
      const [, it, salt, h] = s.split('$');
      return sameText(await pbkdf2(pw, salt, Number(it) || ITERATIONS), h);
    }
    return sameText(await legacyHash(pw), s);
  } catch { return false; }
}
/** kept for older code: same as makeHash */
export const hashPassword = makeHash;

const COMMON = ['password', 'admin', 'administrator', 'employee', 'welcome', 'qwerty', '12345678', '123456789', '1234567890', 'abcd1234', 'password1', 'admin123', 'admin@123', 'priority', 'student', 'portal'];
/** what is wrong with a new password ('' when it is fine) */
export function passwordProblem(pw, username = '') {
  const p = String(pw || '');
  if (p.length < MIN_LENGTH) return `The password needs at least ${MIN_LENGTH} characters`;
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Use letters and numbers in the password';
  if (/^\s|\s$/.test(p)) return 'The password cannot start or end with a space';
  const low = p.toLowerCase();
  if (username && low === String(username).trim().toLowerCase()) return 'The password cannot be the same as the username';
  if (COMMON.includes(low)) return 'That password is too easy to guess — choose another';
  return '';
}
/** checklist shown under a new-password box */
export const passwordChecks = (pw, username = '') => {
  const p = String(pw || '');
  return [
    [`At least ${MIN_LENGTH} characters`, p.length >= MIN_LENGTH],
    ['Letters and numbers', /[A-Za-z]/.test(p) && /[0-9]/.test(p)],
    ['Not the username or an easy word', !!p && p.toLowerCase() !== String(username).trim().toLowerCase() && !COMMON.includes(p.toLowerCase())],
  ];
};
export function usernameProblem(u) {
  const s = String(u || '').trim();
  if (!s) return 'Enter a username';
  if (s.length < 3) return 'The username needs at least 3 characters';
  if (!/^[A-Za-z0-9._@-]+$/.test(s)) return 'Use only letters, numbers and . _ @ - in the username (no spaces)';
  return '';
}

/* recovery code: 16 characters, no look-alike letters (0/O, 1/I/L) */
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  const r = crypto.getRandomValues(new Uint8Array(16));
  const s = [...r].map((b) => ALPHA[b % ALPHA.length]).join('');
  return s.match(/.{4}/g).join('-');
}
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---------- logins on this page (claude.ai / this browser): checked here ---------- */
/** Owner: admin / admin only until the owner sets their own login */
export async function checkLogin(auth, username, password) {
  const u = String(username || '').trim().toLowerCase();
  if (!auth?.hash) return u === 'admin' && password === 'admin';
  return u === String(auth.username || '').toLowerCase() && verifyHash(password, auth.hash);
}
/** Employee: employee / employee until the owner sets their own (or turns the employee login off) */
export async function checkEmployeeLogin(auth, username, password) {
  if (!auth?.hash) return !auth?.disabled && String(username || '').trim().toLowerCase() === 'employee' && password === 'employee';
  return String(username || '').trim().toLowerCase() === String(auth.username || '').toLowerCase() && verifyHash(password, auth.hash);
}

/* ---------- wrong-password lock (this browser): 5 wrong tries → wait 5 minutes ---------- */
const LOCK_KEY = 'student-portal-login-fails';
const MAX_TRIES = 5; const WAIT_MIN = 5;
const readFails = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); } catch { return {}; } };
const writeFails = (v) => { try { localStorage.setItem(LOCK_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
/** minutes left while locked, else 0 */
export function lockedMinutes() {
  const f = readFails();
  const left = (f.until || 0) - Date.now();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}
/** record a wrong try; returns tries left before the lock */
export function noteFailure() {
  const f = readFails();
  const n = (Date.now() - (f.at || 0) > 15 * 60000 ? 0 : f.n || 0) + 1;
  const v = { n, at: Date.now(), until: n >= MAX_TRIES ? Date.now() + WAIT_MIN * 60000 : 0 };
  if (n >= MAX_TRIES) v.n = 0;
  writeFails(v);
  return n >= MAX_TRIES ? 0 : MAX_TRIES - n;
}
export function clearFailures() { writeFails({}); }
