/* PostgreSQL access for the backend: connection pool, schema set-up and record helpers.
   One table (portal_records) keeps every record as JSON (JSONB), keyed by (collection, id). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DB } from '../config/env.js';
import { COLLECTIONS, STUDENT_TABLES } from './collections.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const pool = new pg.Pool({ ...DB, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, application_name: 'student-portal' });
pool.on('error', (e) => console.error('PostgreSQL connection error:', e.message)); // an idle connection dropped: the pool opens a new one

/** run one statement; `?` placeholders become $1, $2, … ; returns the rows */
const q1 = async (q, sql, params = []) => { let i = 0; return (await q.query(sql.replace(/\?/g, () => `$${++i}`), params)).rows; };

export async function ensureSchema() {
  await pool.query(fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8')); // the whole file in one go (it holds a function body)
}

export const isCollection = (c) => COLLECTIONS.includes(c);
export const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const parse = (d) => (typeof d === 'string' ? JSON.parse(d) : d || {});
const out = (r) => ({ ...parse(r.data), id: r.id });
const clean = (row) => { const o = { ...(row || {}) }; delete o.id; return o; };
const json = (row) => JSON.stringify(clean(row), (k, v) => (typeof v === 'string' ? v.replace(/\0/g, '') : v)); // PostgreSQL JSON cannot hold the NUL character

export async function all(c) {
  return (await q1(pool, 'SELECT id, data FROM portal_records WHERE collection = ? ORDER BY created_at, id', [c])).map(out);
}
export async function one(c, id, q = pool) {
  const rows = await q1(q, 'SELECT id, data FROM portal_records WHERE collection = ? AND id = ?', [c, id]);
  return rows[0] ? out(rows[0]) : null;
}
export async function insert(c, row, user, q = pool) {
  const id = newId();
  await q1(q, 'INSERT INTO portal_records (collection, id, data, created_by, updated_by) VALUES (?, ?, ?::jsonb, ?, ?)', [c, id, json(row), user || null, user || null]);
  return { ...clean(row), id };
}
/** replace the whole record (or create it with this id) */
export async function upsert(c, id, row, user, q = pool) {
  await q1(q, `INSERT INTO portal_records (collection, id, data, created_by, updated_by) VALUES (?, ?, ?::jsonb, ?, ?)
    ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by`, [c, id, json(row), user || null, user || null]);
  return { ...clean(row), id };
}
/** run fn(client) inside one transaction (all or nothing) */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}
/** merge fields into a record */
export async function merge(c, id, row, user) {
  return tx(async (client) => {
    const rows = await q1(client, 'SELECT data FROM portal_records WHERE collection = ? AND id = ? FOR UPDATE', [c, id]);
    if (!rows[0]) return null;
    const next = { ...parse(rows[0].data), ...clean(row) };
    await q1(client, 'UPDATE portal_records SET data = ?::jsonb, updated_by = ? WHERE collection = ? AND id = ?', [json(next), user || null, c, id]);
    return { ...next, id };
  });
}
export async function remove(c, id) {
  const r = await pool.query('DELETE FROM portal_records WHERE collection = $1 AND id = $2', [c, id]);
  return r.rowCount > 0;
}

/* settings document with the logins */
export async function academy(q = pool) {
  const r = await one('settings', 'academy-settings', q);
  return r?.academy || {};
}

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
/** student's actual fee (same rule as the portal): actual_fee on the student, else the latest payment's total fees, else the old due schedule */
export async function actualFee(studentId) {
  if (!studentId) return 0;
  const st = await q1(pool, `SELECT data FROM portal_records WHERE collection IN (${STUDENT_TABLES.map(() => '?').join(',')}) AND student_id = ? LIMIT 1`, [...STUDENT_TABLES, studentId]);
  const f1 = st[0] ? num(parse(st[0].data).actual_fee) : 0;
  if (f1) return f1;
  const inst = await q1(pool, "SELECT data FROM portal_records WHERE collection = 'installments' AND student_id = ? ORDER BY data->>'created_at' DESC NULLS LAST, created_at DESC LIMIT 1", [studentId]);
  const f2 = inst[0] ? num(parse(inst[0].data).total_fees) : 0;
  if (f2) return f2;
  const dues = await q1(pool, "SELECT data FROM portal_records WHERE collection = 'fee_dues' AND student_id = ?", [studentId]);
  return dues.reduce((a, r) => a + num(parse(r.data).amount), 0);
}
export async function hasPayments(studentId) {
  if (!studentId) return false;
  const rows = await q1(pool, "SELECT 1 FROM portal_records WHERE collection = 'installments' AND student_id = ? LIMIT 1", [studentId]);
  return rows.length > 0;
}
/** records per type (for the import summary) */
export async function counts() {
  return q1(pool, 'SELECT collection, COUNT(*)::int AS n FROM portal_records GROUP BY collection ORDER BY collection');
}

/** bulk restore (a backup .json): all or nothing; the logins are never replaced from a file */
export async function importAll(collections, user) {
  return tx(async (client) => {
    let n = 0;
    const order = [...STUDENT_TABLES, ...COLLECTIONS.filter((c) => !STUDENT_TABLES.includes(c))];
    for (const c of order) {
      for (const r of collections[c] || []) {
        if (!r || typeof r !== 'object') continue;
        const id = r.id ? String(r.id).slice(0, 120) : newId();
        let row = r;
        if (c === 'settings' && id === 'academy-settings') {
          const cur = await academy(client); // eslint-disable-line no-await-in-loop
          row = { ...r, academy: { ...(r.academy || {}), auth: cur.auth, employee_auth: cur.employee_auth } };
          if (!cur.auth) delete row.academy.auth;
          if (!cur.employee_auth) delete row.academy.employee_auth;
        }
        await upsert(c, id, row, user, client); // eslint-disable-line no-await-in-loop
        n++;
      }
    }
    return n;
  });
}
