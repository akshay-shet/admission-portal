/* Employee rules, checked by the server for every save (the browser hides the same things, but this is the real lock) */
import { OWNER_WRITE, STUDENT_TABLES } from './collections.js';
import { actualFee, hasPayments } from './db.js';

const NO = (msg) => ({ ok: false, msg });
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

/**
 * op: 'add' | 'update' (merge) | 'put' (replace) | 'remove'; cur = the stored record (or null)
 * returns { ok, row } with the row to save, or { ok: false, msg }
 */
export async function check(role, c, op, row, cur) {
  if (role === 'Owner') return { ok: true, row };
  if (OWNER_WRITE.has(c)) return NO('Only the owner can change this.');
  if (c === 'discounts') {
    if (cur && cur.status !== 'Pending') return NO('This discount was already decided by the owner. Ask the owner to change it.');
    if (op === 'remove') return { ok: true };
    return { ok: true, row: { ...row, status: 'Pending' } };
  }
  if (c === 'installments') {
    if (op === 'remove') return cur && cur.status !== 'Pending' ? NO('Only the owner can delete a payment that is already counted.') : { ok: true };
    if (cur && cur.status !== 'Pending') return NO('Only the owner can change a payment that is already counted.');
    const merged = { ...(cur || {}), ...row };
    if (merged.status === 'Rejected') return NO('Only the owner can reject a payment.');
    if (cur && cur.status === 'Pending' && (merged.status || 'Paid') !== 'Pending') return NO('Only the owner can verify a payment.');
    const fee = await actualFee(merged.student_id);
    const out = { ...row };
    if (fee > 0 && num(merged.total_fees) !== fee) out.total_fees = fee; // no hidden discount through the fee on a payment
    return { ok: true, row: out };
  }
  if (c === 'fee_dues' && op === 'update') return NO('Due dates are changed with “Change plan” on the student’s fee page.');
  // the student ID links payments, discounts and documents: only the owner may change it (checked before anything else)
  if (STUDENT_TABLES.includes(c) && cur && row && (op === 'update' || op === 'put')) {
    if ('student_id' in row && String(row.student_id ?? '') !== String(cur.student_id ?? '')) return NO('Only the owner can change a student ID.');
    if (op === 'put' && !('student_id' in row)) row = { ...row, student_id: cur.student_id };
  }
  // pay as you go: the student's actual fee, once set, is the owner's to change
  if (STUDENT_TABLES.includes(c) && (op === 'update' || op === 'put') && row && ('actual_fee' in row || (op === 'put' && cur))) {
    const fee = await actualFee(cur?.student_id || row.student_id);
    if (fee > 0 && num(row.actual_fee) !== fee) return { ok: true, row: { ...row, actual_fee: fee } }; // a replaced record keeps the fee too
  }
  if (STUDENT_TABLES.includes(c) && op === 'remove' && (await hasPayments(cur?.student_id))) return NO('Only the owner can delete a student who has payments.');
  return { ok: true, row };
}
