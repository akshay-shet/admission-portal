/*
 * Student & Fee Tracker workbook (same layout as "Priority_Academy_Auto_Linked_Student_Tracker.xlsx"):
 *   Start Here · Summary (+ charts) · Total Student List (enter data here) · SSLC / PUC / Degree / PG lists ·
 *   one list per admission month · Payments (+ chart) · Pending Fees · Lists (hidden drop-down values)
 * Lists, totals and charts are live Excel formulas, so editing the master list in Excel updates everything.
 *
 * buildTracker(model, { ExcelJS, JSZip }) -> ArrayBuffer (.xlsx)
 * model = { institution: { title, tagline }, generatedAt: Date, activeSheet?,
 *   students: [{ name, level, group, medium, combination, totalFees, admissionDate, lastPayment, paid, discount, admissionNo, mobile, nextDue }],
 *   payments: [{ receipt, date, name, admissionNo, cls, installmentNo, mode, reference, amount, status }] }
 */

const C = {
  navy: 'FF0B1738', gold: 'FFF5B82E', total: 'FFFFF3CC', noteBg: 'FFF8F9FB', noteFg: 'FF667085', band: 'FFEAF2FA',
  white: 'FFFFFFFF', line: 'FFD9DEE7', red: 'FFB42318', green: 'FF067647', redBg: 'FFFEE4E2', greenBg: 'FFDCFAE6', amberBg: 'FFFEF0C7',
  entryBg: 'FFFFFFFF', autoBg: 'FFF2F4F7',
};
const MONEY = '#,##0';
const DATE = 'dd-mmm-yyyy';
const PCT = '0.0%';
const LEVELS = ['SSLC', 'PUC', 'Degree', 'PG'];
const MASTER = 'Total Student List';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const col = (n) => { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }; // 0 -> A
const q = (name) => `'${name.replace(/'/g, "''")}'`;
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: C.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const monthLabel = (d) => (d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '');
const monthKey = (d) => (d ? d.getUTCFullYear() * 100 + d.getUTCMonth() : 0);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeSheet = (s) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
const statusOf = (s) => (!s.totalFees ? 'No fee set' : s.balance <= 0 ? '✔ Fully paid' : !s.paid ? '✖ Not paid' : '◐ Part paid');

function titleBlock(ws, lastCol, title, note, { back = true } = {}) {
  ws.mergeCells(`A1:${lastCol}1`);
  ws.mergeCells(`A2:${lastCol}2`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: C.white } };
  t.fill = fill(C.navy);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  const n = ws.getCell('A2');
  n.value = note;
  n.font = { italic: true, size: 10, color: { argb: C.noteFg } };
  n.fill = fill(C.noteBg);
  n.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 38;
  if (back) {
    const L = ws.getCell(1, ws.getColumn(lastCol).number + 2);
    L.value = { text: '🏠 Start Here', hyperlink: `#${q('Start Here')}!A1` };
    L.font = { color: { argb: 'FF1D4ED8' }, underline: true, bold: true };
    L.alignment = { vertical: 'middle' };
  }
}

function headerRow(ws, r, headers, c0 = 1) {
  headers.forEach((h, i) => {
    const c = ws.getCell(r, c0 + i);
    c.value = h;
    c.font = { bold: true, color: { argb: C.white } };
    c.fill = fill(C.navy);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { ...box, bottom: { style: 'thin', color: { argb: C.navy } } };
  });
  ws.getRow(r).height = 30;
}

function sectionBar(ws, r, text, from, to) {
  ws.mergeCells(r, from, r, to);
  const c = ws.getCell(r, from);
  c.value = text;
  c.font = { bold: true, color: { argb: C.navy } };
  c.fill = fill(C.gold);
  c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 24;
}

function totalsCell(c, value, fmt) {
  c.value = value;
  c.font = { bold: true, color: { argb: C.navy } };
  c.fill = fill(C.total);
  if (fmt) c.numFmt = fmt;
  c.border = box;
}

