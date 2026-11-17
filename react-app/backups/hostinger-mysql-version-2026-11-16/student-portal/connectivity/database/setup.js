/* npm run db:setup — creates the tables, writes the first logins (hashed) and the starting lists into an EMPTY database.
   Safe to run again: existing records and logins are never touched. */
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB, DB_PROBLEM, FIRST_OWNER_USER, FIRST_OWNER_PASSWORD, FIRST_EMPLOYEE_USER, FIRST_EMPLOYEE_PASSWORD } from '../config/env.js';

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
// 1. the database itself (skipped when the MySQL user may not create databases — create it in hPanel / as root instead)
try {
  const c = await mysql.createConnection({ host: DB.host, port: DB.port, user: DB.user, password: DB.password, ssl: DB.ssl });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
} catch (e) { console.log(`(Could not create the database automatically: ${e.message}) — using the existing one`); }

const db = await import('./db.js');
const { makeHash } = await import('../../backend/auth.js');
try {
  await db.ensureSchema();
  console.log('Table portal_records and views v_students, v_payments are ready');
  const [cnt] = await db.pool.query('SELECT COUNT(*) AS n FROM portal_records');
  if (Number(cnt[0].n) === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'initial-data.json'), 'utf8'));
    const n = await db.importAll(seed.data || seed, 'setup');
    console.log(`Loaded ${n} starting records (institution name, logo, boards, courses, combinations)`);
  }
  const cur = await db.one('settings', 'academy-settings');
  const a = cur?.academy || {};
  if (!a.auth?.hash || !a.employee_auth) {
    const now = new Date().toISOString();
    const academy = { ...a };
    if (!a.auth?.hash) academy.auth = { username: FIRST_OWNER_USER, hash: makeHash(FIRST_OWNER_PASSWORD), changed_at: now };
    if (!a.employee_auth) academy.employee_auth = { username: FIRST_EMPLOYEE_USER, hash: makeHash(FIRST_EMPLOYEE_PASSWORD), changed_at: now };
    await db.upsert('settings', 'academy-settings', { ...(cur || {}), academy, updated_at: now }, 'setup');
    console.log(`First logins written — Owner: ${FIRST_OWNER_USER}, Employee: ${FIRST_EMPLOYEE_USER} (passwords from connectivity/config/.env). Change them after signing in: Settings › Login & security.`);
  } else console.log('Logins already set — not changed');
} catch (e) {
  console.error('Setup failed:', e.message); process.exitCode = 1;
}
await db.pool.end();
