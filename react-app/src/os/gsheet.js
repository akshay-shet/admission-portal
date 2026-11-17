/* Google Sheet link: the portal copies every record into the owner's Google spreadsheet (portal → sheet, one tab per record type).
   Works on the hosted portal through the viewer's own "Google Sheets" claude.ai connector — no keys or passwords in the page.
   Each sync rewrites the portal's tabs completely, so the sheet always matches the portal (edits made in the sheet are overwritten). */
import { allStudents, feeAccount } from './data.js';
import { niceTitle, num } from '../utils.js';
import { formFields, formCustomItems } from '../pages/StudentForm.jsx';
import { INSTALLMENT_FIELDS } from '../pages/InstallmentForm.jsx';
import { MODULES } from './modules.js';
import { COLLECTIONS } from '../store.jsx';

export const GS_SERVER = 'Google Sheets';
export const DEFAULT_SHEET_ID = '1Uw1euENvPMZfJx7Qg89ZMu9ew208uCkiWNl24W4BWh0';
export const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
/** spreadsheet id from a pasted link or a bare id */
export function sheetIdFrom(v) {
  const s = String(v || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

let mcpP = null;
const getMcp = () => (mcpP ||= (typeof window !== 'undefined' && window.claude?.use ? window.claude.use('mcp').catch(() => null) : Promise.resolve(null)));

const SHEETS_ENDPOINT = typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')
  ? '/api/sheets'
  : 'https://react-app-sepia-xi.vercel.app/api/sheets';

let apiSheetsP = null;
const checkApiSheets = async () => {
  if (apiSheetsP) return apiSheetsP;
  apiSheetsP = fetch(SHEETS_ENDPOINT)
    .then((r) => r.json())
    .catch(() => ({ configured: false }));
  return apiSheetsP;
};

/** true when this view can reach the Google Sheets connector (claude.ai) or server endpoint (/api/sheets) */
export const gsAvailable = async () => {
  if (await getMcp()) return true;
  const s = await checkApiSheets();
  return !!s?.configured;
};

async function call(tool, input) {
  const m = await getMcp();
  if (m) {
    const r = await m.callTool(GS_SERVER, tool, input, { cache: false });
    const p = r?.payload;
    return p && typeof p === 'object' && 'content' in p && !Array.isArray(p.content) ? p.content : p;
  }
  // Serverless Google Sheets endpoint (works on Vercel and Hostinger)
  const r = await fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `Google Sheets API error: ${r.status}`);
    err.code = data.code || 'tool_error';
    err.status = r.status;
    throw err;
  }
  return data;
}

/** what to tell the owner for each connector error */
export function gsErrorText(e) {
  switch (e?.code) {
    case 'unavailable': case 'no_backup': case 'bad_backup': return e.message;
    case 'needs_reauth': return 'Google Sheets needs to be reconnected: claude.ai Settings › Connectors › Google Sheets.';
    case 'server_not_connected': case 'selection_required': return 'Connect Google Sheets in claude.ai Settings › Connectors, then try again.';
    case 'not_in_manifest': case 'approval_required': case 'consent_required': return 'The portal was not allowed to use Google Sheets. Click "Sync now" and choose Allow.';
    case 'blocked_by_policy': return 'Your organisation does not allow Google Sheets here.';
    case 'server_unavailable': case 'rate_limited': return 'Google Sheets is not answering right now — try again in a minute.';
    case 'tool_error': return /permission|PERMISSION_DENIED|403/i.test(e.message || '') ? 'Your Google account cannot edit this spreadsheet. Open it in Google and check that you are an editor.' : /not.?found|404/i.test(e.message || '') ? 'That spreadsheet was not found — check the link.' : `Google Sheets said: ${String(e.message || '').slice(0, 200)}`;
    default: return `Could not sync: ${String(e?.message || e).slice(0, 200)}`;
  }
}

/* ---------- turning portal records into sheet rows ---------- */
const MONEY = /^(amount|total_fees|actual_fee|balance|cash_amount|online_amount|fee|total|discount|paid|net|refund|expense_amount|opening_balance|salary)$/;
const SKIP = new Set(['id', 'updated_at']);
const isFile = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('asset' in v || 'url' in v) && 'name' in v;

