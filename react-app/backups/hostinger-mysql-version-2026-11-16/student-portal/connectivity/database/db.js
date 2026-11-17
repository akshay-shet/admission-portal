/* MySQL / MariaDB access for the backend: connection pool, schema set-up and record helpers.
   One table (portal_records) keeps every record as JSON, keyed by (collection, id). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { DB } from '../config/env.js';
import { COLLECTIONS, STUDENT_TABLES } from './collections.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4', supportBigNumbers: true, dateStrings: true });

export async function ensureSchema() {
  const sql = fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8').split(/;\s*$/m).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
  for (const stmt of sql) await pool.query(stmt); // eslint-disable-line no-await-in-loop
}

export const isCollection = (c) => COLLECTIONS.includes(c);
export const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const parse = (d) => (typeof d === 'string' ? JSON.parse(d) : d || {}); // MariaDB returns JSON as text
const out = (r) => ({ ...parse(r.data), id: r.id });
const clean = (row) => { const o = { ...(row || {}) }; delete o.id; return o; };

export async function all(c) {
  const [rows] = await pool.query('SELECT id, data FROM portal_records WHERE collection = ? ORDER BY created_at, id', [c]);
  return rows.map(out);
}
export async function one(c, id, q = pool) {
  const [rows] = await q.query('SELECT id, data FROM portal_records WHERE collection = ? AND id = ?', [c, id]);
  return rows[0] ? out(rows[0]) : null;
}
export async function insert(c, row, user, q = pool) {
  const id = newId();
  await q.query('INSERT INTO portal_records (collection, id, data, created_by, updated_by) VALUES (?, ?, ?, ?, ?)', [c, id, JSON.stringify(clean(row)), user || null, user || null]);
  return { ...clean(row), id };
}
/** replace the whole record (or create it with this id) */
export async function upsert(c, id, row, user, q = pool) {
  await q.query(`INSERT INTO portal_records (collection, id, data, created_by, updated_by) VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)`, [c, id, JSON.stringify(clean(row)), user || null, user || null]);
  return { ...clean(row), id };
}
/** merge fields into a record */
export async function merge(c, id, row, user) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT data FROM portal_records WHERE collection = ? AND id = ? FOR UPDATE', [c, id]);
    if (!rows[0]) { await conn.rollback(); return null; }
    const next = { ...parse(rows[0].data), ...clean(row) };
    await conn.query('UPDATE portal_records SET data = ?, updated_by = ? WHERE collection = ? AND id = ?', [JSON.stringify(next), user || null, c, id]);
    await conn.commit();
    return { ...next, id };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
export async function remove(c, id) {
  const [r] = await pool.query('DELETE FROM portal_records WHERE collection = ? AND id = ?', [c, id]);
  return r.affectedRows > 0;
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
  const [st] = await pool.query(`SELECT data FROM portal_records WHERE collection IN (${STUDENT_TABLES.map(() => '?').join(',')}) AND student_id = ? LIMIT 1`, [...STUDENT_TABLES, studentId]);
  const f1 = st[0] ? num(parse(st[0].data).actual_fee) : 0;
  if (f1) return f1;
  const [inst] = await pool.query("SELECT data FROM portal_records WHERE collection = 'installments' AND student_id = ? ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.created_at')) DESC, created_at DESC LIMIT 1", [studentId]);
  const f2 = inst[0] ? num(parse(inst[0].data).total_fees) : 0;
  if (f2) return f2;
  const [dues] = await pool.query("SELECT data FROM portal_records WHERE collection = 'fee_dues' AND student_id = ?", [studentId]);
  return dues.reduce((a, r) => a + num(parse(r.data).amount), 0);
}
export async function hasPayments(studentId) {
  if (!studentId) return false;
  const [rows] = await pool.query("SELECT 1 FROM portal_records WHERE collection = 'installments' AND student_id = ? LIMIT 1", [studentId]);
  return rows.length > 0;
}

/** bulk restore (a backup .json): all or nothing; the logins are never replaced from a file */
export async function importAll(collections, user) {
  const conn = await pool.getConnection();
  let n = 0;
  try {
    await conn.beginTransaction();
    const order = [...STUDENT_TABLES, ...COLLECTIONS.filter((c) => !STUDENT_TABLES.includes(c))];
    for (const c of order) {
      for (const r of collections[c] || []) {
        if (!r || typeof r !== 'object') continue;
        const id = r.id ? String(r.id).slice(0, 120) : newId();
        let row = r;
        if (c === 'settings' && id === 'academy-settings') {
          const cur = await academy(conn); // eslint-disable-line no-await-in-loop
          row = { ...r, academy: { ...(r.academy || {}), auth: cur.auth, employee_auth: cur.employee_auth } };
          if (!cur.auth) delete row.academy.auth;
          if (!cur.employee_auth) delete row.academy.employee_auth;
        }
        await upsert(c, id, row, user, conn); // eslint-disable-line no-await-in-loop
        n++;
      }
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  return n;
}
