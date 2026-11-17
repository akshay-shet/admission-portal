/*
 * Student Portal backend: serves the React front end (frontend/dist) and the API in front of MySQL.
 *   npm run db:setup   create the tables, first logins and starting lists (once)
 *   npm start          http://localhost:3000  (nginx puts it on your domain with HTTPS)
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, HOST, DB_PROBLEM, NODE_ENV, TRUST_PROXY, FORCE_HTTPS, FRONTEND_DIST, WEB_APP, STORAGE_HOME } from '../connectivity/config/env.js';
import { bootstrap } from '../connectivity/database/bootstrap.js';
import { COLLECTIONS, OWNER_READ } from '../connectivity/database/collections.js';
import * as db from '../connectivity/database/db.js';
import { check } from './rules.js';
import { checkPassword, makeToken, readToken, revokeToken, newTicket, useTicket, makeHash, verifyHash, usernameOf, employeeReady, passwordProblem, usernameProblem, newRecoveryCode, normCode, tooMany, failed, cleared } from './auth.js';
import { backupNow, scheduleBackups } from './backup.js';
import { runSheetsTool, sheetsConfigured, serviceAccountEmail } from '../connectivity/google-sheets/sheets.js';

const app = express();
app.disable('x-powered-by');
// behind Hostinger / nginx / any proxy: real visitor address for the wrong-password limit (TRUST_PROXY=1 on a host)
app.set('trust proxy', process.env.TRUST_PROXY ? (/^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY) : 'loopback');
const PROD = NODE_ENV === 'production';
// HTTPS only on a host (FORCE_HTTPS=1): plain http is sent to https
app.use((req, res, next) => {
  if (process.env.FORCE_HTTPS === '1' && !req.secure && !['localhost', '127.0.0.1'].includes(req.hostname)) return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  return next();
});
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
// big bodies only where photos / backups are sent
app.use('/api/import', express.json({ limit: '60mb' }));
app.use(express.json({ limit: '12mb' }));

const MASK = '__saved__';
/* password hashes never leave the server */
/* is a login still on its well-known starting password? (the page shows the owner a red warning) — worked out once per hash */
const weakCache = new Map();
const isWeak = (auth, user, pw) => {
  if (!auth?.hash) return true;
  const k = `${auth.hash}|${pw}`;
  if (!weakCache.has(k)) weakCache.set(k, String(auth.username || '').toLowerCase() === user && verifyHash(pw, auth.hash));
  return weakCache.get(k);
};
const maskSettings = (r) => {
  if (r.id !== 'academy-settings' || !r.academy) return r;
  const a = { ...r.academy };
  if (a.auth) a.auth = { ...a.auth, hash: a.auth.hash ? MASK : undefined, weak: isWeak(r.academy.auth, 'admin', 'admin') };
  if (a.employee_auth && !a.employee_auth.disabled) a.employee_auth = { ...a.employee_auth, weak: isWeak(r.academy.employee_auth, 'employee', 'employee') };
  if (a.auth?.recovery_hash) a.auth.recovery_hash = MASK;
  if (a.employee_auth) a.employee_auth = { ...a.employee_auth, hash: a.employee_auth.hash ? MASK : undefined };
  return { ...r, academy: a };
};
const visible = (role, c, rows) => (role === 'Employee' && OWNER_READ.has(c) ? [] : c === 'settings' ? rows.map(maskSettings) : rows);

/* ---------- live updates (Server-Sent Events) ---------- */
const clients = new Set();
/* the starting owner login (admin / admin) only from this computer; on a host only with FIRST_OWNER_PASSWORD */
const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.get('x-forwarded-for');
const firstLoginAllowed = (req) => !!process.env.FIRST_OWNER_PASSWORD || isLocal(req);
const changed = (collection) => { for (const res of clients) res.write(`event: change\ndata: ${JSON.stringify({ collection })}\n\n`); };

/* ---------- who is calling ---------- */
async function who(req) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  req.token = token;
  if (!token) return null;
  return readToken(token, await db.academy());
}
const need = (role) => async (req, res, next) => {
  try {
    const me = await who(req);
    if (!me) return res.status(401).json({ error: 'Please sign in again.' });
    if (role === 'Owner' && me.role !== 'Owner') return res.status(403).json({ error: 'Only the owner can do this.' });
    req.me = me; return next();
  } catch (e) { return next(e); }
};
const collectionParam = (req, res, next) => {
  if (!db.isCollection(req.params.c)) return res.status(404).json({ error: 'Unknown record type' });
  if (req.params.id !== undefined && !/^[A-Za-z0-9_.:@-]{1,120}$/.test(req.params.id)) return res.status(400).json({ error: 'Bad record id' });
  return next();
};

