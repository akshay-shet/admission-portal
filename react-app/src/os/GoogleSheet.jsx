/* Settings › Google Sheet — link the owner's spreadsheet; the portal copies every record into it (portal → sheet) */
import { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { academySettings } from './summary.js';
import { Card } from './ui.jsx';
import { fmtDateTime } from '../utils.js';
import Icon from '../components/Icon.jsx';
import { notify } from '../components/toast.jsx';
import { DEFAULT_SHEET_ID, sheetIdFrom, sheetUrl, gsAvailable, gsState, onGsState, runSync } from './gsheet.js';
import { currentRole } from './permissions.js';

const saveGs = async (store, patch) => {
  const latest = academySettings(store.data);
  await store.put('settings', 'academy-settings', { academy: { ...latest, gsheet: { ...(latest.gsheet || {}), ...patch } }, updated_at: new Date().toISOString() });
};

export function GoogleSheetSettings() {
  const store = useStore();
  const gs = academySettings(store.data).gsheet || {};
  const id = gs.id || DEFAULT_SHEET_ID;
  const [link, setLink] = useState(sheetUrl(id));
  const [st, setSt] = useState({ ...gsState });
  const [avail, setAvail] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => onGsState(setSt), []);
  useEffect(() => { let on = true; gsAvailable().then((v) => { if (on) setAvail(v); }); return () => { on = false; }; }, []);

  const saveLink = async () => {
    const nid = sheetIdFrom(link);
    if (!nid) { setMsg('Paste the full link of the Google spreadsheet (it contains /spreadsheets/d/…)'); return; }
    await saveGs(store, { id: nid }); setMsg('Spreadsheet link saved'); notify('Spreadsheet link saved');
  };
  const syncNow = async () => {
    setMsg('');
    if (!gs.enabled || gs.id !== id) await saveGs(store, { id, enabled: true, auto: gs.auto !== false });
    const ok = await runSync(store.data, id, true);
    if (ok) notify('Google Sheet updated');
  };
  const setAuto = (auto) => saveGs(store, { id, auto, enabled: gs.enabled || auto });

  return (
    <Card title="Google Sheet (portal → sheet)">
      <div className="sec-status">
        {gs.enabled !== false ? <span className="os-chip success">Linked</span> : <span className="os-chip">Not linked yet</span>}
        <span className="os-sub">{st.last ? `Last synced ${fmtDateTime(st.last)} · ${st.rows} rows` : 'Not synced yet'}</span>
      </div>
      <p className="os-sub">Every student, payment, discount, enquiry, document, exam, expense and fee account is copied into your Google spreadsheet, one tab each, with a <b>Summary</b> and a <b>Fee Accounts</b> tab. The portal stays the main record: anything typed in the sheet is replaced at the next sync.</p>
      {avail === false && <div className="alert alert-warning py-2 small">Google Sheets service account is connecting or needs configuration.</div>}
      <label className="form-label" htmlFor="gs_link">Spreadsheet link</label>
      <div className="input-group input-group-sm">
        <input id="gs_link" className="form-control" value={link} onChange={(e) => setLink(e.target.value)} spellCheck={false} />
        <button type="button" className="btn btn-outline-secondary" onClick={saveLink}>Save link</button>
        <a className="btn btn-outline-primary" href={sheetUrl(id)} target="_blank" rel="noreferrer">Open sheet</a>
      </div>
      <label className="form-check mt-3 d-flex gap-2 align-items-center">
        <input type="checkbox" className="form-check-input m-0" checked={gs.auto !== false} onChange={(e) => setAuto(e.target.checked)} />
        <span>Update the sheet automatically after every change (while an owner has the portal open)</span>
      </label>
      {st.error && <div className="login-msg err mt-2" role="alert"><Icon name="alert" size={15} />{st.error}</div>}
      {msg && <div className={`small mt-2 ${/^Paste/.test(msg) ? 'text-danger' : 'text-success'}`}>{msg}</div>}
      <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
        <span className="os-sub">{st.busy ? st.step : 'The first sync asks you to allow Google Sheets for this portal.'}</span>
        <button type="button" name="gs-sync" className="btn btn-primary btn-sm" onClick={syncNow} disabled={st.busy || avail === false}><Icon name="upload" size={14} /> {st.busy ? 'Syncing…' : 'Sync now'}</button>
      </div>
      <ul className="sec-list mt-3">
        <li>Uses your own Google account through the Google Sheets connector — no keys or passwords are stored in the portal.</li>
        <li>The sheet holds full student details (including Aadhaar numbers). Share it only with people who should see them.</li>
        <li>Changes made with the Employee login reach the sheet the next time an owner has the portal open.</li>
      </ul>
    </Card>
  );
}

/** owner / default sessions: keep the sheet up to date a few seconds after each change */
export function GoogleSheetAutoSync() {
  const store = useStore();
  const gs = academySettings(store.data).gsheet || {};
  const isOwner = currentRole() === 'Owner' || !currentRole();
  const isEnabled = gs.enabled !== false;
  const isAuto = gs.auto !== false;
  const on = store.settingsReady && isOwner && isEnabled && isAuto;
  useEffect(() => {
    if (!on) return undefined;
    const t = setTimeout(() => { runSync(store.data, gs.id || DEFAULT_SHEET_ID); }, 2000);
    return () => clearTimeout(t);
  }, [on, store.data, gs.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
