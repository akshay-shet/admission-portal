/* PostgreSQL access: pool, schema set-up and record helpers */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { DB, HERE } from './env.js';
import { COLLECTIONS, STUDENT_TABLES } from './collections.js';

export const pool = new pg.Pool({ ...DB, max: 10 });

export async function ensureSchema() {
  const sql = fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export const isCollection = (c) => COLLECTIONS.includes(c);
export const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const out = (r) => ({ ...r.data, id: r.id });
const clean = (row) => { const o = { ...(row || {}) }; delete o.id; return o; };

export async function all(c) {
  const { rows } = await pool.query(`SELECT id, data FROM ${c} ORDER BY created_at, id`);
  return rows.map(out);
}
export async function one(c, id, q = pool) {
  const { rows } = await q.query(`SELECT id, data FROM ${c} WHERE id = $1`, [id]);
  return rows[0] ? out(rows[0]) : null;
}
export async function insert(c, row, user, q = pool) {
  const id = newId();
  await q.query(`INSERT INTO ${c} (id, data, created_by, updated_by) VALUES ($1, $2, $3, $3)`, [id, clean(row), user || null]);
  return { ...clean(row), id };
}
/** replace the whole record (or create it with this id) */
export async function upsert(c, id, row, user, q = pool) {
  await q.query(`INSERT INTO ${c} (id, data, created_by, updated_by) VALUES ($1, $2, $3, $3)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), updated_by = EXCLUDED.updated_by`, [id, clean(row), user || null]);
  return { ...clean(row), id };
}
/** merge fields into a record */
export async function merge(c, id, row, user, q = pool) {
  const { rows } = await q.query(`UPDATE ${c} SET data = data || $2::jsonb, updated_at = now(), updated_by = $3 WHERE id = $1 RETURNING id, data`, [id, clean(row), user || null]);
  return rows[0] ? out(rows[0]) : null;
}
export async function remove(c, id, q = pool) {
  const { rowCount } = await q.query(`DELETE FROM ${c} WHERE id = $1`, [id]);
  return rowCount > 0;
}

/* settings document with the logins */
export async function academy(q = pool) {
  const r = await one('settings', 'academy-settings', q);
  return r?.academy || {};
}

/** student's actual fee (same rule as the portal): latest payment's total fees, else the due schedule */
export async function actualFee(studentId) {
  if (!studentId) return 0;
  const { rows } = await pool.query(
    `SELECT COALESCE((SELECT NULLIF(sp_num(data->>'actual_fee'), 0) FROM (SELECT data FROM sslc_students WHERE student_id = $1 UNION ALL SELECT data FROM puc_students WHERE student_id = $1
                       UNION ALL SELECT data FROM degree_students WHERE student_id = $1 UNION ALL SELECT data FROM pg_students WHERE student_id = $1) s LIMIT 1),
                     (SELECT NULLIF(total_fees, 0) FROM installments WHERE student_id = $1 ORDER BY data->>'created_at' DESC NULLS LAST, created_at DESC LIMIT 1),
                     (SELECT SUM(amount) FROM fee_dues WHERE student_id = $1), 0) AS fee`, [studentId]);
  return Number(rows[0]?.fee || 0);
}
export async function hasPayments(studentId) {
  if (!studentId) return false;
  const { rows } = await pool.query('SELECT 1 FROM installments WHERE student_id = $1 LIMIT 1', [studentId]);
  return rows.length > 0;
}

/** bulk restore (a backup .json): students first so every link finds its student */
export async function importAll(collections, user) {
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    const order = [...STUDENT_TABLES, ...COLLECTIONS.filter((c) => !STUDENT_TABLES.includes(c))];
    for (const c of order) {
      for (const r of collections[c] || []) {
        if (!r || typeof r !== 'object') continue;
        const id = r.id ? String(r.id) : newId();
        let row = r;
        if (c === 'settings' && id === 'academy-settings') { // never replace the logins from a file
          const cur = await academy(client);
          row = { ...r, academy: { ...(r.academy || {}), auth: cur.auth, employee_auth: cur.employee_auth } };
          if (!cur.auth) delete row.academy.auth;
          if (!cur.employee_auth) delete row.academy.employee_auth;
        }
        await upsert(c, id, row, user, client); // eslint-disable-line no-await-in-loop
        n++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
  return n;
}
