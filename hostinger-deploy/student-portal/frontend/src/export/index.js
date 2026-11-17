/* Excel downloads in the tracker layout (navy title bar, notes row, totals bar, frozen headings, filters, print setup) */
import { saveFile } from '../store.jsx';
import { isoDate, normMedium, num, studentClass, isReceived } from '../utils.js';
import { allStudents, feeAccount } from '../os/data.js';
import { academySettings } from '../os/summary.js';

const loadLibs = async () => {
  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([import('exceljs'), import('jszip')]);
  return { ExcelJS, JSZip };
};
const utcDate = (v) => {
  const s = isoDate(v);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const stamp = () => new Date().toISOString().slice(0, 10);
const fileSafe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');

/** Everything the tracker workbook needs, taken from the portal's records */
export function trackerModel(data) {
  const a = academySettings(data);
  const students = allStudents(data).map((s) => {
    const fee = feeAccount(data, s);
    const received = fee.list.filter(isReceived);
    const last = received[received.length - 1];
    return {
      name: String(s.student_name ?? '').trim() || s.student_id,
      level: s.levelLabel,
      group: s.program,
      medium: normMedium(s.medium || s.puc_medium || s.sslc_medium || s.prev_medium),
      combination: s.level === 'puc' ? (s.combination_id || '') : s.level === 'sslc' ? 'SSLC' : (s.course_id || ''),
      totalFees: fee.total,
      admissionDate: utcDate(s.admission_date || s.created_at),
      lastPayment: last ? num(last.amount) : 0,
      paid: fee.paid,
      discount: fee.adj,
      admissionNo: s.admission_number || s.student_id || '',
      key: s.admission_number || s.student_id || '',
      mobile: s.mobile || '',
      nextDue: utcDate(fee.next), // pay as you go: the date this student said they will pay next (optional)
    };
  });
  const prefix = a.receipt_prefix || 'RCPT-';
  const byId = Object.fromEntries(allStudents(data).map((s) => [s.student_id, s]));
  const keyOf = (sid, fallback) => byId[sid]?.admission_number || byId[sid]?.student_id || fallback || sid || '';
  let receiptNo = 0;
  const payments = [...(data.installments || [])]
    .sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || '')))
    .map((r) => ({
      receipt: isReceived(r) ? `${prefix}${String(++receiptNo).padStart(4, '0')}` : '',
      date: utcDate(r.payment_date),
      key: keyOf(r.student_id, r.admission_number),
      name: r.student_name || byId[r.student_id]?.student_name || r.student_id || '',
      cls: studentClass(r.student_id) || r.course || '',
      mode: r.payment_mode || '',
      reference: r.reference || '',
      amount: num(r.amount),
      status: r.status || 'Paid',
    }));
  // approved refunds: money given back, shown as negative payments
  (data.discounts || []).filter((d) => d.type === 'Refund' && d.status === 'Approved').forEach((d) => payments.push({
    receipt: '', date: utcDate(d.decided_at || d.created_at), key: keyOf(d.student_id), name: d.student_name || '', cls: studentClass(d.student_id),
    mode: 'Refund', reference: d.request_no || '', amount: -num(d.amount), status: 'Refund',
  }));
  return { institution: { title: a.inst_title || 'Student Admission Portal', tagline: a.inst_tagline ?? 'Admissions · Students · Fees' }, generatedAt: new Date(), graceDays: Number(a.grace_days) || 0, students, payments };
}

