import { saveFile, inArtifact } from '../store.jsx';
import { fmt2, fmtDate, studentClass, batchLabel, num } from '../utils.js';

/* Institution details for the receipt header / footer (kept up to date by the top bar from Settings) */
let BRAND = {};
export function setReceiptBranding(b) { BRAND = b || {}; }
const contactLine = () => [BRAND.address, BRAND.phone && `Ph: ${BRAND.phone}`, BRAND.email, BRAND.website].filter(Boolean).join('  ·  ');

/* logo as a data: URL so it shows in the receipt window and the PDF (uploaded logos may be links) */
async function logoDataUrl(src) {
  if (!src || src.startsWith('data:')) return src || '';
  try { const b = await (await fetch(src)).blob(); return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => ok(''); fr.readAsDataURL(b); }); } catch { return ''; }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Fee receipt for one student: every installment with everything entered on the installment form.
 * extraFields: [{ id, label }] for fields added through Customize on the installment form.
 * Opens the print window; on the hosted claude.ai page (printing blocked) it saves a PDF instead.
 */
export async function printReceipt(student, summary, extraFields = []) {
  const first = summary.list[0] || {};
  const last = summary.list[summary.list.length - 1] || {};
  const name = student?.student_name || first.student_name || '';
  const adm = student?.admission_number || last.admission_number || '';
  const today = fmtDate(new Date().toISOString().slice(0, 10));
  const receiptNo = `R-${(adm || student?.student_id || 'NA').replace(/[^A-Z0-9-]/gi, '')}-${summary.list.length}`;

  const info = [
    ['Student Name', name],
    ['Admission No', adm],
    ['Class', studentClass(student?.student_id || first.student_id)],
    ['Father Name', student?.father_name || ''],
    ['Mobile', student?.mobile || last.phone || ''],
    ['Admission Year', student?.admission_year || last.admission_year || ''],
    ['Admission Batch', batchLabel(student?.admission_batch || last.admission_batch || '')],
    ['Register Number', student?.register_number || last.register_number || ''],
  ];

  // running balance after each payment
  let paidSoFar = 0;
  const extras = extraFields.filter((f) => summary.list.some((r) => r[f.id] !== undefined && r[f.id] !== ''));
  const head = ['#', 'Date', 'Payment No', 'Amount', 'Payment Mode', 'Reference', 'Status', ...extras.map((f) => f.label), 'Balance After'];
  const body = summary.list.map((r, i) => {
    if (!['Pending', 'Rejected'].includes(r.status)) paidSoFar += num(r.amount);
    const mode = r.payment_mode === 'Cash/Online' && r.cash_amount != null
      ? `Cash ${fmt2(r.cash_amount)} + Online ${fmt2(r.online_amount)}` : (r.payment_mode || '');
    return [String(i + 1), fmtDate(r.payment_date), String(r.installment_no || i + 1), fmt2(r.amount), mode, r.reference || '', r.status || '',
      ...extras.map((f) => String(r[f.id] ?? '')), fmt2(Math.max(0, summary.total - (summary.discount || 0) - paidSoFar))];
  });
  const amountCol = 3;
  const logoSrc = await logoDataUrl(BRAND.logo);
  const totals = [['Actual Fee', fmt2(summary.total)], ...(summary.discount ? [['Discount', fmt2(summary.discount)], ['Total Fee', fmt2(Math.max(0, summary.total - summary.discount))]] : []), ...(summary.refund ? [['Refunded', fmt2(summary.refund)]] : []), ['Total Paid', fmt2(summary.paid)], ['Balance Due', fmt2(summary.balance)]];

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fee Receipt - ${esc(name)}</title><style>
        @page { size: A4; margin: 12mm; }
        *{box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;font-size:12.5px;background:#fff}
        .rc{border:1.5px solid #0f172a;padding:18px 20px;max-width:800px;margin:0 auto}
        .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #0f172a;padding-bottom:10px;margin-bottom:12px;gap:12px}
        .org{color:#475569;margin-top:2px;font-size:11.5px}
        .meta{text-align:right;line-height:1.7;white-space:nowrap} .meta b{display:inline-block;min-width:78px;color:#475569;font-weight:600}
        .info{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 16px;margin-bottom:12px}
        .info span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
        .info div{border-bottom:1px dotted #cbd5e1;padding-bottom:3px;min-height:30px}
        table{border-collapse:collapse;width:100%} th,td{border:1px solid #94a3b8;padding:5px 7px;text-align:left}
        th{background:#e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:.03em;-webkit-print-color-adjust:exact;print-color-adjust:exact} td.n,th.n{text-align:right}
        .tot{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px 22px;margin-top:10px;font-size:13px} .tot b{margin-left:6px}
        .tot .due b{color:#b91c1c}
        .sign{margin-top:46px;display:flex;justify-content:space-between;color:#475569}
        .sign div{border-top:1px solid #64748b;padding-top:4px;width:200px;text-align:center}
        .note{margin-top:14px;font-size:11px;color:#64748b}
        .brand{display:flex;gap:12px;align-items:flex-start} .brand img{width:56px;height:56px;object-fit:contain}
        .iname{font-size:17px;font-weight:700} h1{font-size:15px;letter-spacing:.12em;margin:6px 0 0}
      </style></head><body><div class="rc">
        <div class="top"><div class="brand">${logoSrc ? `<img src="${esc(logoSrc)}" alt="">` : ''}<div><div class="iname">${esc(BRAND.title || 'Student Portal')}</div>${contactLine() ? `<div class="org">${esc(contactLine())}</div>` : ''}<h1>FEE RECEIPT</h1></div></div>
          <div class="meta"><div><b>Receipt No</b> ${esc(receiptNo)}</div><div><b>Date</b> ${esc(today)}</div></div></div>
        <div class="info">${info.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v) || '&nbsp;'}</div>`).join('')}</div>
        <table><thead><tr>${head.map((h, i) => `<th class="${i === amountCol || i === head.length - 1 ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r) => `<tr>${r.map((c, i) => `<td class="${i === amountCol || i === r.length - 1 ? 'n' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">No payments yet</td></tr>`}</tbody></table>
        <div class="tot">${totals.map(([k, v]) => `<div class="${k === 'Balance Due' && summary.balance > 0 ? 'due' : ''}">${esc(k)}:<b>${esc(v)}</b></div>`).join('')}</div>
        ${BRAND.signatures === false ? '' : '<div class="sign"><div>Student / Parent</div><div>Authorised Signatory</div></div>'}
        <div class="note">${BRAND.footer ? `${esc(BRAND.footer)}<br>` : ''}This is a computer-generated receipt covering all payments made to date.</div>
      </div></body></html>`;
  const fileName = `fee-receipt-${(adm || name).replace(/[^a-z0-9-]+/gi, '-')}.pdf`;
  showReceipt(html, { onPdf: () => receiptPdf({ head, body, info, totals, receiptNo, today, amountCol, logo: logoSrc, fileName }) });
}

/* ---------- receipt preview: the receipt itself on screen, with Print and Download PDF ---------- */
function showReceipt(html, { onPdf }) {
  document.querySelector('.rcpt-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'rcpt-overlay';
  ov.innerHTML = `<div class="rcpt-box" role="dialog" aria-modal="true" aria-label="Fee receipt">
    <div class="rcpt-bar"><b>Fee receipt</b><span class="rcpt-hint"></span>
      <button type="button" class="btn btn-primary btn-sm" data-act="print">Print receipt</button>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-act="pdf">Download PDF</button>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-act="close" aria-label="Close">Close</button></div>
    <iframe class="rcpt-frame" title="Fee receipt"></iframe></div>`;
  document.body.appendChild(ov);
  const frame = ov.querySelector('iframe');
  frame.srcdoc = html;
  const hint = ov.querySelector('.rcpt-hint');
  const close = () => ov.remove();
  ov.addEventListener('click', async (e) => {
    const act = e.target?.dataset?.act;
    if (e.target === ov || act === 'close') close();
    if (act === 'pdf') { hint.textContent = 'Preparing the PDF…'; await onPdf(); hint.textContent = 'PDF saved — open it and press Ctrl + P to print.'; }
    if (act === 'print') {
      if (!inArtifact()) { try { frame.contentWindow.focus(); frame.contentWindow.print(); return; } catch { /* fall through */ } }
      // claude.ai blocks the print window inside the page: open the receipt on its own tab and print there
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body>'));
        w.document.close();
        hint.textContent = 'Opened in a new tab — if the print window does not appear there, press Ctrl + P.';
      } else {
        hint.textContent = 'Printing is blocked here — use Download PDF, open it and press Ctrl + P.';
      }
    }
  });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

/* ---------- PDF in the same receipt layout (border, header, details grid, table, totals, signatures) ---------- */
async function receiptPdf({ head, body, info, totals, receiptNo, today, amountCol, logo, fileName }) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: head.length > 9 ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const M = 34; const X = M + 16; const R = W - M - 16;
  let tx = X;
  if (logo && /^data:image\/(png|jpe?g)/i.test(logo)) { try { doc.addImage(logo, logo.includes('png') ? 'PNG' : 'JPEG', X, M + 14, 46, 46); tx = X + 56; } catch { /* skip logo */ } }
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(BRAND.title || 'Student Portal', tx, M + 28);
  doc.setFont('helvetica', 'normal');
  if (contactLine()) { doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(doc.splitTextToSize(contactLine(), R - tx - 150)[0], tx, M + 41); }
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text('F E E   R E C E I P T', tx, M + 58);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  [['Receipt No', receiptNo, M + 28], ['Date', today, M + 42]].forEach(([k, v, yy]) => {
    doc.setTextColor(15, 23, 42); doc.text(v, R, yy, { align: 'right' });
    doc.setTextColor(71, 85, 105); doc.text(`${k}  `, R - doc.getTextWidth(v), yy, { align: 'right' });
  });
  doc.setLineWidth(1.1); doc.line(X, M + 70, R, M + 70);
  // details grid (4 per row)
  const cw = (R - X) / 4; let y = M + 88;
  info.forEach(([k, v], i) => {
    const cx = X + (i % 4) * cw; const cy = y + Math.floor(i / 4) * 32;
    doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(k.toUpperCase(), cx, cy);
    doc.setFontSize(9.5); doc.setTextColor(15, 23, 42); doc.text(String(v || '-'), cx, cy + 12, { maxWidth: cw - 12 });
    doc.setLineDashPattern([1, 1.5], 0); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.6); doc.line(cx, cy + 17, cx + cw - 12, cy + 17); doc.setLineDashPattern([], 0);
  });
  y += Math.ceil(info.length / 4) * 32 + 4;
  doc.setDrawColor(15, 23, 42);
  autoTable(doc, { head: [head], body: body.length ? body : [['No payments yet', ...head.slice(1).map(() => '')]], startY: y, margin: { left: X, right: W - R },
    theme: 'grid', styles: { fontSize: 8.5, lineColor: [148, 163, 184], lineWidth: 0.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { [amountCol]: { halign: 'right' }, [head.length - 1]: { halign: 'right' } } });
  y = doc.lastAutoTable.finalY + 18;
  doc.setFontSize(10);
  let tx2 = R;
  [...totals].reverse().forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold'); if (k === 'Balance Due') doc.setTextColor(185, 28, 28); doc.text(v, tx2, y, { align: 'right' }); const vw = doc.getTextWidth(v);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42); doc.text(`${k}:`, tx2 - vw - 4, y, { align: 'right' });
    tx2 -= vw + doc.getTextWidth(`${k}:`) + 22;
  });
  y += 58; doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.setLineWidth(0.6); doc.setDrawColor(100, 116, 139);
  if (BRAND.signatures !== false) {
    doc.line(X, y, X + 160, y); doc.text('Student / Parent', X + 80, y + 12, { align: 'center' });
    doc.line(R - 160, y, R, y); doc.text('Authorised Signatory', R - 80, y + 12, { align: 'center' });
  }
  y += 34; doc.setFontSize(8.5);
  const note = `${BRAND.footer ? `${BRAND.footer}\n` : ''}This is a computer-generated receipt covering all payments made to date.`;
  doc.text(doc.splitTextToSize(note, R - X), X, y);
  y += 12 * (note.split('\n').length + 1);
  doc.setDrawColor(15, 23, 42); doc.setLineWidth(1.1); doc.rect(M, M, W - 2 * M, Math.min(H - 2 * M, y - M + 6));
  await saveFile(fileName, doc.output('blob'));
}

/* kept for older imports */
export const printFeeStatement = printReceipt;