/** one cell: numbers stay numbers; text that Sheets would turn into a formula, number or date is kept as text */
function cell(k, v) {
  if (v == null || v === '') return '';
  if (isFile(v)) return 'Attached';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (Array.isArray(v)) return safeText(v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', '));
  if (typeof v === 'object') return safeText(JSON.stringify(v));
  if (MONEY.test(k) && /^-?[\d,]+(\.\d+)?$/.test(String(v).trim())) return num(v);
  return safeText(String(v));
}
function safeText(s) {
  const t = s.length > 45000 ? `${s.slice(0, 45000)}…` : s;
  // =,+,-,@ would start a formula; digit-only / date-like text would be converted (Aadhaar shown as 1.2E+11, leading zeros lost)
  return /^[=+\-@\t\r]/.test(t) || /^[\d\s.,:/()+-]+$/.test(t) ? `'${t}` : t;
}
/** a tab: the heading row always lists every field of the form (even with no records yet), then any extra fields found in the records */
function table(rows, fields) {
  const keys = []; const labels = new Map();
  fields.forEach(({ name, label }) => { if (name && !keys.includes(name)) { keys.push(name); labels.set(name, label); } });
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => { if (!SKIP.has(k) && !k.startsWith('_') && !keys.includes(k)) keys.push(k); }));
  const head = keys.map((k) => labels.get(k) || niceTitle(k.replace(/_/g, ' ')));
  return [[...head, 'Record ID'], ...rows.map((r) => [...keys.map((k) => cell(k, r[k])), safeText(String(r.id || ''))])];
}

const customOf = (data, level) => (data.settings || []).find((d) => d.id === `form-${level}`)?.config || {};
/** every field of a level's student form (as customised), plus the fee fields and file uploads */
function studentFields(data, level) {
  const base = [{ name: 'student_id', label: 'Student ID' }, ...formFields(level, customOf(data, level))];
  const files = formCustomItems(level).filter((f) => f.note === 'File upload / Scan').map((f) => ({ name: f.id, label: f.label }));
  const age = formCustomItems(level).some((f) => f.id === 'age') ? [{ name: 'age', label: 'Age' }] : [];
  return [...base, ...age, { name: 'actual_fee', label: 'Actual Fee' }, { name: 'next_payment_date', label: 'Next Payment Date' }, ...files, { name: 'created_at', label: 'Created At' }];
}
const PAYMENT_FIELDS = [{ name: 'student_id', label: 'Student ID' }, { name: 'student_name', label: 'Student Name' }, { name: 'course', label: 'Course' },
  ...INSTALLMENT_FIELDS.map((f) => ({ name: f.id, label: f.id === 'installment_no' ? 'Payment No.' : f.label })),
  { name: 'cash_amount', label: 'Cash Amount' }, { name: 'online_amount', label: 'Online Amount' }, { name: 'created_at', label: 'Created At' }];
const moduleFields = (c) => {
  const m = Object.values(MODULES).find((x) => x.collection === c);
  return [...(m?.fields || []).filter((f) => f.name).map((f) => ({ name: f.name, label: f.label })), { name: 'created_at', label: 'Created At' }];
};
const fieldsFor = (data, c) => {
  const lvl = { sslc_students: 'sslc', puc_students: 'puc', degree_students: 'degree', pg_students: 'pg' }[c];
  if (lvl) return studentFields(data, lvl);
  if (c === 'installments') return PAYMENT_FIELDS;
  if (c === 'discounts') return [{ name: 'student_id', label: 'Student ID' }, { name: 'student_name', label: 'Student Name' }, ...moduleFields(c)];
  return moduleFields(c);
};

const TABS = [
  ['SSLC Students', 'sslc_students'], ['PUC Students', 'puc_students'], ['Degree Students', 'degree_students'], ['PG Students', 'pg_students'],
  ['Payments', 'installments'], ['Discounts & Refunds', 'discounts'], ['Enquiries', 'enquiries'], ['Documents', 'documents'], ['Exams', 'exams'],
  ['Fee Plans', 'fee_plans'], ['Expenses', 'expenses'], ['Cash & Bank', 'cash_bank'], ['Approvals', 'approvals'], ['Employees', 'employees'], ['Reminders', 'notifications'],
];

