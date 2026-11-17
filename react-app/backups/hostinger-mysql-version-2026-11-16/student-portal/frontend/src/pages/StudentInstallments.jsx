import { useMemo } from 'react';
import { Shell, Link, useConfirm, useNav } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import { fmtAmt, fmt2, fmtINR, fmtDate, studentClass, feeSummary } from '../utils.js';
import { printReceipt } from '../components/printStatement.js';
import { useCustomization as useInstCustom } from '../components/Customize.jsx';
import FeeSchedule from '../os/FeeSchedule.jsx';
import { feeAccount, allStudents, INR } from '../os/data.js';
import Icon from '../components/Icon.jsx';
import { Chip } from '../os/ui.jsx';
import { currentRole, employeeMayChangePayment } from '../os/permissions.js';

const TABLES = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'];

/** One student's installments: summary, every payment with Edit / Delete, add a new installment, print */
export default function StudentInstallments({ studentId }) {
  const store = useStore();
  const { go } = useNav();
  const [ask, dialog] = useConfirm();
  const [instFormCfg] = useInstCustom('form-installment');
  const receiptExtras = (instFormCfg.extra || []).map((x) => ({ id: x.name, label: x.label }));
  const student = useMemo(() => TABLES.flatMap((t) => store.data[t] || []).find((s) => s.student_id === studentId), [store.data, studentId]);
  const summary = feeSummary(store.data.installments || [], studentId, store.data.discounts, student?.actual_fee);
  const acctStudent = allStudents(store.data).find((x) => x.student_id === studentId);
  const acct = acctStudent ? feeAccount(store.data, acctStudent) : null;
  const back = { page: 'inst-student', studentId };
  const name = student?.student_name || summary.list[0]?.student_name || studentId;

  const actual = acct ? acct.total : summary.total;
  const discount = acct ? acct.adj : summary.discount;
  const del = async (r) => { if (await ask(`Delete installment ${r.installment_no || ''} (${fmtINR(r.amount)} on ${fmtDate(r.payment_date)})?`)) store.remove('installments', r.id); };

  return (
    <Shell>
      <div className="card page-card mb-3">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h1 className="page-title">{name}</h1>
            <div className="os-sub">
              {student?.admission_number || summary.list[0]?.admission_number || '—'} · {studentClass(studentId)} · {student?.mobile || summary.list[0]?.phone || ''}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-outline-primary" onClick={() => printReceipt(student, summary, receiptExtras)} disabled={!summary.list.length}><Icon name="print" size={15} /> Print receipt</button>
            <Link to={{ page: 'inst-add', studentId, back }} className="btn btn-primary"><Icon name="plus" size={15} /> Add Installment</Link>
          </div>
        </div>
        <div className="fee-tiles mt-3">
          <div><span>Actual fee</span><strong>{fmtINR(actual)}</strong></div>
          <div className="clear"><span>Discount</span><strong>{fmtINR(discount)}</strong></div>
          <div className="net"><span>Total fee</span><strong>{fmtINR(Math.max(0, actual - discount))}</strong></div>
          <div><span>Paid</span><strong>{fmtINR(summary.paid)}</strong></div>
          <div className={(acct ? acct.balance : summary.balance) > 0 ? 'due' : 'clear'}><span>Balance</span><strong>{fmtINR(acct ? acct.balance : summary.balance)}</strong></div>
          <div><span>Payments</span><strong>{acct ? acct.count : summary.list.length}</strong></div>
          {acct && acct.last && <div><span>Last payment</span><strong>{fmtDate(acct.last)}</strong></div>}
          {acct && acct.next && <div className={acct.followUp ? 'due' : ''}><span>{acct.followUp ? 'Follow-up due' : 'Next payment'}</span><strong>{fmtDate(acct.next)}</strong></div>}
        </div>
      </div>

      {student && <FeeSchedule student={student} />}

      <div className="card page-card">
        <h5 className="section-title">Payments</h5>
        <div className="table-responsive">
          <table className="table table-hover os-table mb-0">
            <thead>
              <tr><th>Sl. No.</th><th>Date</th><th>Payment No.</th><th className="text-end">Amount</th><th>Payment Mode</th><th>Reference</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {summary.list.length === 0 && <tr><td colSpan={8} className="dataTables_empty"><div className="empty-state"><Icon name="inbox" size={28} /><b>No payments yet</b><span>Use “Add Installment” to record the first payment.</span></div></td></tr>}
              {summary.list.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{fmtDate(r.payment_date)}</td>
                  <td>{r.installment_no}</td>
                  <td className="text-end">{fmtINR(r.amount)}</td>
                  <td>{r.payment_mode}{r.payment_mode === 'Cash/Online' && r.cash_amount != null ? ` (Cash ${fmtINR(r.cash_amount)} + Online ${fmtINR(r.online_amount)})` : ''}</td>
                  <td>{r.reference}</td>
                  <td><Chip t={r.status || 'Paid'} /></td>
                  <td>
                    <div className="row-actions">
                      {(currentRole() !== 'Employee' || employeeMayChangePayment(r)) ? <>
                        <Link to={{ page: 'inst-edit', id: r.id, back }} className="btn btn-outline-secondary btn-sm">Edit</Link>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => del(r)}>Delete</button>
                      </> : <span className="small text-muted" title="Only the owner can change a counted payment">Counted</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {summary.list.length > 0 && (
              <tfoot><tr><th colSpan={3} className="text-end">Total paid</th><th className="text-end">{fmtINR(summary.paid)}</th><th colSpan={4}>Balance: {fmtINR(acct ? acct.balance : summary.balance)}</th></tr></tfoot>
            )}
          </table>
        </div>
      </div>
      {dialog}
    </Shell>
  );
}
