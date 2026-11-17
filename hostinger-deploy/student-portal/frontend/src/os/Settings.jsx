/* Settings: everything the portal reads from 'academy-settings', grouped in sections */
import { notify } from '../components/toast.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { saveFile, COLLECTIONS } from '../store.jsx';
import { useConfirm } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import { useNav } from '../components/Layout.jsx';
import { PageHead, Card, Line } from './ui.jsx';
import { RecordFields } from './Records.jsx';
import { BrandingCard } from './Pages.jsx';
import { academySettings } from './summary.js';
import { THEME_PRESETS, DEFAULT_THEME, themeVars, applyTheme } from './theme.js';
import { PasswordBox, PasswordChecklist, Msg, RecoveryCodeBox, saveOwnerLogin, saveEmployeeLogin } from './LoginSetup.jsx';
import { fmtDateTime } from '../utils.js';
import { GoogleSheetSettings } from './GoogleSheet.jsx';
import { gsAvailable, runSync, readSheetBackup, gsErrorText, gsState, DEFAULT_SHEET_ID } from './gsheet.js';
import TrackerButton from '../export/TrackerButton.jsx';
import Icon from '../components/Icon.jsx';

const SECTIONS = [
  ['general', 'General', 'Academic year and the contact details printed on receipts'],
  ['brand', 'Branding & colours', 'Logo, name and the colours of the three bars'],
  ['fees', 'Fees & receipts', 'Receipt numbers, receipt note, overdue rule, expense approvals'],
  ['display', 'Display', 'Start page and rows shown per page in lists'],
  ['security', 'Login & security', 'Owner and employee logins, recovery code, automatic logout'],
  ['gsheet', 'Google Sheet', 'Copy every record into your Google spreadsheet'],
  ['data', 'Data & backup', 'Back up, restore and download everything'],
  ['about', 'About & programs', 'Programs offered, storage and record counts'],
];

const yearOptions = () => { const y = new Date().getFullYear(); return [-1, 0, 1, 2].map((d) => `${y + d}–${String(y + d + 1).slice(2)}`); };

/** Save part of the settings without touching the rest */
function useSaveSettings() {
  const store = useStore();
  const [msg, setMsg] = useState('');
  const save = async (patch, text = 'Saved', quiet = false) => {
    const latest = academySettings(store.data);
    await store.put('settings', 'academy-settings', { academy: { ...latest, ...patch }, updated_at: new Date().toISOString() });
    setMsg(quiet ? 'Saved automatically' : text); setTimeout(() => setMsg(''), 2500);
    if (!quiet) notify(text === 'Saved' ? 'Settings saved' : text);
  };
  return [save, msg, setMsg];
}

