/* Academy OS: views over the existing student and installment records */
import { LEVELS, feeSummary, batchLabel, num, isoDate } from '../utils.js';
export { num, isoDate };

export const TODAY = () => new Date().toISOString().slice(0, 10);
export const INR = (n) => '₹' + Math.round(num(n)).toLocaleString('en-IN');
export const LEVEL_KEYS = ['sslc', 'puc', 'degree', 'pg'];

export function programOf(level, s) {
  if (level === 'puc') return s.course_id ? `PUC ${s.course_id}` : 'PUC';
  if (level === 'degree') return s.course_id ? `Degree · ${s.course_id}` : 'Degree';
  if (level === 'pg') return s.course_id ? `PG · ${s.course_id}` : 'PG';
  return 'SSLC';
}
export const cohortOf = (s) => (s.admission_year ? `${s.admission_year} · Batch ${batchLabel(s.admission_batch)}` : 'Not set');

/** Every student from the four level lists, with level / program / cohort */
/* Results are cached per data snapshot (a new snapshot is made on every change), so pages stay fast with many students */
const CACHE = new WeakMap();
const memo = (data) => { let c = CACHE.get(data); if (!c) { c = { acc: new Map() }; CACHE.set(data, c); } return c; };
const groupBy = (rows, key) => { const m = new Map(); for (const r of rows || []) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };

export function allStudents(data) {
  const c = memo(data);
  if (!c.students) c.students = buildStudents(data);
  return c.students;
}
function buildStudents(data) {
  return LEVEL_KEYS.flatMap((level) => (data[LEVELS[level].table] || []).map((s) => ({
    ...s, level, levelLabel: LEVELS[level].label, program: programOf(level, s), cohort: cohortOf(s),
  })));
}

/**
 * Installment amounts after the student's discount: the discount lowers the total fee, so every installment is
 * reduced in the same proportion (₹80,000 in 4 × ₹20,000 with ₹10,000 off -> 4 × ₹17,500). Whole rupees; the last
 * installment takes the rounding so the plan adds up exactly. Each row keeps its original amount in `gross`.
 */
export function netDues(dues, total, discount) {
  const sorted = [...dues].sort((a, b) => isoDate(a.due_date).localeCompare(isoDate(b.due_date)));
  const scheduled = sorted.reduce((a, d) => a + num(d.amount), 0);
  const factor = total > 0 && discount > 0 ? Math.max(0, total - discount) / total : 1;
  if (factor === 1) return sorted.map((d) => ({ ...d, gross: num(d.amount) }));
  const target = Math.round(scheduled * factor);
  let used = 0;
  return sorted.map((d, i) => {
    const amt = i === sorted.length - 1 ? target - used : Math.round(num(d.amount) * factor);
    used += amt;
    return { ...d, gross: num(d.amount), amount: Math.max(0, amt) };
  });
}

/** Due schedule rows of one student with status worked out against what was actually paid (payments only) */
export function dueStatus(dues, paid, graceDays = 0) {
  let cum = 0;
  // Settings > Fees: days of grace after a due date before it counts as overdue
  const t = new Date(); t.setDate(t.getDate() - (Number(graceDays) || 0));
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return [...dues].sort((a, b) => isoDate(a.due_date).localeCompare(isoDate(b.due_date))).map((d) => {
    const amt = num(d.amount);
    const prev = cum; cum += amt;
    const due = isoDate(d.due_date);
    let status = 'Pending';
    if (paid >= cum - 0.005) status = 'Paid';
    else if (due && due < today) status = 'Overdue';
    else if (paid > prev) status = 'Part Paid';
    return { ...d, status, covered: Math.max(0, Math.min(amt, paid - prev)) };
  });
}

