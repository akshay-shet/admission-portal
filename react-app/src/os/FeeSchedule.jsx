/* Pay as you go: a student's fee, what they paid, what is left, how they pay — no fixed installments */
import { useState } from 'react';
import { useStore } from '../store.jsx';
import { fmtDate, num, LEVELS } from '../utils.js';
import { feeAccount, allStudents, INR } from './data.js';
import { Chip } from './ui.jsx';
import { currentRole } from './permissions.js';
import { notify } from '../components/toast.jsx';

/** Fee inputs used on the student forms: actual fee + (optional) the date this student will pay next */
export function FeeFields({ value, onChange, idPrefix = 'fee', lockFee = false }) {
  const v = value;
  const set = (k, x) => onChange({ ...v, [k]: x });
  return (
    <div className="row g-2">
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${idPrefix}_actual`}>Actual fee (₹)</label>
        <input id={`${idPrefix}_actual`} className="form-control" inputMode="decimal" placeholder="e.g. 80000" value={v.actual_fee ?? ''} readOnly={lockFee}
          title={lockFee ? 'The fee is set by the owner' : undefined}
          onChange={(e) => set('actual_fee', e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${idPrefix}_next`}>Next payment date <small className="text-muted fw-normal">(optional)</small></label>
        <input id={`${idPrefix}_next`} type="date" className="form-control" value={v.next_payment_date || ''} onChange={(e) => set('next_payment_date', e.target.value)} />
      </div>
    </div>
  );
}

/** the student's own record (to save the fee / next payment date on it) */
function recordOf(data, studentId) {
  for (const [level, L] of Object.entries(LEVELS)) {
    const r = (data[L.table] || []).find((x) => x.student_id === studentId);
    if (r) return { level, table: L.table, row: r };
  }
  return null;
}

/** Fee & payments card on the student's fee page and in the All Students drawer */
export default function FeeSchedule({ student, compact }) {
  const store = useStore();
  const s = allStudents(store.data).find((x) => x.student_id === student?.student_id);
  const fee = s ? feeAccount(store.data, s) : null;
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(() => ({ actual_fee: fee?.total ? String(fee.total) : '', next_payment_date: s?.next_payment_date || '' }));
  if (!s) return null;
  const emp = currentRole() === 'Employee';
  const lockFee = emp && fee.total > 0;
  const rec = recordOf(store.data, s.student_id);
  const save = async () => {
    if (!rec) return;
    const patch = { next_payment_date: v.next_payment_date || '' };
    if (!lockFee) patch.actual_fee = num(v.actual_fee) || '';
    if (await store.update(rec.table, rec.row.id, patch)) { setEdit(false); notify('Fee details saved'); }
  };
  const got = fee.list.filter((r) => !['Pending', 'Rejected'].includes(r.status) && num(r.amount) > 0);
  let running = 0;
  const timeline = got.map((r, i) => {
    running += num(r.amount);
    const prev = got[i - 1];
    const gap = prev ? Math.round((new Date(r.payment_date) - new Date(prev.payment_date)) / 86400000) : null;
    return { ...r, n: i + 1, running, left: Math.max(0, fee.net - running), gap };
  });
  const nextChip = !fee.balance ? null : fee.followUp ? <Chip t="Follow-up due" /> : fee.next ? <Chip t="Upcoming" /> : <Chip t="Not set" />;
  return (
    <div className={compact ? '' : 'card page-card mb-3'}>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <h5 className="m-0">Fee &amp; payments <small className="text-muted fw-normal">· pay as you go</small></h5>
          <div className="small text-muted">No fixed installments: every payment the student makes is added up and taken off the total fee.</div>
        </div>
        {!edit && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setV({ actual_fee: fee.total ? String(fee.total) : '', next_payment_date: s.next_payment_date || '' }); setEdit(true); }}>
          {fee.total ? (lockFee ? 'Set next payment date' : 'Edit fee / next payment date') : 'Set fee'}</button>}
      </div>
      {edit && (
        <div className="plan-box mb-3">
          <FeeFields value={v} onChange={setV} idPrefix={`fee_${s.student_id}`} lockFee={lockFee} />
          <div className="form-text">{lockFee ? 'The fee itself is set by the owner. ' : ''}The next payment date is only for this student — leave it empty if no date was agreed.</div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(false)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      )}
      {fee.total > 0 ? (
        <>
          <div className="payg-bar" title={`${fee.paidPct}% of the total fee paid`}><span style={{ width: `${Math.min(100, fee.paidPct)}%` }} /></div>
          <div className="payg-legend"><span><b>{INR(fee.paid)}</b> paid of {INR(fee.net)}</span><span><b>{fee.paidPct}%</b></span><span><b className={fee.balance ? 'text-danger' : 'text-success'}>{INR(fee.balance)}</b> left</span></div>
          <div className="payg-stats">
            <div><span>Payments made</span><b>{fee.count}</b></div>
            <div><span>Average payment</span><b>{fee.count ? INR(fee.avg) : '—'}</b></div>
            <div><span>Last payment</span><b>{fee.last ? fmtDate(fee.last) : '—'}</b>{fee.last && <small>{fee.daysSince === 0 ? 'today' : fee.daysSince < 0 ? 'dated in the future' : `${fee.daysSince} day(s) ago`}</small>}</div>
            <div><span>Next payment date</span><b>{fee.next ? fmtDate(fee.next) : '—'}</b>{nextChip}</div>
          </div>
          {timeline.length > 0 && (
            <div className="table-responsive mt-2">
              <table className="table table-sm os-table mb-0">
                <thead><tr><th>Payment</th><th>Date</th><th className="text-end">Amount</th><th className="text-end">Paid so far</th><th className="text-end">Left after it</th><th>Gap since previous</th></tr></thead>
                <tbody>{timeline.map((r) => (
                  <tr key={r.id}><td>Payment {r.n}</td><td>{fmtDate(r.payment_date)}</td><td className="text-end">{INR(r.amount)}</td>
                    <td className="text-end text-success">{INR(r.running)}</td><td className="text-end fw-semibold">{INR(r.left)}</td>
                    <td className="text-muted">{r.gap === null ? 'first payment' : `${r.gap} day(s)`}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {!timeline.length && <div className="os-empty">No payment yet. Use “Add Installment” to record the first payment of any amount.</div>}
        </>
      ) : !edit && <div className="os-empty">No fee set yet. Use “Set fee” to type this student’s actual fee.</div>}
    </div>
  );
}