function printSetup(ws, landscape = true) {
  ws.pageSetup = { orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  ws.headerFooter = { oddFooter: '&L&8&A&R&8Page &P of &N' };
}

function statusRules(ws, ref) {
  ws.addConditionalFormatting({ ref, rules: [
    { type: 'containsText', operator: 'containsText', text: 'Fully', priority: 1, style: { fill: fill(C.greenBg), font: { color: { argb: C.green }, bold: true } } },
    { type: 'containsText', operator: 'containsText', text: 'Not paid', priority: 2, style: { fill: fill(C.redBg), font: { color: { argb: C.red }, bold: true } } },
    { type: 'containsText', operator: 'containsText', text: 'Part', priority: 3, style: { fill: fill(C.amberBg), font: { color: { argb: 'FF93370D' } } } },
  ] });
}
function balanceRules(ws, ref, first) {
  ws.addConditionalFormatting({ ref, rules: [
    { type: 'expression', formulae: [`AND(ISNUMBER(${first}),${first}>0)`], priority: 4, style: { font: { color: { argb: C.red }, bold: true } } },
    { type: 'expression', formulae: [`AND(ISNUMBER(${first}),${first}<=0)`], priority: 5, style: { font: { color: { argb: C.green }, bold: true } } },
  ] });
}
function rateRules(ws, ref, first) {
  ws.addConditionalFormatting({ ref, rules: [
    { type: 'expression', formulae: [`AND(ISNUMBER(${first}),${first}<0.3)`], priority: 6, style: { fill: fill(C.redBg) } },
    { type: 'expression', formulae: [`AND(ISNUMBER(${first}),${first}>=0.3,${first}<0.7)`], priority: 7, style: { fill: fill(C.amberBg) } },
    { type: 'expression', formulae: [`AND(ISNUMBER(${first}),${first}>=0.7)`], priority: 8, style: { fill: fill(C.greenBg) } },
  ] });
}

/* ------------------------------------------------------------------ charts (added to the file after ExcelJS writes it) */
const PALETTE = ['1F4E79', 'F5B82E', 'C0504D', '2E8B57', '7F56D9', '0E9384'];
function strCache(vals) { return `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strCache>`; }
function numCache(vals, fmt) { return `<c:numCache><c:formatCode>${esc(fmt)}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join('')}</c:numCache>`; }
const txPr = (sz, bold = false, color = '344054') => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
const dLbls = ({ val = false, pct = false, fmt, pos }) => `<c:dLbls>${fmt ? `<c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/>` : ''}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, true)}${pos ? `<c:dLblPos val="${pos}"/>` : ''}<c:showLegendKey val="0"/><c:showVal val="${val ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${pct ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>`;

function chartXml(ch) {
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1300" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1300" b="1"><a:solidFill><a:srgbClr val="0B1738"/></a:solidFill></a:rPr><a:t>${esc(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
  const cat = `<c:cat><c:strRef><c:f>${esc(ch.cats.ref)}</c:f>${strCache(ch.cats.values)}</c:strRef></c:cat>`;
  let plot;
  if (ch.type === 'doughnut') {
    const s = ch.series[0];
    const pts = ch.cats.values.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[i % PALETTE.length]}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('');
    plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f>${strCache([s.name])}</c:strRef></c:tx>${pts}${dLbls({ val: true })}${cat}<c:val><c:numRef><c:f>${esc(s.ref)}</c:f>${numCache(s.values, s.fmt || 'General')}</c:numRef></c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  } else {
    const sers = ch.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f>${strCache([s.name])}</c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${s.color || PALETTE[i]}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${ch.labels ? dLbls({ val: true, fmt: s.fmt, pos: 'outEnd' }) : ''}${cat}<c:val><c:numRef><c:f>${esc(s.ref)}</c:f>${numCache(s.values, s.fmt || 'General')}</c:numRef></c:val></c:ser>`).join('');
    const max = ch.max != null ? `<c:max val="${ch.max}"/>` : '';
    plot = `<c:barChart><c:barDir val="${ch.horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="70"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>`
      + `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${ch.horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D0D5DD"/></a:solidFill></a:ln></c:spPr>${txPr(900)}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/>${max}<c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.horizontal ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="EAECF0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${esc(ch.axisFmt || MONEY)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900)}<c:crossAx val="5001"/><c:crosses val="${ch.horizontal ? 'autoZero' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/></c:spPr></c:plotArea>${ch.type === 'doughnut' || ch.series.length > 1 ? `<c:legend><c:legendPos val="${ch.type === 'doughnut' ? 'r' : 'b'}"/><c:overlay val="0"/>${txPr(900)}</c:legend>` : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D0D5DD"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:chartSpace>`;
}

async function addCharts(buf, charts, JSZip) {
  const zip = await JSZip.loadAsync(buf);
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const sheetFile = (name) => {
    const m = wbXml.match(new RegExp(`<sheet [^>]*name="${esc(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="([^"]+)"`)) || wbXml.match(new RegExp(`<sheet [^>]*r:id="([^"]+)"[^>]*name="${esc(name)}"`));
    const id = m[1];
    const t = wbRels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`)) || wbRels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`));
    return 'xl/' + t[1].replace(/^\/?xl\//, '');
  };
  let ct = await zip.file('[Content_Types].xml').async('string');
  const bySheet = {};
  charts.forEach((c) => { (bySheet[c.sheet] ||= []).push(c); });
  let chartNo = 0; let drawNo = 0;
  for (const [sheet, list] of Object.entries(bySheet)) {
    drawNo++;
    const path = sheetFile(sheet);
    const relPath = path.replace('worksheets/', 'worksheets/_rels/') + '.rels';
    const anchors = []; const dRels = [];
    list.forEach((c, i) => {
      chartNo++;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(c));
      ct = ct.replace('</Types>', `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      dRels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNo}.xml"/>`);
      const [c1, r1, c2, r2] = c.at;
      anchors.push(`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${esc(c.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);
    });
    zip.file(`xl/drawings/drawing${drawNo}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join('')}</xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/drawing${drawNo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dRels.join('')}</Relationships>`);
    ct = ct.replace('</Types>', `<Override PartName="/xl/drawings/drawing${drawNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    // sheet -> drawing relationship
    const relId = 'rIdTrackerDrawing';
    const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawNo}.xml"/>`;
    const existing = zip.file(relPath) ? await zip.file(relPath).async('string') : null;
    zip.file(relPath, existing ? existing.replace('</Relationships>', `${rel}</Relationships>`)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`);
    let sx = await zip.file(path).async('string');
    if (!/xmlns:r=/.test(sx.slice(0, 600))) sx = sx.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    const tag = `<drawing r:id="${relId}"/>`;
    const at = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>']
      .map((t) => sx.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    sx = sx.slice(0, at) + tag + sx.slice(at);
    zip.file(path, sx);
  }
  zip.file('[Content_Types].xml', ct);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

/* ------------------------------------------------------------------ workbook */
export async function buildTracker(model, { ExcelJS, JSZip }) {
  const inst = model.institution || {};
  const instName = inst.title || 'Student Admission Portal';
  const UP = instName.toUpperCase();
  const gen = model.generatedAt || new Date();
  const genText = gen.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // students: computed fields + sorted by admission date
  const students = (model.students || []).map((s) => {
    const totalFees = Number(s.totalFees) || 0; const paid = Number(s.paid) || 0; const discount = Number(s.discount) || 0;
    const balance = totalFees ? totalFees - paid - discount : '';
    return { ...s, totalFees, paid, discount, balance, month: monthLabel(s.admissionDate), mkey: monthKey(s.admissionDate) };
  }).sort((a, b) => (a.mkey - b.mkey) || ((a.admissionDate?.getTime() || 0) - (b.admissionDate?.getTime() || 0)) || String(a.name).localeCompare(String(b.name)));
  // every student has a unique key (admission no, else student id) that links payments and installments to them
  const seenKeys = new Set();
  students.forEach((s) => {
    let k = String(s.key || s.admissionNo || s.name || '').trim() || `STUDENT-${seenKeys.size + 1}`;
    if (seenKeys.has(k)) { let i = 2; while (seenKeys.has(`${k} (${i})`)) i++; k = `${k} (${i})`; }
    seenKeys.add(k); s.key = k;
  });
  const grace = Math.max(0, Number(model.graceDays) || 0);
  const isCounted = (p) => !['Pending', 'Rejected'].includes(p.status); // money really received (refunds are negative rows)
  const isInst = (p) => isCounted(p) && p.status !== 'Refund';
  const payments = [...(model.payments || [])].map((p) => ({ ...p, amount: Number(p.amount) || 0 }))
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  const payBy = new Map();
  payments.forEach((p) => { if (!payBy.has(p.key)) payBy.set(p.key, []); payBy.get(p.key).push(p); });
  // Excel serial of "today" (local date), the same day Excel's TODAY() will use
  const serial = (d) => Math.round(d.getTime() / 86400000) + 25569;
  const todaySerial = serial(new Date(Date.UTC(gen.getFullYear(), gen.getMonth(), gen.getDate())));
  students.forEach((s) => {
    const mine = payBy.get(s.key) || [];
    s.paid = Math.round(mine.filter(isCounted).reduce((a, p) => a + p.amount, 0) * 100) / 100; // paid = payments sheet (same as the formula)
    const got = mine.filter(isInst);
    s.lastPayment = (got.slice(-1)[0] || {}).amount || '';
    s.lastDate = (got.slice(-1)[0] || {}).date || null;
    s.instCount = got.length;
    s.slots = got.map((p) => ({ date: p.date || null, amount: p.amount }));
    s.balance = s.totalFees ? Math.round((s.totalFees - s.paid - s.discount) * 100) / 100 : '';
    // pay as you go: no fixed installments; a follow-up is due when the student's own next payment date has passed
    s.nextDue = s.nextDue || null;
    const nd = s.nextDue ? serial(s.nextDue) : null;
    s.overdue = typeof s.balance === 'number' && s.balance > 0 && nd !== null && nd < todaySerial - grace ? s.balance : 0;
    s.days = s.lastDate ? todaySerial - serial(s.lastDate) : '';
  });
  students.forEach((s) => { s.status = statusOf({ ...s, balance: s.balance === '' ? 0 : s.balance }); });
  // installment slots shown on every student row: enough for everyone's payments plus spare slots for new ones
  const SL = Math.min(12, Math.max(4, Math.max(0, ...students.map((x) => x.slots.length)) + 1));
  const SLOT0 = 20; // 1-based column of "Inst 1 Date" on the master (T)
  const slotCol = (k, part) => SLOT0 + 2 * (k - 1) + part; // part 0 = date, 1 = amount
  const MLASTCOL = SLOT0 + 2 * SL - 1;           // last visible master column
  const PLAST = 4 + Math.max(payments.length + 100, 200); // last row of the Payments sheet
  const TRK = 'Payment Tracker';
  const PR = (L) => `Payments!$${L}$5:$${L}$${PLAST}`;
  const TR = (L) => `${q(TRK)}!$${L}$5:$${L}$${LAST}`;
  const COUNTED = (L) => `${PR('J')},"<>Pending",${PR('J')},"<>Rejected"`;
  const months = [...new Map(students.filter((s) => s.month).map((s) => [s.mkey, s.month])).entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const groupsPresent = [...new Set(students.map((s) => s.group).filter(Boolean))];
  const groups = [...new Set(['SSLC', 'PUC Science', 'PUC Commerce', 'PUC Arts', ...groupsPresent])];
  const n = students.length;
  const CAP = Math.max(200, n + 100);
  const LAST = 4 + CAP; // last data row on the master and every list

  const wb = new ExcelJS.Workbook();
  wb.creator = instName;
  wb.created = gen;
  wb.calcProperties = { fullCalcOnLoad: true };
  const views = (x = 0, y = 4) => [{ state: 'frozen', xSplit: x, ySplit: y, showGridLines: false }];

  /* ---------- Start Here ---------- */
  const start = wb.addWorksheet('Start Here', { properties: { tabColor: { argb: C.gold } }, views: [{ showGridLines: false }] });
  /* the other sheets are added below; Start Here is filled at the end once every sheet name is known */

  /* ---------- Summary ---------- */
  const sum = wb.addWorksheet('Summary', { properties: { tabColor: { argb: C.navy } }, views: [{ showGridLines: false }] });

  /* ---------- Master ---------- */
  const ms = wb.addWorksheet(MASTER, { properties: { tabColor: { argb: 'FF16A34A' } }, views: views(2, 4) });
  const MCOLS = [
    ['Sl No', 7, null], ['Name', 26, null], ['Level', 11, null], ['Course Group', 18, null], ['Medium', 9, null], ['Combination / Course', 20, null],
    ['Total Fees (₹)', 15, MONEY], ['Admission Date', 15, DATE], ['Last Payment (₹) (Auto)', 16, MONEY], ['Total Paid (₹) (Auto)', 15, MONEY], ['Balance (₹)', 14, MONEY],
    ['Admission Month (Auto)', 20, null], ['Discount (₹)', 13, MONEY], ['Admission No', 20, null], ['Mobile', 14, null], ['Fee Status (Auto)', 16, null],
    ['Payments Made (Auto)', 13, '0'], ['Next Payment Date', 15, DATE], ['Follow-up Due (₹) (Auto)', 14, MONEY],
  ];
  const HELP0 = MLASTCOL + 1; // after a spacer column: hidden position helpers
  const helperKeys = [...LEVELS.map((l) => ({ kind: 'level', key: l })), ...months.map((m) => ({ kind: 'month', key: m }))];
  const helperCol = {};
  helperKeys.forEach((h, i) => { helperCol[h.key] = col(HELP0 + i); });
  MCOLS.forEach(([, w, f], i) => { const c = ms.getColumn(i + 1); c.width = w; if (f) c.numFmt = f; });
  ms.getColumn(MLASTCOL + 1).width = 3;
  for (let k = 1; k <= SL; k++) { ms.getColumn(slotCol(k, 0)).width = 13; ms.getColumn(slotCol(k, 1)).width = 13; }
  titleBlock(ms, col(MLASTCOL - 1), `${UP} — STUDENT MASTER (ENTER STUDENTS HERE)`,
    'ONE-TIME ENTRY: Type each student on a new row below (white columns). Grey columns fill in by themselves. Pay as you go: there are no fixed installments. Each payment recorded on the Payments sheet appears in the student\'s Payment 1, 2, 3… Date / Amount columns on the right, and Total Paid, Balance and the Payment Tracker update. Type a Next Payment Date for a student if they promised to pay on a certain day. Lists, Summary and charts update automatically.');
  headerRow(ms, 4, [...MCOLS.map((c) => c[0]), ...Array.from({ length: SL }, (_, i) => [`Payment ${i + 1} Date (Auto)`, `Payment ${i + 1} Amount (₹) (Auto)`]).flat()]);
  for (let k = 1; k <= SL; k++) [0, 1].forEach((pt) => { ms.getCell(4, slotCol(k, pt)).fill = fill(k % 2 ? 'FF1E3A5F' : C.navy); });
  helperKeys.forEach((h, i) => { const c = ms.getCell(4, HELP0 + i + 1); c.value = `${h.key} Position (helper)`; c.font = { italic: true, color: { argb: C.noteFg } }; ms.getColumn(HELP0 + i + 1).hidden = true; });
  // totals bar (row 3)
  totalsCell(ms.getCell('A3'), 'TOTAL');
  totalsCell(ms.getCell('B3'), { formula: `COUNTA(B5:B${LAST})`, result: n }, '0" students"');
  const sumOf = (k) => students.reduce((a, s) => a + (typeof s[k] === 'number' ? s[k] : 0), 0);
  [['G', 'totalFees'], ['J', 'paid'], ['K', 'balance'], ['M', 'discount'], ['S', 'overdue']].forEach(([L, k]) => totalsCell(ms.getCell(`${L}3`), { formula: `SUM(${L}5:${L}${LAST})`, result: sumOf(k) }, MONEY));
  totalsCell(ms.getCell('Q3'), { formula: `SUM(Q5:Q${LAST})`, result: sumOf('instCount') }, '0');
  for (let k = 1; k <= SL; k++) {
    const L = col(slotCol(k, 1) - 1);
    totalsCell(ms.getCell(3, slotCol(k, 0)), null);
    totalsCell(ms.getCell(3, slotCol(k, 1)), { formula: `SUM(${L}5:${L}${LAST})`, result: Math.round(students.reduce((a, x) => a + (x.slots[k - 1]?.amount || 0), 0) * 100) / 100 }, MONEY);
  }
  ['C', 'D', 'E', 'F', 'H', 'I', 'L', 'N', 'O', 'P', 'R'].forEach((L) => totalsCell(ms.getCell(`${L}3`), null));
  ms.getRow(3).height = 22;

  const posCount = {};
  for (let i = 0; i < CAP; i++) {
    const r = 5 + i;
    const s = students[i];
    const row = ms.getRow(r);
    const v = (L, val) => { row.getCell(L).value = val; };
    v('A', { formula: `IF(B${r}="","",ROW()-4)`, result: s ? i + 1 : '' });
    if (s) {
      v('B', s.name || ''); v('C', s.level || ''); v('D', s.group || ''); v('E', s.medium || ''); v('F', s.combination || '');
      v('G', s.totalFees || null); v('H', s.admissionDate || null);
      v('M', s.discount || null); v('N', s.key); v('O', s.mobile ? String(s.mobile) : '');
      v('R', s.nextDue || null);
    }
    // money comes from the Payments sheet
    v('I', { formula: `IF(N${r}="","",IFERROR(LOOKUP(2,1/((${PR('D')}=N${r})*(${PR('J')}<>"Pending")*(${PR('J')}<>"Rejected")*(${PR('J')}<>"Refund")),${PR('I')}),""))`, result: s ? s.lastPayment : '' });
    v('J', { formula: `IF(N${r}="","",SUMIFS(${PR('I')},${PR('D')},N${r},${COUNTED()}))`, result: s ? s.paid : '' });
    v('Q', { formula: `IF(N${r}="","",COUNTIFS(${PR('D')},N${r},${COUNTED()},${PR('J')},"<>Refund"))`, result: s ? s.instCount : '' });
    v('S', { formula: `IF(OR(N${r}="",K${r}=""),"",IF(AND(ISNUMBER(R${r}),R${r}<TODAY()-${grace},N(K${r})>0),K${r},0))`, result: s ? s.overdue : '' });
    // installment slots: the k-th payment received from this student (filled from the Payments sheet)
    for (let k = 1; k <= SL; k++) {
      const sl = s ? s.slots[k - 1] : null;
      const dc = row.getCell(slotCol(k, 0)); const ac = row.getCell(slotCol(k, 1));
      dc.value = { formula: `IF($N${r}="","",IFERROR(INDEX(${PR('B')},MATCH($N${r}&"#${k}",${PR('L')},0)),""))`, result: sl && sl.date ? sl.date : '' };
      ac.value = { formula: `IF($N${r}="","",IFERROR(INDEX(${PR('I')},MATCH($N${r}&"#${k}",${PR('L')},0)),""))`, result: sl ? sl.amount : '' };
      dc.numFmt = DATE; ac.numFmt = MONEY;
      dc.fill = fill(k % 2 ? 'FFEFF6FF' : C.autoBg); ac.fill = fill(k % 2 ? 'FFEFF6FF' : C.autoBg);
      dc.border = box; ac.border = box;
    }
    v('K', { formula: `IF(OR(B${r}="",G${r}=""),"",G${r}-N(J${r})-N(M${r}))`, result: s && s.totalFees ? s.balance : '' });
    v('L', { formula: `IF(B${r}="","",IF(H${r}="","",TEXT(H${r},"mmmm yyyy")))`, result: s ? s.month : '' });
    v('P', { formula: `IF(B${r}="","",IF(N(G${r})=0,"No fee set",IF(N(K${r})<=0,"✔ Fully paid",IF(N(J${r})=0,"✖ Not paid","◐ Part paid"))))`, result: s ? s.status : '' });
    helperKeys.forEach((h, j) => {
      const by = h.kind === 'level' ? 'C' : 'L';
      const hit = s && (h.kind === 'level' ? s.level === h.key : s.month === h.key);
      if (hit) posCount[h.key] = (posCount[h.key] || 0) + 1;
      row.getCell(HELP0 + j + 1).value = { formula: `IF(AND($B${r}<>"",$${by}${r}="${h.key}"),COUNTIFS($${by}$5:$${by}${r},"${h.key}",$B$5:$B${r},"<>"),"")`, result: hit ? posCount[h.key] : '' };
    });
    // look: auto columns grey, entry columns white, light grid
    for (let c = 1; c <= 19; c++) {
      const cell = row.getCell(c);
      cell.border = box;
      if ([1, 9, 10, 11, 12, 16, 17, 19].includes(c)) { cell.fill = fill(C.autoBg); if (c === 1 || c === 17) cell.alignment = { horizontal: 'center' }; }
    }
    row.getCell(18).numFmt = DATE; row.getCell(17).numFmt = '0';
  }
  ms.autoFilter = { from: 'A4', to: `${col(MLASTCOL - 1)}${LAST}` };
  ms.addConditionalFormatting({ ref: `S5:S${LAST}`, rules: [{ type: 'expression', formulae: ['AND(ISNUMBER(S5),S5>0)'], priority: 10, style: { fill: fill(C.redBg), font: { color: { argb: C.red }, bold: true } } }] });
  balanceRules(ms, `K5:K${LAST}`, 'K5');
  statusRules(ms, `P5:P${LAST}`);
  printSetup(ms);
  ms.pageSetup.printTitlesRow = '4:4';

  /* ---------- Lists (hidden: drop-down values) ---------- */
  const lists = wb.addWorksheet('Lists', { state: 'hidden' });
  lists.getCell('A1').value = 'Level'; lists.getCell('B1').value = 'Course Group'; lists.getCell('C1').value = 'Medium';
  LEVELS.forEach((x, i) => { lists.getCell(2 + i, 1).value = x; });
  groups.forEach((x, i) => { lists.getCell(2 + i, 2).value = x; });
  ['KN', 'EN'].forEach((x, i) => { lists.getCell(2 + i, 3).value = x; });
  const dv = (ref, rule) => { for (let r = 5; r <= LAST; r++) ms.getCell(`${ref}${r}`).dataValidation = rule; };
  dv('B', { type: 'textLength', operator: 'greaterThan', formulae: [0], allowBlank: true, showInputMessage: true, promptTitle: 'Student name', prompt: "Type the student's full name. Leave the row empty to skip it." });
  dv('C', { type: 'list', allowBlank: true, formulae: [`Lists!$A$2:$A$${1 + LEVELS.length}`], showErrorMessage: true, errorTitle: 'Pick from the list', error: 'Choose SSLC, PUC, Degree or PG from the drop-down arrow.', showInputMessage: true, prompt: 'Click the small arrow and pick the level.' });
  dv('D', { type: 'list', allowBlank: true, formulae: [`Lists!$B$2:$B$${1 + groups.length}`], showErrorMessage: false, showInputMessage: true, prompt: 'Pick the course group (e.g. PUC Commerce).' });
  dv('E', { type: 'list', allowBlank: true, formulae: ['Lists!$C$2:$C$3'], showErrorMessage: true, error: 'Choose KN (Kannada) or EN (English).', showInputMessage: true, prompt: 'KN = Kannada, EN = English' });
  ['G', 'M'].forEach((L) => dv(L, { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Numbers only', error: 'Type the amount as a plain number, for example 25000 (no commas or ₹ sign).' }));
  dv('R', { type: 'date', operator: 'greaterThan', formulae: [new Date(Date.UTC(2000, 0, 1))], allowBlank: true, showErrorMessage: true, errorTitle: 'Date needed', error: 'Type a date such as 15-09-2026.', showInputMessage: true, prompt: 'Optional: the day this student said they will pay next. Leave empty if not agreed.' });
  dv('H', { type: 'date', operator: 'greaterThan', formulae: [new Date(Date.UTC(2000, 0, 1))], allowBlank: true, showErrorMessage: true, errorTitle: 'Date needed', error: 'Type a date such as 15-09-2026.', showInputMessage: true, prompt: 'Type the admission date, e.g. 15-09-2026' });

  /* ---------- auto-linked lists (levels + months) ---------- */
  const VIEW = [['Sl No', 7], ['Name', 26], ['Level', 11], ['Course Group', 18], ['Medium', 9], ['Combination / Course', 20], ['Total Fees (₹)', 15], ['Admission Date', 15], ['Last Payment (₹)', 16], ['Total Paid (₹)', 15], ['Balance (₹)', 14], ['Admission Month', 18], ['Fee Status', 15], ['Follow-up Due (₹)', 15], ['Next Payment Date', 15]];
  const SRC = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'P', 'S', 'R']; // master column for each list column
  const FIELD = [null, 'name', 'level', 'group', 'medium', 'combination', 'totalFees', 'admissionDate', 'lastPayment', 'paid', 'balance', 'month', 'status', 'overdue', 'nextDue'];
  for (let k = 1; k <= SL; k++) {
    VIEW.push([`Payment ${k} Date`, 13], [`Payment ${k} Amount (₹)`, 13]);
    SRC.push(col(slotCol(k, 0) - 1), col(slotCol(k, 1) - 1));
    FIELD.push(`slot${k}d`, `slot${k}a`);
  }
  students.forEach((x) => { for (let k = 1; k <= SL; k++) { x[`slot${k}d`] = x.slots[k - 1]?.date || ''; x[`slot${k}a`] = x.slots[k - 1]?.amount ?? ''; } });
  const VLAST = col(VIEW.length - 1);
  const isDateCol = (j) => j === 7 || j === 14 || (j >= 15 && (j - 15) % 2 === 0);
  const isMoneyCol = (j) => [6, 8, 9, 10, 13].includes(j) || (j >= 15 && (j - 15) % 2 === 1);
  const listSheets = [];
  const makeList = (sheetName, heading, key, tab) => {
    const ws = wb.addWorksheet(sheetName, { properties: { tabColor: { argb: tab } }, views: views(2, 4) });
    listSheets.push(sheetName);
    VIEW.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
    titleBlock(ws, VLAST, `${UP} — ${heading}`, `AUTO-LINKED VIEW — Do not type here. Enter or edit students in '${MASTER}' only; this list fills in by itself.`);
    headerRow(ws, 4, VIEW.map((c) => c[0]));
    const rows = students.filter((s) => (LEVELS.includes(key) ? s.level === key : s.month === key));
    const pos = `${q(MASTER)}!$${helperCol[key]}$5:$${helperCol[key]}$${LAST}`;
    totalsCell(ws.getCell('A3'), 'TOTAL');
    totalsCell(ws.getCell('B3'), { formula: `COUNTIF(B5:B${LAST},"?*")`, result: rows.length }, '0" students"');
    [['G', 'totalFees'], ['J', 'paid'], ['K', 'balance']].forEach(([L, k]) => totalsCell(ws.getCell(`${L}3`), { formula: `SUM(${L}5:${L}${LAST})`, result: rows.reduce((a, s) => a + (typeof s[k] === 'number' ? s[k] : 0), 0) }, MONEY));
    totalsCell(ws.getCell('N3'), { formula: `SUM(N5:N${LAST})`, result: rows.reduce((a, x) => a + (x.overdue || 0), 0) }, MONEY);
    ['C', 'D', 'E', 'F', 'H', 'I', 'L', 'M', 'O'].forEach((L) => totalsCell(ws.getCell(`${L}3`), null));
    for (let j = 15; j < VIEW.length; j++) {
      const L = col(j);
      if (isMoneyCol(j)) totalsCell(ws.getCell(`${L}3`), { formula: `SUM(${L}5:${L}${LAST})`, result: Math.round(rows.reduce((a, x) => a + (Number(x[FIELD[j]]) || 0), 0) * 100) / 100 }, MONEY);
      else totalsCell(ws.getCell(`${L}3`), null);
    }
    for (let j = 15; j < VIEW.length; j++) ws.getCell(4, j + 1).fill = fill(Math.floor((j - 15) / 2) % 2 ? C.navy : 'FF1E3A5F');
    ws.getRow(3).height = 22;
    for (let i = 0; i < CAP; i++) {
      const r = 5 + i; const s = rows[i]; const row = ws.getRow(r);
      VIEW.forEach((_, j) => {
        const cell = row.getCell(j + 1);
        const look = `INDEX(${q(MASTER)}!${SRC[j]}$5:${SRC[j]}$${LAST},MATCH(ROW()-4,${pos},0))`;
        // text columns: &"" so an empty master cell shows empty (not 0); number/date columns: blank stays blank
        const NUMERIC = [6, 7, 8, 9, 10, 13, 14].includes(j) || j >= 15;
        let formula;
        if (j === 0) formula = `IF(B${r}="","",ROW()-4)`;
        else if (j === 1) formula = `IFERROR(${look}&"","")`;
        else if (NUMERIC) formula = `IF($B${r}="","",IFERROR(IF(${look}="","",${look}),""))`;
        else formula = `IF($B${r}="","",IFERROR(${look}&"",""))`;
        let result = '';
        if (s) result = j === 0 ? i + 1 : (s[FIELD[j]] ?? '');
        if (s && (j === 6 || j === 8)) result = result || ''; // empty master cell -> blank
        if (result === null || result === undefined) result = '';
        if (s && !NUMERIC && j > 0) result = String(result ?? '');
        cell.value = { formula, result };
        if (isMoneyCol(j)) cell.numFmt = MONEY;
        if (isDateCol(j)) cell.numFmt = DATE;
        if (j === 0) cell.alignment = { horizontal: 'center' };
        cell.border = box;
        if (i % 2 === 1) cell.fill = fill('FFF9FAFB');
      });
    }
    ws.autoFilter = { from: 'A4', to: `${VLAST}${LAST}` };
    balanceRules(ws, `K5:K${LAST}`, 'K5');
    statusRules(ws, `M5:M${LAST}`);
    printSetup(ws);
    ws.pageSetup.printTitlesRow = '4:4';
    return ws;
  };
  LEVELS.forEach((l) => makeList(`${l} List`, `${l.toUpperCase()} STUDENTS`, l, 'FF2563EB'));
  months.forEach((m) => makeList(safeSheet(`${m} List`), `${m.toUpperCase()} ADMISSIONS`, m, 'FF7C3AED'));

  /* ---------- Payments ---------- */
  const pay = wb.addWorksheet('Payments', { properties: { tabColor: { argb: 'FF0E9384' } }, views: views(0, 4) });
  const PCOLS = [['Receipt No', 15], ['Payment Date', 14], ['Student Name (Auto)', 26], ['Admission No', 20], ['Class (Auto)', 10], ['Payment No (Auto)', 12], ['Payment Mode', 14], ['Reference / UTR', 18], ['Amount (₹)', 14], ['Status', 11], ['Payment Month (Auto)', 20]];
  PCOLS.forEach(([, w], i) => { pay.getColumn(i + 1).width = w; });
  pay.getColumn(12).hidden = true; pay.getColumn(13).width = 20; pay.getColumn(14).width = 16; pay.getColumn(15).width = 12;
  titleBlock(pay, 'K', `${UP} — PAYMENTS (EVERY PAYMENT RECEIVED)`, 'To record a payment: pick the Admission No on a new row, then type the date, mode, amount and status. Name, class and payment number fill in by themselves, and the student\'s paid amount, balance and Payment Tracker update. "Pending" and "Rejected" payments are not counted; a refund is a negative amount with status "Refund".');
  headerRow(pay, 4, PCOLS.map((c) => c[0]));
  const received = payments.filter(isCounted);
  const sumAmt = (xs) => Math.round(xs.reduce((a, p) => a + p.amount, 0) * 100) / 100;
  totalsCell(pay.getCell('A3'), 'TOTAL');
  totalsCell(pay.getCell('B3'), { formula: `COUNTA(D5:D${PLAST})`, result: payments.length }, '0" payments"');
  totalsCell(pay.getCell('I3'), { formula: `SUMIFS(I5:I${PLAST},J5:J${PLAST},"<>Pending",J5:J${PLAST},"<>Rejected")`, result: sumAmt(received) }, MONEY);
  ['C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'].forEach((L) => totalsCell(pay.getCell(`${L}3`), null));
  pay.getRow(3).height = 22;
  const instNo = new Map();
  const studentByKey = new Map(students.map((x) => [x.key, x]));
  for (let i = 0; i < PLAST - 4; i++) {
    const r = 5 + i; const p = payments[i]; const row = pay.getRow(r);
    let no = '';
    if (p) {
      row.getCell(1).value = isCounted(p) && p.status !== 'Refund' ? (p.receipt || '') : (p.status === 'Pending' ? 'Awaiting verification' : '');
      row.getCell(2).value = p.date || null; row.getCell(4).value = p.key || '';
      row.getCell(7).value = p.mode || ''; row.getCell(8).value = p.reference || '';
      row.getCell(9).value = p.amount; row.getCell(10).value = p.status || 'Paid';
      if (isInst(p)) { no = (instNo.get(p.key) || 0) + 1; instNo.set(p.key, no); } else no = p.status === 'Refund' ? 'Refund' : '—';
    }
    const st = p ? studentByKey.get(p.key) : null;
    const nameFallback = p ? String(p.name || '').replace(/"/g, "'") : '';
    row.getCell(3).value = { formula: `IF(D${r}="","",IFERROR(INDEX(${q(MASTER)}!$B$5:$B$${LAST},MATCH(D${r},${q(MASTER)}!$N$5:$N$${LAST},0)),"${nameFallback}"))`, result: p ? (st ? st.name : nameFallback) : '' };
    row.getCell(5).value = { formula: `IF(D${r}="","",IFERROR(INDEX(${q(MASTER)}!$C$5:$C$${LAST},MATCH(D${r},${q(MASTER)}!$N$5:$N$${LAST},0)),"${p ? String(p.cls || '').replace(/"/g, "'") : ''}"))`, result: p ? (st ? st.level : (p.cls || '')) : '' };
    row.getCell(6).value = { formula: `IF(D${r}="","",IF(OR(J${r}="Pending",J${r}="Rejected"),"—",IF(J${r}="Refund","Refund",COUNTIFS($D$5:D${r},D${r},$J$5:J${r},"<>Pending",$J$5:J${r},"<>Rejected",$J$5:J${r},"<>Refund"))))`, result: p ? no : '' };
    row.getCell(11).value = { formula: `IF(B${r}="","",TEXT(B${r},"mmmm yyyy"))`, result: p ? monthLabel(p.date) : '' };
    row.getCell(12).value = { formula: `IF(OR(D${r}="",NOT(ISNUMBER(F${r}))),"",D${r}&"#"&F${r})`, result: p && typeof no === 'number' ? `${p.key}#${no}` : '' }; // hidden: links installment slots
    row.getCell(2).numFmt = DATE; row.getCell(9).numFmt = MONEY; row.getCell(6).alignment = { horizontal: 'center' };
    for (let c = 1; c <= 11; c++) row.getCell(c).border = box;
    [3, 5, 6, 11].forEach((c) => { row.getCell(c).fill = fill(C.autoBg); });
    row.getCell(4).dataValidation = { type: 'list', allowBlank: true, formulae: [`${q(MASTER)}!$N$5:$N$${LAST}`], showErrorMessage: true, errorTitle: 'Unknown student', error: `Pick an Admission No that exists on '${MASTER}'.`, showInputMessage: true, prompt: 'Pick the student\'s Admission No from the list.' };
    row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Cash,UPI,Card,Bank transfer,Cheque,Refund"'], showErrorMessage: false };
    row.getCell(10).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Paid,Pending,Rejected,Refund"'], showErrorMessage: true, error: 'Choose Paid, Pending, Rejected or Refund.' };
    row.getCell(9).dataValidation = { type: 'decimal', operator: 'between', formulae: [-10000000, 10000000], allowBlank: true, showErrorMessage: true, error: 'Type the amount as a plain number (use a minus sign for a refund).' };
  }
  pay.autoFilter = { from: 'A4', to: `K${PLAST}` };
  pay.addConditionalFormatting({ ref: `J5:J${PLAST}`, rules: [
    { type: 'containsText', operator: 'containsText', text: 'Pending', priority: 1, style: { fill: fill(C.amberBg), font: { color: { argb: 'FF93370D' }, bold: true } } },
    { type: 'containsText', operator: 'containsText', text: 'Rejected', priority: 2, style: { fill: fill(C.redBg), font: { color: { argb: C.red } } } },
    { type: 'containsText', operator: 'containsText', text: 'Refund', priority: 3, style: { font: { color: { argb: C.red }, italic: true } } },
  ] });
  // collections by month (right side)
  const payMonths = [...new Map(received.filter((p) => p.date).map((p) => [monthKey(p.date), monthLabel(p.date)])).entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  headerRow(pay, 4, ['Collected in month', 'Amount (₹)', 'Payments'], 13);
  payMonths.forEach((m, i) => {
    const r = 5 + i; const xs = received.filter((p) => monthLabel(p.date) === m);
    pay.getCell(r, 13).value = m;
    pay.getCell(r, 14).value = { formula: `SUMIFS($I$5:$I$${PLAST},$K$5:$K$${PLAST},M${r},$J$5:$J$${PLAST},"<>Pending",$J$5:$J$${PLAST},"<>Rejected")`, result: sumAmt(xs) };
    pay.getCell(r, 15).value = { formula: `COUNTIFS($K$5:$K$${PLAST},M${r},$J$5:$J$${PLAST},"<>Pending",$J$5:$J$${PLAST},"<>Rejected")`, result: xs.length };
    pay.getCell(r, 14).numFmt = MONEY;
    [13, 14, 15].forEach((c) => { pay.getCell(r, c).border = box; });
  });
  const pmEnd = 4 + Math.max(1, payMonths.length);
  const pmTot = pmEnd + 1;
  totalsCell(pay.getCell(pmTot, 13), 'Total');
  totalsCell(pay.getCell(pmTot, 14), { formula: `SUM(N5:N${pmEnd})`, result: sumAmt(received) }, MONEY);
  totalsCell(pay.getCell(pmTot, 15), { formula: `SUM(O5:O${pmEnd})`, result: received.length });
  // by payment mode
  const modes = [...new Set(received.map((p) => p.mode || 'Other'))];
  const modeHead = pmTot + 2;
  headerRow(pay, modeHead, ['Payment mode', 'Amount (₹)', 'Payments'], 13);
  modes.forEach((m, i) => {
    const r = modeHead + 1 + i; const xs = received.filter((p) => (p.mode || 'Other') === m);
    pay.getCell(r, 13).value = m;
    pay.getCell(r, 14).value = { formula: `SUMIFS($I$5:$I$${PLAST},$G$5:$G$${PLAST},M${r},$J$5:$J$${PLAST},"<>Pending",$J$5:$J$${PLAST},"<>Rejected")`, result: sumAmt(xs) };
    pay.getCell(r, 15).value = { formula: `COUNTIFS($G$5:$G$${PLAST},M${r},$J$5:$J$${PLAST},"<>Pending",$J$5:$J$${PLAST},"<>Rejected")`, result: xs.length };
    pay.getCell(r, 14).numFmt = MONEY;
    [13, 14, 15].forEach((c) => { pay.getCell(r, c).border = box; });
  });
  printSetup(pay);
  pay.pageSetup.printTitlesRow = '4:4';

  /* ---------- Payment Tracker (pay as you go: one row per student, worked out from the payments) ---------- */
  const trk = wb.addWorksheet(TRK, { properties: { tabColor: { argb: 'FFB45309' } }, views: views(3, 4) });
  const TCOLS = [['Sl No', 7], ['Admission No', 20], ['Student Name', 26], ['Level', 10], ['Total Fee after Discount (₹)', 16], ['Paid (₹)', 14], ['Balance (₹)', 14],
    ['Paid %', 9], ['Payments Made', 10], ['Average Payment (₹)', 14], ['Last Payment Date', 14], ['Days Since Last Payment', 12], ['Next Payment Date', 14], ['Status', 17]];
  TCOLS.forEach(([, w], i) => { trk.getColumn(i + 1).width = w; });
  titleBlock(trk, 'N', `${UP} — PAYMENT TRACKER (PAY AS YOU GO)`,
    `No fixed installments: every student pays whenever they can. This sheet follows each student from the '${MASTER}' and Payments sheets: how much is paid, what is left, how often they pay and when they last paid. "Follow-up due" means the student's own Next Payment Date has passed${grace ? ` by more than ${grace} day(s)` : ''} and money is still owed. Do not type here.`);
  headerRow(trk, 4, TCOLS.map((c) => c[0]));
  const M_ = (L, r) => `${q(MASTER)}!${L}${r}`;
  const tStatus = (s) => (!s.totalFees ? 'No fee set' : s.balance <= 0 ? '✔ Fully paid' : s.overdue > 0 ? '✖ Follow-up due' : s.paid > 0 ? '◐ Part paid' : 'Not paid yet');
  totalsCell(trk.getCell('A3'), 'TOTAL');
  totalsCell(trk.getCell('B3'), { formula: `COUNTIF(B5:B${LAST},"?*")`, result: n }, '0" students"');
  const tNet = (s) => (s.totalFees ? Math.max(0, s.totalFees - s.discount) : 0);
  [['E', students.reduce((a, s) => a + tNet(s), 0)], ['F', sumOf('paid')], ['G', sumOf('balance')]].forEach(([L, val]) => totalsCell(trk.getCell(`${L}3`), { formula: `SUM(${L}5:${L}${LAST})`, result: Math.round(val * 100) / 100 }, MONEY));
  totalsCell(trk.getCell('I3'), { formula: `SUM(I5:I${LAST})`, result: sumOf('instCount') }, '0');
  totalsCell(trk.getCell('H3'), { formula: `IF(E3=0,0,F3/E3)`, result: (() => { const t = students.reduce((a, s) => a + tNet(s), 0); return t ? sumOf('paid') / t : 0; })() }, PCT);
  totalsCell(trk.getCell('N3'), { formula: `COUNTIF(N5:N${LAST},"✖ Follow-up due")`, result: students.filter((s) => tStatus(s) === '✖ Follow-up due').length }, '0" follow-ups"');
  ['C', 'D', 'J', 'K', 'L', 'M'].forEach((L) => totalsCell(trk.getCell(`${L}3`), null));
  trk.getRow(3).height = 22;
  for (let i = 0; i < CAP; i++) {
    const r = 5 + i; const mr = 5 + i; const s = students[i]; const row = trk.getRow(r);
    const set = (c, formula, result, fmt) => { const cell = row.getCell(c); cell.value = { formula, result }; if (fmt) cell.numFmt = fmt; };
    set(1, `IF(B${r}="","",ROW()-4)`, s ? i + 1 : '');
    set(2, `IF(${M_('N', mr)}="","",${M_('N', mr)})`, s ? s.key : '');
    set(3, `IF(B${r}="","",${M_('B', mr)}&"")`, s ? String(s.name ?? '') : '');
    set(4, `IF(B${r}="","",${M_('C', mr)}&"")`, s ? String(s.level ?? '') : '');
    set(5, `IF(OR(B${r}="",${M_('G', mr)}=""),"",MAX(0,${M_('G', mr)}-N(${M_('M', mr)})))`, s && s.totalFees ? tNet(s) : '', MONEY);
    set(6, `IF(B${r}="","",N(${M_('J', mr)}))`, s ? s.paid : '', MONEY);
    set(7, `IF(B${r}="","",IF(${M_('K', mr)}="","",${M_('K', mr)}))`, s && s.totalFees ? s.balance : '', MONEY);
    set(8, `IF(OR(B${r}="",N(E${r})=0),"",F${r}/E${r})`, s && tNet(s) ? s.paid / tNet(s) : '', PCT);
    set(9, `IF(B${r}="","",N(${M_('Q', mr)}))`, s ? s.instCount : '', '0');
    set(10, `IF(OR(B${r}="",N(I${r})=0),"",F${r}/I${r})`, s && s.instCount ? Math.round((s.paid / s.instCount) * 100) / 100 : '', MONEY);
    set(11, `IF(B${r}="","",IFERROR(LOOKUP(2,1/((${PR('D')}=B${r})*(${PR('J')}<>"Pending")*(${PR('J')}<>"Rejected")*(${PR('J')}<>"Refund")),${PR('B')}),""))`, s && s.lastDate ? s.lastDate : '', DATE);
    set(12, `IF(ISNUMBER(K${r}),TODAY()-K${r},"")`, s && s.lastDate ? s.days : '', '0');
    set(13, `IF(B${r}="","",IF(ISNUMBER(${M_('R', mr)}),${M_('R', mr)},""))`, s && s.nextDue ? s.nextDue : '', DATE);
    set(14, `IF(B${r}="","",IF(N(E${r})=0,"No fee set",IF(N(G${r})<=0,"✔ Fully paid",IF(AND(ISNUMBER(M${r}),M${r}<TODAY()-${grace}),"✖ Follow-up due",IF(N(F${r})>0,"◐ Part paid","Not paid yet")))))`, s ? tStatus(s) : '');
    row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(9).alignment = { horizontal: 'center' }; row.getCell(12).alignment = { horizontal: 'center' };
    for (let c = 1; c <= 14; c++) { row.getCell(c).border = box; row.getCell(c).fill = fill(C.autoBg); }
  }
  trk.autoFilter = { from: 'A4', to: `N${LAST}` };
  trk.addConditionalFormatting({ ref: `N5:N${LAST}`, rules: [
    { type: 'containsText', operator: 'containsText', text: 'Fully', priority: 1, style: { fill: fill(C.greenBg), font: { color: { argb: C.green }, bold: true } } },
    { type: 'containsText', operator: 'containsText', text: 'Follow-up', priority: 2, style: { fill: fill(C.redBg), font: { color: { argb: C.red }, bold: true } } },
    { type: 'containsText', operator: 'containsText', text: 'Part', priority: 3, style: { fill: fill(C.amberBg), font: { color: { argb: 'FF93370D' } } } },
  ] });
  trk.addConditionalFormatting({ ref: `L5:L${LAST}`, rules: [{ type: 'expression', formulae: ['AND(ISNUMBER(L5),L5>30,N(G5)>0)'], priority: 10, style: { font: { color: { argb: C.red }, bold: true } } }] });
  rateRules(trk, `H5:H${LAST}`, 'H5');
  printSetup(trk);
  trk.pageSetup.printTitlesRow = '4:4';

  /* ---------- Pending Fees ---------- */
  const pend = wb.addWorksheet('Pending Fees', { properties: { tabColor: { argb: 'FFDC2626' } }, views: views(2, 4) });
  const DCOLS = [['Sl No', 7], ['Student Name', 26], ['Admission No', 20], ['Level', 10], ['Course Group', 18], ['Mobile', 14], ['Total Fees (₹)', 15], ['Paid (₹)', 14], ['Discount (₹)', 13], ['Balance Due (₹)', 15], ['Follow-up Due (₹)', 14], ['Next Payment Date', 14], ['Fee Status', 15]];
  DCOLS.forEach(([, w], i) => { pend.getColumn(i + 1).width = w; });
  titleBlock(pend, 'M', `${UP} — PENDING FEES (WHO STILL HAS TO PAY)`, `Students who still owe fees: follow-ups due first, then the biggest balance. Pay as you go — Follow-up Due (₹) is the balance of students whose own Next Payment Date has passed. This is a snapshot taken on ${genText}; download the tracker again for the latest figures.`);
  headerRow(pend, 4, DCOLS.map((c) => c[0]));
  const due = students.filter((s) => typeof s.balance === 'number' && s.balance > 0).sort((a, b) => (b.overdue - a.overdue) || (b.balance - a.balance));
  const dEnd = 4 + Math.max(1, due.length);
  totalsCell(pend.getCell('A3'), 'TOTAL');
  totalsCell(pend.getCell('B3'), due.length, '0" students"');
  [['G', 'totalFees'], ['H', 'paid'], ['I', 'discount'], ['J', 'balance'], ['K', 'overdue']].forEach(([L, k]) => totalsCell(pend.getCell(`${L}3`), { formula: `SUM(${L}5:${L}${dEnd})`, result: due.reduce((a, s) => a + (s[k] || 0), 0) }, MONEY));
  ['C', 'D', 'E', 'F', 'L', 'M'].forEach((L) => totalsCell(pend.getCell(`${L}3`), null));
  pend.getRow(3).height = 22;
  due.forEach((s, i) => {
    const r = 5 + i; const row = pend.getRow(r);
    [i + 1, s.name, s.key, s.level, s.group, s.mobile ? String(s.mobile) : '', s.totalFees, s.paid, s.discount || 0, s.balance, s.overdue || 0, s.nextDue || null, s.status].forEach((val, j) => { row.getCell(j + 1).value = val; row.getCell(j + 1).border = box; });
    [7, 8, 9, 10, 11].forEach((c) => { row.getCell(c).numFmt = MONEY; });
    row.getCell(12).numFmt = DATE; row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(10).font = { bold: true, color: { argb: C.red } };
    if (s.overdue > 0) { row.getCell(11).font = { bold: true, color: { argb: C.red } }; row.getCell(11).fill = fill(C.redBg); }
  });
  if (!due.length) { pend.mergeCells('A5:M5'); pend.getCell('A5').value = '🎉 Nobody has a pending balance.'; pend.getCell('A5').alignment = { horizontal: 'center' }; }
  else pend.autoFilter = { from: 'A4', to: `M${dEnd}` };
  if (due.length) statusRules(pend, `M5:M${dEnd}`);
  pend.addConditionalFormatting({ ref: `L5:L${dEnd}`, rules: [{ type: 'expression', formulae: [`AND(ISNUMBER(L5),L5<TODAY())`], priority: 9, style: { fill: fill(C.redBg), font: { color: { argb: C.red }, bold: true } } }] });
  printSetup(pend);
  pend.pageSetup.printTitlesRow = '4:4';

  /* ---------- Summary (built now that every list exists) ---------- */
  [24, 12, 17, 16, 15, 15, 3, 18, 16, 15, 15, 15].forEach((w, i) => { sum.getColumn(i + 1).width = w; });
  titleBlock(sum, 'L', `${UP} — STUDENT & FEE SUMMARY`, `LIVE SUMMARY: Add or edit a student in '${MASTER}' only. SSLC, PUC, Degree, PG, month lists, fees and charts update from the master.`);
  sum.mergeCells('A3:L3');
  sum.getCell('A3').value = `Report from ${instName}${inst.tagline ? ` · ${inst.tagline}` : ''} · generated ${genText}`;
  sum.getCell('A3').font = { size: 9, color: { argb: C.noteFg } };
  sum.getCell('A3').alignment = { horizontal: 'right' };
  const M = (L) => `${q(MASTER)}!$${L}$5:$${L}$${LAST}`;
  headerRow(sum, 4, ['List / Group', 'Students', 'Total Fees (₹)', 'Total Paid (₹)', 'Balance (₹)', 'Collection Rate']);
  const agg = (pred) => { const xs = students.filter(pred); const f = xs.reduce((a, s) => a + s.totalFees, 0); const p = xs.reduce((a, s) => a + s.paid, 0); const b = xs.reduce((a, s) => a + (typeof s.balance === 'number' ? s.balance : 0), 0); return { n: xs.length, f, p, b, r: f ? p / f : 0 }; };
  const sumRows = [
    { label: 'Combined student list', crit: null, a: agg(() => true), style: 'total' },
    ...LEVELS.map((l) => ({ label: l, crit: ['C', l], a: agg((s) => s.level === l) })),
    ...months.map((m) => ({ label: `${m} tracker`, crit: ['L', m], a: agg((s) => s.month === m), style: 'band' })),
  ];
  const levelRow = {};
  sumRows.forEach((x, i) => {
    const r = 5 + i;
    if (LEVELS.includes(x.label)) levelRow[x.label] = r;
    const cells = x.crit ? [
      { formula: `COUNTIFS(${M(x.crit[0])},"${x.crit[1]}",${M('B')},"<>")`, result: x.a.n },
      { formula: `SUMIFS(${M('G')},${M(x.crit[0])},"${x.crit[1]}")`, result: x.a.f },
      { formula: `SUMIFS(${M('J')},${M(x.crit[0])},"${x.crit[1]}")`, result: x.a.p },
      { formula: `SUMIFS(${M('K')},${M(x.crit[0])},"${x.crit[1]}")`, result: x.a.b },
    ] : [
      { formula: `COUNTA(${q(MASTER)}!B5:B${LAST})`, result: x.a.n },
      { formula: `SUM(${M('G')})`, result: x.a.f }, { formula: `SUM(${M('J')})`, result: x.a.p }, { formula: `SUM(${M('K')})`, result: x.a.b },
    ];
    sum.getCell(r, 1).value = x.label;
    cells.forEach((v, j) => { sum.getCell(r, 2 + j).value = v; sum.getCell(r, 2 + j).numFmt = MONEY; });
    sum.getCell(r, 6).value = { formula: `IF(C${r}=0,0,D${r}/C${r})`, result: x.a.r };
    sum.getCell(r, 6).numFmt = PCT;
    for (let c = 1; c <= 6; c++) {
      const cell = sum.getCell(r, c); cell.border = box;
      if (x.style === 'total') { cell.fill = fill(C.total); cell.font = { bold: true, color: { argb: C.navy } }; }
      else if (x.style === 'band') cell.fill = fill(C.band);
    }
    // click a row label to open that list
    const target = x.crit ? (x.crit[0] === 'C' ? `${x.crit[1]} List` : safeSheet(`${x.crit[1]} List`)) : MASTER;
    sum.getCell(r, 1).value = { text: x.label, hyperlink: `#${q(target)}!A1` };
    sum.getCell(r, 1).font = { ...(x.style === 'total' ? { bold: true } : {}), color: { argb: x.style === 'total' ? C.navy : 'FF1D4ED8' }, underline: x.style !== 'total' };
  });
  const sumEnd = 4 + sumRows.length;
  rateRules(sum, `F6:F${sumEnd}`, 'F6');
  // course breakdown
  const cbBar = sumEnd + 2;
  sectionBar(sum, cbBar, 'COURSE BREAKDOWN', 1, 6);
  headerRow(sum, cbBar + 1, ['Course Group', 'Students', 'Total Fees (₹)', 'Total Paid (₹)', 'Balance (₹)', 'Collection Rate']);
  const courseGroups = groupsPresent.length ? groupsPresent : ['SSLC'];
  courseGroups.forEach((g, i) => {
    const r = cbBar + 2 + i; const a = agg((s) => s.group === g);
    sum.getCell(r, 1).value = g;
    [
      { formula: `COUNTIFS(${M('D')},A${r},${M('B')},"<>")`, result: a.n },
      { formula: `SUMIFS(${M('G')},${M('D')},A${r})`, result: a.f },
      { formula: `SUMIFS(${M('J')},${M('D')},A${r})`, result: a.p },
      { formula: `SUMIFS(${M('K')},${M('D')},A${r})`, result: a.b },
    ].forEach((v, j) => { sum.getCell(r, 2 + j).value = v; sum.getCell(r, 2 + j).numFmt = MONEY; });
    sum.getCell(r, 6).value = { formula: `IF(C${r}=0,0,D${r}/C${r})`, result: a.r };
    sum.getCell(r, 6).numFmt = PCT;
    for (let c = 1; c <= 6; c++) sum.getCell(r, c).border = box;
  });
  const cbEnd = cbBar + 1 + courseGroups.length;
  rateRules(sum, `F${cbBar + 2}:F${cbEnd}`, `F${cbBar + 2}`);
  // month table (right)
  headerRow(sum, 4, ['Admission Month', 'Total Fees (₹)', 'Paid (₹)', 'Balance (₹)', 'Collection Rate'], 8);
  const monthRows = months.length ? months : [''];
  monthRows.forEach((m, i) => {
    const r = 5 + i; const a = agg((s) => s.month === m);
    sum.getCell(r, 8).value = m;
    [['G', a.f], ['J', a.p], ['K', a.b]].forEach(([L, val], j) => {
      sum.getCell(r, 9 + j).value = { formula: `SUMIFS(${M(L)},${M('L')},H${r})`, result: m ? val : 0 };
      sum.getCell(r, 9 + j).numFmt = MONEY;
    });
    sum.getCell(r, 12).value = { formula: `IF(I${r}=0,0,J${r}/I${r})`, result: a.r };
    sum.getCell(r, 12).numFmt = PCT;
    for (let c = 8; c <= 12; c++) sum.getCell(r, c).border = box;
  });
  const mEnd = 4 + monthRows.length;
  rateRules(sum, `L5:L${mEnd}`, 'L5');
  // charts section
  // pay-as-you-go tracking block (from the Payment Tracker sheet)
  const itBar = cbEnd + 2;
  sectionBar(sum, itBar, 'PAY AS YOU GO — PAYMENT TRACKING (from the Payment Tracker sheet)', 1, 6);
  headerRow(sum, itBar + 1, ['Students', 'Count', 'Balance (₹)', 'What it means']);
  const tSt = students.map((s) => ({ s, st: (!s.totalFees ? 'No fee set' : s.balance <= 0 ? '✔ Fully paid' : s.overdue > 0 ? '✖ Follow-up due' : s.paid > 0 ? '◐ Part paid' : 'Not paid yet') }));
  const itRows = [
    ['✔ Fully paid', 'Nothing left to pay'],
    ['◐ Part paid', 'Paying as they go — some fees still to come'],
    ['Not paid yet', 'No payment received so far'],
    ['✖ Follow-up due', 'Their own next payment date has passed — call them'],
    ['No fee set', 'Type the fee on the main list'],
  ];
  itRows.forEach(([st, what], i) => {
    const r = itBar + 2 + i;
    const xs = tSt.filter((x) => x.st === st);
    const amt = Math.round(xs.reduce((a, x) => a + (typeof x.s.balance === 'number' ? x.s.balance : 0), 0) * 100) / 100;
    sum.getCell(r, 1).value = { text: st, hyperlink: `#${q(TRK)}!A1` };
    sum.getCell(r, 1).font = { color: { argb: st === '✖ Follow-up due' ? C.red : 'FF1D4ED8' }, underline: true, bold: st === '✖ Follow-up due' };
    sum.getCell(r, 2).value = { formula: `COUNTIF(${TR('N')},"${st}")`, result: xs.length };
    sum.getCell(r, 3).value = { formula: `SUMIFS(${TR('G')},${TR('N')},"${st}")`, result: amt };
    sum.getCell(r, 3).numFmt = MONEY;
    sum.mergeCells(r, 4, r, 6);
    sum.getCell(r, 4).value = what; sum.getCell(r, 4).font = { color: { argb: C.noteFg }, italic: true };
    for (let c = 1; c <= 6; c++) sum.getCell(r, c).border = box;
    if (st === '✖ Follow-up due') for (let c = 1; c <= 3; c++) sum.getCell(r, c).fill = fill(C.redBg);
  });
  const itEnd = itBar + 1 + itRows.length;
  const chBar = Math.max(itEnd, mEnd) + 2;
  sectionBar(sum, chBar, 'CHARTS — these update by themselves when the lists change', 1, 12);
  const top = chBar; // 0-based row index of the row after the bar
  printSetup(sum);

  const charts = [
    { sheet: 'Summary', type: 'bar', title: 'Fee position by admission month', labels: months.length <= 6,
      cats: { ref: `Summary!$H$5:$H$${mEnd}`, values: monthRows },
      series: [['I', 'Total Fees', '1F4E79', 'f'], ['J', 'Paid', '2E8B57', 'p'], ['K', 'Balance', 'C0504D', 'b']].map(([L, name, color, k]) => ({
        name, nameRef: `Summary!$${L}$4`, ref: `Summary!$${L}$5:$${L}$${mEnd}`, color, fmt: MONEY, values: monthRows.map((m) => agg((s) => s.month === m)[k]) })),
      at: [0, top + 1, 6, top + 19] },
    { sheet: 'Summary', type: 'doughnut', title: 'Students by level',
      cats: { ref: `Summary!$A$${levelRow.SSLC}:$A$${levelRow.PG}`, values: LEVELS },
      series: [{ name: 'Students', nameRef: 'Summary!$B$4', ref: `Summary!$B$${levelRow.SSLC}:$B$${levelRow.PG}`, values: LEVELS.map((l) => agg((s) => s.level === l).n) }],
      at: [7, top + 1, 12, top + 19] },
    { sheet: 'Summary', type: 'bar', horizontal: true, title: 'Collection rate by level (how much of the fees is paid)', labels: true, max: 1, axisFmt: '0%',
      cats: { ref: `Summary!$A$${levelRow.SSLC}:$A$${levelRow.PG}`, values: LEVELS },
      series: [{ name: 'Collection Rate', nameRef: 'Summary!$F$4', ref: `Summary!$F$${levelRow.SSLC}:$F$${levelRow.PG}`, color: 'F5B82E', fmt: '0%', values: LEVELS.map((l) => agg((s) => s.level === l).r) }],
      at: [0, top + 20, 6, top + 37] },
    { sheet: 'Summary', type: 'bar', title: 'Fees collected each month', labels: payMonths.length <= 8,
      cats: { ref: `Payments!$M$5:$M$${pmEnd}`, values: payMonths.length ? payMonths : [''] },
      series: [{ name: 'Amount (₹)', nameRef: 'Payments!$N$4', ref: `Payments!$N$5:$N$${pmEnd}`, color: '0E9384', fmt: MONEY, values: payMonths.length ? payMonths.map((m) => received.filter((p) => monthLabel(p.date) === m).reduce((a, p) => a + (Number(p.amount) || 0), 0)) : [0] }],
      at: [7, top + 20, 12, top + 37] },
    { sheet: 'Payments', type: 'bar', title: 'Fees collected each month', labels: payMonths.length <= 8,
      cats: { ref: `Payments!$M$5:$M$${pmEnd}`, values: payMonths.length ? payMonths : [''] },
      series: [{ name: 'Amount (₹)', nameRef: 'Payments!$N$4', ref: `Payments!$N$5:$N$${pmEnd}`, color: '0E9384', fmt: MONEY, values: payMonths.length ? payMonths.map((m) => received.filter((p) => monthLabel(p.date) === m).reduce((a, p) => a + (Number(p.amount) || 0), 0)) : [0] }],
      at: [12, modeHead + modes.length + 1, 18, modeHead + modes.length + 19] },
  ];

  /* ---------- Start Here (filled last) ---------- */
  [3, 30, 72, 16].forEach((w, i) => { start.getColumn(i + 1).width = w; });
  titleBlock(start, 'D', `📘 START HERE — ${UP} STUDENT & FEE TRACKER`, `Downloaded from the Student Portal on ${genText}. Read this page once: it explains every sheet in plain words. Click any blue sheet name to jump to it.`, { back: false });
  let r = 4;
  sectionBar(start, r, 'WHAT IS IN THIS FILE  (click a name to open that sheet)', 1, 4); r++;
  headerRow(start, r, ['', 'Sheet', 'What it shows', 'Can I type here?']); r++;
  const guide = [
    ['Summary', 'Totals for everyone, for each level, each admission month and each course, plus 4 charts. Click a row name to open that list.', 'No — automatic'],
    [MASTER, 'THE MAIN LIST. Every student, one per row: fees, admission date, paid amount, balance, fee status, next payment date, follow-up amount, and every payment made (Payment 1, 2, 3… date and amount).', 'YES — type here'],
    ...LEVELS.map((l) => [`${l} List`, `Only the ${l} students, picked out of the main list automatically.`, 'No — automatic']),
    ...months.map((m) => [safeSheet(`${m} List`), `Students who joined in ${m}.`, 'No — automatic']),
    ['Payments', 'Every payment received, with receipt number, date, mode and amount. Monthly and payment-mode totals on the right. Each student\'s Total Paid is added up from here.', 'Yes — add new payments at the bottom'],
    [TRK, 'Pay as you go: for every student, the fee after discount, paid, balance, paid %, how many payments, average payment, last payment date, days since then, next payment date and status.', 'No — automatic'],
    ['Pending Fees', 'Students who still owe money, follow-ups first, then the biggest balance, with mobile number and next payment date.', 'No — snapshot'],
  ];
  guide.forEach(([name, what, can]) => {
    start.getCell(r, 2).value = { text: name, hyperlink: `#${q(name)}!A1` };
    start.getCell(r, 2).font = { color: { argb: 'FF1D4ED8' }, underline: true, bold: true };
    start.getCell(r, 3).value = what; start.getCell(r, 3).alignment = { wrapText: true, vertical: 'top' };
    start.getCell(r, 4).value = can;
    start.getCell(r, 4).font = { bold: true, color: { argb: can.startsWith('YES') || can.startsWith('Yes') ? C.green : C.noteFg } };
    [2, 3, 4].forEach((c) => { start.getCell(r, c).border = box; });
    start.getRow(r).height = what.length > 80 ? 32 : 20;
    r++;
  });
  r++;
  sectionBar(start, r, 'HOW TO ADD A NEW STUDENT (3 steps)', 1, 4); r++;
  [
    `1.  Open the '${MASTER}' sheet and click the first empty row under the last student.`,
    '2.  Type the Name, then pick Level, Course Group and Medium from the small drop-down arrow. Type Total Fees, Admission Date (e.g. 15-09-2026) and Total Paid.',
    '3.  Press Enter. Balance, Admission Month and Fee Status fill in by themselves, and the student appears in the right SSLC / PUC / Degree / PG list, month list, Summary and charts.',
    'To record a payment: go to the Payments sheet, pick the student\'s Admission No on the first empty row and type the date, mode, amount and status "Paid". Total Paid, Balance, Payments Made, the Payment 1, 2, 3… columns and the Payment Tracker all update by themselves. There are no fixed installments — students pay as they go.',
  ].forEach((t) => { start.mergeCells(r, 2, r, 4); start.getCell(r, 2).value = t; start.getCell(r, 2).alignment = { wrapText: true, vertical: 'middle' }; start.getRow(r).height = 30; r++; });
  r++;
  sectionBar(start, r, 'WHAT THE COLOURS MEAN', 1, 4); r++;
  [
    [C.navy, 'Dark blue bar', 'Titles and column headings', C.white],
    [C.total, 'Light yellow', 'Totals (they add up automatically)', C.navy],
    [C.white, 'White cells', `Type here (on the '${MASTER}' and Payments sheets)`, 'FF101828'],
    [C.autoBg, 'Grey cells', 'Filled in automatically — no need to type', 'FF101828'],
    [C.greenBg, '✔ Fully paid', 'Nothing left to pay (green)', C.green],
    [C.amberBg, '◐ Part paid', 'Some fees paid, some still due (orange)', 'FF93370D'],
    [C.redBg, '✖ Not paid', 'No payment yet, or a promised payment date that has passed (red)', C.red],
  ].forEach(([bg, name, means, fg]) => {
    const c = start.getCell(r, 2); c.value = name; c.fill = fill(bg); c.font = { bold: true, color: { argb: fg } }; c.border = box;
    start.getCell(r, 3).value = means; start.getCell(r, 3).border = box;
    r++;
  });
  r++;
  sectionBar(start, r, 'HANDY TIPS', 1, 4); r++;
  [
    '🔎  Find a student: press Ctrl + F and type part of the name.',
    '⬇  Show only some rows: click the small arrow in any blue heading (for example "Level") and tick what you want. Click it again and choose "Select All" to see everyone.',
    '📌  The heading row stays at the top while you scroll, so you always know which column is which.',
    '🏠  Every sheet has a "Start Here" link in its top-right corner to come back to this page.',
    '🖨  Printing is already set up: File > Print fits each list to the page width and repeats the headings on every page.',
    '🔒  The automatic lists and the Summary are locked so they cannot be broken by accident (Review > Unprotect Sheet unlocks them; no password).',
    `ℹ️  The automatic lists have room for ${CAP} students. Send the data back through the Student Portal for anything more.`,
  ].forEach((t) => { start.mergeCells(r, 2, r, 4); start.getCell(r, 2).value = t; start.getCell(r, 2).alignment = { wrapText: true, vertical: 'middle' }; start.getRow(r).height = 30; r++; });
  printSetup(start, false);

  // lock the automatic sheets (no password) so formulas cannot be overwritten by accident
  const lockOpts = { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: false, formatColumns: true, formatRows: true };
  for (const name of [...listSheets, 'Summary']) await wb.getWorksheet(name).protect('', lockOpts);

  // open on the requested sheet
  const order = wb.worksheets.map((w) => w.name);
  const active = Math.max(0, order.indexOf(model.activeSheet || 'Start Here'));
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: active, visibility: 'visible' }];

  // one font everywhere (Calibri), keeping each cell's size / colour / bold
  wb.eachSheet((ws) => ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
    if (!cell.font || !cell.font.name) cell.font = { name: 'Calibri', size: 11, ...(cell.font || {}) };
  })));

  const buf = await wb.xlsx.writeBuffer();
  return addCharts(buf, charts, JSZip);
}