async function audit(me, collection, action, row) {
  if (['audit_logs', 'settings'].includes(collection)) return;
  const label = row?.student_name || row?.name || row?.expense || row?.plan || row?.transaction || row?.account || row?.document || row?.alert
    || row?.enquiry_no || row?.request_no || row?.expense_no || row?.board_name || row?.course_name || row?.combination_name || '';
  const extra = collection === 'installments' && row?.amount ? ` · ₹${row.amount}` : '';
  await db.insert('audit_logs', { at: new Date().toISOString(), actor: me.user, role: me.role, collection, action, label: label + extra }, me.user);
  changed('audit_logs');
}

/* sign-ins and wrong passwords go to the Audit Log (same entries as the portal page writes) */
async function loginEvent(action, actor, role, ip) {
  try { await db.insert('audit_logs', { at: new Date().toISOString(), actor, role, collection: 'login', action, label: `${action} · ${ip}` }, 'login'); changed('audit_logs'); } catch { /* never block a sign-in */ }
}

/* ---------- public ---------- */
app.get('/api/health', async (req, res) => {
  try { await db.pool.query('SELECT 1'); res.json({ ok: true, database: 'mysql' }); } catch (e) { console.error('Health check:', e.message); res.status(503).json({ ok: false, error: 'Database not reachable' }); }
});
/* what the login page needs: name, logo, colours (no passwords) */
app.get('/api/public', async (req, res, next) => {
  try {
    const a = await db.academy();
    const pick = ['inst_title', 'inst_tagline', 'inst_logo', 'theme'];
    res.json({ academy: { ...Object.fromEntries(pick.filter((k) => a[k] !== undefined).map((k) => [k, a[k]])), employee_ready: employeeReady(a) } });
  } catch (e) { next(e); }
});
app.post('/api/login', async (req, res, next) => {
  try {
    const ip = req.ip;
    if (tooMany(ip)) return res.status(429).json({ error: 'Too many wrong tries. Wait 10 minutes and try again.' });
    const role = req.body?.kind === 'Employee' ? 'Employee' : 'Owner';
    const a = await db.academy();
    if (role === 'Employee' && !employeeReady(a)) return res.status(403).json({ error: 'The employee login has not been set up yet. The owner sets it in Settings › Login & security.' });
    if (role === 'Owner' && !a.auth?.hash && !firstLoginAllowed(req)) return res.status(403).json({ error: 'No owner login yet — run "npm run db:setup" on the server first.' });
    // shared lock for this login (whatever computer or address the tries come from) — same rule as the portal page
    const guard = (await db.one('settings', 'login-guard')) || { id: 'login-guard' };
    const g = guard[role] || {};
    if (g.until > Date.now()) return res.status(429).json({ error: `The ${role.toLowerCase()} login is locked for ${Math.ceil((g.until - Date.now()) / 60000)} more minute(s) after too many wrong tries.` });
    const typed = String(req.body?.username || '').trim().slice(0, 60);
    if (!checkPassword(a, role, req.body?.username, req.body?.password)) {
      const left = failed(ip);
      const n = (Date.now() - (g.at || 0) > 15 * 60000 ? 0 : g.n || 0) + 1;
      const lock = n >= 5;
      await db.upsert('settings', 'login-guard', { ...guard, [role]: lock ? { n: 0, at: Date.now(), until: Date.now() + 10 * 60000 } : { n, at: Date.now(), until: 0 } }, 'login');
      await loginEvent(lock ? 'Login locked (too many wrong tries)' : 'Wrong password', typed, role, ip);
      await new Promise((r) => setTimeout(r, Math.min(3000, 400 * n))); // each wrong try answers a little slower
      if (lock) return res.status(429).json({ error: `Too many wrong tries — the ${role.toLowerCase()} login is locked for 10 minutes.` });
      const rest = Math.min(left || 5, 5 - n);
      return res.status(401).json({ error: `Wrong ${role.toLowerCase()} username or password (${rest} ${rest === 1 ? 'try' : 'tries'} left before a wait)` });
    }
    cleared(ip);
    if (g.n || g.until) await db.upsert('settings', 'login-guard', { ...guard, [role]: { n: 0, at: 0, until: 0 } }, 'login');
    const user = usernameOf(a, role);
    await loginEvent('Signed in', user, role, ip);
    res.json({ token: makeToken(a, role, user), user, role });
  } catch (e) { next(e); }
});

