/* Settings for the backend, read from connectivity/config/.env (KEY=value lines, no extra packages).
   Values already set in the server's environment (for example by PM2) win. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(CONFIG_DIR, '..', '..');
export const ENV_FILE = path.join(CONFIG_DIR, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
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
  host: env('DB_HOST', '127.0.0.1'),
  port: Number(env('DB_PORT', '3306')),
  user: env('DB_USER', 'portal'),
  password: env('DB_PASSWORD', ''),
  database: env('DB_NAME', 'student_portal'),
  ssl: env('DB_SSL') === '1' ? { rejectUnauthorized: env('DB_SSL_STRICT') === '1' } : undefined,
};
export const DB_PROBLEM = !fs.existsSync(ENV_FILE) && !process.env.DB_PASSWORD
  ? 'No settings file: copy connectivity/config/.env.example to connectivity/config/.env and fill in the MySQL details.'
  : !DB.password ? 'DB_PASSWORD is empty in connectivity/config/.env.' : '';

export const PORT = Number(env('PORT', '3000'));
export const HOST = env('HOST', '127.0.0.1'); // behind nginx: listen on this computer only
export const NODE_ENV = env('NODE_ENV', 'production');
export const TRUST_PROXY = env('TRUST_PROXY', '1');
export const FORCE_HTTPS = env('FORCE_HTTPS', '0') === '1';
export const SESSION_HOURS = Number(env('SESSION_HOURS', '12'));
export const FRONTEND_DIST = path.resolve(ROOT, env('FRONTEND_DIST', 'frontend/dist'));
export const BACKUP_DIR = path.resolve(ROOT, env('BACKUP_DIR', 'backups'));
export const DATA_DIR = path.resolve(ROOT, env('DATA_DIR', 'connectivity/config'));

/* first logins written by `npm run db:setup` into an empty database (same as the portal: admin / admin and employee / employee unless set here) */
export const FIRST_OWNER_USER = env('FIRST_OWNER_USER', 'admin');
export const FIRST_OWNER_PASSWORD = env('FIRST_OWNER_PASSWORD', 'admin');
export const FIRST_EMPLOYEE_USER = env('FIRST_EMPLOYEE_USER', 'employee');
export const FIRST_EMPLOYEE_PASSWORD = env('FIRST_EMPLOYEE_PASSWORD', 'employee');

/* Google Sheets (service account) */
export const GOOGLE_KEY_FILE = env('GOOGLE_SERVICE_ACCOUNT_FILE') ? path.resolve(ROOT, env('GOOGLE_SERVICE_ACCOUNT_FILE')) : '';
export const SHEET_ID = env('GOOGLE_SHEET_ID', '');

/* secret that signs login tokens: SESSION_SECRET, or one made once and kept in connectivity/config/.secret */
export function sessionSecret() {
  if (env('SESSION_SECRET')) return env('SESSION_SECRET');
  const f = path.join(DATA_DIR, '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}
