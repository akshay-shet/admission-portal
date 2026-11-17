/* npm run db:import -- /path/to/Student_Portal_Backup.json — copies a backup (downloaded from Settings › Data & backup) into PostgreSQL.
   The logins in the database are kept; the logins in the file are ignored. */
import fs from 'node:fs';
import { ensureSchema, importAll, counts, pool } from '../connectivity/database/db.js';

const file = process.argv[2];
if (!file) { console.error('Give the backup file: npm run db:import -- /path/to/Student_Portal_Backup.json'); process.exit(1); }
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const src = json.data || json.collections || json;
await ensureSchema();
const n = await importAll(src, 'import');
console.log(`Imported ${n} records into PostgreSQL`);
const rows = await counts();
console.log(rows.map((r) => `${r.collection}: ${r.n}`).join(', '));
await pool.end();
