/* npm run db:import -- "C:\path\Student_Portal_Backup.json"  — copies a backup from the old portal into PostgreSQL */
import fs from 'node:fs';
import { ensureSchema, importAll, pool } from './db.js';

const file = process.argv[2];
if (!file) { console.error('Give the backup file: npm run db:import -- "C:\\path\\Student_Portal_Backup.json"'); process.exit(1); }
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const src = json.data || json.collections || json;
await ensureSchema();
const n = await importAll(src, 'import');
console.log(`Imported ${n} records into PostgreSQL`);
const { rows } = await pool.query('SELECT level, count(*)::int AS n FROM student_registry GROUP BY level ORDER BY level');
console.log('Students by level:', rows.map((r) => `${r.level}: ${r.n}`).join(', '));
await pool.end();
