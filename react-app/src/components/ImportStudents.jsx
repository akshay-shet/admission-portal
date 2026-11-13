import { readSheet, headingSheet } from './sheetRead.js';
import Icon from './Icon.jsx';
import { useEffect, useRef, useState } from 'react';
import { useStore, saveFile } from '../store.jsx';
import { formFields } from '../pages/StudentForm.jsx';
import {
  LEVELS, calcAge, nextStudentId, admissionPrefix, nextAdmissionNumber, normMedium, MEDIUM_FIELDS,
} from '../utils.js';

/**
 * "Import" next to "Add New Student".
 * - Columns can be in any order and the headings can be worded differently (or missing):
 *   each column is matched by heading (exact, then close wording), and if that fails, by what
 *   its values look like (10-digit mobile, 12-digit Aadhaar, dates, Male/Female, KN/EN, …).
 * - The preview lets you change any column's match before importing.
 * - Columns that don't match a form field are kept as "Other details" on each student's form.
 * - Rows are sorted A–Z by name before they are added, so IDs and admission numbers run in order.
 */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SKIP = '__skip';
const EXTRA = '__extra';

/* Wording that should point at a field even when it isn't the exact label */
const KEYWORDS = [
  [/father|fathers|dad/, 'father_name'],
  [/mother|mothers|mom/, 'mother_name'],
  [/guardian/, 'father_name'],
  [/dob|birth/, 'dob'],
  [/aadha|adhar|aadar|uid/, 'aadhar_card'],
  [/whatsapp/, 'whatsapp'],
  [/(mobile|phone|contact|cell)(no|number)?(2|two|alt|alternate|secondary|other)|alt(ernate)?(mobile|phone|contact)/, 'phone2'],
  [/mobile|phone|contact|cell/, 'mobile'],
  [/mail/, 'email'],
  [/subcaste/, 'subcaste'],
  [/category|quota|reservation/, 'category'],
  [/caste/, 'caste'],
  [/gender|sex/, 'gender'],
  [/handicap|disab|challenged/, 'physically_handicapped'],
  [/religion/, 'religion'],
  [/nationality|citizen/, 'nationality'],
  [/tongue/, 'mother_tongue'],
  [/address|residence|place/, 'address'],
  [/admission(no|number|id)|admno|applicationno/, 'admission_number'],
  [/admissionyear|yearofadmission/, 'admission_year'],
  [/admissionbatch|batchno|batch/, 'admission_batch'],
  [/^(student)?(full)?name$|nameofstudent|studentname|candidatename/, 'student_name'],
];

/* Field-specific keyword overrides per level */
const LEVEL_KEYWORDS = {
  sslc: [[/medium/, 'medium'], [/board/, 'board_id'], [/class|std|standard/, 'prev_class'], [/tc|transfer/, 'prev_register_number']],
  puc: [[/sslcboard/, 'sslc_board_name'], [/sslcmedium/, 'sslc_medium'], [/sslcreg|regno|registerno/, 'sslc_register_number'],
    [/sslcyear|sslcpass/, 'sslc_passed_year'], [/sslcmark/, 'sslc_marks'], [/sslcperc|percentage/, 'sslc_percentage'],
    [/medium/, 'medium'], [/board/, 'board_id'], [/branch|stream|faculty/, 'course_id'], [/course|combination|subjects?group/, 'combination_id'],
    [/^puc$|pucyear|year/, 'puc_year']],
  degree: [[/sslcboard/, 'sslc_board_name'], [/sslcmedium/, 'sslc_medium'], [/sslcreg/, 'sslc_register_number'], [/sslcyear|sslcpass/, 'sslc_passed_year'],
    [/pucboard/, 'puc_board_name'], [/pucmedium/, 'puc_medium'], [/pucreg/, 'puc_register_number'], [/pucyear|pucpass/, 'puc_passed_year'],
    [/pucmark/, 'puc_marks'], [/pucperc/, 'puc_percentage'], [/university|mode/, 'university_mode'], [/board/, 'board_id'],
    [/sem/, 'sem'], [/course|programme|program|degree/, 'course_id'], [/medium/, 'puc_medium'], [/year/, 'year']],
  pg: [[/sslcboard/, 'sslc_board_name'], [/sslcmedium/, 'sslc_medium'], [/sslcreg/, 'sslc_register_number'], [/sslcyear|sslcpass/, 'sslc_passed_year'],
    [/pucboard/, 'puc_board_name'], [/pucmedium/, 'puc_medium'], [/pucreg/, 'puc_register_number'], [/pucyear|pucpass/, 'puc_passed_year'],
    [/bachelor.*reg|degreereg|ugreg/, 'degree_register_number'], [/bachelor.*(board|univ)|degreeboard|ugboard/, 'degree_board_name'],
    [/bachelor.*(year|pass)|degreeyear|ugyear/, 'degree_passed_year'], [/bachelor.*course|degreecourse|ugcourse/, 'degree_course_id'],
    [/cgpa|gpa/, 'degree_cgpa'], [/msc|specialisation|specialization|subject/, 'msc_subject'],
    [/university|mode/, 'university_mode'], [/board/, 'board_id'], [/sem/, 'sem'], [/course|programme|program/, 'course_id'], [/medium/, 'puc_medium'], [/year/, 'year']],
};

