/* Reading and writing simple spreadsheets for Import Students — uses ExcelJS (already used for the Excel tracker)
   instead of the old "xlsx" 0.18.5 package, which has unfixed security advisories. */
const p2 = (n) => String(n).padStart(2, '0');
const dateText = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;

function cellValue(v) {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : dateText(v);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return String(v.text ?? '');
    if ('error' in v) return '';
    return '';
  }
  return v;
}

/** CSV / TSV / semicolon text → rows of cells (quotes handled) */
export function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] || '';
  const sep = [',', ';', '\t'].map((s) => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** first sheet of an .xlsx or a .csv file → rows of cell values */
export async function readSheet(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(csv|txt|tsv)$/.test(name) || file.type === 'text/csv') return parseCsv(await file.text());
  if (/\.xls$/.test(name)) throw new Error('Old .xls files cannot be read. Open the file in Excel, choose "Save As" → Excel Workbook (.xlsx) or CSV, and import that.');
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { throw new Error('Could not read that file. Use an Excel (.xlsx) or CSV file.'); }
  const ws = wb.worksheets.find((w) => w.state !== 'hidden') || wb.worksheets[0];
  if (!ws) return [];
  const rows = [];
  const width = ws.columnCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r); const out = [];
    for (let c = 1; c <= width; c++) out.push(cellValue(row.getCell(c).value));
    rows.push(out);
  }
  return rows;
}

/** one-sheet .xlsx with a heading row */
export async function headingSheet(sheetName, heads) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(sheetName).slice(0, 31));
  ws.addRow(heads);
  ws.getRow(1).font = { bold: true };
  heads.forEach((h, i) => { ws.getColumn(i + 1).width = Math.max(12, String(h).length + 2); });
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