/** settings save themselves a moment after each change (and at once when the page is hidden or closed) */
function useAutoSave(value, run) {
  const first = useRef(true); const pending = useRef(null); const runRef = useRef(run); runRef.current = run;
  const json = JSON.stringify(value);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    pending.current = () => { pending.current = null; runRef.current(); };
    const t = setTimeout(() => pending.current?.(), 700);
    return () => clearTimeout(t);
  }, [json]);
  useEffect(() => {
    const flush = () => { if (pending.current) pending.current(); };
    document.addEventListener('visibilitychange', flush); window.addEventListener('pagehide', flush);
    return () => { flush(); document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);
}

const SaveBar = ({ onSave, msg, label = 'Save', disabled }) => (
  <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
    {msg && <span className={`small ${/^(Could|Wrong|The|Enter|Type|Pick)/.test(msg) ? 'text-danger' : 'text-success'}`}>{msg}</span>}
    <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={disabled}>{label}</button>
  </div>
);

function General() {
  const store = useStore();
  const cur = academySettings(store.data);
  const [v, setV] = useState(() => ({ academic_year: yearOptions()[1], phone: '', email: '', address: '', website: '', ...cur }));
  const [save, msg] = useSaveSettings();
  const pickG = (x) => ({ academic_year: x.academic_year, phone: String(x.phone || '').trim(), email: String(x.email || '').trim(), website: String(x.website || '').trim(), address: String(x.address || '').trim() });
  useAutoSave(pickG(v), () => save(pickG(v), 'Saved', true));
  return (
    <Card title="General">
      <RecordFields data={store.data} v={v} setV={setV} fields={[
        { name: 'academic_year', label: 'Current academic year (shown in the top bar)', type: 'select', options: yearOptions() },
        { name: 'phone', label: 'Office phone' },
        { name: 'email', label: 'Office email' },
        { name: 'website', label: 'Website (optional)' },
        { name: 'address', label: 'Address', type: 'textarea' },
      ]} />
      <div className="os-sub mt-2">The phone, email, address and website are printed at the top of every fee receipt.</div>
      <SaveBar msg={msg} onSave={() => save({ academic_year: v.academic_year, phone: v.phone.trim(), email: v.email.trim(), website: v.website.trim(), address: v.address.trim() })} />
    </Card>
  );
}

/* ---------- colours ---------- */
const AREAS = [
  ['inst_bg', 'Top title bar', 'The bar with your logo and name'],
  ['top_bg', 'Top navigation bar', 'Page name, search, login type and bell'],
  ['side_bg', 'Side navigation bar', 'The menu on the left'],
  ['accent', 'Highlight colour', 'Selected menu item, logo tile and avatar'],
];
function ThemePreview({ t }) {
  const v = themeVars(t);
  return (
    <div className="theme-preview" aria-hidden="true">
      <div className="tp-inst" style={{ background: v['--inst-bg'], color: v['--inst-fg'] }}><span className="tp-logo" style={{ background: v['--accent'] }} />Your Institution</div>
      <div className="tp-body">
        <div className="tp-side" style={{ background: `linear-gradient(180deg, ${v['--side-bg']}, ${v['--side-bg2']})`, color: v['--side-fg'] }}>
          <div className="tp-item tp-active" style={{ background: `color-mix(in srgb, ${v['--accent']} 30%, transparent)`, color: v['--side-strong'], borderLeftColor: v['--accent'] }}>Dashboard</div>
          <div className="tp-item">Students</div><div className="tp-item">Fees</div><div className="tp-item">Settings</div>
        </div>
        <div className="tp-main">
          <div className="tp-top" style={{ background: v['--top-bg'], color: v['--top-fg'] }}>Student Admin Panel <span style={{ color: v['--top-muted'] }}>/ Dashboard</span><span className="tp-avatar" style={{ background: v['--accent'] }} /></div>
          <div className="tp-page"><div className="tp-card" /><div className="tp-card" /><div className="tp-card" /></div>
        </div>
      </div>
    </div>
  );
}
function Colours() {
  const store = useStore();
  const saved = { ...DEFAULT_THEME, ...(academySettings(store.data).theme || {}) };
  const [t, setT] = useState(saved);
  const [save, msg] = useSaveSettings();
  const set = (k, val) => { const n = { ...t, [k]: val }; setT(n); applyTheme(n); }; // live preview on the real page too
  const pick = (p) => { setT(p.theme); applyTheme(p.theme); };
  const cancel = () => { setT(saved); applyTheme(saved); };
  const changed = JSON.stringify(t) !== JSON.stringify(saved);
  useAutoSave(t, () => { if (changed && Object.values(t).every((x) => /^#[0-9a-f]{6}$/i.test(x))) save({ theme: t }, 'Colours saved', true); });
  return (
    <Card title="Colours">
      <div className="os-sub mb-2">Pick a ready-made colour set, or choose your own colour for each bar. Text colours adjust automatically so they stay readable. Changes show on this page straight away; press Save to keep them for everyone.</div>
      <div className="theme-presets mb-3">
        {THEME_PRESETS.map((p) => (
          <button type="button" key={p.name} className={`theme-chip${JSON.stringify(p.theme) === JSON.stringify(t) ? ' on' : ''}`} onClick={() => pick(p)} title={p.name}>
            <span className="sw" style={{ background: p.theme.inst_bg }} /><span className="sw" style={{ background: p.theme.top_bg }} /><span className="sw" style={{ background: p.theme.side_bg }} /><span className="sw" style={{ background: p.theme.accent }} />
            <b>{p.name}</b>
          </button>
        ))}
      </div>
      <div className="row g-3 align-items-start">
        <div className="col-lg-6">
          {AREAS.map(([k, label, hint]) => (
            <div className="theme-row" key={k}>
              <input type="color" value={t[k]} onChange={(e) => set(k, e.target.value)} aria-label={label} id={`tc_${k}`} />
              <label htmlFor={`tc_${k}`}><b>{label}</b><span>{hint}</span></label>
              <input className="form-control form-control-sm theme-hex" value={t[k]} aria-label={`${label} colour code`}
                onChange={(e) => { const x = e.target.value.trim(); setT({ ...t, [k]: x }); if (/^#[0-9a-f]{6}$/i.test(x)) applyTheme({ ...t, [k]: x }); }} />
            </div>
          ))}
        </div>
        <div className="col-lg-6"><ThemePreview t={t} /></div>
      </div>
      <div className="d-flex justify-content-end align-items-center gap-2 mt-3 flex-wrap">
        {msg && <span className="small text-success">{msg}</span>}
        <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => pick(THEME_PRESETS[0])}>Reset to default colours</button>
        {changed && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancel}>Undo changes</button>}
        <button type="button" className="btn btn-primary btn-sm" disabled={!Object.values(t).every((x) => /^#[0-9a-f]{6}$/i.test(x))} onClick={() => save({ theme: t }, 'Colours saved')}>Save colours</button>
      </div>
    </Card>
  );
}

function Fees() {
  const store = useStore();
  const cur = academySettings(store.data);
  const [v, setV] = useState(() => ({ receipt_prefix: 'RCPT-', receipt_footer: '', show_signatures: 'Yes', ...cur, grace_days: String(cur.grace_days ?? '0'), expense_threshold: cur.expense_threshold ?? '' }));
  const [save, msg, setMsg] = useSaveSettings();
  const go = (quiet = false) => {
    if (!String(v.receipt_prefix || '').trim()) { setMsg('Type a receipt number prefix'); return; }
    save({ receipt_prefix: v.receipt_prefix.trim(), receipt_footer: (v.receipt_footer || '').trim(), grace_days: Number(v.grace_days || 0), expense_threshold: v.expense_threshold === '' ? '' : Number(v.expense_threshold), show_signatures: v.show_signatures }, 'Saved', quiet);
  };
  useAutoSave([v.receipt_prefix, v.receipt_footer, v.grace_days, v.expense_threshold, v.show_signatures], () => go(true));
  return (
    <Card title="Fees & receipts">
      <RecordFields data={store.data} v={v} setV={setV} fields={[
        { name: 'receipt_prefix', label: 'Receipt number prefix (e.g. RCPT- gives RCPT-0001)' },
        { name: 'grace_days', label: 'Days after a student\'s promised payment date before it shows as Follow-up due', type: 'select', options: ['0', '3', '5', '7', '10', '15', '30'] },
        { name: 'expense_threshold', label: 'Approve expenses automatically up to (₹) — leave empty to approve every expense by hand', type: 'amount' },
        { name: 'show_signatures', label: 'Print signature lines on receipts', type: 'select', options: ['Yes', 'No'] },
        { name: 'receipt_footer', label: 'Note printed at the bottom of every receipt (e.g. “Fees once paid are not refundable.”)', type: 'textarea' },
      ]} />
      <SaveBar msg={msg} onSave={() => go()} />
    </Card>
  );
}

function Display() {
  const store = useStore();
  const cur = academySettings(store.data);
  const [v, setV] = useState(() => ({ rows_per_page: String(cur.rows_per_page || 10), start_page: cur.start_page || 'sslc' }));
  const [save, msg] = useSaveSettings();
  useAutoSave(v, () => save({ rows_per_page: Number(v.rows_per_page), start_page: v.start_page }, 'Saved', true));
  return (
    <Card title="Display">
      <RecordFields data={store.data} v={v} setV={setV} fields={[
        { name: 'start_page', label: 'Page to open after login', type: 'select', options: [
          { value: 'sslc', label: 'SSLC Students' }, { value: 'os-overview', label: 'Dashboard' }, { value: 'os-all-students', label: 'All Students' },
          { value: 'installments', label: 'Manage Installments' }, { value: 'os-fee-dashboard', label: 'Fee Dashboard' }] },
        { name: 'rows_per_page', label: 'Rows shown per page in lists', type: 'select', options: ['10', '15', '25', '50', '100'] },
      ]} />
      <SaveBar msg={msg} onSave={() => save({ rows_per_page: Number(v.rows_per_page), start_page: v.start_page })} />
    </Card>
  );
}

/** Employee login (one shared staff login). Owner-only pages are hidden from it. */
function EmployeeLogin() {
  const store = useStore();
  const [ask, dialog] = useConfirm();
  const ea = academySettings(store.data).employee_auth || {};
  const ready = !!ea.hash;
  const [v, setV] = useState({ username: ea.username || '', next: '', again: '' });
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setM(null); setBusy(true);
    try {
      await saveEmployeeLogin(store, v);
      setV({ ...v, next: '', again: '' });
      setM({ ok: true, text: ready ? 'Employee login updated. Staff signed in with the old details are signed out.' : 'Employee login is ready — staff can sign in with Employee Login now.' });
      notify('Employee login saved');
    } catch (e) { setM({ text: e.message }); }
    setBusy(false);
  };
  const off = async () => {
    if (!(await ask('Turn off the employee login? Staff will be signed out and cannot sign in until you set a password again.'))) return;
    try { await saveEmployeeLogin(store, { username: ea.username, disable: true }); setM({ ok: true, text: 'Employee login turned off' }); notify('Employee login turned off'); } catch (e) { setM({ text: e.message }); }
  };
  return (
    <Card title="Employee login">
      {dialog}
      <div className="sec-status">
        {ready
          ? <span className="os-chip success">Active</span>
          : ea.disabled ? <span className="os-chip danger">Turned off</span> : <span className="os-chip warning">Default login</span>}
        <span className="os-sub">{ready ? <>Username <b>{ea.username}</b>{ea.changed_at ? ` · last changed ${fmtDateTime(ea.changed_at)}` : ''}</> : ea.disabled ? 'Staff cannot sign in until you set a username and password here.' : <>Staff sign in with <b>employee / employee</b> until you set your own here.</>}</span>
      </div>
      <div className="os-sub mb-2">Staff sign in with <b>Employee Login</b>. They can work on students, enquiries, admissions, documents, exams, fee collection, payments, pending fees and discounts. The Dashboard, Fee Dashboard, Student Fee Accounts, Cash &amp; Bank, Expenses &amp; Vendors, Finance Reports, Approvals, Settings and Audit Logs are hidden from them. If staff forget the password, set a new one here.</div>
      <div className="row g-2">
        <div className="col-md-4"><label className="form-label" htmlFor="emp_user">Employee username</label><input id="emp_user" className="form-control form-control-sm" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} autoComplete="off" placeholder="For example: staff.front" /></div>
        <div className="col-md-4"><PasswordBox id="emp_new" label={ready ? 'New password (leave empty to keep it)' : 'Password'} value={v.next} onChange={(x) => setV({ ...v, next: x })} /><PasswordChecklist pw={v.next} username={v.username} /></div>
        <div className="col-md-4"><PasswordBox id="emp_again" label="Password again" value={v.again} onChange={(x) => setV({ ...v, again: x })} /></div>
      </div>
      <Msg m={m} />
      <div className="d-flex justify-content-end gap-2 mt-3">
        {(ready || !ea.disabled) && <button type="button" className="btn btn-outline-danger btn-sm" onClick={off}>Turn off employee login</button>}
        <button type="button" name="save-employee" className="btn btn-primary btn-sm" onClick={go} disabled={busy}>{busy ? 'Saving…' : 'Save employee login'}</button>
      </div>
    </Card>
  );
}

function Security() {
  const store = useStore();
  const { user, logout, relogin } = useNav();
  const cur = academySettings(store.data);
  const auth = cur.auth || {};
  const [v, setV] = useState({ username: auth.username || user || '', current: '', next: '', again: '' });
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);
  const [rcPw, setRcPw] = useState('');
  const [m3, setM3] = useState(null);
  const [idle, setIdle] = useState(String(cur.auto_logout_min || 0));
  const [save2, msg2] = useSaveSettings();
  const change = async () => {
    setM(null);
    if (!v.current) { setM({ text: 'Type your current password to save changes' }); return; }
    setBusy(true);
    try {
      const r = await saveOwnerLogin(store, v);
      setV({ ...v, username: r.username, current: '', next: '', again: '' });
      setM({ ok: true, text: 'Owner login saved. Use the new details from the next sign-in; you stay signed in here.' });
      notify('Owner login saved');
      if (r.code) setCode({ code: r.code, username: r.username }); else if (r.username !== user) relogin(r.username);
    } catch (e) { setM({ text: e.message }); }
    setBusy(false);
  };
  const newCode = async () => {
    setM3(null);
    if (!rcPw) { setM3({ text: 'Type your current password first' }); return; }
    try {
      const r = await saveOwnerLogin(store, { username: auth.username || user, current: rcPw, next: '', again: '', newCode: true });
      setRcPw(''); setCode({ code: r.code, username: r.username }); setM3({ ok: true, text: 'New recovery code created — the old one no longer works' });
    } catch (e) { setM3({ text: e.message }); }
  };
  const hasCode = !!auth.recovery_hash;
  return (
    <>
      {code && <RecoveryCodeBox code={code.code} username={code.username} onDone={() => { const u = code.username; setCode(null); if (u !== user) relogin(u); }} />}
      <Card title="Owner login (full access)">
        <div className="sec-status">
          <span className="os-chip success">Active</span>
          <span className="os-sub">Signed in as <b>{user}</b>{auth.changed_at ? ` · last changed ${fmtDateTime(auth.changed_at)}` : ''}</span>
        </div>
        <div className="row g-2">
          <div className="col-md-6"><label className="form-label" htmlFor="sec_user">Username</label><input id="sec_user" className="form-control form-control-sm" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} autoComplete="username" /></div>
          <div className="col-md-6"><PasswordBox id="sec_cur" label="Current password (needed to save)" value={v.current} onChange={(x) => setV({ ...v, current: x })} autoComplete="current-password" /></div>
          <div className="col-md-6"><PasswordBox id="sec_new" label="New password (leave empty to keep it)" value={v.next} onChange={(x) => setV({ ...v, next: x })} /><PasswordChecklist pw={v.next} username={v.username} /></div>
          <div className="col-md-6"><PasswordBox id="sec_again" label="New password again" value={v.again} onChange={(x) => setV({ ...v, again: x })} />{v.again && v.again !== v.next && <div className="small text-danger mt-1">The two passwords are different</div>}</div>
        </div>
        <Msg m={m} />
        <div className="d-flex justify-content-end mt-3"><button type="button" name="save-owner" className="btn btn-primary btn-sm" onClick={change} disabled={busy}>{busy ? 'Saving…' : 'Save login details'}</button></div>
      </Card>
      <div className="mt-3">
        <Card title="Owner recovery code">
          <div className="sec-status">
            {hasCode ? <span className="os-chip success">Saved</span> : <span className="os-chip danger">Not created</span>}
            <span className="os-sub">{hasCode ? `Created ${auth.recovery_at ? fmtDateTime(auth.recovery_at) : ''}. If the owner password is forgotten, use Owner Login › Forgot password? with this code.` : 'Create one now so the owner login can never be lost.'}</span>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-md-6"><PasswordBox id="rc_pw" label="Current password" value={rcPw} onChange={setRcPw} autoComplete="current-password" /></div>
            <div className="col-md-6 text-md-end"><button type="button" name="new-code" className="btn btn-outline-primary btn-sm" onClick={newCode}><Icon name="key" size={14} /> {hasCode ? 'Create a new recovery code' : 'Create recovery code'}</button></div>
          </div>
          <Msg m={m3} />
        </Card>
      </div>
      <div className="mt-3"><EmployeeLogin /></div>
      <div className="mt-3">
        <Card title="Automatic logout">
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label" htmlFor="sec_idle">Log out after this much time without activity</label>
              <select id="sec_idle" className="form-select form-select-sm" value={idle} onChange={(e) => { setIdle(e.target.value); save2({ auto_logout_min: Number(e.target.value) }, 'Saved', true); }}>
                {[['0', 'Never'], ['10', '10 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours']].map(([x, l]) => <option key={x} value={x}>{l}</option>)}
              </select>
            </div>
            <div className="col-md-6 text-md-end"><button type="button" className="btn btn-outline-danger btn-sm" onClick={logout}><Icon name="logout" size={14} /> Log out now</button></div>
          </div>
          <SaveBar msg={msg2} onSave={() => save2({ auto_logout_min: Number(idle) })} />
        </Card>
      </div>
      <div className="mt-3">
        <Card title="How the logins are protected">
          <ul className="sec-list">
            <li>Passwords are never stored or sent anywhere — only a one-way PBKDF2-SHA256 hash (310,000 rounds, its own random salt), which cannot be turned back into the password.</li>
            <li>Until you change them, the logins are admin / admin (owner) and employee / employee (staff) — change both here for safety.</li>
            <li>5 wrong passwords in a row on a login → that login is locked for 10 minutes on every computer, each wrong try answers more slowly, and every sign-in and wrong try is written to the Audit Log.</li>
            <li>A sign-in lasts at most 12 hours. {store.changeLogin ? 'Every password is checked by your server; password hashes never leave it, and the site uses HTTPS.' : 'Only people in your organisation can open the hosted portal at all.'}</li>
            <li>Changing a password signs out every other tab that used the old one. Logging out never deletes any data.</li>
            <li>Settings saves, backups and restores never change the logins.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

const LABELS = { sslc_students: 'SSLC students', puc_students: 'PUC students', degree_students: 'Degree students', pg_students: 'PG students', installments: 'Installments / payments',
  enquiries: 'Enquiries', documents: 'Documents', exams: 'Exam records', fee_plans: 'Fee plans', fee_dues: 'Due schedule', discounts: 'Discounts & refunds', expenses: 'Expenses',
  cash_bank: 'Cash & bank entries', approvals: 'Approvals', employees: 'Employees', notifications: 'Reminders', audit_logs: 'Audit log entries',
  settings: 'Settings & page layouts', boards: 'Boards', courses: 'Courses', combinations: 'Combinations' };

function Data() {
  const store = useStore();
  const [ask, dialog] = useConfirm();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const counts = COLLECTIONS.map((c) => [c, (store.data[c] || []).length]);
  const total = counts.reduce((a, [, n]) => a + n, 0);
  const backup = async () => {
    const out = { app: 'student-portal', version: 1, exported_at: new Date().toISOString(), data: Object.fromEntries(COLLECTIONS.map((c) => [c, store.data[c] || []])) };
    await saveFile(`Student_Portal_Backup_${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    setMsg(`Backup downloaded (${total} records)`);
  };
  const gs = academySettings(store.data).gsheet || {};
  const [gsOk, setGsOk] = useState(false);
  useEffect(() => { let on = true; gsAvailable().then((v) => { if (on) setGsOk(v); }); return () => { on = false; }; }, []);
  const restore = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setMsg('');
    let json;
    try { json = JSON.parse(await f.text()); } catch { setMsg('Could not read that file — choose a backup .json downloaded from this page'); return; }
    const src = json?.data;
    if (!src || typeof src !== 'object') { setMsg('That file is not a Student Portal backup'); return; }
    await restoreSrc(src, `“${f.name}”`);
  };
  const backupToSheet = async () => {
    setMsg(''); setBusy('Saving the backup to the Google Sheet…');
    if (!gs.enabled) await store.put('settings', 'academy-settings', { academy: { ...academySettings(store.data), gsheet: { ...gs, id: gs.id || DEFAULT_SHEET_ID, enabled: true, auto: gs.auto !== false } }, updated_at: new Date().toISOString() });
    const ok = await runSync(store.data, gs.id || DEFAULT_SHEET_ID, true);
    setBusy(''); setMsg(ok ? 'Backup saved to the Google Sheet (tab “Backup (do not edit)”)' : `Could not save to the Google Sheet: ${gsState.error}`);
  };
  const restoreFromSheet = async () => {
    setMsg(''); setBusy('Reading the backup from the Google Sheet…');
    let json;
    try { json = await readSheetBackup(gs.id || DEFAULT_SHEET_ID); } catch (err) { setBusy(''); setMsg(`Could not restore: ${gsErrorText(err)}`); return; }
    setBusy('');
    await restoreSrc(json.data, `the Google Sheet backup of ${fmtDateTime(json.exported_at)}`);
  };
  const restoreSrc = async (src, label) => {
    const cols = COLLECTIONS.filter((c) => Array.isArray(src[c]));
    const n = cols.reduce((a, c) => a + src[c].length, 0);
    if (!(await ask(`Restore ${n} records from ${label}? Records with the same ID are replaced by the backup copy; everything else stays. The logins are not changed.`))) return;
    if (store.importAll) { // hosted with the backend: one request, all or nothing
      setBusy(`Restoring ${n} records…`);
      try { const k = await store.importAll(src); setBusy(''); setMsg(`Restored ${k} records into the database`); } catch (err) { setBusy(''); setMsg(`Could not restore: ${err.message}`); }
      return;
    }
    let done = 0;
    setBusy(`Restoring 0 / ${n}…`);
    for (const c of cols) {
      for (const r of src[c]) {
        if (!r?.id) continue;
        // eslint-disable-next-line no-await-in-loop
        // the logins are never replaced by a backup file
        const row = c === 'settings' && r.id === 'academy-settings' ? { ...r, academy: { ...(r.academy || {}), auth: academySettings(store.data).auth, employee_auth: academySettings(store.data).employee_auth } } : r;
        await store.put(c, r.id, row); done++;
        if (done % 20 === 0) setBusy(`Restoring ${done} / ${n}…`);
      }
    }
    setBusy(''); setMsg(`Restored ${done} records`);
  };
  return (
    <>
      <Card title="Back up and restore">
        <div className="os-sub mb-3">Download a backup file now and then (for example every week) and keep it safe. If anything is deleted by mistake, restore it here. {gsOk ? <>Every Google Sheet sync also keeps a full backup in the sheet's <b>Backup (do not edit)</b> tab (logins are never included); Google keeps older copies in the sheet's File › Version history.</> : ''}</div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button type="button" className="btn btn-primary btn-sm" onClick={backup}><Icon name="download" size={14} /> Download backup (.json)</button>
          <label className={`btn btn-outline-primary btn-sm mb-0${busy ? ' disabled' : ''}`}><Icon name="upload" size={14} /> Restore from backup<input type="file" accept=".json,application/json" hidden onChange={restore} disabled={!!busy} /></label>
          <TrackerButton sheet="Start Here" className="btn btn-outline-success btn-sm" label="Download Excel Tracker" />
          {gsOk && <button type="button" name="backup-sheet" className="btn btn-outline-primary btn-sm" onClick={backupToSheet} disabled={!!busy}><Icon name="upload" size={14} /> Back up to Google Sheet</button>}
          {gsOk && <button type="button" name="restore-sheet" className="btn btn-outline-primary btn-sm" onClick={restoreFromSheet} disabled={!!busy}><Icon name="download" size={14} /> Restore from Google Sheet</button>}
          {busy && <span className="small text-primary">{busy}</span>}
          {!busy && msg && <span className={`small ${/^(Could|That|No )/.test(msg) ? 'text-danger' : 'text-success'}`}>{msg}</span>}
        </div>
      </Card>
      <div className="mt-3">
        <Card title={`Records saved (${total})`} pad={false}>
          <table className="table os-table mb-0"><thead><tr><th>What</th><th className="text-end">Records</th></tr></thead>
            <tbody>{counts.filter(([, n]) => n).map(([c, n]) => <tr key={c}><td>{LABELS[c] || c}</td><td className="text-end">{n}</td></tr>)}</tbody></table>
        </Card>
      </div>
      {dialog}
    </>
  );
}

function About() {
  const store = useStore();
  const students = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'].reduce((a, c) => a + (store.data[c] || []).length, 0);
  return (
    <div className="os-grid two">
      <Card title="Programs offered">
        <Line k="SSLC" v="Boards: BISE, BOSSE · Medium: KN / EN" />
        <Line k="PUC" v="Science · Commerce · Arts (PUC 1 / 2)" />
        <Line k="Degree" v="Online: Alliance, GLA · Offline: KSOU" />
        <Line k="PG" v="Online: MBA, MCA · Offline: KSOU (MA, M.Com, MBA, M.Lib.I.Sc, M.Sc)" />
        <div className="os-sub mt-2">To rename, hide or add form fields and list columns, use the Customize button on each student list and form.</div>
      </Card>
      <Card title="About this portal">
        <Line k="Students" v={students} />
        <Line k="Where records are saved" v={store.kind === 'server' ? 'MySQL database on your server — shared by every computer that signs in' : store.kind === 'artifact' ? 'Online — shared with everyone who opens this portal' : 'In this browser on this computer'} />
        <Line k="Excel exports" v="Tracker layout with charts" />
        <Line k="Version" v="2026.11" />
        {store.kind === 'local' && <div className="os-sub mt-2">Records stay in this browser only. Use Data &amp; backup to copy them to another computer.</div>}
      </Card>
    </div>
  );
}

export default function Settings() {
  const [sec, setSec] = useState(() => { try { return sessionStorage.getItem('settings-tab') || 'general'; } catch { return 'general'; } });
  const open = (k) => { setSec(k); try { sessionStorage.setItem('settings-tab', k); } catch { /* ignore */ } };
  const cur = useMemo(() => SECTIONS.find((s) => s[0] === sec) || SECTIONS[0], [sec]);
  return (
    <>
      <PageHead title="Settings" sub="Everything you can change in the portal, grouped in one place" />
      <div className="settings-wrap">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(([k, label, hint]) => (
            <button type="button" key={k} className={`settings-tab${sec === k ? ' on' : ''}`} onClick={() => open(k)} aria-current={sec === k}>
              <span><b>{label}</b><small>{hint}</small></span>
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <h5 className="settings-title">{cur[1]}</h5>
          {sec === 'general' && <General />}
          {sec === 'brand' && <><BrandingCard /><div className="mt-3"><Colours /></div></>}
          {sec === 'fees' && <Fees />}
          {sec === 'display' && <Display />}
          {sec === 'security' && <Security />}
          {sec === 'gsheet' && <GoogleSheetSettings />}
          {sec === 'data' && <Data />}
          {sec === 'about' && <About />}
        </div>
      </div>
    </>
  );
}