/* Similarity of two strings (0..1) using letter pairs: tolerates small spelling differences */
function similar(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const p = s.slice(i, i + 2); m.set(p, (m.get(p) || 0) + 1); } return m; };
  const A = pairs(a); const B = pairs(b); let hit = 0;
  for (const [p, n] of A) hit += Math.min(n, B.get(p) || 0);
  return (2 * hit) / (a.length + b.length - 2);
}

function exactMap(level, listColumns, fields) {
  const map = {};
  const put = (h, name) => { const k = norm(h); if (k && !map[k]) map[k] = name; };
  for (const c of listColumns) if (c.key) put(c.title, c.key);
  for (const f of fields) { put(f.label, f.name); put(f.name, f.name); }
  return map;
}

/* Match one heading to a field: exact -> level keywords -> general keywords -> close spelling */
function matchHeading(heading, level, exact, fields) {
  const h = norm(heading);
  if (!h) return null;
  if (['slno', 'sno', 'serialno', 'sl', 'no', 'actions', 'action', 'studentid'].includes(h)) return SKIP;
  if (exact[h]) return exact[h];
  for (const [re, f] of LEVEL_KEYWORDS[level] || []) if (re.test(h)) return f;
  for (const [re, f] of KEYWORDS) if (re.test(h)) return f;
  let best = null; let score = 0;
  for (const f of fields) {
    const s = Math.max(similar(h, norm(f.label)), similar(h, norm(f.name)));
    if (s > score) { score = s; best = f.name; }
  }
  return score >= 0.72 ? best : null;
}

const pad = (n) => String(n).padStart(2, '0');
function cellText(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v ?? '').trim();
}

