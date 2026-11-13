import { useDraft, DraftBanner } from '../components/draft.jsx';
import { useEffect, useMemo, useState } from 'react';
import { Shell, useNav } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import { studentClass, fmt0, fmt2, fmtINR, fmtDate, batchLabel, normMedium, feeSummary, num } from '../utils.js';
import CustomizeButton, { useCustomization } from '../components/Customize.jsx';
import { notify } from '../components/toast.jsx';
import Icon from '../components/Icon.jsx';
import { currentRole, employeeMayChangePayment } from '../os/permissions.js';
import { allStudents, feeAccount } from '../os/data.js';

const MODES = ['Cash', 'UPI', 'Card'];

/* Fields of this form, as shown in its Customize panel (and as choices for extra list columns) */
export const INSTALLMENT_FIELDS = [
  { id: 'admission_number', section: 'Student', label: 'Admission Number', type: 'text' },
  { id: 'phone', section: 'Student', label: 'Mobile', type: 'text' },
  { id: 'admission_year', section: 'Student', label: 'Admission Year', type: 'text' },
  { id: 'admission_batch', section: 'Student', label: 'Admission Batch', type: 'text' },
  { id: 'register_number', section: 'Student', label: 'Register Number', type: 'text' },
  { id: 'total_fees', section: 'Payment', label: 'Total Fees', type: 'text' },
  { id: 'installment_no', section: 'Payment', label: 'Installment No', type: 'fixed', note: 'Counted automatically' },
  { id: 'amount', section: 'Payment', label: 'Amount', type: 'text' },
  { id: 'balance', section: 'Payment', label: 'Balance', type: 'fixed', note: 'Worked out automatically' },
  { id: 'payment_date', section: 'Payment', label: 'Date', type: 'fixed', note: 'Date picker' },
  { id: 'payment_mode', section: 'Payment', label: 'Payment Mode', type: 'select', options: MODES },
  { id: 'status', section: 'Payment', label: 'Status', type: 'select', options: ['Paid', 'Pending', 'Rejected'] },
  { id: 'reference', section: 'Payment', label: 'Reference / UTR', type: 'text' },
];
/* Money / number boxes: plain text (no up/down spinner), digits and one decimal point only */
const MONEY = new Set(['total_fees', 'amount', 'cash_amount', 'online_amount']);
const cleanNum = (s, decimals = true) => {
  const t = String(s).replace(decimals ? /[^\d.]/g : /\D/g, '');
  return decimals ? t.replace(/(\..*)\./g, '$1') : t;
};
const TABLES = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'];

