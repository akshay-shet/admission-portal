/* Automatic backups of every record into the project's "backups" folder:
   on every start and every 6 hours → backups/portal-backup-YYYY-MM-DD.json (one file per day, last 60 days kept).
   (deploy/backup-db.sh adds a nightly pg_dump on the VPS as a second copy.) */
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR } from '../connectivity/config/env.js';
import { COLLECTIONS } from '../connectivity/database/collections.js';
import * as db from '../connectivity/database/db.js';

const KEEP_DAYS = 60;
const day = () => new Date().toISOString().slice(0, 10);

async function snapshot() {
  const data = {};
  for (const c of COLLECTIONS) data[c] = await db.all(c); // eslint-disable-line no-await-in-loop
  return { app: 'student-portal', version: 1, exported_at: new Date().toISOString(), data };
}
export async function backupNow() {
  const json = await snapshot();
  const n = Object.values(json.data).reduce((s, r) => s + r.length, 0);
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_DIR, `portal-backup-${day()}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(json), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file); // never leaves a half-written backup
  const daily = fs.readdirSync(BACKUP_DIR).filter((f) => /^portal-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  daily.slice(0, Math.max(0, daily.length - KEEP_DAYS)).forEach((f) => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* ignore */ } });
  console.log(`Backup saved: backups/${path.basename(file)} (${n} records)`);
  return file;
}
export function scheduleBackups() {
  setInterval(() => backupNow().catch((e) => console.error('Backup failed:', e.message)), 6 * 3600e3).unref();
}