/** every tab the sync writes: [{title, values}] */
export function buildTabs(data) {
  const students = allStudents(data);
  const fee = [['Student ID', 'Admission No.', 'Student Name', 'Program', 'Mobile', 'Actual Fee', 'Discount', 'Total Fee', 'Paid', 'Balance', 'Paid %', 'Payments', 'Last Payment', 'Days Since', 'Next Payment Date', 'Follow-up Due', 'Status']];
  let collected = 0; let outstanding = 0; let followUps = 0;
  students.forEach((s) => {
    const a = feeAccount(data, s);
    collected += a.paid; outstanding += a.balance; if (a.followUp) followUps++;
    fee.push([safeText(String(s.student_id || '')), safeText(String(s.admission_number || '')), safeText(String(s.student_name || '')), safeText(String(s.program || '')), safeText(String(s.mobile || '')),
      a.total, a.adj, a.net, a.paid, a.balance, a.paidPct, a.count, a.last || '', a.daysSince ?? '', a.next || '', a.followUp ? 'Yes' : '', a.status]);
  });
  const tabs = [];
  const now = new Date();
  tabs.push({ title: 'Summary', values: [
    ['Student Portal — copy of all records'], [''],
    ['Last synced', now.toLocaleString('en-IN')],
    ['Students', students.length], ['Payments', (data.installments || []).length],
    ['Fees collected (₹)', collected], ['Balance outstanding (₹)', outstanding], ['Follow-ups due', followUps], [''],
    ['This spreadsheet is filled by the portal. Changes typed here are replaced at the next sync — make changes in the portal.'],
  ] });
  tabs.push({ title: 'Fee Accounts', values: fee });
  TABS.forEach(([title, c]) => { tabs.push({ title, values: table(data[c] || [], fieldsFor(data, c)) }); });
  return tabs;
}

const q = (t) => `'${t.replace(/'/g, "''")}'`;

/* ---------- full backup inside the spreadsheet (tab "Backup (do not edit)") ---------- */
export const BACKUP_TAB = 'Backup (do not edit)';
const CHUNK = 40000;
/** every record (logins left out) as one JSON text */
export function backupText(data) {
  const d = Object.fromEntries(COLLECTIONS.map((c) => [c, (data[c] || []).map((r) => {
    if (c !== 'settings' || r.id !== 'academy-settings') return r;
    const a = { ...(r.academy || {}) }; delete a.auth; delete a.employee_auth;
    return { ...r, academy: a };
  })]));
  return JSON.stringify({ app: 'student-portal', version: 1, exported_at: new Date().toISOString(), data: d });
}
function backupRows(text, count) {
  const parts = [];
  for (let i = 0; i < text.length; i += CHUNK) parts.push(text.slice(i, i + CHUNK));
  return [
    ['Student Portal backup', new Date().toLocaleString('en-IN'), `${count} records`, 'Do not edit this tab. Restore it in the portal: Settings › Data & backup › Restore from Google Sheet. Older backups: File › Version history.'],
    [''], ['Part', 'Data'],
    ...parts.map((c, i) => [i + 1, `'${c}`]), // ' keeps every part as plain text
  ];
}
/** read the backup tab back: { app, version, exported_at, data } */
export async function readSheetBackup(spreadsheetId) {
  const r = await call('get_values', { spreadsheetId, range: `${q(BACKUP_TAB)}!A1:B20000` });
  const rows = (r?.values || []).slice(3).filter((x) => x && /^\d+$/.test(String(x[0])) && x[1] != null);
  if (!rows.length) { const e = new Error('No backup found in the Google Sheet yet — click "Sync now" first.'); e.code = 'no_backup'; throw e; }
  const text = rows.sort((a, b) => Number(a[0]) - Number(b[0])).map((x) => String(x[1])).join(''); // Sheets hides the leading ' we wrote
  let json; try { json = JSON.parse(text); } catch { const e = new Error('The backup in the Google Sheet is damaged (was the Backup tab edited?).'); e.code = 'bad_backup'; throw e; }
  if (!json?.data || typeof json.data !== 'object') { const e = new Error('The Backup tab does not hold a Student Portal backup.'); e.code = 'bad_backup'; throw e; }
  return json;
}

