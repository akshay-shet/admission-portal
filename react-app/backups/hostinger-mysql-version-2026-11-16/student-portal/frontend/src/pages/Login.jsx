import { useLayoutEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { fileUrl } from '../utils.js';
import { academySettings } from '../os/summary.js';
import { applyTheme } from '../os/theme.js';
import { checkLogin, checkEmployeeLogin, lockedMinutes, noteFailure, clearFailures } from '../os/auth.js';
import { PasswordBox, PasswordChecklist, Msg, RecoveryCodeBox, recoverOwner, verOf } from '../os/LoginSetup.jsx';
import Icon from '../components/Icon.jsx';

/* Owner Login: admin / admin until the owner chooses their own login in Settings › Login & security.
   Employee Login: employee / employee until the owner sets their own (or turns it off).
   This page checks the stored password hash. */
const SHARED_TRIES = 5; const SHARED_WAIT_MIN = 10;

export default function Login({ onLogin }) {
  const store = useStore();
  const a = academySettings(store.data);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(() => { try { const n = sessionStorage.getItem('login-note') || ''; sessionStorage.removeItem('login-note'); return n ? { text: n, ok: /saved|reset|changed to/i.test(n) } : null; } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('Owner');
  const [forgot, setForgot] = useState(false);
  const [rv, setRv] = useState({ username: '', code: '', next: '', again: '' });
  const [newCode, setNewCode] = useState(null);
  useLayoutEffect(() => { applyTheme(a.theme); }, [JSON.stringify(a.theme || {})]); // eslint-disable-line react-hooks/exhaustive-deps
  const logo = fileUrl(a.inst_logo);
  const server = !!store.login; // hosted with the backend: the server checks every password
  const employeeReady = server ? a.employee_ready !== false : !!a.employee_auth?.hash || !a.employee_auth?.disabled;

  const guardDoc = () => (store.data.settings || []).find((d) => d.id === 'login-guard') || {};
  const guardOf = (k) => guardDoc()[k] || {};
  const writeGuard = async (k, v) => { try { await store.put('settings', 'login-guard', { ...guardDoc(), [k]: v, id: undefined }); } catch { /* the local lock still applies */ } };
  const logEvent = async (action, actor, role) => { try { await store.add('audit_logs', { at: new Date().toISOString(), actor, role, collection: 'login', action, label: action }); } catch { /* ignore */ } };
  const wait = () => { const m = lockedMinutes(); if (m) { setMsg({ text: `Too many wrong tries. Please wait ${m} minute${m > 1 ? 's' : ''} and try again.` }); return true; } return false; };

  const submit = async (e) => {
    e.preventDefault();
    if (!store.settingsReady) { setMsg({ text: 'Still loading the saved login details — try again in a moment.' }); return; }
    if (!username.trim() || !password) { setMsg({ text: 'Enter the username and the password' }); return; }
    if (!server && wait()) return;
    setBusy(true);
    if (server) { // the server checks the password, the shared lock and writes the Audit Log
      try { const r = await store.login(kind, username, password); clearFailures(); setBusy(false); onLogin(r.user, r.role, null); } catch (err) { setBusy(false); setMsg({ text: err.message }); }
      return;
    }
    if (kind === 'Employee' && !employeeReady) { setBusy(false); setMsg({ text: 'The employee login is turned off. The owner can turn it on in Settings › Login & security.' }); return; }
    // shared lock (all computers): too many wrong tries on this login → it waits, whoever is trying
    const g = guardOf(kind);
    if (g.until > Date.now()) { setBusy(false); setMsg({ text: `The ${kind.toLowerCase()} login is locked for ${Math.ceil((g.until - Date.now()) / 60000)} more minute(s) after too many wrong tries.` }); return; }
    const ok = kind === 'Employee' ? await checkEmployeeLogin(a.employee_auth, username, password) : await checkLogin(a.auth, username, password);
    if (ok) {
      clearFailures();
      const auth = kind === 'Employee' ? a.employee_auth : a.auth;
      const who = !auth?.hash ? (kind === 'Owner' ? 'admin' : 'employee') : String(auth.username);
      if (g.n || g.until) await writeGuard(kind, { n: 0, at: 0, until: 0 });
      await logEvent('Signed in', who, kind);
      setBusy(false);
      onLogin(who, kind, verOf(auth));
      return;
    }
    const left = noteFailure();
    const n = (Date.now() - (g.at || 0) > 15 * 60000 ? 0 : g.n || 0) + 1;
    const lock = n >= SHARED_TRIES;
    await writeGuard(kind, lock ? { n: 0, at: Date.now(), until: Date.now() + SHARED_WAIT_MIN * 60000 } : { n, at: Date.now(), until: 0 });
    await logEvent(lock ? 'Login locked (too many wrong tries)' : 'Wrong password', String(username).trim().slice(0, 60), kind);
    await new Promise((r) => setTimeout(r, Math.min(3000, 400 * n))); // each wrong try answers a little slower
    setBusy(false);
    setMsg({ text: lock ? `Too many wrong tries — the ${kind.toLowerCase()} login is locked for ${SHARED_WAIT_MIN} minutes.` : left ? `Wrong ${kind.toLowerCase()} username or password (${Math.min(left, SHARED_TRIES - n)} ${Math.min(left, SHARED_TRIES - n) === 1 ? 'try' : 'tries'} left before a wait)` : 'Too many wrong tries. Please wait 5 minutes and try again.' });
  };

  const doRecover = async (e) => {
    e.preventDefault(); setMsg(null);
    if (!server && wait()) return;
    setBusy(true);
    try { const r = await recoverOwner(store, rv); clearFailures(); setNewCode(r.code); } catch (err) {
      if (err.wrong) { const left = noteFailure(); setMsg({ text: left ? `${err.message} (${left} ${left === 1 ? 'try' : 'tries'} left)` : 'Too many wrong tries. Please wait 5 minutes and try again.' }); } else setMsg({ text: err.message });
    }
    setBusy(false);
  };

  if (newCode) {
    return <RecoveryCodeBox code={newCode} username={rv.username.trim()} title="Password reset — save your new recovery code"
      onDone={() => { setNewCode(null); setForgot(false); setUsername(rv.username.trim()); setPassword(''); setRv({ username: '', code: '', next: '', again: '' }); setMsg({ text: 'Password reset. Sign in with your new password.', ok: true }); }} />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          {logo ? <img className="inst-logo" src={logo} alt="" /> : <span className="inst-logo inst-logo-default" aria-hidden="true"><Icon name="cap" size={28} /></span>}
          <div className="login-inst">{a.inst_title || 'Student Admission Portal'}</div>
          <div className="login-tag">{a.inst_tagline ?? 'Admissions · Students · Fees'}</div>
        </div>
        {forgot ? (
          <form onSubmit={doRecover} noValidate>
            <h1 className="login-title">Reset the owner password</h1>
            <p className="os-sub">Use the recovery code you saved when the owner login was set up.</p>
            <Msg m={msg} />
            <label htmlFor="rc_user" className="form-label">Owner username</label>
            <input id="rc_user" className="form-control mb-3" value={rv.username} onChange={(e) => setRv({ ...rv, username: e.target.value })} autoComplete="username" />
            <label htmlFor="rc_code" className="form-label">Recovery code</label>
            <input id="rc_code" className="form-control mb-3 rc-input" value={rv.code} onChange={(e) => setRv({ ...rv, code: e.target.value })} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} />
            <PasswordBox id="rc_new" label="New password" value={rv.next} onChange={(x) => setRv({ ...rv, next: x })} small={false} />
            <PasswordChecklist pw={rv.next} username={rv.username} />
            <div className="mt-2"><PasswordBox id="rc_again" label="New password again" value={rv.again} onChange={(x) => setRv({ ...rv, again: x })} small={false} /></div>
            <button type="submit" name="recover" className="btn btn-primary w-100 mt-3" disabled={busy}>{busy ? 'Checking…' : 'Reset password'}</button>
            <button type="button" className="btn btn-link btn-sm w-100 mt-1" onClick={() => { setForgot(false); setMsg(null); }}>Back to sign in</button>
            <p className="small text-muted mt-2 mb-0">No recovery code? {server ? <>On the server, in the project folder, run <code>npm run reset-login</code>.</> : 'Ask the person who manages this portal to reset the owner login.'}</p>
          </form>
        ) : (
          <>
            <div className="login-kind" role="tablist" aria-label="Login type">
              {[['Owner', 'Owner Login'], ['Employee', 'Employee Login']].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setMsg(null); }}>{l}</button>
              ))}
            </div>
            <h1 className="login-title">{kind === 'Owner' ? 'Sign in with the owner account' : 'Sign in with the employee account'}</h1>
            {kind === 'Employee' && store.settingsReady && !employeeReady && <div className="alert alert-warning py-2 small">The employee login is turned off. The owner can turn it on in <b>Settings › Login &amp; security</b>.</div>}
            <Msg m={msg} />
            <form onSubmit={submit} noValidate>
              <label htmlFor="username" className="form-label">Username</label>
              <input id="username" name="username" className="form-control mb-3" placeholder="Enter your username" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value); setMsg(null); }} />
              <PasswordBox id="password" label="Password" value={password} onChange={(x) => { setPassword(x); setMsg(null); }} autoComplete="current-password" placeholder="Enter your password" small={false} />
              <button name="login" type="submit" className="btn btn-primary w-100 btn-lg-ish mt-3" disabled={busy || !store.settingsReady}>{!store.settingsReady ? 'Connecting…' : busy ? 'Checking…' : `Login as ${kind}`}</button>
            </form>
            {kind === 'Owner'
              ? <button type="button" name="forgot" className="btn btn-link btn-sm w-100 mt-1" onClick={() => { setForgot(true); setMsg(null); setRv({ ...rv, username }); }}>Forgot password?</button>
              : <p className="small text-muted text-center mt-2 mb-0">Forgot the employee password? Ask the owner to set a new one.</p>}
          </>
        )}
        <div className="login-foot">© {new Date().getFullYear()} {a.inst_title || 'Student Admission Portal'}</div>
      </div>
    </div>
  );
}
