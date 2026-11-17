/* First start on an empty database: the starting lists (name, logo, boards, courses, combinations) and the
   first logins (hashed). Used by `npm run db:setup` and automatically by the server on start, so a Hostinger
   web app (no terminal needed) is ready after its first deployment. Existing records and logins are never touched. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { makeHash } from '../../backend/auth.js';
import { FIRST_OWNER_USER, FIRST_OWNER_PASSWORD, FIRST_EMPLOYEE_USER, FIRST_EMPLOYEE_PASSWORD } from '../config/env.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function bootstrap(log = console.log) {
  const [cnt] = await db.pool.query('SELECT COUNT(*) AS n FROM portal_records');
  if (Number(cnt[0].n) === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'initial-data.json'), 'utf8'));
    const n = await db.importAll(seed.data || seed, 'setup');
    log(`Loaded ${n} starting records (institution name, logo, boards, courses, combinations)`);
  }
  const cur = await db.one('settings', 'academy-settings');
  const a = cur?.academy || {};
  if (a.auth?.hash && a.employee_auth) return false;
  const now = new Date().toISOString();
  const academy = { ...a };
  if (!a.auth?.hash) academy.auth = { username: FIRST_OWNER_USER, hash: makeHash(FIRST_OWNER_PASSWORD), changed_at: now };
  if (!a.employee_auth) academy.employee_auth = { username: FIRST_EMPLOYEE_USER, hash: makeHash(FIRST_EMPLOYEE_PASSWORD), changed_at: now };
  await db.upsert('settings', 'academy-settings', { ...(cur || {}), academy, updated_at: now }, 'setup');
  log(`First logins written — Owner: ${FIRST_OWNER_USER}, Employee: ${FIRST_EMPLOYEE_USER}. Change them after signing in: Settings › Login & security.`);
  return true;
}
