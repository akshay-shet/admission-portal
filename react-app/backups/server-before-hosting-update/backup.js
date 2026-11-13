/* Automatic backups of every record into the project's "backups" folder, and the one-time clean-up of old records.
   - on every start and every 6 hours: backups/portal-backup-YYYY-MM-DD.json (one file per day, last 60 days kept)
   - if server/CLEAR_ALL_RECORDS.flag exists at start: a full backup first, then all records are removed
     (settings, logins, boards, courses and combinations stay); the flag is then renamed so it runs only once. */
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './env.js';
import { COLLECTIONS } from './collections.js';
import * as db from './db.js';

export const BACKUP_DIR = path.resolve(HERE, '..', 'backups');
const KEEP_DAYS = 60;
const day = () => new Date().toISOString().slice(0, 10);

async function snapshot() {
  const data = {};
  for (const c of COLLECTIONS) data[c] = await db.all(c); // eslint-disable-line no-await-in-loop
  return { app: 'student-portal', version: 1, exported_at: new Date().toISOString(), data };
}
function write(name, json) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(json));
  fs.renameSync(tmp, file); // never leaves a half-written backup
  return file;
}

export async function backupNow(tag = '') {
  const json = await snapshot();
  const n = Object.values(json.data).reduce((s, r) => s + r.length, 0);
  const file = write(tag === 'before-clear' ? `before-clear-${new Date().toISOString().replace(/[:.]/g, '-')}.json` : `portal-backup-${day()}.json`, json);
  // keep the daily files of the last KEEP_DAYS days
  const daily = fs.readdirSync(BACKUP_DIR).filter((f) => /^portal-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  daily.slice(0, Math.max(0, daily.length - KEEP_DAYS)).forEach((f) => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* ignore */ } });
  console.log(`Backup saved: ${path.relative(path.resolve(HERE, '..'), file)} (${n} records)`);
  return file;
}

export function scheduleBackups() {
  setInterval(() => backupNow().catch((e) => console.error('Backup failed:', e.message)), 6 * 3600e3).unref();
}

const FLAG = path.join(HERE, 'CLEAR_ALL_RECORDS.flag');
const KEEP = new Set(['settings', 'boards', 'courses', 'combinations']);
export async function clearIfRequested() {
  if (!fs.existsSync(FLAG)) return;
  console.log('Removing the old records as requested (a full backup is saved first)…');
  await backupNow('before-clear');
  const tables = [...COLLECTIONS.filter((c) => !KEEP.has(c)), 'student_registry'];
  await db.pool.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
  fs.renameSync(FLAG, path.join(HERE, `CLEAR_ALL_RECORDS.done-${day()}.txt`));
  console.log('Old records removed. Settings, logins, boards, courses and combinations were kept.');
}