export default function InstallmentForm({ id, studentId, back }) {
  const store = useStore();
  const { back: navBack } = useNav();
  const goBack = () => navBack(back || { page: 'installments' });
  const editing = id ? store.data.installments.find((r) => r.id === id) : null;
  const students = useMemo(() => TABLES.flatMap((t) => store.data[t]), [store.data]);
  const today = new Date().toISOString().slice(0, 10);

  /** Everything the form can take from the student's record (and their previous installment) */
  const studentFill = (sid) => {
    const s = TABLES.flatMap((t) => store.data[t] || []).find((x) => x.student_id === sid);
    const prev = store.data.installments.filter((r) => r.student_id === sid && r.id !== id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      student_id: sid,
      admission_year: s?.admission_year || prev?.admission_year || '',
      admission_batch: s?.admission_batch || prev?.admission_batch || '',
      admission_number: s?.admission_number || prev?.admission_number || '',
      register_number: s?.register_number || s?.sslc_register_number || prev?.register_number || '',
      phone: s?.mobile || prev?.phone || '',
      course: studentClass(sid),
      // pay as you go: the student's own fee (or the fee typed on their last payment)
      total_fees: String(num(s?.actual_fee) || num(prev?.total_fees) || (store.data.fee_dues || []).filter((d) => d.student_id === sid).reduce((a, d) => a + num(d.amount), 0) || ''),
      next_payment_date: s?.next_payment_date || '',
      _found: Boolean(s),
    };
  };
  const blank = { student_id: '', admission_year: '', admission_batch: '', admission_number: '', register_number: '', phone: '', course: '',
    total_fees: '', amount: '', payment_date: today, status: 'Paid', payment_mode: 'Cash', reference: '', cash_amount: '', online_amount: '' };
  const [v, setV] = useState(() => (editing ? { ...editing, next_payment_date: studentFill(editing.student_id).next_payment_date } : studentId ? { ...blank, ...studentFill(studentId) } : blank));
  // Opened from a student's page before their record finished loading: fill in as soon as it arrives
  useEffect(() => {
    if (!editing && studentId && !v._found) {
      const f = studentFill(studentId);
      if (f._found) setV((cur) => ({ ...cur, ...f, total_fees: cur.total_fees || f.total_fees }));
    }
  }, [store.data, studentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [custom] = useCustomization('form-installment');
  const ci = (k) => custom.items?.[k] || {};
  const lbl = (k, d) => ci(k).label || d;
  const off = (k) => Boolean(ci(k).hidden);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const draft = useDraft(`payment:${id || 'new'}:${studentId || ''}`, v, (d) => setV(d));

  if (id && !editing) {
    return <Shell><h4>Installment not found</h4><button type="button" className="btn btn-outline-secondary" onClick={goBack}>Back</button></Shell>;
  }
  // Employee login: counted payments are the owner's to change; the student's fee can't be changed from here
  const emp = currentRole() === 'Employee';
  if (emp && editing && !employeeMayChangePayment(editing)) {
    return (
      <Shell><div className="card page-card text-center py-5">
        <div className="state-ico"><Icon name="info" size={30} /></div>
        <h5 className="mt-2">This payment is already counted</h5>
        <div className="os-sub mb-3">Only the owner can change or delete a payment after it is counted. Ask the owner if something needs fixing.</div>
        <div><button type="button" className="btn btn-outline-secondary" onClick={goBack}>Back</button></div>
      </div></Shell>
    );
  }
  const accStudent = v.student_id ? allStudents(store.data).find((x) => x.student_id === v.student_id) : null;
  // the fee belongs to the student (changed on their fee page), so it is shown here, not typed again
  const lockedFee = accStudent ? feeAccount(store.data, accStudent).total : 0;

  // What this student has already paid (other installments only)
  const others = (store.data.installments || []).filter((r) => r.student_id === v.student_id && r.id !== id);
  const prior = feeSummary(others, v.student_id, store.data.discounts, accStudent?.actual_fee);
  const paid = prior.paid + prior.discount; // approved discounts count towards the fees
  const split = v.payment_mode === 'Cash/Online';
  const amount = split ? Number(v.cash_amount || 0) + Number(v.online_amount || 0) : Number(v.amount || 0);
  const balance = Math.max(0, Math.round((num(lockedFee || v.total_fees) - (paid + (['Pending', 'Rejected'].includes(v.status) ? 0 : amount))) * 100) / 100);
  const instNo = editing ? v.installment_no : (v.student_id ? others.length + 1 : '');
  const showRef = ['Online', 'UPI', 'Card', 'Cash/Online'].includes(v.payment_mode);

  const set = (k) => (e) => setV({ ...v, [k]: MONEY.has(k) ? cleanNum(e.target.value) : e.target.value });
  const cls = studentClass(v.student_id) || v.course || '';
  const modeList = ci('payment_mode').options?.length ? ci('payment_mode').options : MODES;
  const modes = modeList.includes(v.payment_mode) || !v.payment_mode ? modeList : [...modeList, v.payment_mode]; // keep an older mode visible
  const statusList0 = ci('status').options?.length ? ci('status').options : ['Paid', 'Pending', 'Rejected'];
  // an employee records Paid or Pending; only the owner rejects or verifies
  const statusList = !emp ? statusList0 : editing ? ['Pending'] : statusList0.filter((x) => x !== 'Rejected');
  const st = TABLES.flatMap((t) => store.data[t] || []).find((x) => x.student_id === v.student_id);

  const pickStudent = (e) => {
    const f = studentFill(e.target.value);
    setV({ ...v, ...f, total_fees: f.total_fees || v.total_fees });
  };

  const submit = async (e) => {
    e.preventDefault();
    const s = students.find((x) => x.student_id === v.student_id);
    if (!s && !editing) { setError('Select a student.'); return; }
    setSaving(true);
    const row = {
      student_id: v.student_id,
      student_name: s?.student_name || editing?.student_name || '',
      admission_year: v.admission_year, admission_batch: v.admission_batch, admission_number: v.admission_number,
      register_number: v.register_number, phone: v.phone, course: cls,
      board_id: s?.board_id ?? editing?.board_id ?? '', course_id: s?.course_id ?? editing?.course_id ?? '',
      combination_id: s?.combination_id ?? editing?.combination_id ?? '',
      total_fees: lockedFee > 0 ? lockedFee : Number(v.total_fees || 0), installment_no: Number(instNo || 1), amount, balance,
      payment_date: v.payment_date || editing?.payment_date || today, status: v.status, payment_mode: v.payment_mode,
      cash_amount: split ? Number(v.cash_amount || 0) : null, online_amount: split ? Number(v.online_amount || 0) : null,
      reference: showRef ? v.reference : '',
      // fields added through Customize
      ...Object.fromEntries((custom.extra || []).map((x) => [x.name, v[x.name] ?? ''])),
    };
    try {
      const ok = editing ? await store.update('installments', id, row) : await store.add('installments', { ...row, created_at: new Date().toISOString() });
      if (ok === false) { setSaving(false); return; }
      // the student's own record keeps the fee (first time) and the next payment date they agreed
      const recTable = TABLES.find((t) => (store.data[t] || []).some((x) => x.student_id === v.student_id));
      const rec = recTable && store.data[recTable].find((x) => x.student_id === v.student_id);
      if (rec) {
        const patch = {};
        if (!lockedFee && num(v.total_fees) > 0) patch.actual_fee = num(v.total_fees);
        const nextDate = balance > 0 ? (v.next_payment_date || '') : '';
        if ((rec.next_payment_date || '') !== nextDate) patch.next_payment_date = nextDate;
        if (Object.keys(patch).length) await store.update(recTable, rec.id, patch);
      }
      notify(editing ? 'Installment updated' : `Payment of ${fmtINR(row.amount)} saved`);
      draft.clear();
      goBack();
    } catch (err) {
      setError(err?.code === 'invalid_argument' ? 'You do not have permission to change records in this portal.' : `Could not save: ${err?.message || err}`);
      setSaving(false);
    }
  };

  const field = (col, label, k, props = {}) => {
    if (off(k)) return null;
    const o = ci(k);
    const text = lbl(k, label);
    if (o.type === 'select' && o.options?.length) {
      return (
        <div className={col}>
          <label className="form-label" htmlFor={`i_${k}`}>{text}</label>
          <select id={`i_${k}`} className="form-select form-select-sm" value={v[k] ?? ''} onChange={set(k)}>
            <option value="">Select</option>
            {v[k] && !o.options.includes(v[k]) && <option value={v[k]}>{v[k]}</option>}
            {o.options.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div className={col}>
        <label className="form-label" htmlFor={`i_${k}`}>{text}</label>
        <input id={`i_${k}`} type="text" className="form-control form-control-sm" value={v[k] ?? ''} onChange={set(k)}
          {...(MONEY.has(k) ? { inputMode: 'decimal', autoComplete: 'off' } : {})} {...props} />
      </div>
    );
  };

  // Fields added through Customize, placed in the section chosen for them
  const extrasIn = (sec) => (custom.extra || []).filter((x) => (sec ? x.section === sec : !['Student', 'Payment'].includes(x.section)));
  const extraBox = (x) => (
    <div className="col-md-3" key={x.name}>
      <label className="form-label" htmlFor={`i_${x.name}`}>{x.label}</label>
      {x.type === 'select'
        ? (
          <select id={`i_${x.name}`} className="form-select form-select-sm" value={v[x.name] ?? ''} onChange={set(x.name)}>
            <option value="">Select</option>
            {(x.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )
        : <input id={`i_${x.name}`} className="form-control form-control-sm" value={v[x.name] ?? ''} onChange={set(x.name)} />}
    </div>
  );

  return (
    <Shell>
      <div className="card page-card inst-card">
        <div className="inst-card-head">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h1 className="page-title">{editing ? 'Edit Installment' : 'Add Installment'}</h1>
            <CustomizeButton pageKey="form-installment" title="installment form" mode="form" items={INSTALLMENT_FIELDS} />
          </div>
          {v.student_id && (
            <div className="inst-summary">
              <span>Total <strong>{fmtINR(lockedFee || v.total_fees)}</strong></span>
              <span>Paid before <strong>{fmtINR(paid)}</strong></span>
              <span className={balance > 0 ? 'due' : 'clear'}>Balance after <strong>{fmtINR(balance)}</strong></span>
            </div>
          )}
        </div>

        <DraftBanner draft={draft} />
        <form onSubmit={submit} className="inst-form-grid">
          <fieldset>
            <legend>Student</legend>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label" htmlFor="student_id">Student Name</label>
                <select id="student_id" className="form-select form-select-sm" required value={v.student_id} onChange={pickStudent} disabled={Boolean(studentId && !editing)}>
                  {!editing && <option value="">Select Student</option>}
                  {students.map((s) => <option key={s.student_id + s.id} value={s.student_id}>{s.student_name} </option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="i_class">Class</label>
                <input id="i_class" className="form-control form-control-sm auto" readOnly value={cls} placeholder="Auto" />
              </div>
              {field('col-md-3', 'Admission Number', 'admission_number')}
              {field('col-md-3', 'Mobile', 'phone', { inputMode: 'tel' })}
              {field('col-md-2', 'Admission Year', 'admission_year', { inputMode: 'numeric', maxLength: 4 })}
              {field('col-md-2', 'Admission Batch', 'admission_batch', { inputMode: 'numeric', maxLength: 1 })}
              {field('col-md-3', 'Register Number', 'register_number')}
            </div>
            {st && (
              <div className="stu-strip">
                {[
                  ['Father', st.father_name], ['Mother', st.mother_name], ['DOB', fmtDate(st.dob)], ['Gender', st.gender],
                  ['Board', st.board_id], ['Course', st.combination_id || st.course_id], ['Medium', normMedium(st.medium || st.puc_medium || st.sslc_medium)],
                  ['Batch', batchLabel(st.admission_batch)], ['Mobile 2', st.phone2], ['Email', st.email],
                ].filter(([, x]) => x).map(([k, x]) => <span key={k}><b>{k}</b>{x}</span>)}
              </div>
            )}
            {extrasIn('Student').length > 0 && <div className="row g-2 mt-1">{extrasIn('Student').map(extraBox)}</div>}
          </fieldset>

          <fieldset>
            <legend>Payment</legend>
            <div className="row g-2">
              {field('col-md-3', 'Total Fees', 'total_fees', lockedFee > 0 ? { readOnly: true, value: String(lockedFee), className: 'form-control form-control-sm auto', title: 'The student’s actual fee — change it on the student’s fee page' } : { placeholder: 'Student’s actual fee' })}
              <div className="col-md-2">
                <label className="form-label" htmlFor="installment_no">{lbl('installment_no', 'Payment No.')}</label>
                <input id="installment_no" type="text" inputMode="numeric" className={`form-control form-control-sm${editing ? '' : ' auto'}`}
                  value={instNo} readOnly={!editing} onChange={(e) => setV({ ...v, installment_no: cleanNum(e.target.value, false) })} />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="amount">{lbl('amount', 'Amount')}</label>
                <input id="amount" type="text" inputMode="decimal" autoComplete="off" className={`form-control form-control-sm${split ? ' auto' : ''}`}
                  readOnly={split} value={split ? amount.toFixed(2) : v.amount} onChange={set('amount')} />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="balance">{lbl('balance', 'Balance')}</label>
                <input id="balance" type="text" className="form-control form-control-sm auto" readOnly value={v.student_id ? balance.toFixed(2) : ''} />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="payment_date">{lbl('payment_date', 'Date')}</label>
                <input id="payment_date" type="date" className="form-control form-control-sm" value={v.payment_date || ''} onChange={set('payment_date')} />
              </div>
              {!off('payment_mode') && <div className="col-md-3">
                <label className="form-label" htmlFor="payment_mode">{lbl('payment_mode', 'Payment Mode')}</label>
                <select id="payment_mode" className="form-select form-select-sm" value={v.payment_mode} onChange={set('payment_mode')}>
                  {modes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>}
              <div className="col-md-3">
                <label className="form-label" htmlFor="next_payment_date">Next payment date <small className="text-muted fw-normal">(optional)</small></label>
                <input id="next_payment_date" type="date" className="form-control form-control-sm" value={v.next_payment_date || ''} onChange={set('next_payment_date')}
                  title="Only if the student says when they will pay next" disabled={!!v.student_id && balance <= 0} />
              </div>
              {!off('status') && <div className="col-md-2">
                <label className="form-label" htmlFor="status">{lbl('status', 'Status')}</label>
                <select id="status" className="form-select form-select-sm" value={v.status} onChange={set('status')}>
                  {(statusList.includes(v.status) || !v.status ? statusList : [...statusList, v.status]).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>}
              {showRef && field('col-md-4', v.payment_mode === 'Card' ? 'Reference / Card last 4 digits' : 'Reference / UTR', 'reference')}
              {split && (
                <>
                  {field('col-md-3', 'Cash Amount', 'cash_amount')}
                  {field('col-md-3', 'Online Amount', 'online_amount')}
                </>
              )}
              {extrasIn('Payment').map(extraBox)}
            </div>
          </fieldset>

          {extrasIn(null).length > 0 && (
            <fieldset>
              <legend>Additional Details</legend>
              <div className="row g-2">{extrasIn(null).map(extraBox)}</div>
            </fieldset>
          )}

          {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}

          <div className="d-flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : editing ? 'Update Installment' : 'Save Installment'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={goBack}>Cancel</button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
