/*
 * Student Portal server: the portal page + a small API in front of PostgreSQL.
 *   npm run db:setup   create the database and tables (once)
 *   npm start          http://localhost:3000
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, HOST, HERE, DB_PROBLEM } from './env.js';
import { COLLECTIONS, OWNER_READ } from './collections.js';
import * as db from './db.js';
import { check } from './rules.js';
import { checkPassword, makeToken, readToken, makeHash, verifyHash, usernameOf, employeeReady, passwordProblem, usernameProblem, newRecoveryCode, normCode, tooMany, failed, cleared } from './auth.js';
import { backupNow, scheduleBackups, clearIfRequested } from './backup.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30mb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); next(); });

const MASK = '__saved__';
/* password hashes never leave the server */
const maskSettings = (r) => {
  if (r.id !== 'academy-settings' || !r.academy) return r;
  const a = { ...r.academy };
  if (a.auth) a.auth = { ...a.auth, hash: a.auth.hash ? MASK : undefined };
  if (a.auth?.recovery_hash) a.auth.recovery_hash = MASK;
  if (a.employee_auth) a.employee_auth = { ...a.employee_auth, hash: a.employee_auth.hash ? MASK : undefined };
  return { ...r, academy: a };
};
const visible = (role, c, rows) => (role === 'Employee' && OWNER_READ.has(c) ? [] : c === 'settings' ? rows.map(maskSettings) : rows);

/* ---------- live updates (Server-Sent Events) ---------- */
const clients = new Set();
const changed = (collection) => { for (const res of clients) res.write(`event: change\ndata: ${JSON.stringify({ collection })}\n\n`); };

/* ---------- who is calling ---------- */
async function who(req) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
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
const collectionParam = (req, res, next) => (db.isCollection(req.params.c) ? next() : res.status(404).json({ error: 'Unknown record type' }));

async function audit(me, collection, action, row) {
  if (['audit_logs', 'settings'].includes(collection)) return;
  const label = row?.student_name || row?.name || row?.expense || row?.plan || row?.transaction || row?.account || row?.document || row?.alert
    || row?.enquiry_no || row?.request_no || row?.expense_no || row?.board_name || row?.course_name || row?.combination_name || '';
  const extra = collection === 'installments' && row?.amount ? ` · ₹${row.amount}` : '';
  await db.insert('audit_logs', { at: new Date().toISOString(), actor: me.user, role: me.role, collection, action, label: label + extra }, me.user);
  changed('audit_logs');
}

/* ---------- public ---------- */
app.get('/api/health', async (req, res) => {
  try { await db.pool.query('SELECT 1'); res.json({ ok: true, database: 'postgresql' }); } catch (e) { res.status(503).json({ ok: false, error: 'Database not reachable: ' + e.message }); }
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
    if (!checkPassword(a, role, req.body?.username, req.body?.password)) {
      const left = failed(ip);
      return res.status(401).json({ error: left ? `Wrong ${role.toLowerCase()} username or password (${left} ${left === 1 ? 'try' : 'tries'} left before a 10-minute wait)` : 'Too many wrong tries. Wait 10 minutes and try again.' });
    }
    cleared(ip);
    const user = usernameOf(a, role);
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
app.get('/api/events', need(), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('event: hello\ndata: {}\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
});

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
    if (!checkPassword(a, 'Owner', usernameOf(a, 'Owner'), req.body?.current)) { failed(req.ip); return bad('The current password is wrong'); }
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
    if (!old.recovery_hash) return res.status(400).json({ error: 'No recovery code was created. On the computer that runs the portal, double-click reset-owner-login.bat.' });
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

/* Owner: restore a backup file into PostgreSQL in one go */
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

/* ---------- the portal page itself ---------- */
const DIST = path.resolve(HERE, '..', 'dist');
app.get(['/', '/index.html'], (req, res) => {
  const f = path.join(DIST, 'index.html');
  if (!fs.existsSync(f)) return res.status(500).send('Run "npm run build" first, then start the server again.');
  res.set('Cache-Control', 'no-cache');
  return res.sendFile(f);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
db.ensureSchema()
  .then(() => clearIfRequested())
  .then(() => backupNow('start').catch((e) => console.error('Backup failed:', e.message)))
  .then(() => { scheduleBackups(); app.listen(PORT, HOST, () => console.log(`Student Portal is running: http://localhost:${PORT}  (PostgreSQL connected)`)); })
  .catch((e) => { console.error('Could not connect to PostgreSQL:', e.message); console.error('Check server/.env (DATABASE_URL or PGPASSWORD) and that PostgreSQL is running.'); process.exit(1); });