/* ---------- signed in ---------- */
app.get('/api/me', need(), (req, res) => res.json(req.me));
app.get('/api/data', need(), async (req, res, next) => {
  try {
    const out = {};
    for (const c of COLLECTIONS) out[c] = visible(req.me.role, c, await db.all(c)); // eslint-disable-line no-await-in-loop
    res.json({ collections: out, role: req.me.role, user: req.me.user });
  } catch (e) { next(e); }
});
app.get('/api/c/:c', need(), collectionParam, async (req, res, next) => {
  try { res.json(visible(req.me.role, req.params.c, await db.all(req.params.c))); } catch (e) { next(e); }
});
/* live updates: the page first asks for a one-use ticket (with its login token in the header), then opens the stream with it */
app.post('/api/events/ticket', need(), (req, res) => res.json({ ticket: newTicket(req.token) }));
app.get('/api/events', async (req, res, next) => {
  try {
    const token = useTicket(req.query.ticket);
    if (!token || !readToken(token, await db.academy())) return res.status(401).json({ error: 'Please sign in again.' });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    res.write('event: hello\ndata: {}\n\n');
    clients.add(res);
    // every 25 s: still signed in? (logged out, password changed or expired → the stream closes)
    const ping = setInterval(async () => {
      let ok = false; try { ok = !!readToken(token, await db.academy()); } catch { ok = true; }
      if (!ok) { res.write('event: bye\ndata: {}\n\n'); res.end(); return; }
      res.write(': ping\n\n');
    }, 25000);
    // Hostinger web apps stop any request after 120 s: end the stream first; the page reconnects in 5 s and reloads the records
    const cap = WEB_APP ? setTimeout(() => res.end(), 100000) : null;
    req.on('close', () => { clearInterval(ping); clearTimeout(cap); clients.delete(res); });
  } catch (e) { next(e); }
});
/* log out: the token stops working at once */
app.post('/api/logout', need(), (req, res) => { revokeToken(req.token); res.json({ ok: true }); });

