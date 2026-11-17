/* Academy OS pages: dashboards, directories, finance views and management screens */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { useNav } from '../components/Layout.jsx';
import { fmtDate, studentClass, feeSummary, LEVELS, storeUpload, fileUrl, isReceived, fmtDateTime } from '../utils.js';
import { printReceipt } from '../components/printStatement.js';
import { PageHead, Metric, Chip, Card, BarList, Columns, Line, Drawer, OSTable, Modal } from './ui.jsx';
import Records, { RecordFields } from './Records.jsx';
import { MODULES } from './modules.js';
import { allStudents, feeAccount, INR, TODAY, monthKey, monthLabel, lastMonths, exportXlsx, dueStatus, num, isoDate } from './data.js';
import { canMoney, permitted, ROLES, isOwner, OWNER_ONLY, OS_TITLES, employeeMayChangePayment, employeeMayChangeDiscount } from './permissions.js';
import { academySettings, computeAlerts } from './summary.js';
import { DEFAULT_BRAND } from '../components/Layout.jsx';
import FeeSchedule from './FeeSchedule.jsx';
import TrackerButton from '../export/TrackerButton.jsx';
import Icon from '../components/Icon.jsx';
import { notify } from '../components/toast.jsx';

const LEVEL_OF = { SSLC: 'sslc', 'PUC Science': 'puc', 'PUC Commerce': 'puc', 'PUC Arts': 'puc', Degree: 'degree', PG: 'pg' };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function useOS() {
  const store = useStore();
  const nav = useNav();
  const students = useMemo(() => allStudents(store.data), [store.data]);
  const accounts = useMemo(() => students.map((s) => ({ ...s, fee: feeAccount(store.data, s) })), [students, store.data]);
  return { store, data: store.data, nav, role: nav.role, money: canMoney(nav.role), students, accounts };
}

