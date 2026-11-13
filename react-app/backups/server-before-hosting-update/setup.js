/* npm run db:setup — creates the database (if it does not exist yet) and all tables, views and links */
import pg from 'pg';
import { DB, DB_PROBLEM } from './env.js';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSchema, importAll, pool } from './db.js';
import { HERE } from './env.js';

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
const target = DB.database;
try {
  const admin = new pg.Client({ ...DB, database: 'postgres' });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [target]);
  if (!rows.length) { await admin.query(`CREATE DATABASE "${target.replace(/"/g, '')}"`); console.log(`Created database "${target}"`); } else console.log(`Database "${target}" already exists`);
  await admin.end();
} catch (e) {
  console.log(`(Could not check/create the database automatically: ${e.message}) — continuing with the existing one`);
}
try {
  await ensureSchema();
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  console.log(`Tables ready (${rows[0].n}). Views: v_students, v_fee_accounts, v_payments, v_due_schedule, v_unlinked_records`);
  // first run: load the records copied from the online portal (server/initial-data.json) into the empty database
  const seed = path.join(HERE, 'initial-data.json');
  const { rows: cnt } = await pool.query('SELECT (SELECT count(*) FROM sslc_students) + (SELECT count(*) FROM puc_students) + (SELECT count(*) FROM degree_students) + (SELECT count(*) FROM pg_students) + (SELECT count(*) FROM installments) AS n');
  if (fs.existsSync(seed) && Number(cnt[0].n) === 0) {
    const json = JSON.parse(fs.readFileSync(seed, 'utf8'));
    const n = await importAll(json.data || json, 'setup');
    console.log(`Loaded ${n} records from the online portal (server/initial-data.json)`);
  } else if (fs.existsSync(seed)) console.log('Database already has records — initial-data.json was not loaded again');
} catch (e) {
  console.error('Setup failed:', e.message); process.exitCode = 1;
}
await pool.end();