/* Recognise a column by its values when the heading doesn't say what it is */
function sniff(values, level, strongOnly) {
  const vals = values.filter((v) => v !== '');
  if (vals.length === 0) return null;
  const share = (re) => vals.filter((v) => re.test(v)).length / vals.length;
  const ok = (re) => share(re) >= 0.7;
  // Strong patterns: safe to use even when the column has some other heading
  if (ok(/^\d{4}-\d{1,2}-[A-Z0-9]+-\d{3,}$/i)) return 'admission_number';
  if (ok(/^(\+?91[\s-]?|0)?[6-9]\d{4}\s?\d{5}$/)) return 'mobile';
  if (ok(/^\d{4}\s?\d{4}\s?\d{4}$/)) return 'aadhar_card';
  if (ok(/^\S+@\S+\.\S+$/)) return 'email';
  if (strongOnly) return null;
  // Weak patterns: only for columns with no heading
  if (ok(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})$/)) return 'dob';
  if (ok(/^(m|f|male|female|boy|girl|other)$/i)) return 'gender';
  if (ok(/^(gm|obc|sc|st|2a|2b|3a|3b|cat-?1|general)$/i)) return 'category';
  if (ok(/^(kn|en|kannada|english)(\s*medium)?$/i)) return level === 'degree' || level === 'pg' ? 'puc_medium' : 'medium';
  if (ok(/^(bise|bosse)$/i)) return level === 'sslc' || level === 'puc' ? 'board_id' : 'sslc_board_name';
  if (ok(/^(ksou|alliance university|gla university)$/i)) return 'board_id';
  if (ok(/^(online|offline)$/i)) return 'university_mode';
  if (level === 'puc' && ok(/^(science|commerce|arts)$/i)) return 'course_id';
  if (level === 'puc' && ok(/^(pcmb|pcmc|pcme|ceba|seba|heba|csba|hebs|hepk|hesp)$/i)) return 'combination_id';
  if (ok(/^(yes|no|y|n)$/i)) return 'physically_handicapped';
  if (ok(/^[A-Za-z][A-Za-z .']{2,}$/) && vals.some((v) => /\s/.test(v))) return 'student_name';
  return null;
}

function toIsoDate(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return s;
}
function gender(s) {
  const t = s.toLowerCase();
  if (t === 'm' || t.startsWith('male') || t === 'boy') return 'Male';
  if (t === 'f' || t.startsWith('female') || t === 'girl') return 'Female';
  return s ? 'Other' : '';
}
const cleanMobile = (s) => { const d = s.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d || s; };

export default function ImportStudents({ level, listColumns, formCfg }) {
  const store = useStore();
  const inputRef = useRef(null);
  const [sheet, setSheet] = useState(null); // {fileName, headings, samples, data:[[...]], mapping:[field|SKIP|EXTRA]}
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [grid, setGrid] = useState(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const L = LEVELS[level];
  const fields = formFields(level, formCfg);
  const fieldLabel = Object.fromEntries(fields.map((f) => [f.name, f.label]));

  const allStudents = () => Object.values(LEVELS).flatMap((x) => store.data[x.table] || []);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setResult('');
    try {
      const raw = (await readSheet(file)).map((r) => r.map(cellText));
      analyze(raw, file.name);
    } catch (err) {
      setError(err.message || 'Could not read that file. Use an Excel (.xlsx) or CSV file.');
    }
  };

  /* Work out the columns of a table of text cells (from a file or the blank sheet) and open the preview */
  const analyze = (rawIn, sourceName) => {
    {
      const raw = rawIn.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some((c) => c !== ''));
      if (!raw.length) throw new Error('The sheet is empty. Paste or type at least one student.');
      // ignore empty columns on the right (e.g. unused columns of the blank sheet)
      const width = Math.max(...raw.map((r) => { let n = r.length; while (n > 0 && r[n - 1] === '') n--; return n; }));
      const exact = exactMap(level, listColumns, fields);

      // Heading row: the row (among the first 10) whose cells match the most fields
      let headRow = -1; let bestHits = 1;
      raw.slice(0, 10).forEach((r, i) => {
        const hits = r.filter((c) => { const m = matchHeading(c, level, exact, fields); return m && m !== SKIP; }).length;
        if (hits > bestHits) { bestHits = hits; headRow = i; }
      });
      const headings = Array.from({ length: width }, (_, i) => (headRow >= 0 ? raw[headRow][i] || '' : ''));
      const data = raw.slice(headRow + 1);

      // Match each column: heading first, then the values in it
      const used = new Set();
      const mapping = headings.map((hd, i) => {
        let f = matchHeading(hd, level, exact, fields);
        if (!f || (f !== SKIP && used.has(f))) {
          let s = sniff(data.slice(0, 50).map((r) => r[i] ?? ''), level, Boolean(norm(hd)));
          if (s === 'mobile' && used.has('mobile')) s = used.has('phone2') ? 'whatsapp' : 'phone2';
          if (s && !used.has(s)) f = s;
          else if (f && f !== SKIP && used.has(f)) f = null;
        }
        if (f && f !== SKIP) used.add(f);
        return f || (hd || data.some((r) => (r[i] ?? '') !== '') ? EXTRA : SKIP);
      });
      setSheet({
        fileName: sourceName,
        headings: headings.map((h, i) => h || `Column ${i + 1}`),
        samples: headings.map((_, i) => (data.find((r) => (r[i] ?? '') !== '') || [])[i] || ''),
        data,
        mapping,
      });
    }
  };

  const setMap = (i, f) => setSheet((s) => {
    const mapping = s.mapping.map((m, j) => (j !== i && f !== SKIP && f !== EXTRA && m === f ? EXTRA : m));
    mapping[i] = f;
    return { ...s, mapping };
  });

  /* Rows that will be imported, already cleaned and sorted A-Z by name */
  const build = () => {
    const existing = new Set(allStudents().map((s) => String(s.admission_number || '').toUpperCase()).filter(Boolean));
    const out = []; let dupes = 0; let noName = 0;
    for (const r of sheet.data) {
      const row = {}; const extra = {};
      sheet.mapping.forEach((f, i) => {
        const t = (r[i] ?? '').trim();
        if (!t || f === SKIP) return;
        if (f === EXTRA) extra[sheet.headings[i]] = t;
        else row[f] = t;
      });
      if (!row.student_name) { if (Object.keys(row).length || Object.keys(extra).length) noName++; continue; }
      if (row.admission_number && existing.has(row.admission_number.toUpperCase())) { dupes++; continue; }
      if (Object.keys(extra).length) row.extra_details = extra;
      out.push(row);
    }
    out.sort((a, b) => a.student_name.localeCompare(b.student_name, undefined, { sensitivity: 'base' }));
    return { rows: out, dupes, noName };
  };

  const run = async () => {
    const { rows } = build();
    setBusy(true); setError('');
    const table = L.table;
    const working = [...(store.data[table] || [])];
    const everyone = allStudents();
    let added = 0;
    try {
      for (const src of rows) {
        const row = { physically_handicapped: 'No', ...src };
        if (row.gender) row.gender = gender(row.gender);
        if (row.dob) { row.dob = toIsoDate(row.dob); row.age = calcAge(row.dob); }
        for (const k of ['mobile', 'phone2', 'whatsapp']) if (row[k]) row[k] = cleanMobile(row[k]);
        for (const k of MEDIUM_FIELDS) if (row[k]) row[k] = normMedium(row[k]);
        if (row.physically_handicapped) row.physically_handicapped = /^y/i.test(row.physically_handicapped) ? 'Yes' : 'No';
        if (row.category) row.category = row.category.toUpperCase();
        row.student_id = nextStudentId(working, L.prefix);
        if (!row.admission_number) {
          if (!row.admission_year) row.admission_year = String(new Date().getFullYear());
          const prefix = admissionPrefix(level, row);
          if (prefix) row.admission_number = nextAdmissionNumber(everyone, prefix);
        }
        row.created_at = new Date().toISOString();
        await store.add(table, row);
        working.push(row); everyone.push(row); added++;
      }
      setResult(`Imported ${added} student${added === 1 ? '' : 's'} into ${L.label} Students (sorted A–Z by name).`);
      setSheet(null);
    } catch (err) {
      setError(`Stopped after ${added} of ${rows.length}: ${err?.code === 'invalid_argument' ? 'you do not have permission to add students here.' : err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const template = async () => {
    const heads = [];
    for (const c of listColumns) if (c.key) heads.push(c.title);
    for (const f of fields) if (!listColumns.some((c) => c.key === f.name) && !heads.some((t) => norm(t) === norm(f.label))) heads.push(f.label);
    saveFile(`${L.label}-students-import-template.xlsx`, await headingSheet(`${L.label} Students`, heads));
  };

  // Headings the blank sheet starts with: the columns of this page's list
  const sheetHeadings = listColumns.filter((c) => c.key).map((c) => c.title);

  const preview = sheet ? build() : null;
  const hasName = sheet?.mapping.includes('student_name');
  const close = () => { setSheet(null); setError(''); setResult(''); };

  return (
    <>
      <div className="import-menu" ref={menuRef}>
        <button type="button" className="btn btn-outline-secondary dropdown-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}><Icon name="upload" size={15} /> Import</button>
        {menuOpen && (
          <div className="import-menu-list" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setGrid(blankGrid(sheetHeadings)); }}>
              <strong>Blank sheet</strong><span>Headings ready: paste rows from Excel, or type them</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); inputRef.current?.click(); }}>
              <strong>Excel / CSV file</strong><span>Choose a .xlsx or .csv file</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); template(); }}>
              <strong>Download template</strong><span>Empty Excel sheet with the headings</span>
            </button>
          </div>
        )}
      </div>
      {grid && (
        <BlankSheet
          title={`${L.label} Students: blank sheet`}
          grid={grid}
          setGrid={setGrid}
          headings={sheetHeadings}
          fieldLabels={fields.map((f) => f.label)}
          onCancel={() => setGrid(null)}
          onContinue={() => {
            try { setError(''); setResult(''); analyze(grid, 'the blank sheet'); setGrid(null); }
            catch (e) { setError(e.message); }
          }}
        />
      )}
      <input ref={inputRef} type="file" hidden accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={pick} />

      {(sheet || error || result) && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-box import-box">
            <h5 className="mb-2">Import {L.label} Students</h5>
            {sheet && (
              <>
                <p className="mb-2">
                  <strong>{preview.rows.length}</strong> student{preview.rows.length === 1 ? '' : 's'} ready from <em>{sheet.fileName}</em>, sorted A–Z by name.
                  {preview.dupes > 0 && <> {preview.dupes} already in the portal will be skipped.</>}
                  {preview.noName > 0 && <> {preview.noName} row{preview.noName === 1 ? ' has' : 's have'} no name and will be skipped.</>}
                </p>
                {!hasName && <div className="alert alert-warning py-2 mb-2">Choose which column holds the student <strong>Name</strong> below.</div>}
                <div className="import-map">
                  <table className="table table-sm align-middle mb-0">
                    <thead><tr><th>Column in sheet</th><th>Example</th><th>Saved as</th></tr></thead>
                    <tbody>
                      {sheet.headings.map((h, i) => (
                        <tr key={i} className={sheet.mapping[i] === SKIP ? 'text-muted' : ''}>
                          <td className="fw-semibold">{h}</td>
                          <td className="import-sample">{sheet.samples[i]}</td>
                          <td>
                            <select className="form-select form-select-sm" value={sheet.mapping[i]} onChange={(e) => setMap(i, e.target.value)} aria-label={`Field for ${h}`}>
                              <option value={EXTRA}>Other details (keep on form)</option>
                              <option value={SKIP}>Don’t import</option>
                              <optgroup label="Form fields">
                                {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                              </optgroup>
                            </select>
                            {fieldLabel[sheet.mapping[i]] === undefined && sheet.mapping[i] === EXTRA && <small className="text-muted">No matching field: kept under “Other details”</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small text-muted mt-2 mb-3">
                  Columns were matched by heading or by their values; change any match above. Student IDs are created automatically,
                  and admission numbers are generated when batch and course are present.
                </p>
              </>
            )}
            {result && <div className="alert alert-success py-2">{result}</div>}
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <div className="d-flex gap-2 justify-content-between flex-wrap">
              <button type="button" className="btn btn-link px-0" onClick={template}>Download blank template</button>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={close}>{sheet ? 'Cancel' : 'Close'}</button>
                {sheet && <button type="button" className="btn btn-primary" disabled={busy || !hasName || !preview.rows.length} onClick={run}>{busy ? 'Importing…' : `Import ${preview.rows.length}`}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Blank sheet: an Excel-like grid with the list headings in row 1, ready to paste into or type on ---------- */
const COLS = 12;
const ROWS = 25;
const colName = (i) => { let s = ''; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function blankGrid(headings = []) {
  const cols = Math.max(COLS, headings.length + 3);
  const head = [...headings, ...Array(cols - headings.length).fill('')];
  return [head, ...Array.from({ length: ROWS }, () => Array(cols).fill(''))];
}

function BlankSheet({ title, grid, setGrid, headings, fieldLabels, onCancel, onContinue }) {
  const width = grid[0].length;
  // row 1 holds the headings; count only the student rows under it
  const filled = grid.slice(1).filter((r) => r.some((c) => String(c).trim() !== '')).length;

  const setCell = (r, c, v) => setGrid((g) => g.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));

  /* Paste a block copied from Excel / Google Sheets (tab-separated) starting at the clicked cell */
  const onPaste = (r, c) => (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return; // single value: normal paste
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    setGrid((g) => {
      const needRows = r + lines.length;
      const needCols = c + Math.max(...lines.map((l) => l.length));
      const cols = Math.max(g[0].length, needCols);
      const out = g.map((row) => [...row, ...Array(cols - row.length).fill('')]);
      while (out.length < needRows + 3) out.push(Array(cols).fill(''));
      lines.forEach((l, i) => l.forEach((v, j) => { out[r + i][c + j] = v.trim(); }));
      return out;
    });
  };

  const move = (r, c) => (e) => {
    const go = (rr, cc) => { const el = document.getElementById(`bs-${rr}-${cc}`); if (el) { e.preventDefault(); el.focus(); el.select(); } };
    if (e.key === 'Enter' || e.key === 'ArrowDown') go(r + 1, c);
    else if (e.key === 'ArrowUp') go(r - 1, c);
    else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) go(r, c + 1);
    else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) go(r, c - 1);
  };

  const addRows = () => setGrid((g) => [...g, ...Array.from({ length: 10 }, () => Array(g[0].length).fill(''))]);
  const [focusId, setFocusId] = useState(null);
  useEffect(() => { if (focusId) { document.getElementById(focusId)?.focus(); setFocusId(null); } }, [focusId, grid]);
  const addCol = () => {
    const j = grid[0].length;
    setGrid((g) => g.map((row) => [...row, '']));
    setFocusId(`bs-0-${j}`); // jump to the new column's heading cell
  };

  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-box sheet-box">
        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
          <div>
            <h5 className="mb-1">{title}</h5>
            <p className="small text-muted mb-0">
              Row 1 has the headings. Paste student rows from Excel into cell A2 (Ctrl+V), or type them.
              Need more details? Type a heading in an empty cell of row 1 (or use + Column): headings that match a
              form field (e.g. Father Name, DOB, Category) fill that field on the student’s form; others are kept under
              Other Details. Pasting your own heading row into A1 works too.
            </p>
          </div>
          <span className="badge text-bg-light border">{filled} row{filled === 1 ? '' : 's'} filled</span>
        </div>
        <div className="sheet-wrap">
          <table className="sheet">
            <thead>
              <tr><th className="sheet-corner" />{Array.from({ length: width }, (_, j) => <th key={j}>{colName(j)}</th>)}</tr>
            </thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={i} className={i === 0 ? 'sheet-head-row' : ''}>
                  <th>{i + 1}</th>
                  {row.map((v, j) => (
                    <td key={j}>
                      <input id={`bs-${i}-${j}`} value={v} aria-label={i === 0 ? `Heading ${colName(j)}` : `${colName(j)}${i + 1}`}
                        list={i === 0 ? 'bs-heading-options' : undefined}
                        placeholder={i === 0 && !v ? '+ heading' : undefined}
                        onChange={(e) => setCell(i, j, e.target.value)} onPaste={onPaste(i, j)} onKeyDown={move(i, j)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="bs-heading-options">
            {[...new Set(fieldLabels)].filter((l) => !grid[0].includes(l)).map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div className="d-flex gap-2 justify-content-between flex-wrap mt-3">
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRows}>+ 10 rows</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addCol}>+ Column</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setGrid(blankGrid(headings))}>Clear</button>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={filled === 0} onClick={onContinue}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}