/* ------------------------------------------------------------------ Dashboard */
export function Overview() {
  const { data, nav, money, students, accounts } = useOS();
  const tot = accounts.reduce((a, s) => ({ fees: a.fees + s.fee.total, paid: a.paid + s.fee.paid, due: a.due + s.fee.balance }), { fees: 0, paid: 0, due: 0 });
  const byLevel = ['sslc', 'puc', 'degree', 'pg'].map((l) => [LEVELS[l].label, students.filter((s) => s.level === l).length]);
  const byProgram = Object.entries(students.reduce((m, s) => ({ ...m, [s.program]: (m[s.program] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([n, v]) => [n, v, `${v} student${v === 1 ? '' : 's'}`]);
  const months = lastMonths(6);
  const inst = (data.installments || []).filter(isReceived); // money actually received
  const coll = months.map((m) => ({ label: monthLabel(m), a: inst.filter((r) => monthKey(r.payment_date) === m).reduce((x, r) => x + num(r.amount), 0),
    b: (data.expenses || []).filter((r) => monthKey(r.expense_date) === m && ['Approved', 'Paid'].includes(r.status)).reduce((x, r) => x + num(r.amount), 0) }));
  const cohorts = Object.entries(students.reduce((m, s) => ({ ...m, [s.cohort]: (m[s.cohort] || 0) + 1 }), {})).sort((a, b) => b[0].localeCompare(a[0]));
  const overdue = accounts.filter((s) => s.fee.followUp); // pay as you go: their own next payment date has passed
  const pendDocs = (data.documents || []).filter((d) => ['Pending', 'Missing'].includes(d.verification));
  const follow = (data.enquiries || []).filter((e) => e.follow_up && e.follow_up <= TODAY() && !['Converted', 'Closed'].includes(e.status));
  const pendAppr = [...(data.approvals || []), ...(data.discounts || []), ...(data.expenses || []).filter((e) => ['Submitted', 'Pending'].includes(e.status))].filter((x) => ['Pending', 'Submitted'].includes(x.status));
  const quick = (money
    ? [['Student Directory', { page: 'os', key: 'all-students' }], ['Collect Fee', { page: 'inst-add' }], ['Pending Balances', { page: 'os', key: 'pending-fees' }], ['Receipts', { page: 'os', key: 'payments' }], ['Finance Reports', { page: 'os', key: 'finance-reports' }], ['System Map', { page: 'os', key: 'system-map' }]]
    : [['New Enquiry', { page: 'os', key: 'enquiries' }], ['Add Student', { page: 'os', key: 'new-admission' }], ['Student Directory', { page: 'os', key: 'all-students' }], ['Documents', { page: 'os', key: 'documents' }], ['Examinations', { page: 'os', key: 'exams' }], ['System Map', { page: 'os', key: 'system-map' }]]
  ).filter(([, r]) => permitted(r.page === 'os' ? r.key : 'collect', nav.role));
  const alert = (cls, title, note, to) => (
    <div className="os-alert" key={title}>
      <span className={`os-dot ${cls}`} />
      <div className="flex-grow-1"><strong>{title}</strong><div className="os-sub">{note}</div></div>
      {to && permitted(to.key, nav.role) && <button type="button" className="btn btn-sm btn-link" onClick={() => nav.go(to)}>Open</button>}
    </div>
  );
  return (
    <>
      <PageHead title="Academy Dashboard" sub={money ? 'Students, admissions and financial position at a glance' : 'Admissions, students and operational priorities'}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go({ page: 'os', key: 'all-students' })}>Student Directory</button>
        {money && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav.go({ page: 'inst-add' })}>Collect Fee</button>}
        <TrackerButton sheet="Summary" className="btn btn-outline-success btn-sm" label="Download Excel Tracker" />
      </PageHead>
      <div className={`os-grid ${money ? 'five' : 'four'} mb-3`}>
        <Metric label="Total students" value={students.length} note={byLevel.map(([n, v]) => `${v} ${n}`).join(' · ')} />
        {money ? <>
          <Metric label="Actual fees" value={INR(tot.fees)} note="From fee records" em />
          <Metric label="Collected" value={INR(tot.paid)} note={`${inst.length} payment${inst.length === 1 ? '' : 's'} recorded`} />
          <Metric label="Outstanding fees" value={INR(tot.due)} note={`${overdue.length} follow-up${overdue.length === 1 ? '' : 's'} due`} />
        </> : <>
          <Metric label="Open enquiries" value={(data.enquiries || []).filter((e) => !['Converted', 'Closed'].includes(e.status)).length} note="Not yet admitted" />
          <Metric label="Documents pending" value={pendDocs.length} note="Pending or missing" />
        </>}
        <Metric label="This month's admissions" value={students.filter((s) => monthKey(s.created_at) === monthKey(TODAY())).length} note={monthLabel(monthKey(TODAY()))} />
      </div>
      <div className="os-grid two">
        <Card title="Course-wise Student Distribution"><BarList rows={byProgram} /></Card>
        {money
          ? <Card title="Collections vs Expenses (last 6 months)"><Columns rows={coll} aLabel="Collected" bLabel="Expenses" fmt={INR} /></Card>
          : <Card title="Admission Cohorts">{cohorts.length ? cohorts.map(([c, n]) => <Line key={c} k={c} v={`${n} student${n === 1 ? '' : 's'}`} />) : <div className="os-empty">No students yet</div>}</Card>}
      </div>
      <div className="os-grid two mt-3">
        <Card title="Attention Required">
          {money && alert('red', 'Payment follow-ups due', `${overdue.length} student(s) · ${INR(overdue.reduce((a, s) => a + (s.fee.overdue || 0), 0))} still owed after their promised payment date`, { page: 'os', key: 'pending-fees' })}
          {money && (() => { const pv = (data.installments || []).filter((r) => r.status === 'Pending'); return alert('', 'Payments to verify', `${pv.length} payment(s) · ${INR(pv.reduce((a, r) => a + num(r.amount), 0))} awaiting your check — not counted until verified`, { page: 'os', key: 'payments' }); })()}
          {alert('', 'Documents to verify', `${pendDocs.length} document record(s) pending or missing`, { page: 'os', key: 'documents' })}
          {alert('', 'Enquiry follow-ups due', `${follow.length} enquiry follow-up(s) due today or earlier`, { page: 'os', key: 'enquiries' })}
          {alert('green', 'Approvals waiting', `${pendAppr.length} request(s) waiting for a decision`, { page: 'os', key: 'approvals' })}
        </Card>
        <Card title="Quick Operations">
          <div className="os-grid two">{quick.map(([n, r]) => <button type="button" key={n} className="btn btn-outline-secondary btn-sm" onClick={() => nav.go(r)}>{n}</button>)}</div>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Admissions */
export function Enquiries() {
  const { store, nav } = useOS();
  const admit = async (r) => {
    await store.update('enquiries', r.id, { status: 'Converted' });
    nav.go({ page: 'student-add', level: LEVEL_OF[r.interest] || 'sslc', prefill: { student_name: r.name || '', mobile: r.mobile || '', father_name: r.guardian || '' } });
  };
  const all = store.data.enquiries || [];
  return (
    <>
      <PageHead title="Enquiries" sub="Manage student enquiries and turn qualified enquiries into admissions" />
      <div className="os-grid four mb-3">
        {['New', 'Contacted', 'Follow-up', 'Converted'].map((s) => <Metric key={s} label={s} value={all.filter((e) => e.status === s).length} />)}
      </div>
      <Records cfg={MODULES.enquiries}
        extraActions={(r) => !['Converted', 'Closed'].includes(r.status) && <>
          {r.status === 'New' && <QuickSet collection="enquiries" r={r} patch={{ status: 'Contacted' }} label="Contacted" />}
          {permitted('new-admission', nav.role) && <button type="button" className="btn btn-sm btn-success" onClick={() => admit(r)}>Admit</button>}
        </>} />
    </>
  );
}

export function NewAdmission() {
  const { data, nav, students, store } = useOS();
  const open = (data.enquiries || []).filter((e) => !['Converted', 'Closed'].includes(e.status));
  return (
    <>
      <PageHead title="New Student Admission" sub="Pick the level; the student is entered once and linked to the course lists, fee tracking and reports">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav.go({ page: 'os', key: 'all-students' })}>Back to Students</button>
      </PageHead>
      <div className="os-grid four mb-3">
        {['sslc', 'puc', 'degree', 'pg'].map((l) => (
          <button type="button" key={l} className="os-card os-levelcard" onClick={() => nav.go({ page: 'student-add', level: l })}>
            <span className="os-levelicon"><Icon name="plus" size={16} /></span>
            <b>{LEVELS[l].label} Admission</b>
            <small>{students.filter((s) => s.level === l).length} students so far</small>
          </button>
        ))}
      </div>
      <div className="os-grid two">
        <Card title="Admission Stages">
          {['Student Details', 'Previous Qualification', 'Course Details', 'Documents', 'Admission number (automatic)', 'Fee plan & installments'].map((x, i) => <Line key={x} k={`${i + 1}. ${x}`} v="" />)}
        </Card>
        <Card title={`Open Enquiries (${open.length})`}>
          {open.length ? open.slice(0, 8).map((e) => (
            <div className="os-line" key={e.id}>
              <span><b>{e.name}</b> <span className="os-sub">· {e.interest || 'Program not set'} · {e.mobile}</span></span>
              <button type="button" className="btn btn-sm btn-success" onClick={async () => { await store.update('enquiries', e.id, { status: 'Converted' }); nav.go({ page: 'student-add', level: LEVEL_OF[e.interest] || 'sslc', prefill: { student_name: e.name || '', mobile: e.mobile || '', father_name: e.guardian || '' } }); }}>Admit</button>
            </div>
          )) : <div className="os-empty">No open enquiries</div>}
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Students */
function StudentDrawer({ s, onClose }) {
  const { data, nav, money } = useOS();
  const fee = feeAccount(data, s);
  const docs = (data.documents || []).filter((d) => d.student_id === s.student_id);
  const exams = (data.exams || []).filter((d) => d.student_id === s.student_id);
  const [tab, setTab] = useState('overview');
  const tabs = [['overview', 'Overview'], ...(money ? [['fees', `Payments (${fee.list.length})`], ['schedule', 'Fee & payments']] : []), ['docs', `Documents (${docs.length})`], ['exams', `Exams (${exams.length})`]];
  return (
    <Drawer title={s.student_name} sub={`${s.admission_number || s.student_id} · ${s.program}`} onClose={onClose}>
      {money && <div className="os-grid three mb-3"><Metric label="Actual fee" value={INR(fee.total)} note={fee.adj ? `Discount ${INR(fee.adj)}` : undefined} /><Metric label="Total fee" value={INR(Math.max(0, fee.total - fee.adj))} /><Metric label="Balance" value={INR(fee.balance)} em /></div>}
      <div className="os-tabs">{tabs.map(([k, l]) => <button type="button" key={k} className={`os-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'overview' && <>
        <Line k="Student ID" v={s.student_id} /><Line k="Level" v={s.levelLabel} /><Line k="Program" v={s.program} />
        <Line k="Cohort" v={s.cohort} /><Line k="Mobile" v={s.mobile || '—'} /><Line k="Father" v={s.father_name || '—'} />
        {money && <><Line k="Fee status" v={<Chip t={fee.status} />} /><Line k="Paid" v={INR(fee.paid)} /><Line k="Last payment" v={fmtDate(fee.last) || '—'} /><Line k="Next payment" v={fee.next ? <>{fmtDate(fee.next)} {fee.followUp && <Chip t="Follow-up due" />}</> : '—'} /></>}
      </>}
      {tab === 'fees' && (fee.list.length ? fee.list.map((r) => <Line key={r.id} k={`Payment ${r.installment_no || ''} · ${fmtDate(r.payment_date)} · ${r.payment_mode || ''}${r.status && r.status !== 'Paid' ? ` · ${r.status}` : ''}`} v={INR(r.amount)} />) : <div className="os-empty">No payments yet</div>)}
      {tab === 'schedule' && <FeeSchedule student={s} compact />}
      {tab === 'docs' && (docs.length ? docs.map((d) => <Line key={d.id} k={d.document} v={<Chip t={d.verification} />} />) : <div className="os-empty">No document records</div>)}
      {tab === 'exams' && (exams.length ? exams.map((d) => <Line key={d.id} k={`${d.exam} · ${fmtDate(d.exam_date)}`} v={<Chip t={d.result} />} />) : <div className="os-empty">No exam records</div>)}
      <div className="os-drawerfoot">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav.go({ page: 'student-edit', level: s.level, id: s.id })}>Edit student</button>
        {money && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => nav.go({ page: 'inst-student', studentId: s.student_id })}>Fee page</button>}
        {money && <button type="button" className="btn btn-sm btn-primary" onClick={() => nav.go({ page: 'inst-add', studentId: s.student_id, back: { page: 'os', key: 'all-students' } })}>Record payment</button>}
      </div>
    </Drawer>
  );
}

const DIR_FILTERS = (money, feeView) => (feeView && money
  ? [{ label: 'Fee statuses', get: (s) => s.fee.status }]   // Fee Accounts: program + fee status
  : [{ label: 'Levels', get: (s) => s.levelLabel }]);       // All Students: program + level

function StudentDirectory({ title, sub, feeView }) {
  const { nav, money, accounts } = useOS();
  const [open, setOpen] = useState(null);
  const view = (s) => <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setOpen(s)}>{s.admission_number || s.student_id}</button>;
  const columns = [
    { title: 'SL.no', value: (r, i) => i + 1, export: false },
    { title: 'Admission no', value: (s) => s.admission_number || s.student_id, render: view },
    { title: 'Student', value: (s) => s.student_name, render: (s) => <b>{s.student_name}</b> },
    { title: 'Level', value: (s) => s.levelLabel },
    { title: 'Program', value: (s) => s.program },
    { title: 'Cohort', value: (s) => s.cohort },
    { title: 'Mobile', value: (s) => s.mobile || '' },
    ...(money && isOwner(nav.role) ? [
      { title: 'Actual fee', value: (s) => INR(s.fee.total) }, { title: 'Discount', value: (s) => INR(s.fee.adj) }, { title: 'Total fee', value: (s) => INR(Math.max(0, s.fee.total - s.fee.adj)) },
      { title: 'Paid', value: (s) => INR(s.fee.paid) },
      { title: 'Balance', value: (s) => INR(s.fee.balance), render: (s) => <b>{INR(s.fee.balance)}</b> },
      ...(feeView ? [{ title: 'Payments', value: (s) => s.fee.count, sortValue: (s) => s.fee.count }, { title: 'Last payment', value: (s) => fmtDate(s.fee.last), sortValue: (s) => s.fee.last || '' }, { title: 'Next payment', value: (s) => fmtDate(s.fee.next), sortValue: (s) => s.fee.next || '9999' }] : []),
      { title: 'Status', value: (s) => s.fee.status, render: (s) => <Chip t={s.fee.status} /> },
    ] : [{ title: 'Status', value: () => 'Active', render: () => <Chip t="Active" /> }]),
    { title: 'Action', export: false, value: () => '', render: (s) => <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOpen(s)}>View</button> },
  ];
  const lv = (l) => accounts.filter((s) => s.level === l).length;
  const rows = [...accounts].sort((a, b) => String(a.student_name).localeCompare(String(b.student_name)));
  return (
    <>
      <PageHead title={title} sub={sub}>
        <TrackerButton sheet="Total Student List" className="btn btn-outline-success btn-sm" />
        {permitted('new-admission', nav.role) && <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go({ page: 'os', key: 'new-admission' })}><Icon name="plus" size={14} /> New Admission</button>}
      </PageHead>
      <div className="os-grid five mb-3">
        <Metric label="All students" value={accounts.length} />
        {['sslc', 'puc', 'degree', 'pg'].map((l) => <Metric key={l} label={LEVELS[l].label} value={lv(l)} />)}
      </div>
      <OSTable columns={columns} rows={rows} name={title} filterBy={(s) => s.program} filterLabel="All programs" initialQuery={nav.route.q || ''}
        filters={DIR_FILTERS(money, feeView)}
        extraTools={feeView ? null : undefined} empty="No students yet" />
      {open && <StudentDrawer s={open} onClose={() => setOpen(null)} />}
    </>
  );
}
export const AllStudents = () => <StudentDirectory title="All Students" sub="One master directory across SSLC, PUC, Degree and PG. Click an admission number for the 360° profile." />;
export const FeeAccounts = () => <StudentDirectory title="Student Fee Accounts" sub="Actual fee, discount, total fee, collected amount and balance for every student" feeView />;

export function Documents() {
  const { data } = useOS();
  const all = data.documents || [];
  return (
    <>
      <PageHead title="Student Documents" sub="Collect and verify admission documents for every student" />
      <div className="os-grid four mb-3">{['Pending', 'Verified', 'Rejected', 'Missing'].map((s) => <Metric key={s} label={s} value={all.filter((d) => d.verification === s).length} />)}</div>
      <Records cfg={MODULES.documents} extraActions={(r) => r.verification !== 'Verified' && <QuickSet collection="documents" r={r} patch={{ verification: 'Verified', verified_on: TODAY() }} label="Verify" />} />
    </>
  );
}

export function Exams() {
  const { data } = useOS();
  const all = data.exams || [];
  return (
    <>
      <PageHead title="Examinations" sub="Registration, exam schedule, hall tickets and results by student" />
      <div className="os-grid four mb-3">
        <Metric label="Exam records" value={all.length} />
        <Metric label="Registration pending" value={all.filter((d) => d.registration === 'Pending').length} />
        <Metric label="Passed" value={all.filter((d) => d.result === 'Pass').length} />
        <Metric label="Results awaited" value={all.filter((d) => d.result === 'Awaited').length} />
      </div>
      <Records cfg={MODULES.exams} />
    </>
  );
}

/* ------------------------------------------------------------------ Finance */
export function FeeDashboard() {
  const { data, nav, accounts } = useOS();
  const [period, setPeriod] = useState('');
  const t = accounts.reduce((a, s) => ({ fees: a.fees + s.fee.total, paid: a.paid + s.fee.paid, due: a.due + s.fee.balance, adj: a.adj + s.fee.adj, over: a.over + (s.fee.overdue || 0) }), { fees: 0, paid: 0, due: 0, adj: 0, over: 0 });
  const recv = (data.installments || []).filter(isReceived);
  const months = [...new Set(recv.map((r) => monthKey(r.payment_date)).filter(Boolean))].sort().reverse();
  const inPeriod = recv.filter((r) => !period || monthKey(r.payment_date) === period);
  const sumOf = (xs) => xs.reduce((a, r) => a + num(r.amount), 0);
  const cash = sumOf(inPeriod.filter((r) => r.payment_mode === 'Cash'));
  const exp = (data.expenses || []).filter((e) => ['Approved', 'Paid'].includes(e.status) && (!period || monthKey(e.expense_date) === period)).reduce((a, e) => a + num(e.amount), 0);
  const modes = Object.entries(inPeriod.reduce((m, r) => ({ ...m, [r.payment_mode || 'Other']: (m[r.payment_mode || 'Other'] || 0) + num(r.amount) }), {}));
  const byMonth = [...months].reverse().slice(-6).map((m) => ({ label: monthLabel(m), a: sumOf(recv.filter((r) => monthKey(r.payment_date) === m)) }));
  const courses = Object.entries(accounts.reduce((m, s) => {
    const c = (m[s.program] ||= { n: 0, fees: 0, paid: 0, due: 0, over: 0 }); c.n++; c.fees += s.fee.total; c.paid += s.fee.paid; c.due += s.fee.balance; c.over += s.fee.overdue || 0; return m;
  }, {})).sort((a, b) => a[0].localeCompare(b[0]));
  const rate = t.fees ? Math.round((t.paid / t.fees) * 100) : 0;
  return (
    <>
      <PageHead title="Fee & Finance Dashboard" sub="Pay as you go — collections, outstanding fees and payment follow-ups in one place">
        <select className="form-select form-select-sm" style={{ width: 'auto' }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Collections period">
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go({ page: 'inst-add' })}>Receive Fee</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav.go({ page: 'os', key: 'finance-reports' })}>Open Reports</button>
        <TrackerButton sheet="Summary" className="btn btn-outline-success btn-sm" />
      </PageHead>
      <div className="os-grid five mb-3">
        <Metric label={period ? `Collected in ${monthLabel(period)}` : 'Collected (all time)'} value={INR(sumOf(inPeriod))} note={`${inPeriod.length} verified payment(s)`} em />
        <Metric label="Cash" value={INR(cash)} note="Payment date in the period" />
        <Metric label="Digital" value={INR(sumOf(inPeriod) - cash)} note="UPI · card · bank transfer" />
        <Metric label="Outstanding (all time)" value={INR(t.due)} note={`After ${INR(t.adj)} approved discounts`} />
        <Metric label="Follow-ups due" value={INR(t.over)} note={`${accounts.filter((s) => s.fee.followUp).length} student(s) past their promised date`} />
      </div>
      <div className="os-grid three">
        <Card title="Collection performance">
          <div className="fee-ring" style={{ '--p': rate }}><b>{rate}%</b><span>collected</span></div>
          <Line k="Actual fees" v={INR(t.fees)} /><Line k="Collected" v={INR(t.paid)} /><Line k="Outstanding" v={INR(t.due)} />
          <Line k={period ? 'Expenses in period' : 'Expenses (approved / paid)'} v={INR(exp)} />
        </Card>
        <Card title="Collections by payment month"><Columns rows={byMonth} aLabel="Collected" fmt={INR} /></Card>
        <Card title={`By payment mode${period ? ` · ${monthLabel(period)}` : ''}`}><BarList rows={modes.map(([m, v]) => [m, v, INR(v)])} /></Card>
      </div>
      <div className="mt-3">
        <Card title="Course fee summary" pad={false}>
          <table className="table os-table mb-0"><thead><tr><th>Course</th><th className="text-end">Students</th><th className="text-end">Actual fee</th><th className="text-end">Collected</th><th className="text-end">Outstanding</th><th className="text-end">Follow-up due</th></tr></thead>
            <tbody>{courses.map(([c, v]) => <tr key={c}><td>{c}</td><td className="text-end">{v.n}</td><td className="text-end">{INR(v.fees)}</td><td className="text-end">{INR(v.paid)}</td><td className="text-end"><b>{INR(v.due)}</b></td><td className={`text-end${v.over > 0 ? ' text-danger fw-bold' : ''}`}>{INR(v.over)}</td></tr>)}
              {!courses.length && <tr><td colSpan={6} className="os-empty">No students yet</td></tr>}</tbody>
            {courses.length > 0 && <tfoot><tr><th>Total</th><th className="text-end">{accounts.length}</th><th className="text-end">{INR(t.fees)}</th><th className="text-end">{INR(t.paid)}</th><th className="text-end">{INR(t.due)}</th><th className="text-end text-danger">{INR(t.over)}</th></tr></tfoot>}
          </table>
        </Card>
        <div className="os-sub mt-2">This dashboard tracks student fees and collections. Pending and rejected payments are not counted. It does not show bank balances or profit.</div>
      </div>
    </>
  );
}

/* Give a student the fee of a plan (pay as you go: just the actual fee — no installments are created) */
function ApplyFee({ onClose }) {
  const { store, data, role } = useOS();
  const plans = (data.fee_plans || []).filter((p) => p.status !== 'Inactive');
  const [v, setV] = useState({ plan: plans[0]?.id || '' });
  const plan = plans.find((p) => p.id === v.plan);
  const [err, setErr] = useState('');
  const s = v.student_id ? allStudents(data).find((x) => x.student_id === v.student_id) : null;
  const cur = s ? feeAccount(data, s).total : 0;
  const go = async () => {
    if (!s || !plan) { setErr('Choose a student and a fee plan'); return; }
    if (num(plan.total) <= 0) { setErr('This fee plan has no fee. Edit the plan first.'); return; }
    if (!isOwner(role) && cur > 0) { setErr('This student already has a fee. Only the owner can change it.'); return; }
    const L = LEVELS[s.level];
    if (await store.update(L.table, s.id, { actual_fee: num(plan.total), fee_plan: plan.plan })) { notify(`${s.student_name}: actual fee set to ${INR(plan.total)}`); onClose(); }
  };
  return (
    <Modal title="Apply a fee plan to a student" onClose={onClose}
      footer={<>{err && <span className="text-danger me-auto small">{err}</span>}<button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary btn-sm" onClick={go}>Apply fee</button></>}>
      {!plans.length ? <div className="os-empty">Add a fee plan first.</div> : <>
        <RecordFields data={data} v={v} setV={setV} fields={[
          { name: 'student', label: 'Student', type: 'student', full: true },
          { name: 'plan', label: 'Fee plan', type: 'select', options: plans.map((p) => ({ value: p.id, label: `${p.plan} · ${INR(p.total)}` })) },
        ]} />
        <div className="os-sub mt-2">Pay as you go: the student's actual fee becomes {plan ? INR(plan.total) : '—'}. They pay any amount whenever they can; no installments are fixed.</div>
        {s && cur > 0 && <div className="text-warning small mt-1">{s.student_name} already has an actual fee of {INR(cur)}{isOwner(role) ? '; it will be replaced.' : '.'}</div>}
      </>}
    </Modal>
  );
}

export function FeePlans() {
  const { data, role } = useOS();
  const owner = isOwner(role);
  const [apply, setApply] = useState(false);
  return (
    <>
      <PageHead title="Fee Plans" sub="Standard fees for each program. Pay as you go — a plan sets a student's actual fee; there are no fixed installments.">
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setApply(true)}><Icon name="layers" size={14} /> Apply plan to a student</button>
      </PageHead>
      {!owner && <div className="os-note mb-3"><Icon name="info" size={15} /> Fee plan prices are set by the owner. You can apply a plan to a student who has no fee yet.</div>}
      <Records cfg={MODULES.fee_plans} readOnly={!owner} />
      {apply && <ApplyFee onClose={() => setApply(false)} />}
    </>
  );
}
export function Payments() {
  const { data, nav, students, store, role } = useOS();
  const owner = isOwner(role);
  const byId = Object.fromEntries(students.map((s) => [s.student_id, s]));
  const rows = useMemo(() => {
    const sorted = [...(data.installments || [])].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const pre = academySettings(data).receipt_prefix || 'RCPT-';
    let no = 0; // receipt numbers go only to verified (received) payments
    return sorted.map((r) => ({ ...r, receipt: isReceived(r) ? `${pre}${String(++no).padStart(4, '0')}` : r.status === 'Pending' ? 'Awaiting verification' : '—' })).reverse();
  }, [data]);
  const received = rows.filter(isReceived);
  const total = received.reduce((a, r) => a + num(r.amount), 0);
  const thisMonth = received.filter((r) => monthKey(r.payment_date) === monthKey(TODAY())).reduce((a, r) => a + num(r.amount), 0);
  const columns = [
    { title: 'Receipt', value: (r) => r.receipt },
    { title: 'Student', value: (r) => r.student_name || byId[r.student_id]?.student_name || '' },
    { title: 'Admission no', value: (r) => r.admission_number || byId[r.student_id]?.admission_number || '' },
    { title: 'Class', value: (r) => studentClass(r.student_id) },
    { title: 'Date', value: (r) => fmtDate(r.payment_date), sortValue: (r) => isoDate(r.payment_date) },
    { title: 'Installment', value: (r) => r.installment_no || '' },
    { title: 'Mode', value: (r) => r.payment_mode || '' },
    { title: 'Reference', value: (r) => r.reference || '' },
    { title: 'Amount', value: (r) => INR(r.amount), render: (r) => <b>{INR(r.amount)}</b> },
    { title: 'Status', value: (r) => r.status || 'Paid', render: (r) => <Chip t={r.status || 'Paid'} /> },
    { title: 'Action', export: false, value: () => '', render: (r) => (
      <div className="row-actions">
        {r.status === 'Pending' && owner && <>
          <button type="button" className="btn btn-sm btn-success" title="I checked the bank / cash record and the money was received" onClick={() => store.update('installments', r.id, { status: 'Paid', verified_at: new Date().toISOString() })}>Verify</button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => store.update('installments', r.id, { status: 'Rejected', verified_at: new Date().toISOString() })}>Reject</button>
        </>}
        {isReceived(r) && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => printReceipt(byId[r.student_id], feeSummary(data.installments || [], r.student_id, data.discounts, byId[r.student_id]?.actual_fee))}>Receipt</button>}
        {(owner || employeeMayChangePayment(r)) && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav.go({ page: 'inst-edit', id: r.id, back: { page: 'os', key: 'payments' } })}>Edit</button>}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav.go({ page: 'inst-student', studentId: r.student_id })}>Open</button>
      </div>
    ) },
  ];
  return (
    <>
      <PageHead title="Payments & Receipts" sub="Every installment payment with a sequential receipt number and printable receipt">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go({ page: 'inst-add' })}><Icon name="plus" size={14} /> Collect Fee</button>
      </PageHead>
      <div className="os-grid four mb-3">
        <Metric label="Payments" value={rows.length} em={!owner} />
        {owner ? <Metric label="Total collected" value={INR(total)} em /> : <Metric label="Receipts issued" value={received.length} />}
        {owner ? <Metric label="This month" value={INR(thisMonth)} note={monthLabel(monthKey(TODAY()))} /> : <Metric label="Received this month" value={received.filter((r) => monthKey(r.payment_date) === monthKey(TODAY())).length} note={monthLabel(monthKey(TODAY()))} />}
        <Metric label="Awaiting verification" value={rows.filter((r) => r.status === 'Pending').length} note={owner ? `${INR(rows.filter((r) => r.status === 'Pending').reduce((a, r) => a + num(r.amount), 0))} · not counted yet` : 'The owner checks and verifies these'} />
      </div>
      <OSTable columns={columns} rows={rows} name="Payments & Receipts" filterBy={(r) => r.payment_mode} filterLabel="All modes" empty="No payments yet"
        filters={[{ label: 'Statuses', get: (r) => r.status || 'Paid' }]} />
    </>
  );
}

const waNumber = (m) => { const d = String(m).replace(/\D/g, ''); return d.length === 10 ? `91${d}` : d; };

export function PendingFees() {
  const { nav, accounts } = useOS();
  const rows = accounts.filter((s) => s.fee.balance > 0)
    .sort((a, b) => (b.fee.followUp - a.fee.followUp) || ((b.fee.daysSince ?? 9999) - (a.fee.daysSince ?? 9999)) || b.fee.balance - a.fee.balance);
  const sum = (xs) => INR(xs.reduce((a, s) => a + s.fee.balance, 0));
  const quiet = (s) => s.fee.daysSince === null || s.fee.daysSince > 30; // no payment in the last 30 days
  const columns = [
    { title: 'SL.no', value: (r, i) => i + 1, export: false },
    { title: 'Student', value: (s) => s.student_name, render: (s) => <b>{s.student_name}</b> },
    { title: 'Admission no', value: (s) => s.admission_number || s.student_id },
    { title: 'Program', value: (s) => s.program },
    { title: 'Mobile', value: (s) => s.mobile || '' },
    { title: 'Total fee', value: (s) => INR(s.fee.net), sortValue: (s) => s.fee.net },
    { title: 'Paid', value: (s) => INR(s.fee.paid), sortValue: (s) => s.fee.paid },
    { title: 'Balance', value: (s) => INR(s.fee.balance), sortValue: (s) => s.fee.balance, render: (s) => <b>{INR(s.fee.balance)}</b> },
    { title: 'Paid %', value: (s) => `${s.fee.paidPct}%`, sortValue: (s) => s.fee.paidPct, render: (s) => <span className="payg-mini"><span style={{ width: `${Math.min(100, s.fee.paidPct)}%` }} /><em>{s.fee.paidPct}%</em></span> },
    { title: 'Payments', value: (s) => s.fee.count, sortValue: (s) => s.fee.count },
    { title: 'Last payment', value: (s) => (s.fee.last ? fmtDate(s.fee.last) : 'Never'), sortValue: (s) => s.fee.last || '' },
    { title: 'Days since', value: (s) => (s.fee.daysSince === null ? '' : s.fee.daysSince), sortValue: (s) => s.fee.daysSince ?? 99999,
      render: (s) => (s.fee.daysSince === null ? '—' : <span className={s.fee.daysSince > 30 ? 'text-danger fw-bold' : ''}>{s.fee.daysSince}</span>) },
    { title: 'Next payment', value: (s) => fmtDate(s.fee.next) || '—', sortValue: (s) => s.fee.next || '9999' },
    { title: 'Status', value: (s) => s.fee.status, render: (s) => <Chip t={s.fee.status} /> },
    { title: 'Action', export: false, value: () => '', render: (s) => (
      <div className="row-actions">
        <button type="button" className="btn btn-sm btn-success" onClick={() => nav.go({ page: 'inst-add', studentId: s.student_id, back: { page: 'os', key: 'pending-fees' } })}>Collect</button>
        {s.mobile && <a className="btn btn-sm btn-outline-secondary" href={`tel:${s.mobile}`}>Call</a>}
        {s.mobile && <a className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer" title="Send a fee reminder on WhatsApp"
          href={`https://wa.me/${waNumber(s.mobile)}?text=${encodeURIComponent(`Dear parent, this is a gentle reminder that ${INR(s.fee.balance)} is still pending towards the fees of ${s.student_name}${s.fee.next ? ` (you planned to pay on ${fmtDate(s.fee.next)})` : ''}. You can pay any amount that suits you. Thank you.`)}`}>WhatsApp</a>}
      </div>
    ) },
  ];
  return (
    <>
      <PageHead title="Pending Fees" sub="Pay as you go — who still owes, how much they have paid and when they last paid. Follow-ups due first." />
      <div className="os-grid four mb-3">
        <Metric label="Students with balance" value={rows.length} note={sum(rows)} em />
        <Metric label="Follow-ups due" value={rows.filter((s) => s.fee.followUp).length} note={`${sum(rows.filter((s) => s.fee.followUp))} · promised date passed`} />
        <Metric label="No payment in 30+ days" value={rows.filter(quiet).length} note={sum(rows.filter(quiet))} />
        <Metric label="Never paid" value={rows.filter((s) => !s.fee.count).length} note={sum(rows.filter((s) => !s.fee.count))} />
      </div>
      <OSTable columns={columns} rows={rows} name="Pending Fees" filterBy={(s) => s.fee.status} empty="No pending fees"
        filters={[{ label: 'Levels', get: (s) => s.levelLabel }]} />
    </>
  );
}

/** One-click status change used in record lists */
function QuickSet({ collection, r, patch, label }) {
  const { store } = useOS();
  return <button type="button" className="btn btn-sm btn-outline-success" onClick={() => store.update(collection, r.id, patch)}>{label}</button>;
}

function DecideButtons({ collection, r, on = 'Approved' }) {
  const { store } = useOS();
  if (!['Pending', 'Submitted'].includes(r.status)) return null;
  return <>
    <button type="button" className="btn btn-sm btn-success" onClick={() => store.update(collection, r.id, { status: on, decided_at: new Date().toISOString() })}>Approve</button>
    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => store.update(collection, r.id, { status: 'Rejected', decided_at: new Date().toISOString() })}>Reject</button>
  </>;
}

const EMP_DISCOUNTS = { ...MODULES.discounts, defaults: { ...MODULES.discounts.defaults, status: 'Pending' }, addLabel: 'Request Discount',
  fields: MODULES.discounts.fields.filter((f) => f.name !== 'status') };
export function Discounts() {
  const { data, role } = useOS();
  const owner = isOwner(role);
  const all = data.discounts || [];
  const amt = (f) => INR(all.filter(f).reduce((a, r) => a + num(r.amount), 0));
  return (
    <>
      <PageHead title="Discounts & Refunds" sub="Fee adjustments and refund requests with approval. Approved discounts reduce the student's balance." />
      <div className="os-grid four mb-3">
        <Metric label="Pending requests" value={all.filter((r) => r.status === 'Pending').length} note={owner ? undefined : 'Waiting for the owner'} em={!owner} />
        <Metric label="Approved discounts" value={owner ? amt((r) => r.status === 'Approved' && r.type !== 'Refund') : all.filter((r) => r.status === 'Approved' && r.type !== 'Refund').length} />
        <Metric label="Approved refunds" value={owner ? amt((r) => r.status === 'Approved' && r.type === 'Refund') : all.filter((r) => r.status === 'Approved' && r.type === 'Refund').length} />
        <Metric label="Rejected" value={all.filter((r) => r.status === 'Rejected').length} />
      </div>
      {!owner && <div className="os-note mb-3"><Icon name="info" size={15} /> Your requests are sent to the owner as <b>Pending</b>. They change the student’s fee only after the owner approves them. Decided requests can only be changed by the owner.</div>}
      <Records cfg={owner ? MODULES.discounts : EMP_DISCOUNTS} extraActions={(r) => owner && <DecideButtons collection="discounts" r={r} />}
        canEdit={(r) => owner || employeeMayChangeDiscount(r)} canDelete={(r) => owner || employeeMayChangeDiscount(r)} />
    </>
  );
}

export function Expenses() {
  const { data, role } = useOS();
  const all = data.expenses || [];
  const live = all.filter((e) => ['Approved', 'Paid'].includes(e.status));
  const byCat = Object.entries(live.reduce((m, e) => ({ ...m, [e.category || 'Other']: (m[e.category || 'Other'] || 0) + num(e.amount) }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHead title="Expenses & Vendors" sub="Exam fees, rent, salaries and vendor expenses with approvals" />
      <div className="os-grid four mb-3">
        <Metric label="Approved / paid" value={INR(live.reduce((a, e) => a + num(e.amount), 0))} em />
        <Metric label="This month" value={INR(live.filter((e) => monthKey(e.expense_date) === monthKey(TODAY())).reduce((a, e) => a + num(e.amount), 0))} />
        <Metric label="Waiting approval" value={all.filter((e) => ['Submitted', 'Pending'].includes(e.status)).length} />
        <Metric label="Vendors" value={new Set(all.map((e) => e.vendor).filter(Boolean)).size} />
      </div>
      {byCat.length > 0 && <div className="mb-3"><Card title="By category"><BarList rows={byCat.map(([c, v]) => [c, v, INR(v)])} /></Card></div>}
      <Records cfg={MODULES.expenses} extraActions={(r) => <>{isOwner(role) && <DecideButtons collection="expenses" r={r} />}{r.status === 'Approved' && <QuickSet collection="expenses" r={r} patch={{ status: 'Paid', paid_on: TODAY() }} label="Mark paid" />}</>} />
    </>
  );
}

export function CashBank() {
  const { data } = useOS();
  const auto = [
    ...(data.installments || []).filter(isReceived).map((r) => ({ id: 'i' + r.id, date: r.payment_date, account: r.payment_mode === 'Cash' ? 'Cash' : 'Bank', what: `Fee · ${r.student_name || r.student_id} (${r.payment_mode || ''})`, in: num(r.amount), out: 0 })),
    ...(data.discounts || []).filter((d) => d.type === 'Refund' && d.status === 'Approved').map((d) => ({ id: 'r' + d.id, date: d.decided_at || d.created_at, account: 'Bank', what: `Refund · ${d.student_name || ''}`, in: 0, out: num(d.amount) })),
    ...(data.expenses || []).filter((e) => e.status === 'Paid').map((e) => ({ id: 'e' + e.id, date: e.expense_date, account: e.paid_via === 'Cash' ? 'Cash' : 'Bank', what: `Expense · ${e.expense}`, in: 0, out: num(e.amount) })),
    ...(data.cash_bank || []).map((e) => ({ id: 'm' + e.id, date: e.entry_date, account: e.account || 'Cash', what: e.transaction, in: num(e.credit), out: num(e.debit) })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const bal = (acc) => auto.filter((r) => r.account === acc).reduce((a, r) => a + r.in - r.out, 0);
  return (
    <>
      <PageHead title="Cash & Bank" sub="Cash book and bank register built from fee payments, paid expenses and manual entries" />
      <div className="os-grid four mb-3">
        <Metric label="Cash balance" value={INR(bal('Cash'))} em />
        <Metric label="Bank balance" value={INR(bal('Bank'))} note="UPI / Card / Bank" />
        <Metric label="Money in" value={INR(auto.reduce((a, r) => a + r.in, 0))} />
        <Metric label="Unreconciled entries" value={(data.cash_bank || []).filter((e) => e.match !== 'Reconciled').length} />
      </div>
      <h6 className="os-h6">Combined register</h6>
      <OSTable name="Cash & Bank Register" rows={auto} filterBy={(r) => r.account} filterLabel="All accounts" pageSize={10}
        columns={[{ title: 'Date', value: (r) => fmtDate(r.date) }, { title: 'Account', value: (r) => r.account }, { title: 'Transaction', value: (r) => r.what },
          { title: 'Money in', value: (r) => (r.in ? INR(r.in) : '') }, { title: 'Money out', value: (r) => (r.out ? INR(r.out) : '') }]} />
      <h6 className="os-h6 mt-4">Manual entries</h6>
      <Records cfg={MODULES.cash_bank} />
    </>
  );
}

export function FinanceReports() {
  const { data, accounts } = useOS();
  const today = TODAY();
  const allInst = data.installments || [];
  const inst = allInst.filter(isReceived);
  const progs = Object.entries(accounts.reduce((m, s) => {
    const a = (m[s.program] ||= { n: 0, fees: 0, paid: 0, due: 0 }); a.n++; a.fees += s.fee.total; a.paid += s.fee.paid; a.due += s.fee.balance; return m;
  }, {})).sort((a, b) => a[0].localeCompare(b[0]));
  const bucket = (s) => { const d = s.fee.daysSince; if (d === null) return 'Never paid'; return d <= 30 ? 'Paid in last 30 days' : d <= 60 ? '31–60 days ago' : d <= 90 ? '61–90 days ago' : 'Over 90 days ago'; };
  const reports = [
    ['Student Fee Summary', 'Every student: actual fee, paid, balance, status', () => exportXlsx('Student_Fee_Summary.xlsx', ['Admission no', 'Student', 'Level', 'Program', 'Cohort', 'Actual fee', 'Discount', 'Total fee', 'Paid', 'Balance', 'Payments', 'Last payment', 'Next payment', 'Status'],
      accounts.map((s) => [s.admission_number || s.student_id, s.student_name, s.levelLabel, s.program, s.cohort, s.fee.total, s.fee.adj, s.fee.net, s.fee.paid, s.fee.balance, s.fee.count, fmtDate(s.fee.last), fmtDate(s.fee.next), s.fee.status]))],
    ['Program-wise Summary', 'Students, fees, collected and balance per program', () => exportXlsx('Program_Summary.xlsx', ['Program', 'Students', 'Actual fee', 'Collected', 'Balance'], progs.map(([p, v]) => [p, v.n, v.fees, v.paid, v.due]))],
    ['Outstanding Aging', 'Balances grouped by how long since the last payment', () => exportXlsx('Outstanding_Aging.xlsx', ['Student', 'Program', 'Balance', 'Last payment', 'Days since', 'Next payment', 'Aging'], accounts.filter((s) => s.fee.balance > 0).map((s) => [s.student_name, s.program, s.fee.balance, fmtDate(s.fee.last), s.fee.daysSince ?? '', fmtDate(s.fee.next), bucket(s)]))],
    ['Collections by Month', 'Fee collected each month, split by payment mode', () => {
      const ms = [...new Set(inst.map((r) => monthKey(r.payment_date)).filter(Boolean))].sort();
      const modes = [...new Set(inst.map((r) => r.payment_mode || 'Other'))];
      return exportXlsx('Collections_by_Month.xlsx', ['Month', ...modes, 'Total'], ms.map((m) => { const xs = inst.filter((r) => monthKey(r.payment_date) === m); return [monthLabel(m), ...modes.map((md) => xs.filter((r) => (r.payment_mode || 'Other') === md).reduce((a, r) => a + num(r.amount), 0)), xs.reduce((a, r) => a + num(r.amount), 0)]; }));
    }],
    ['Fee Ledger', 'Every payment with receipt details', () => exportXlsx('Fee_Ledger.xlsx', ['Date', 'Student', 'Admission no', 'Class', 'Payment no', 'Mode', 'Reference', 'Amount', 'Total fees', 'Status'], allInst.map((r) => [fmtDate(r.payment_date), r.student_name, r.admission_number, studentClass(r.student_id), r.installment_no, r.payment_mode, r.reference, num(r.amount), num(r.total_fees), r.status || 'Paid']))],
    ['Expense Report', 'Expenses by category, vendor and status', () => exportXlsx('Expense_Report.xlsx', ['ID', 'Date', 'Expense', 'Category', 'Vendor', 'Amount', 'Paid via', 'Status'], (data.expenses || []).map((e) => [e.expense_no, fmtDate(e.expense_date), e.expense, e.category, e.vendor, num(e.amount), e.paid_via, e.status]))],
    ['Discounts & Refunds', 'All adjustment requests with decisions', () => exportXlsx('Discounts_Refunds.xlsx', ['Request', 'Student', 'Type', 'Amount', 'Reason', 'Status'], (data.discounts || []).map((r) => [r.request_no, r.student_name, r.type, num(r.amount), r.reason, r.status]))],
  ];
  return (
    <>
      <PageHead title="Finance Reports" sub="Program, cohort, collection, aging, ledger and expense reports — download any as Excel" />
      <div className="os-card os-cardbody mb-3 d-flex flex-wrap align-items-center gap-3 tracker-feature">
        <div className="flex-grow-1">
          <div className="os-kicker">Complete Student &amp; Fee Tracker (recommended)</div>
          <div className="os-sub">One Excel file with everything, laid out like your tracker: a Start Here guide, Summary with 4 charts, the master student list (type here), SSLC / PUC / Degree / PG lists, a list for every admission month, all payments and pending fees. Lists, totals and charts update by themselves when the master list is edited in Excel.</div>
        </div>
        <TrackerButton sheet="Start Here" className="btn btn-success" label="Download tracker" />
      </div>
      <div className="os-card mb-3">
        <table className="table os-table mb-0"><thead><tr><th>Report</th><th>What it contains</th><th>Format</th><th /></tr></thead>
          <tbody>{reports.map(([n, d, fn]) => <tr key={n}><td><b>{n}</b></td><td>{d}</td><td>Excel (.xlsx)</td><td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary" onClick={fn}><Icon name="download" size={14} /> Download</button></td></tr>)}</tbody></table>
      </div>
      <Card title="Program-wise Summary" pad={false}>
        <table className="table os-table mb-0"><thead><tr><th>Program</th><th>Students</th><th>Actual fee</th><th>Collected</th><th>Balance</th></tr></thead>
          <tbody>{progs.map(([p, v]) => <tr key={p}><td>{p}</td><td>{v.n}</td><td>{INR(v.fees)}</td><td>{INR(v.paid)}</td><td><b>{INR(v.due)}</b></td></tr>)}
            {!progs.length && <tr><td colSpan={5} className="os-empty">No students yet</td></tr>}</tbody></table>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ Management */
export function Approvals() {
  const { data } = useOS();
  const pendingOther = [
    ...(data.discounts || []).filter((r) => r.status === 'Pending').map((r) => ({ ...r, _c: 'discounts', _type: r.type, _who: r.requested_by, _what: `${r.student_name} · ${r.reason || ''}`, _no: r.request_no })),
    ...(data.expenses || []).filter((r) => ['Submitted', 'Pending'].includes(r.status)).map((r) => ({ ...r, _c: 'expenses', _type: 'Expense', _who: r.requested_by, _what: `${r.expense} · ${r.vendor || ''}`, _no: r.expense_no })),
  ];
  return (
    <>
      <PageHead title="Approvals" sub="Decide on fee discounts, refunds, expenses and other requests" />
      <div className="os-grid three mb-3">
        <Metric label="Waiting from Discounts & Expenses" value={pendingOther.length} em />
        <Metric label="Approval requests pending" value={(data.approvals || []).filter((r) => r.status === 'Pending').length} />
        <Metric label="Decided" value={(data.approvals || []).filter(isReceived).length} />
      </div>
      <h6 className="os-h6">Waiting in other modules</h6>
      <OSTable name="Pending approvals" rows={pendingOther} pageSize={8} empty="Nothing waiting"
        columns={[{ title: 'Ref', value: (r) => r._no }, { title: 'Type', value: (r) => r._type }, { title: 'Amount', value: (r) => INR(r.amount) },
          { title: 'Submitted by', value: (r) => r._who || '' }, { title: 'Details', value: (r) => r._what }, { title: 'Status', value: (r) => r.status, render: (r) => <Chip t={r.status} /> },
          { title: 'Action', export: false, value: () => '', render: (r) => <div className="row-actions"><DecideButtons collection={r._c} r={r} /></div> }]} />
      <h6 className="os-h6 mt-4">Other approval requests</h6>
      <Records cfg={MODULES.approvals} extraActions={(r) => <DecideButtons collection="approvals" r={r} />} />
    </>
  );
}

const ROLE_ROWS = () => [
  ['Student lists, enquiries, admissions, documents, exams', 'Yes', 'Yes'],
  ['Collect fee, payments & receipts, pending fees, installments, fee plans, discounts', 'Yes', 'Yes'],
  ['Employees & roles, notifications, system map', 'Yes', 'Yes'],
  ...[...OWNER_ONLY].map((k) => [OS_TITLES[k], 'Yes', 'No']),
];
export function Employees() {
  const { role } = useOS();
  return (
    <>
      <PageHead title="Employees & Roles" sub={isOwner(role) ? 'Academy staff, their job roles and what each login can open' : 'Academy staff and their job roles'} />
      <Records cfg={MODULES.employees} />
      {isOwner(role) && <div className="mt-3">
        <Card title="What each login can open (Owner login and Employee login)" pad={false}>
          <table className="table os-table mb-0"><thead><tr><th>Area</th>{ROLES.map((r) => <th key={r}>{r} login</th>)}</tr></thead>
            <tbody>{ROLE_ROWS().map(([a, ...v]) => <tr key={a}><td>{a}</td>{v.map((x, i) => <td key={i}><Chip t={x === 'Yes' ? 'Allowed' : 'Hidden'} /></td>)}</tr>)}</tbody></table>
        </Card>
      </div>}
    </>
  );
}

export function Notifications() {
  const { data, nav, money, accounts } = useOS();
  const today = TODAY();
  const alerts = computeAlerts(data, nav.role);
  return (
    <>
      <PageHead title="Notifications" sub="Overdue fees, missing documents, follow-ups and approvals — worked out automatically, plus your own reminders" />
      <OSTable name="Notifications" rows={alerts.map((a, i) => ({ id: i, p: a[0], t: a[1], o: a[2], d: a[3], to: a[4] }))} filterBy={(r) => r.p} filterLabel="All priorities" empty="All clear — nothing needs attention"
        columns={[{ title: 'Priority', value: (r) => r.p, render: (r) => <Chip t={r.p} /> }, { title: 'Alert', value: (r) => r.t }, { title: 'Owner', value: (r) => r.o },
          { title: 'Date', value: (r) => fmtDate(r.d) }, { title: 'Action', export: false, value: () => '', render: (r) => <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => nav.go(r.to)}>Open</button> }]} />
      <h6 className="os-h6 mt-4">My reminders</h6>
      <Records cfg={MODULES.notifications} extraActions={(r) => r.status !== 'Done' && <QuickSet collection="notifications" r={r} patch={{ status: 'Done' }} label="Done" />} />
    </>
  );
}
/** Settings: institution logo, name and tagline shown in the bar at the top of every page */
export function BrandingCard() {
  const { store, data } = useOS();
  const cur = academySettings(data);
  const [title, setTitle] = useState(cur.inst_title || '');
  const [tagline, setTagline] = useState(cur.inst_tagline ?? '');
  const [logo, setLogo] = useState(cur.inst_logo || null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (patch) => {
    const latest = academySettings(store.data);
    await store.put('settings', 'academy-settings', { academy: { ...latest, ...patch }, updated_at: new Date().toISOString() });
    setMsg('Saved — the top bar is updated'); setTimeout(() => setMsg(''), 2500);
  };
  // the name and tagline save themselves a moment after typing stops
  const firstB = useRef(true);
  useEffect(() => {
    if (firstB.current) { firstB.current = false; return undefined; }
    const t = setTimeout(() => save({ inst_title: title.trim(), inst_tagline: tagline.trim() }), 800);
    return () => clearTimeout(t);
  }, [title, tagline]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickLogo = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try { const up = await storeUpload(f, 'photo'); setLogo(up); await save({ inst_logo: up }); } catch (err) { setMsg(String(err?.message || err)); }
    setBusy(false);
  };
  const reset = async () => { setTitle(''); setTagline(DEFAULT_BRAND.tagline); setLogo(null); await save({ inst_title: '', inst_tagline: DEFAULT_BRAND.tagline, inst_logo: null }); };
  const url = fileUrl(logo);
  return (
    <Card title="Institution branding (top bar)">
      <div className="brand-preview mb-3">
        {url ? <img className="inst-logo" src={url} alt="Logo preview" /> : <span className="inst-logo inst-logo-default" aria-hidden="true"><Icon name="cap" size={22} /></span>}
        <div><div className="inst-title">{title || DEFAULT_BRAND.title}</div>{tagline && <div className="inst-tagline">{tagline}</div>}</div>
      </div>
      <div className="row g-2">
        <div className="col-md-6"><label className="form-label" htmlFor="b_title">Institution name</label>
          <input id="b_title" className="form-control form-control-sm" placeholder={DEFAULT_BRAND.title} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="b_tag">Tagline (optional)</label>
          <input id="b_tag" className="form-control form-control-sm" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
        <div className="col-12 d-flex gap-2 flex-wrap align-items-center mt-1">
          <label className={`btn btn-outline-primary btn-sm mb-0${busy ? ' disabled' : ''}`}><Icon name="upload" size={14} /> {url ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/*" hidden onChange={pickLogo} disabled={busy} /></label>
          {url && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={async () => { setLogo(null); await save({ inst_logo: null }); }}>Remove logo</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => save({ inst_title: title.trim(), inst_tagline: tagline.trim() })}>Save name</button>
          <button type="button" className="btn btn-link btn-sm text-danger" onClick={reset}>Reset to default</button>
          {busy && <span className="small text-primary">Uploading…</span>}
          {msg && <span className="small text-success">{msg}</span>}
        </div>
      </div>
    </Card>
  );
}

const COLL_NAMES = { sslc_students: 'SSLC student', puc_students: 'PUC student', degree_students: 'Degree student', pg_students: 'PG student', installments: 'Installment',
  enquiries: 'Enquiry', documents: 'Document', exams: 'Exam record', fee_plans: 'Fee plan', fee_dues: 'Due installment', discounts: 'Discount / refund', expenses: 'Expense',
  cash_bank: 'Cash / bank entry', approvals: 'Approval', employees: 'Employee', notifications: 'Reminder', settings: 'Settings' };
export function AuditLogs() {
  const { data } = useOS();
  const rows = [...(data.audit_logs || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return (
    <>
      <PageHead title="Audit Logs" sub="Who created, changed and deleted every record — written automatically" />
      <OSTable name="Audit Logs" rows={rows} filterBy={(r) => r.action} filterLabel="All actions" empty="No activity recorded yet"
        filters={[{ label: 'Record types', get: (r) => COLL_NAMES[r.collection] || r.collection }]}
        columns={[{ title: 'Time', value: (r) => (r.at ? fmtDateTime(r.at) : ''), sortValue: (r) => r.at || '' }, { title: 'User', value: (r) => r.actor || '' }, { title: 'Role', value: (r) => r.role || '' },
          { title: 'Record type', value: (r) => COLL_NAMES[r.collection] || r.collection }, { title: 'Action', value: (r) => r.action, render: (r) => <Chip t={r.action} /> },
          { title: 'Record', value: (r) => r.label || '' }]} />
    </>
  );
}
