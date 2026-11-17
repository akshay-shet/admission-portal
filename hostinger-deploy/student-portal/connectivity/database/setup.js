/* npm run db:setup — creates the tables, writes the first logins (hashed) and the starting lists into an EMPTY database.
   Safe to run again: existing records and logins are never touched. (The server also does this by itself on start.) */
import mysql from 'mysql2/promise';
import { DB, DB_PROBLEM } from '../config/env.js';

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
// 1. the database itself (skipped when the MySQL user may not create databases — create it in hPanel / as root instead)
try {
  const c = await mysql.createConnection({ host: DB.host, port: DB.port, user: DB.user, password: DB.password, ssl: DB.ssl });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
} catch (e) { console.log(`(Could not create the database automatically: ${e.message}) — using the existing one`); }

const db = await import('./db.js');
try {
  await db.ensureSchema();
  console.log('Table portal_records and views v_students, v_payments are ready');
  const { bootstrap } = await import('./bootstrap.js');
  if (!(await bootstrap())) console.log('Logins already set — not changed');
} catch (e) {
  console.error('Setup failed:', e.message); process.exitCode = 1;
}
await db.pool.end();
