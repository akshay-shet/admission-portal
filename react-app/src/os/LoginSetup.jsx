/* Login set-up and changes: shared by the first-time owner set-up, Settings › Login & security and "Forgot password" */
import { useState } from 'react';
import { academySettings } from './summary.js';
import { makeHash, verifyHash, passwordProblem, passwordChecks, usernameProblem, newRecoveryCode, normCode } from './auth.js';
import Icon from '../components/Icon.jsx';
import { saveFile } from '../store.jsx';

export const SESSION_VER = 'student-portal-ver';
export const setSessionVer = (v) => { try { if (v == null) sessionStorage.removeItem(SESSION_VER); else sessionStorage.setItem(SESSION_VER, String(v)); } catch { /* ignore */ } };
export const getSessionVer = () => { try { return sessionStorage.getItem(SESSION_VER); } catch { return null; } };
export const verOf = (auth) => String(auth?.changed_at || 'default');

/** password box with a show / hide button */
export function PasswordBox({ id, label, value, onChange, autoComplete = 'new-password', placeholder, small = true }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className={`input-group${small ? ' input-group-sm' : ''}`}>
        <input id={id} type={show ? 'text' : 'password'} className={`form-control${small ? ' form-control-sm' : ''}`} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} spellCheck={false} />
        <button type="button" className="btn btn-outline-secondary" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}><Icon name="eye" size={14} /></button>
      </div>
    </>
  );
}

/** ticks under a new password */
export function PasswordChecklist({ pw, username }) {
  if (!pw) return null;
  return (
    <ul className="pw-checks">
      {passwordChecks(pw, username).map(([t, ok]) => <li key={t} className={ok ? 'ok' : ''}><span aria-hidden="true">{ok ? '✓' : '•'}</span> {t}</li>)}
    </ul>
  );
}

/** green / red line under a form */
export const Msg = ({ m }) => (m?.text ? <div className={`login-msg ${m.ok ? 'ok' : 'err'}`} role={m.ok ? 'status' : 'alert'}><Icon name={m.ok ? 'check' : 'alert'} size={15} />{m.text}</div> : null);

/** shows a new recovery code once: copy / download, then "I have saved it" */
export function RecoveryCodeBox({ code, username, title, onDone }) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const copy = async () => { try { await navigator.clipboard.writeText(code); setNote('Copied'); } catch { setNote('Select the code and copy it by hand'); } };
  const download = () => saveFile('Owner_Recovery_Code.txt', new Blob([
    `Student Portal — owner recovery code\r\n\r\nOwner username: ${username}\r\nRecovery code:  ${code}\r\nCreated: ${new Date().toLocaleString('en-IN')}\r\n\r\nUse it on the login page (Owner Login › Forgot password?) if the owner password is ever forgotten.\r\nKeep it somewhere safe and private. Each code works once; a new one is shown after it is used.\r\n`,
  ], { type: 'text/plain' }));
  return (
    <div className="rc-overlay" role="dialog" aria-modal="true" aria-labelledby="rc-title">
      <div className="rc-box">
        <div className="rc-icon"><Icon name="key" size={22} /></div>
        <h2 id="rc-title">{title || 'Save your recovery code'}</h2>
        <p>If the owner password is ever forgotten, this code lets you set a new one from the login page (<b>Owner Login › Forgot password?</b>). It is shown <b>only now</b>.</p>
        <div className="rc-code" data-code={code}>{code}</div>
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={copy}><Icon name="copy" size={14} /> Copy</button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={download}><Icon name="download" size={14} /> Download as a file</button>
        </div>
        {note && <div className="small text-success text-center mt-1">{note}</div>}
        <label className="form-check mt-3 d-flex gap-2 align-items-center justify-content-center">
          <input type="checkbox" className="form-check-input m-0" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I have written down or saved this code</span>
        </label>
        <button type="button" name="rc-done" className="btn btn-primary w-100 mt-2" disabled={!saved} onClick={onDone}>Continue</button>
      </div>
    </div>
  );
}

/* ---------- saving logins (stored as hashes in the settings record) ---------- */
async function writeAcademy(store, patch) {
  const latest = academySettings(store.data);
  const ok = await store.put('settings', 'academy-settings', { academy: { ...latest, ...patch }, updated_at: new Date().toISOString() });
  if (ok === false) throw new Error('Could not save — please try again');
}

/**
 * Owner login: change username and/or password (current password needed; on first set-up "admin"),
 * optionally a new recovery code. Returns { username, ver, code }.
 */
