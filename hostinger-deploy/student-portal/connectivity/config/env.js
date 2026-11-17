/* Settings for the backend, read from connectivity/config/.env (KEY=value lines, no extra packages).
   Values already set in the server's environment (for example by PM2) win. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(CONFIG_DIR, '..', '..');
export const ENV_FILE = path.join(CONFIG_DIR, '.env');

/* Hostinger Business / Cloud "Node.js web app": every deployment unpacks into a NEW folder
   (/home/<user>/domains/<domain>/hbuilds/<build>/nodejs), so anything the server writes must live outside it:
   /home/<user>/domains/<domain>/portal-data  (outside public_html — never served to visitors). */
export const WEB_APP = /[\\/]hbuilds[\\/]/.test(ROOT) || process.env.HOSTINGER_WEB_APP === '1';
export const STORAGE_HOME = process.env.PORTAL_DATA_DIR
  || (/[\\/]hbuilds[\\/]/.test(ROOT) ? path.join(ROOT.split(/[\\/]hbuilds[\\/]/)[0], 'portal-data') : '');
if (STORAGE_HOME) { try { fs.mkdirSync(STORAGE_HOME, { recursive: true, mode: 0o700 }); } catch { /* reported when used */ } }
export const ENV_FILES = [ENV_FILE, STORAGE_HOME && path.join(STORAGE_HOME, '.env')].filter((f) => f && fs.existsSync(f));
for (const file of ENV_FILES) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#') || process.env[m[1]] !== undefined) continue;
    const v = m[2];
    // "quoted values" are kept as they are; otherwise a " # comment" after the value is ignored
    process.env[m[1]] = /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v.replace(/\s+#.*$/, '');
  }
}
const env = (k, d = '') => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);

/* MySQL connection (hPanel / VPS: create the database and user first — see README-HOSTINGER.md) */
export const DB = {
  host: env('DB_HOST', 'localhost'),
  port: Number(env('DB_PORT', '3306')),
  user: env('DB_USER', 'portal'),
  password: env('DB_PASSWORD', ''),
  database: env('DB_NAME', 'student_portal'),
  ssl: env('DB_SSL') === '1' ? { rejectUnauthorized: env('DB_SSL_STRICT') === '1' } : undefined,
};
export const DB_PROBLEM = !ENV_FILES.length && !process.env.DB_PASSWORD
  ? (WEB_APP ? 'The database settings are missing: add DB_HOST, DB_NAME, DB_USER and DB_PASSWORD under Environment Variables in hPanel (Websites › your Node.js app › Settings & Redeploy), then redeploy.'
    : 'No settings file: copy connectivity/config/.env.example to connectivity/config/.env and fill in the MySQL details.')
  : !DB.password ? 'DB_PASSWORD is empty (Environment Variables in hPanel, or connectivity/config/.env).' : '';

export const PORT = Number(env('PORT', '3000'));
export const HOST = env('HOST', WEB_APP ? '' : '127.0.0.1'); // VPS behind nginx: this computer only · Hostinger web app: the port Hostinger gives (PORT)
export const NODE_ENV = env('NODE_ENV', 'production');
export const TRUST_PROXY = env('TRUST_PROXY', '1');
export const FORCE_HTTPS = env('FORCE_HTTPS', '0') === '1';
export const SESSION_HOURS = Number(env('SESSION_HOURS', '12'));
export const FRONTEND_DIST = path.resolve(ROOT, env('FRONTEND_DIST', 'frontend/dist'));
export const BACKUP_DIR = path.resolve(ROOT, env('BACKUP_DIR', STORAGE_HOME ? path.join(STORAGE_HOME, 'backups') : 'backups'));
export const DATA_DIR = path.resolve(ROOT, env('DATA_DIR', STORAGE_HOME || 'connectivity/config'));

/* first logins written by `npm run db:setup` into an empty database (same as the portal: admin / admin and employee / employee unless set here) */
export const FIRST_OWNER_USER = env('FIRST_OWNER_USER', 'admin');
export const FIRST_OWNER_PASSWORD = env('FIRST_OWNER_PASSWORD', 'admin');
export const FIRST_EMPLOYEE_USER = env('FIRST_EMPLOYEE_USER', 'employee');
export const FIRST_EMPLOYEE_PASSWORD = env('FIRST_EMPLOYEE_PASSWORD', 'employee');

/* Google Sheets (service account) */
/* the key comes from GOOGLE_SERVICE_ACCOUNT_JSON (the whole key file pasted as one value), else from a key file:
   GOOGLE_SERVICE_ACCOUNT_FILE, or portal-data/service-account.json on a Hostinger web app */
export const GOOGLE_KEY_JSON = env('GOOGLE_SERVICE_ACCOUNT_JSON');
export const GOOGLE_KEY_FILE = env('GOOGLE_SERVICE_ACCOUNT_FILE') ? path.resolve(ROOT, env('GOOGLE_SERVICE_ACCOUNT_FILE'))
  : STORAGE_HOME ? path.join(STORAGE_HOME, 'service-account.json') : '';
export const SHEET_ID = env('GOOGLE_SHEET_ID', '');

/* secret that signs login tokens: SESSION_SECRET, or one made once and kept in connectivity/config/.secret */
export function sessionSecret() {
  if (env('SESSION_SECRET')) return env('SESSION_SECRET');
  const f = path.join(DATA_DIR, '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}
