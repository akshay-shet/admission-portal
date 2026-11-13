/* Reads server/.env (KEY=value lines) without extra packages. Values already set in the environment win. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
// server/.env holds the settings; if it is missing, a filled-in .env.example is used instead
const pick = ['.env', '.env.example'].map((f) => path.join(HERE, f)).find((f) => fs.existsSync(f) && (f.endsWith('.env') || !/YOUR_PASSWORD/.test(fs.readFileSync(f, 'utf8'))));
export const ENV_FILE = pick || '';
if (pick) {
  for (const line of fs.readFileSync(pick, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/* postgres://user:password@host:port/database — the password may contain @ : # / etc. (the LAST @ ends it) */
function parseUrl(u) {
  const m = /^postgres(?:ql)?:\/\/([^:@/]*)(?::(.*))?@([^@/:?]+)(?::(\d+))?(?:\/([^?]*))?/.exec(String(u).trim());
  if (!m) return null;
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  return { user: dec(m[1] || 'postgres'), password: m[2] === undefined ? '' : dec(m[2]), host: m[3], port: Number(m[4] || 5432), database: dec(m[5] || 'student_portal') };
}

/* PostgreSQL connection: DATABASE_URL, or the separate PG* values */
export const DB = (process.env.DATABASE_URL && parseUrl(process.env.DATABASE_URL)) || {
  host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD ?? '', database: process.env.PGDATABASE || 'student_portal',
};
// hosted databases usually need an encrypted connection: PGSSLMODE=require (or ?sslmode=require in DATABASE_URL)
if (process.env.PGSSLMODE === 'require' || /sslmode=require/.test(process.env.DATABASE_URL || '')) DB.ssl = { rejectUnauthorized: process.env.PGSSL_STRICT === '1' };
export const DB_PROBLEM = !pick
  ? 'No settings file: create server/.env (copy server/.env.example) and put your PostgreSQL password in it.'
  : !DB.password ? `No PostgreSQL password in ${path.basename(pick)} (DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/student_portal).`
    : /YOUR_PASSWORD/.test(DB.password) ? `Replace YOUR_PASSWORD with your PostgreSQL password in ${path.basename(pick)}.` : '';
export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';

/* secret that signs login tokens: SESSION_SECRET, or one made once and kept in server/.secret */
export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(HERE, '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8').trim();
}
