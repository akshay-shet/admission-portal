import { useMemo } from 'react';
import DataTable from '../components/DataTable.jsx';
import TrackerButton, { trackerFor } from '../export/TrackerButton.jsx';
import { Shell, Link, useConfirm, useNav } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import { fmtAmt, fmt2, fmtINR, fmtDate, studentClass, feeSummary } from '../utils.js';
import { printReceipt } from '../components/printStatement.js';
import { useCustomization as useInstCustom } from '../components/Customize.jsx';
import CustomizeButton, { useCustomization, applyListCustom } from '../components/Customize.jsx';
import { INSTALLMENT_FIELDS } from './InstallmentForm.jsx';
import Icon from '../components/Icon.jsx';
import { currentRole } from '../os/permissions.js';
import { PageHead } from '../os/ui.jsx';

const TABLES = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'];

/** One row per student; every installment of that student is listed inside the row */
/* Extra filter (besides Board, Batch and Search): class */
const INST_FILTERS = [{ key: 'class', label: 'Class', value: (r) => studentClass(r.student_id) }];

export default function Installments() {
  const store = useStore();
  const { go } = useNav();
  const [ask, dialog] = useConfirm();
  const [instFormCfg] = useInstCustom('form-installment');
  const receiptExtras = (instFormCfg.extra || []).map((x) => ({ id: x.name, label: x.label }));
  const all = store.data.installments || [];

  const students = useMemo(() => {
    const m = {};
    for (const t of TABLES) for (const s of store.data[t] || []) m[s.student_id] = s;
    return m;
  }, [store.data]);

  const rows = useMemo(() => {
    const ids = [...new Set(all.map((r) => r.student_id))];
    return ids.map((sid) => {
      const st = students[sid];
      const sum = feeSummary(all, sid, store.data.discounts, st?.actual_fee);
      const last = sum.list[sum.list.length - 1] || {};
      return {
        id: sid,
        student_id: sid,
        student: st,
        summary: sum,
        admission_number: st?.admission_number || last.admission_number || '',
        student_name: st?.student_name || last.student_name || '',
        cls: studentClass(sid),
        board_id: st?.board_id || last.board_id || '',
        admission_batch: st?.admission_batch || last.admission_batch || '',
        created_at: sum.list[0]?.created_at || '',
      };
    });
  }, [all, students]);

  const openStudent = (r) => go({ page: 'inst-student', studentId: r.student_id });
  const delAll = async (r) => {
    const n = r.summary.list.length;
    if (await ask(`Delete all ${n} installment${n === 1 ? '' : 's'} of ${r.student_name}?`)) {
      for (const x of r.summary.list) await store.remove('installments', x.id);
    }
  };

  // Stacked values: one line per installment
  const lines = (r, f) => r.summary.list.map(f);
  const stack = (r, f) => <div className="stack">{lines(r, f).map((t, i) => <div key={i}>{t}</div>)}</div>;

  const columns = [
    { title: 'SL.no', value: (r, i) => i + 1, sortKey: (r) => r.created_at },
    {
      title: 'Admission Number', value: (r) => r.admission_number,
      render: (r) => (
        <button type="button" className="btn btn-link p-0 adm-link" onClick={() => openStudent(r)} title="Open this student's installments">
          {r.admission_number || r.student_id}
        </button>
      ),
    },
    { title: 'Student Name', value: (r) => r.student_name },
    { title: 'Class', value: (r) => r.cls },
    { title: 'Total Amount', value: (r) => fmtAmt(r.summary.total), render: (r) => fmtINR(r.summary.total), sortKey: (r) => r.summary.total, total: (r) => r.summary.total },
    {
      title: 'Installment Amount', value: (r) => lines(r, (x) => fmtAmt(x.amount)).join(', '), sortKey: (r) => r.summary.paid, total: (r) => r.summary.paid,
      render: (r) => stack(r, (x) => fmtINR(x.amount)),
    },
    {
      title: 'Date', value: (r) => lines(r, (x) => fmtDate(x.payment_date)).join(', '), sortKey: (r) => r.summary.list[r.summary.list.length - 1]?.payment_date || '',
      render: (r) => stack(r, (x) => fmtDate(x.payment_date)),
    },
    {
      title: 'Payment Mode', value: (r) => lines(r, (x) => x.payment_mode || '').join(', '),
      render: (r) => stack(r, (x) => x.payment_mode || ''),
    },
    { title: 'Balance', value: (r) => fmt2(r.summary.balance), render: (r) => <b className={r.summary.balance > 0 ? 'text-danger' : 'text-success'}>{fmtINR(r.summary.balance)}</b>, sortKey: (r) => r.summary.balance, total: (r) => r.summary.balance, money2: true },
    {
      title: 'Action', export: false, sortKey: false, value: () => '',
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openStudent(r)}>Edit</button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => printReceipt(r.student, r.summary, receiptExtras)}>Print</button>
          {currentRole() !== 'Employee' && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => delAll(r)}>Delete</button>}
        </div>
      ),
    },
  ];

  // Customize: renamed / hidden / reordered / added columns (SL.no and Action stay fixed)
  const [listCfg] = useCustomization('list-installments');
  const base = columns.slice(1, -1);
  const custom = applyListCustom(base, listCfg, (x) => ({
    title: x.title,
    key: x.key,
    value: (r) => {
      const last = r.summary.list[r.summary.list.length - 1] || {};
      return last[x.key] ?? r.student?.[x.key] ?? '';
    },
  }));
  const shown = [columns[0], ...custom, columns[columns.length - 1]];

  const sum = (list, f) => list.reduce((a, r) => a + f(r), 0);
  const footer = (page) => {
    const first = shown.findIndex((c) => c.total);
    if (first < 0) return null;
    return (
      <tr>
        <th colSpan={first} className="text-end">Total</th>
        {shown.slice(first).map((c, i) => (
          <th key={i}>{c.total ? fmtINR(sum(page, c.total)) : ''}</th>
        ))}
      </tr>
    );
  };

  return (
    <Shell>
      <PageHead title="Manage Installments" sub="Every student's payments in one place · totals and balance update automatically">
            <CustomizeButton pageKey="list-installments" title="installments list" mode="list"
              items={base.map((c) => ({ id: c.title, title: c.title }))}
              fieldChoices={INSTALLMENT_FIELDS.map((f) => ({ key: f.id, label: f.label }))} />
            <TrackerButton sheet="Payments" />
            <Link to={{ page: 'inst-add' }} className="btn btn-primary"><Icon name="plus" size={15} /> Add Installment</Link>
      </PageHead>
      <div className="card page-card">
        <div>
          <DataTable
            key={shown.map((c) => c.title).join('|')}
            id="installmentsTable"
            columns={shown}
            rows={rows}
            order={[2, 'asc']}
            className="table table-hover"
            footer={footer}
            title="Installments"
            onTracker={currentRole() === 'Employee' ? undefined : () => trackerFor(store.data, 'Payments')}
            extraFilters={INST_FILTERS}
          />
        </div>
      </div>
      {dialog}
    </Shell>
  );
}