/** Fee account of a student: agreed fee, paid, discount, balance, next due and status (same rules as the installment pages) */
export function feeAccount(data, s) {
  const c = memo(data);
  if (c.acc.has(s.student_id)) return c.acc.get(s.student_id);
  if (!c.inst) { c.inst = groupBy(data.installments, 'student_id'); c.disc = groupBy(data.discounts, 'student_id'); c.dues = groupBy(data.fee_dues, 'student_id'); }
  const out = computeAccount(data, s, c.inst.get(s.student_id) || [], c.disc.get(s.student_id) || [], c.dues.get(s.student_id) || []);
  c.acc.set(s.student_id, out);
  return out;
}
/*
 * Pay as you go: a student has an actual fee (minus any approved discount = total fee) and pays whatever,
 * whenever. No fixed installments. Each student may have their own next payment date (what they promised);
 * when that date has passed (after the grace days) and money is still owed, a follow-up is due.
 */
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
function computeAccount(data, s, inst, disc, dues) {
  const sum = feeSummary(inst, s.student_id, disc, s.actual_fee);
  const legacy = dues.reduce((a, d) => a + num(d.amount), 0); // fee of students set up with the old installment plans
  const total = sum.total || legacy;
  const paid = sum.paid;
  const adj = sum.discount;
  const balance = Math.max(0, Math.round((total - adj - paid) * 100) / 100);
  const grace = Number((data.settings || []).find((r) => r.id === 'academy-settings')?.academy?.grace_days || 0);
  const got = sum.list.filter((r) => !['Pending', 'Rejected'].includes(r.status) && num(r.amount) > 0);
  const last = got.length ? isoDate(got[got.length - 1].payment_date) : '';
  const today = TODAY();
  const next = balance > 0 ? isoDate(s.next_payment_date) : '';
  const followUp = !!next && daysBetween(next, today) > grace;
  const net = Math.max(0, total - adj);
  let status = 'No Fee Set';
  if (total) status = balance === 0 ? 'Fully Paid' : followUp ? 'Follow-up due' : paid > 0 ? 'Part Paid' : 'Unpaid';
  return {
    total, net, paid, adj, refund: sum.refund, pending: sum.pending, balance, status, list: sum.list,
    next, followUp, overdue: followUp ? balance : 0, // amount that needs a follow-up call
    last, daysSince: last ? daysBetween(last, today) : null, count: got.length,
    avg: got.length ? Math.round((got.reduce((a, r) => a + num(r.amount), 0) / got.length) * 100) / 100 : 0,
    paidPct: net > 0 ? Math.min(100, Math.round((paid / net) * 1000) / 10) : (total ? 100 : 0),
    schedule: [],
  };
}

export function nextNumber(rows, field, prefix) {
  const n = rows.reduce((m, r) => {
    const x = parseInt(String(r[field] || '').replace(prefix, ''), 10);
    return Number.isFinite(x) && x > m ? x : m;
  }, 0);
  return prefix + String(n + 1).padStart(3, '0');
}

export const monthKey = (d) => isoDate(d).slice(0, 7);
export const monthLabel = (k) => {
  if (!/^\d{4}-\d{2}$/.test(k || '')) return '';
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', { month: 'short' }) + ' ' + y.slice(2);
};
export function lastMonths(n) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

/** Excel download in the same look as the Student & Fee Tracker (title bar, totals, filters, print setup) */
export async function exportXlsx(filename, head, rows, sheet) {
  const { downloadStyledSheet } = await import('../export/index.js');
  const title = (sheet && sheet !== 'Sheet1' ? sheet : filename.replace(/\.xlsx$/i, '')).replace(/_/g, ' ');
  await downloadStyledSheet({ filename, title, head, rows, sheetName: title });
}

/** Equal installments: total split n ways (last one takes the rounding), every `gap` months from `first` (yyyy-mm-dd) */
export function makeSchedule(total, n, first, gap = 1) {
  const t = num(total); const k = Math.max(1, Math.round(num(n) || 1)); const g = Math.max(1, Math.round(num(gap) || 1));
  const f = isoDate(first); if (!t || !f) return [];
  const [y0, m0, d0] = f.split('-').map(Number);
  const each = Math.floor(t / k);
  return Array.from({ length: k }, (_, i) => {
    const last = new Date(y0, m0 - 1 + i * g + 1, 0).getDate();
    const d = new Date(y0, m0 - 1 + i * g, Math.min(d0, last));
    return { installment_no: String(i + 1), due_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, amount: i === k - 1 ? t - each * (k - 1) : each };
  });
}
