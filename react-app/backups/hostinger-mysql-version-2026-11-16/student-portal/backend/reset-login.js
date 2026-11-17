/* Last resort when the owner password AND the recovery code are lost: run on the computer that has the database.
   Usage (on the server, in the project folder): npm run reset-login */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { DB_PROBLEM } from '../connectivity/config/env.js';
import * as db from '../connectivity/database/db.js';
import { makeHash, passwordProblem, usernameProblem, newRecoveryCode, normCode } from './auth.js';

if (DB_PROBLEM) { console.error(DB_PROBLEM); process.exit(1); }
const rl = readline.createInterface({ input, output });
try {
  await db.ensureSchema();
  const cur = await db.one('settings', 'academy-settings');
  const a = cur?.academy || {};
  console.log(`\nReset the OWNER login of the Student Portal. Current owner username: ${a.auth?.hash ? a.auth.username : '(not set yet)'}\n`);
  let username; let pw;
  for (;;) { username = (await rl.question('New owner username: ')).trim(); const p = usernameProblem(username); if (!p) break; console.log('  ' + p); }
  for (;;) {
    pw = await rl.question('New owner password (letters and numbers, at least 8): ');
    const p = passwordProblem(pw, username); if (p) { console.log('  ' + p); continue; }
    if ((await rl.question('Type the password again: ')) !== pw) { console.log('  The two passwords are different'); continue; }
    break;
  }
  const code = newRecoveryCode();
  const auth = { ...(a.auth || {}), username, hash: makeHash(pw), changed_at: new Date().toISOString(), recovery_hash: makeHash(normCode(code)), recovery_at: new Date().toISOString() };
  await db.upsert('settings', 'academy-settings', { ...(cur || {}), academy: { ...a, auth }, updated_at: new Date().toISOString() }, 'reset-login');
  console.log(`\nDone. Sign in with Owner Login as "${username}".`);
  console.log(`\nNEW RECOVERY CODE (write it down and keep it safe):   ${code}\n`);
} catch (e) {
  console.error('Could not reset the login:', e.message); process.exitCode = 1;
} finally { rl.close(); await db.pool.end(); }