/** write every tab to the spreadsheet (creates missing tabs); returns { tabs, rows } */
export async function syncToSheet(data, spreadsheetId, onStep = () => {}) {
  const tabs = buildTabs(data);
  const btext = backupText(data);
  const count = COLLECTIONS.reduce((a, c) => a + (data[c] || []).length, 0);
  tabs.push({ title: BACKUP_TAB, values: backupRows(btext, count), backup: true });
  onStep('Opening the spreadsheet…');
  const meta = await call('get_spreadsheet', { spreadsheetId, fields: ['sheets.properties.sheetId', 'sheets.properties.title', 'sheets.properties.gridProperties'] });
  const sheets = (meta?.sheets || []).map((s) => s.properties || {});
  const byTitle = new Map(sheets.map((p) => [p.title, p]));
  const reqs = [];
  // the empty first tab becomes "Summary"
  if (!byTitle.has('Summary') && sheets.length === 1 && /^(Sheet1|Sheet 1)$/.test(sheets[0].title)) {
    reqs.push({ updateSheetProperties: { properties: { sheetId: sheets[0].sheetId, title: 'Summary' }, fields: 'title' } });
    byTitle.set('Summary', { ...sheets[0], title: 'Summary' });
  }
  tabs.forEach((t) => {
    const rows = t.values.length + 50; const cols = Math.max(...t.values.map((r) => r.length)) + 2;
    const p = byTitle.get(t.title);
    if (!p) reqs.push({ addSheet: { properties: { title: t.title, gridProperties: { rowCount: Math.max(200, rows), columnCount: Math.max(26, cols), frozenRowCount: 1 } } } });
    else if ((p.gridProperties?.rowCount || 0) < rows || (p.gridProperties?.columnCount || 0) < cols) {
      reqs.push({ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { rowCount: Math.max(p.gridProperties?.rowCount || 0, rows), columnCount: Math.max(p.gridProperties?.columnCount || 0, cols) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } });
    }
  });
  if (reqs.length) { onStep('Adding tabs…'); await call('update_spreadsheet', { spreadsheetId, requests: reqs }); }
  onStep('Clearing old rows…');
  await call('batch_clear_values', { spreadsheetId, ranges: tabs.map((t) => `${q(t.title)}!A1:ZZ`) });
  let n = 0;
  for (const t of tabs) {
    onStep(`Writing ${t.title}…`);
    // big tabs in pieces of 500 rows
    for (let i = 0; i < t.values.length; i += 500) {
      await call('update_values', { spreadsheetId, range: `${q(t.title)}!A${i + 1}`, values: t.values.slice(i, i + 500) }); // eslint-disable-line no-await-in-loop
    }
    if (!t.backup) n += Math.max(0, t.values.length - 1);
  }
  // bold, frozen header rows (best effort)
  try {
    const meta2 = await call('get_spreadsheet', { spreadsheetId, fields: ['sheets.properties.sheetId', 'sheets.properties.title'] });
    const ids = new Map((meta2?.sheets || []).map((s) => [s.properties?.title, s.properties?.sheetId]));
    const fmt = tabs.filter((t) => ids.has(t.title) && t.title !== 'Summary' && !t.backup).flatMap((t) => [
      { repeatCell: { range: { sheetId: ids.get(t.title), startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColorStyle: { rgbColor: { red: 0.91, green: 0.94, blue: 0.99 } } } }, fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColorStyle' } },
      { updateSheetProperties: { properties: { sheetId: ids.get(t.title), gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    ]);
    if (ids.has('Summary')) fmt.push({ repeatCell: { range: { sheetId: ids.get('Summary'), startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } });
    if (fmt.length) await call('update_spreadsheet', { spreadsheetId, requests: fmt });
  } catch { /* formatting is optional */ }
  return { tabs: tabs.length, rows: n };
}

/* ---------- sync status shared by the Settings card and the automatic sync ---------- */
const listeners = new Set();
export const gsState = { busy: false, step: '', last: null, error: '', rows: 0 };
const setState = (p) => { Object.assign(gsState, p); listeners.forEach((f) => f({ ...gsState })); };
export const onGsState = (f) => { listeners.add(f); return () => listeners.delete(f); };
try { const s = JSON.parse(localStorage.getItem('student-portal-gsheet') || 'null'); if (s) Object.assign(gsState, { last: s.last, rows: s.rows }); } catch { /* ignore */ }

let lastHash = '';
const hashOf = (data) => { const t = buildTabs(data).filter((x) => x.title !== 'Summary'); const s = JSON.stringify(t) + backupText(data).replace(/"exported_at":"[^"]*"/, ''); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return `${s.length}:${h}`; };
/** run one sync (skipped while another runs, or when nothing changed and `force` is false) */
export async function runSync(data, spreadsheetId, force = false) {
  if (gsState.busy || !spreadsheetId) return false;
  const h = hashOf(data);
  if (!force && h === lastHash) return false;
  setState({ busy: true, error: '', step: 'Starting…' });
  try {
    const r = await syncToSheet(data, spreadsheetId, (step) => setState({ step }));
    lastHash = h;
    const last = new Date().toISOString();
    try { localStorage.setItem('student-portal-gsheet', JSON.stringify({ last, rows: r.rows })); } catch { /* ignore */ }
    setState({ busy: false, step: '', last, rows: r.rows, error: '' });
    return true;
  } catch (e) {
    setState({ busy: false, step: '', error: gsErrorText(e), code: e?.code || '' });
    return false;
  }
}