export async function saveOwnerLogin(store, { username, current, next, again, newCode = false, firstSetup = false }) {
  const u = String(username || '').trim();
  const bad = usernameProblem(u); if (bad) throw new Error(bad);
  if (next !== again) throw new Error('The two new passwords are different');
  if (next) { const p = passwordProblem(next, u); if (p) throw new Error(p); }
  const a = academySettings(store.data);
  const auth = a.auth || {};
  const curOk = auth.hash ? await verifyHash(current, auth.hash) : current === 'admin';
  if (!curOk) throw new Error('The current password is wrong');
  if (!auth.hash && !next) throw new Error('Choose a new password');
  if (u.toLowerCase() === String(a.employee_auth?.username || '').toLowerCase()) throw new Error('Use a different username from the employee login');
  const changed = !!next || u !== (auth.username || 'admin');
  if (!changed && !newCode && !firstSetup) throw new Error('Nothing to save — type a new username or password');
  const fresh = { ...auth, username: u, hash: next ? await makeHash(next) : auth.hash };
  if (changed) fresh.changed_at = new Date().toISOString();
  let code = '';
  if (newCode || !auth.recovery_hash) { code = newRecoveryCode(); fresh.recovery_hash = await makeHash(normCode(code)); fresh.recovery_at = new Date().toISOString(); }
  setSessionVer(verOf(fresh)); // this tab stays signed in
  try { sessionStorage.setItem('student-portal-admin', u); } catch { /* ignore */ }
  await writeAcademy(store, { auth: fresh });
  return { username: u, ver: verOf(fresh), code };
}

/** Employee login: set / change (owner only), or turn it off */
export async function saveEmployeeLogin(store, { username, next, again, disable = false }) {
  const u = String(username || '').trim();
  const a = academySettings(store.data);
  const ea = a.employee_auth || {};
  if (disable) { await writeAcademy(store, { employee_auth: { username: ea.username || u, hash: null, disabled: true, changed_at: new Date().toISOString() } }); return; }
  const bad = usernameProblem(u); if (bad) throw new Error(bad);
  if (u.toLowerCase() === String(a.auth?.username || 'admin').toLowerCase()) throw new Error('Use a different username from the owner login');
  if (!ea.hash && !next) throw new Error('Set a password for the employee login');
  if (next !== again) throw new Error('The two passwords are different');
  if (next) { const p = passwordProblem(next, u); if (p) throw new Error(p); }
  if (!next && u === ea.username) throw new Error('Nothing to save — type a new username or password');
  await writeAcademy(store, { employee_auth: { username: u, hash: next ? await makeHash(next) : ea.hash, changed_at: new Date().toISOString() } });
}

/** Forgot owner password: username + recovery code → new password and a new recovery code */
export async function recoverOwner(store, { username, code, next, again }) {
  const u = String(username || '').trim();
  if (!u || !normCode(code)) throw new Error('Enter the owner username and the recovery code');
  if (next !== again) throw new Error('The two new passwords are different');
  const p = passwordProblem(next, u); if (p) throw new Error(p);
  const a = academySettings(store.data);
  const auth = a.auth || {};
  if (!auth.hash) throw new Error('The owner login has not been set up yet — sign in with the starting login');
  if (!auth.recovery_hash) throw new Error('No recovery code was created for this portal. Ask the person who manages the portal to reset the owner login.');
  const ok = u.toLowerCase() === String(auth.username || '').toLowerCase() && await verifyHash(normCode(code), auth.recovery_hash);
  if (!ok) { const e = new Error('The username or recovery code is wrong'); e.wrong = true; throw e; }
  const fresh = { ...auth, hash: await makeHash(next), changed_at: new Date().toISOString() };
  const nc = newRecoveryCode(); fresh.recovery_hash = await makeHash(normCode(nc)); fresh.recovery_at = new Date().toISOString();
  await writeAcademy(store, { auth: fresh });
  return { code: nc };
}

/** First sign-in with the starting login: the owner must choose their own login before using the portal */
export function FirstSetup({ store, onDone, logout }) {
  const [v, setV] = useState({ username: '', next: '', again: '' });
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const go = async (e) => {
    e.preventDefault(); setM(null); setBusy(true);
    try { const r = await saveOwnerLogin(store, { username: v.username, current: 'admin', next: v.next, again: v.again, firstSetup: true, newCode: true }); setDone(r); } catch (err) { setM({ text: err.message }); }
    setBusy(false);
  };
  if (done) return <RecoveryCodeBox code={done.code} username={done.username} onDone={() => onDone(done)} />;
  return (
    <div className="login-page">
      <form className="login-card setup-card" onSubmit={go} noValidate>
        <div className="rc-icon"><Icon name="shield" size={22} /></div>
        <h1 className="login-title text-center">Set up your owner login</h1>
        <p className="os-sub text-center">You signed in with the starting login. Choose your own username and password now — the starting login stops working after this.</p>
        <Msg m={m} />
        <label className="form-label" htmlFor="fs_user">New username</label>
        <input id="fs_user" className="form-control mb-3" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} autoComplete="username" placeholder="For example: owner.priority" />
        <PasswordBox id="fs_new" label="New password" value={v.next} onChange={(x) => setV({ ...v, next: x })} small={false} />
        <PasswordChecklist pw={v.next} username={v.username} />
        <div className="mt-2"><PasswordBox id="fs_again" label="New password again" value={v.again} onChange={(x) => setV({ ...v, again: x })} small={false} /></div>
        {v.again && v.again !== v.next && <div className="small text-danger mt-1">The two passwords are different</div>}
        <button type="submit" name="setup-save" className="btn btn-primary w-100 mt-3" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
        <button type="button" className="btn btn-link btn-sm w-100 mt-1" onClick={logout}>Log out</button>
      </form>
    </div>
  );
}