/** The complete Student & Fee Tracker workbook (all sheets + charts) */
export async function downloadTracker(data, activeSheet) {
  const [{ buildTracker }, libs] = await Promise.all([import('./tracker.js'), loadLibs()]);
  const model = { ...trackerModel(data), activeSheet };
  const buf = await buildTracker(model, libs);
  const name = `${fileSafe(model.institution.title) || 'Student'}_Student_Fee_Tracker_${stamp()}.xlsx`;
  await saveFile(name, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  return name;
}

/* ---------- any single list as a styled sheet in the same look ---------- */
const NAVY = 'FF0B1738'; const TOTAL = 'FFFFF3CC'; const NOTE_BG = 'FFF8F9FB'; const NOTE_FG = 'FF667085';
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const line = { style: 'thin', color: { argb: 'FFD9DEE7' } };
const box = { top: line, left: line, bottom: line, right: line };
const MONEY_RE = /^-?\s*₹?\s*-?[\d,]+(\.\d+)?$/;
const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;
const colLetter = (n) => { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * head: column titles, rows: arrays of values (text, numbers, "₹10,000", "15-09-2026").
 * Number-like columns become real numbers with totals; dd-mm-yyyy text becomes real dates.
 */
export async function downloadStyledSheet({ filename, title, note, head, rows, sheetName }) {
  const { ExcelJS } = await loadLibs();
  const inst = (() => { try { return document.querySelector('.inst-title')?.textContent || ''; } catch { return ''; } })();
  const wb = new ExcelJS.Workbook();
  wb.creator = inst || 'Student Portal';
  const ws = wb.addWorksheet((sheetName || title || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  const n = head.length;
  const last = colLetter(Math.max(n - 1, 3));
  const isSerial = (t) => /^(sl\.?\s*no|#|s\.?no)$/i.test(String(t).trim());
  const isId = (t) => /mobile|phone|aadhar|admission\s*no|reg|receipt|reference|utr|id\b|number/i.test(String(t)) && !/amount|fee/i.test(String(t));
  const blank = (v) => v === '' || v === null || v === undefined || v === '—' || v === '-';
  // decide each column's kind
  const kinds = head.map((h, j) => {
    const vals = rows.map((r) => r[j]).filter((v) => !blank(v));
    if (!vals.length || isSerial(h) || isId(h)) return 'text';
    if (vals.every((v) => typeof v === 'number' || (typeof v === 'string' && MONEY_RE.test(v.trim()) && /[\d]/.test(v)))) {
      return /₹|amount|fee|paid|balance|debit|credit|discount|money|total|collected|agreed/i.test(h) || vals.some((v) => String(v).includes('₹')) ? 'money' : 'number';
    }
    if (vals.every((v) => typeof v === 'string' && DATE_RE.test(v.trim()))) return 'date';
    return 'text';
  });
  const conv = (v, k) => {
    if (blank(v)) return k === 'text' ? (v ?? null) : null;
    if (k === 'money' || k === 'number') return typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, '')) || 0;
    if (k === 'date') { const m = DATE_RE.exec(String(v).trim()); return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); }
    return v;
  };
  // title + note
  ws.mergeCells(`A1:${last}1`); ws.mergeCells(`A2:${last}2`);
  const t = ws.getCell('A1');
  t.value = `${inst ? inst.toUpperCase() + ' — ' : ''}${String(title || '').toUpperCase()}`;
  t.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; t.fill = fill(NAVY); t.alignment = { horizontal: 'center', vertical: 'middle' };
  const nn = ws.getCell('A2');
  nn.value = note || `Downloaded from the Student Portal on ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Click the small arrows in the blue headings to filter.`;
  nn.font = { name: 'Calibri', italic: true, size: 10, color: { argb: NOTE_FG } }; nn.fill = fill(NOTE_BG); nn.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34; ws.getRow(2).height = 32;
  // header
  head.forEach((h, j) => {
    const c = ws.getCell(4, j + 1);
    c.value = h; c.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(NAVY);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = box;
  });
  ws.getRow(4).height = 30;
  // rows
  rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    head.forEach((_, j) => {
      const c = row.getCell(j + 1);
      c.value = conv(r[j], kinds[j]);
      c.font = { name: 'Calibri', size: 11 };
      c.border = box;
      if (kinds[j] === 'money') c.numFmt = '#,##0';
      if (kinds[j] === 'date') c.numFmt = 'dd-mmm-yyyy';
      if (i % 2 === 1) c.fill = fill('FFF9FAFB');
    });
  });
  const lastRow = 4 + Math.max(rows.length, 1);
  // totals bar (row 3)
  head.forEach((h, j) => {
    const c = ws.getCell(3, j + 1);
    c.fill = fill(TOTAL); c.font = { name: 'Calibri', bold: true, color: { argb: NAVY } }; c.border = box;
    const L = colLetter(j);
    if (j === 0) c.value = `TOTAL · ${rows.length} rows`;
    else if (kinds[j] === 'money') {
      c.value = { formula: `SUBTOTAL(9,${L}5:${L}${lastRow})`, result: rows.reduce((a, r) => a + (conv(r[j], 'money') || 0), 0) };
      c.numFmt = '#,##0';
    }
  });
  ws.getRow(3).height = 22;
  // widths
  head.forEach((h, j) => {
    const longest = Math.max(String(h).length, ...rows.slice(0, 300).map((r) => String(r[j] ?? '').length));
    ws.getColumn(j + 1).width = Math.min(45, Math.max(9, longest + 3));
  });
  if (rows.length) ws.autoFilter = { from: 'A4', to: `${colLetter(n - 1)}${lastRow}` };
  ws.pageSetup = { orientation: n > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: '4:4',
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  ws.headerFooter = { oddFooter: '&L&8&A&R&8Page &P of &N' };
  const buf = await wb.xlsx.writeBuffer();
  await saveFile(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