/* add */
app.post('/api/c/:c', need(), collectionParam, async (req, res, next) => {
  try {
    const { c } = req.params;
    if (c === 'audit_logs') return res.status(403).json({ error: 'The audit log is written by the server.' });
    const g = await check(req.me.role, c, 'add', req.body?.row || {}, null);
    if (!g.ok) return res.status(403).json({ error: g.msg });
    const row = await db.insert(c, g.row, req.me.user);
    await audit(req.me, c, 'Created', row); changed(c);
    res.json({ row });
  } catch (e) { next(e); }
});
/* change some fields */
app.patch('/api/c/:c/:id', need(), collectionParam, async (req, res, next) => {
  try {
    const { c, id } = req.params;
    if (c === 'audit_logs') return res.status(403).json({ error: 'The audit log can’t be changed.' });
    const cur = await db.one(c, id);
    if (!cur) return res.status(404).json({ error: 'Record not found' });
    const g = await check(req.me.role, c, 'update', req.body?.row || {}, cur);
    if (!g.ok) return res.status(403).json({ error: g.msg });
    let patch = g.row;
    if (c === 'settings' && id === 'academy-settings') patch = keepLogins(cur, patch);
    const row = await db.merge(c, id, patch, req.me.user);
    await audit(req.me, c, 'Updated', row); changed(c);
    res.json({ row: c === 'settings' ? maskSettings(row) : row });
  } catch (e) { next(e); }
});
/* replace (or create with this id) */
app.put('/api/c/:c/:id', need(), collectionParam, async (req, res, next) => {
  try {
    const { c, id } = req.params;
    if (c === 'audit_logs') return res.status(403).json({ error: 'The audit log can’t be changed.' });
    const cur = await db.one(c, id);
    const g = await check(req.me.role, c, 'put', req.body?.row || {}, cur);
    if (!g.ok) return res.status(403).json({ error: g.msg });
    let row = g.row;
    if (c === 'settings' && id === 'academy-settings') row = keepLogins(cur, row);
    const saved = await db.upsert(c, id, row, req.me.user);
    await audit(req.me, c, cur ? 'Updated' : 'Created', saved); changed(c);
    res.json({ row: c === 'settings' ? maskSettings(saved) : saved });
  } catch (e) { next(e); }
});
app.delete('/api/c/:c/:id', need(), collectionParam, async (req, res, next) => {
  try {
    const { c, id } = req.params;
    if (c === 'audit_logs') return res.status(403).json({ error: 'The audit log can’t be changed.' });
    const cur = await db.one(c, id);
    if (!cur) return res.json({ ok: true });
    const g = await check(req.me.role, c, 'remove', null, cur);
    if (!g.ok) return res.status(403).json({ error: g.msg });
    await db.remove(c, id);
    await audit(req.me, c, 'Deleted', cur); changed(c);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* the settings document is saved whole by the page; the logins inside it only change through /api/credentials */
function keepLogins(cur, row) {
  const keep = cur?.academy || {};
  const a = { ...(row.academy || {}) };
  if (keep.auth) a.auth = keep.auth; else delete a.auth;
  if (keep.employee_auth) a.employee_auth = keep.employee_auth; else delete a.employee_auth;
  return { ...row, academy: a };
}

/* Owner changes a login. Owner login: current password needed. Employee login: set, change or turn off. */
async function saveLogin(key, auth) {
  const cur = await db.one('settings', 'academy-settings');
  const a = cur?.academy || {};
  await db.upsert('settings', 'academy-settings', { ...(cur || {}), academy: { ...a, [key]: auth }, updated_at: new Date().toISOString() }, 'login');
  changed('settings');
}
app.post('/api/credentials', need('Owner'), async (req, res, next) => {
  try {
    const role = req.body?.kind === 'Employee' ? 'Employee' : 'Owner';
    const username = String(req.body?.username || '').trim();
    const next_ = String(req.body?.next || '');
    const a = await db.academy();
    const bad = (error) => res.status(400).json({ error });
    if (role === 'Employee') {
      const old = a.employee_auth || {};
      if (req.body?.disable) {
        await saveLogin('employee_auth', { username: old.username || username, hash: null, disabled: true, changed_at: new Date().toISOString() });
        await audit(req.me, 'settings_logins', 'Updated', { name: 'Employee login turned off' });
        return res.json({ ok: true });
      }
      const u = usernameProblem(username); if (u) return bad(u);
      if (username.toLowerCase() === usernameOf(a, 'Owner').toLowerCase()) return bad('Use a different username from the owner login');
      if (!old.hash && !next_) return bad('Set a password for the employee login');
      if (next_) { const p = passwordProblem(next_, username); if (p) return bad(p); }
      if (!next_ && username === old.username) return bad('Nothing to save — type a new username or password');
      await saveLogin('employee_auth', { username, hash: next_ ? makeHash(next_) : old.hash, changed_at: new Date().toISOString() });
      await audit(req.me, 'settings_logins', 'Updated', { name: 'Employee login' });
      return res.json({ ok: true });
    }
    const old = a.auth || {};
    // first set-up: this owner token came from the starting login, so the current password was just checked
    if ((a.auth || {}).hash && !checkPassword(a, 'Owner', usernameOf(a, 'Owner'), req.body?.current)) { failed(req.ip); return bad('The current password is wrong'); }
    const u = usernameProblem(username); if (u) return bad(u);
    if (a.employee_auth?.hash && username.toLowerCase() === String(a.employee_auth.username || '').toLowerCase()) return bad('Use a different username from the employee login');
    if (!old.hash && !next_) return bad('Choose a new password');
    if (next_) { const p = passwordProblem(next_, username); if (p) return bad(p); }
    const changedLogin = !!next_ || username !== (old.username || 'admin');
    if (!changedLogin && !req.body?.new_code) return bad('Nothing to save — type a new username or password');
    const auth = { ...old, username, hash: next_ ? makeHash(next_) : old.hash };
    if (changedLogin) auth.changed_at = new Date().toISOString();
    let code = '';
    if (req.body?.new_code || !old.recovery_hash) { code = newRecoveryCode(); auth.recovery_hash = makeHash(normCode(code)); auth.recovery_at = new Date().toISOString(); }
    await saveLogin('auth', auth);
    await audit(req.me, 'settings_logins', 'Updated', { name: 'Owner login' });
    const fresh = await db.academy();
    res.json({ ok: true, token: makeToken(fresh, 'Owner', username), user: username, recovery_code: code || undefined });
  } catch (e) { next(e); }
});

/* Owner forgot the password: username + recovery code → new password (and a new recovery code) */
app.post('/api/recover', async (req, res, next) => {
  try {
    const ip = req.ip;
    if (tooMany(ip)) return res.status(429).json({ error: 'Too many wrong tries. Wait 10 minutes and try again.' });
    const a = await db.academy();
    const old = a.auth || {};
    const username = String(req.body?.username || '').trim();
    const next_ = String(req.body?.next || '');
    if (!old.hash) return res.status(400).json({ error: 'The owner login has not been set up yet — sign in with the starting login' });
    if (!old.recovery_hash) return res.status(400).json({ error: 'No recovery code was created. On the server run: npm run reset-login' });
    const p = passwordProblem(next_, username); if (p) return res.status(400).json({ error: p });
    if (username.toLowerCase() !== String(old.username || '').toLowerCase() || !verifyHash(normCode(req.body?.code), old.recovery_hash)) {
      const left = failed(ip);
      return res.status(401).json({ error: left ? `The username or recovery code is wrong (${left} ${left === 1 ? 'try' : 'tries'} left)` : 'Too many wrong tries. Wait 10 minutes and try again.' });
    }
    cleared(ip);
    const code = newRecoveryCode();
    await saveLogin('auth', { ...old, hash: makeHash(next_), changed_at: new Date().toISOString(), recovery_hash: makeHash(normCode(code)), recovery_at: new Date().toISOString() });
    await audit({ user: old.username, role: 'Owner' }, 'settings_logins', 'Updated', { name: 'Owner password reset with the recovery code' });
    res.json({ ok: true, recovery_code: code });
  } catch (e) { next(e); }
});

/* ---------- Google Sheets (service account on this server; owner only) ---------- */
app.get('/api/sheets/status', need('Owner'), (req, res) => res.json({ configured: sheetsConfigured(), email: serviceAccountEmail() }));
app.post('/api/sheets/:tool', need('Owner'), async (req, res) => {
  try { res.json(await runSheetsTool(req.params.tool, req.body || {})); } catch (e) {
    res.status(e.code === 'bad_request' ? 400 : 502).json({ error: e.message, code: e.code || 'upstream_error' });
  }
});

/* Owner: restore a backup file into MySQL in one go */
app.post('/api/import', need('Owner'), async (req, res, next) => {
  try {
    const src = req.body?.data || req.body?.collections;
    if (!src || typeof src !== 'object') return res.status(400).json({ error: 'That file is not a Student Portal backup' });
    const n = await db.importAll(src, req.me.user);
    await audit(req.me, 'import', 'Created', { name: `${n} records restored from a backup` });
    COLLECTIONS.forEach(changed);
    res.json({ ok: true, records: n });
  } catch (e) { next(e); }
});

app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- the React front end (frontend/dist, built with `npm run build:frontend`) ---------- */
app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), { immutable: true, maxAge: '365d', index: false }));
app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
app.get('*', (req, res) => {
  const f = path.join(FRONTEND_DIST, 'index.html');
  if (!fs.existsSync(f)) return res.status(500).send('The front end is not built yet: run "npm run build:frontend", then restart.');
  res.set('Cache-Control', 'no-cache');
  return res.sendFile(f);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That is too large to save (photos must be smaller)' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request' });
  console.error(err);
  res.status(500).json({ error: PROD ? 'Server error — please try again' : (err.message || 'Server error') });
});

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
db.ensureSchema()
  .then(() => bootstrap())
  .then(() => backupNow().catch((e) => console.error('Backup failed:', e.message)))
  .then(async () => {
    scheduleBackups();
    const a = await db.academy();
    if (!a.auth?.hash) console.warn('No owner login in the database yet — run "npm run db:setup" first.');
    if (STORAGE_HOME) console.log(`Server files (backups, sign-in secret) are kept in ${STORAGE_HOME}`);
    if (!sheetsConfigured()) console.warn('Google Sheet link: no service-account key file yet (see connectivity/google-sheets/README.md).');
    const ready = () => console.log(`Student Portal is running on port ${PORT}${HOST ? ` (${HOST})` : ''}  (MySQL connected, ${NODE_ENV}${WEB_APP ? ', Hostinger web app' : ''})`);
    if (HOST) app.listen(PORT, HOST, ready); else app.listen(PORT, ready);
  })
  .catch((e) => { console.error('Could not connect to MySQL:', e.message); console.error(WEB_APP ? 'Check DB_HOST, DB_NAME, DB_USER and DB_PASSWORD under Environment Variables in hPanel (they must match hPanel › Databases › MySQL Databases), then redeploy.' : 'Check connectivity/config/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) and that MySQL is running.'); process.exit(1); });

/* close the database cleanly when the host stops the app */
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { db.pool.end().finally(() => process.exit(0)); });
