import DataTable from '../components/DataTable.jsx';
import { Shell, Link, useConfirm } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import { LEVELS, calcAge, fileUrl, sslcSubjects, pucSubjects, normMedium, maskAadhaar } from '../utils.js';
import ImportStudents from '../components/ImportStudents.jsx';
import CustomizeButton, { useCustomization, applyListCustom } from '../components/Customize.jsx';
import { formFields } from './StudentForm.jsx';
import TrackerButton, { trackerFor } from '../export/TrackerButton.jsx';
import Icon from '../components/Icon.jsx';
import { PageHead } from '../os/ui.jsx';
import { notify } from '../components/toast.jsx';
import { currentRole } from '../os/permissions.js';

const v = (k) => (r) => r[k] ?? '';
const photo = (muted) => ({
  title: 'Photo', value: (r) => (r.photo ? 'Photo' : 'No Photo'), sortKey: false, export: false,
  render: (r) => (fileUrl(r.photo)
    ? <img src={fileUrl(r.photo)} alt="" width="50" height="50" style={{ objectFit: 'cover', borderRadius: 5 }} />
    : muted ? <span className="text-muted">No Photo</span> : 'No Photo'),
});
const file = (title, k, emptyText = 'No File') => ({
  title, value: (r) => (r[k] ? 'File' : emptyText), export: false, sortKey: false,
  render: (r) => (fileUrl(r[k])
    ? <a href={fileUrl(r[k])} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">View</a>
    : emptyText),
});
const dob = { title: 'DOB', value: (r) => r.dob || '0000-00-00' };
const age = { title: 'Age', value: (r) => (r.dob ? calcAge(r.dob) : r.age) || '0' };
const C = (title, k) => ({ title, key: k, value: v(k) });
/* Aadhaar: lists show only the last 4 digits; the full number is in the student form (and in the owner's exports) */
const AADHAAR = { title: 'Aadhar no', key: 'aadhar_card', value: v('aadhar_card'), render: (r) => maskAadhaar(r.aadhar_card),
  exportValue: (r) => (currentRole() === 'Employee' ? maskAadhaar(r.aadhar_card) : r.aadhar_card ?? '') };

/* First columns shared by the Degree and PG lists (same layout as the PUC list) */
const LIST_BASE = [
  C('Admission no', 'admission_number'),
  C('University', 'board_id'),
  { title: 'Batch no', key: 'admission_batch', value: (r) => r.admission_batch || '' },
  C('Name', 'student_name'),
  C('Gender', 'gender'),
  AADHAAR,
  C('Mobile', 'mobile'),
  C('SSLC Board', 'sslc_board_name'),
  C('Register no', 'sslc_register_number'),
  { title: 'Medium', key: 'puc_medium', value: (r) => normMedium(r.puc_medium || r.sslc_medium) },
];

const COLUMNS = {
  sslc: [
    C('Admission no', 'admission_number'),
    C('Board', 'board_id'),
    { title: 'Batch no', key: 'admission_batch', value: (r) => r.admission_batch || r.batch || '' },
    C('Name', 'student_name'),
    C('Gender', 'gender'),
    AADHAAR,
    C('Mobile', 'mobile'),
    C('Previous class', 'prev_class'),
    { title: 'Medium', key: 'medium', value: (r) => normMedium(r.medium || r.prev_medium) },
    { title: 'TC no/Reg no', key: 'prev_register_number', value: (r) => r.prev_register_number || r.register_number || '' },
    C('Year of Passing', 'prev_passing_year'),
  ],
  puc: [
    C('Admission no', 'admission_number'),
    C('Board', 'board_id'),
    { title: 'Batch no', key: 'admission_batch', value: (r) => r.admission_batch || '' },
    C('Name', 'student_name'),
    C('Gender', 'gender'),
    AADHAAR,
    C('Mobile', 'mobile'),
    C('SSLC Board', 'sslc_board_name'),
    C('Register no', 'sslc_register_number'),
    { title: 'Medium', key: 'medium', value: (r) => normMedium(r.medium) },
    C('Branch', 'course_id'),
    C('Course', 'combination_id'),
  ],
  degree: [
    ...LIST_BASE,
    C('PUC Register no', 'puc_register_number'),
    C('PUC Passed Year', 'puc_passed_year'),
    C('Mode', 'university_mode'),
    C('Year', 'year'),
    C('Course', 'course_id'),
    C('Sem', 'sem'),
  ],
  pg: [
    ...LIST_BASE,
    C('PUC Register no', 'puc_register_number'),
    C('PUC Passed Year', 'puc_passed_year'),
    C("Bachelor's Register no", 'degree_register_number'),
    C("Bachelor's Mode", 'degree_mode'),
    C("Bachelor's University", 'degree_board_name'),
    C("Bachelor's Passed Year", 'degree_passed_year'),
    C("Bachelor's Course", 'degree_course_id'),
  ],
};

/* Extra filters above each student list (besides Board, Batch and Search) */
const LEVEL_FILTERS = {
  sslc: [],
  puc: [{ key: 'branch', label: 'Branch', value: (r) => r.course_id || '' }],
  degree: [{ key: 'course', label: 'Course', value: (r) => r.course_id || '' }],
  pg: [{ key: 'course', label: 'Course', value: (r) => r.course_id || '' }],
};
const COMMON_FILTERS = [
  { key: 'year', label: 'Year', value: (r) => (r.admission_year ? String(r.admission_year) : '') },
  { key: 'medium', label: 'Medium', value: (r) => normMedium(r.medium || r.puc_medium || r.sslc_medium) },
];

export default function Dashboard({ tab }) {
  const store = useStore();
  const [ask, dialog] = useConfirm();
  const L = LEVELS[tab];
  const rows = store.data[L.table] || [];
  const isPg = tab === 'pg';
  const msg = tab === 'sslc' ? 'Are you sure to delete this student?' : 'Delete this student?';

  const del = async (r) => {
    const emp = currentRole() === 'Employee';
    if (emp && (store.data.installments || []).some((x) => x.student_id === r.student_id)) {
      notify('Only the owner can delete a student who has payments.', 'error', 5000); return;
    }
    if (!(await ask(msg))) return;
    if (!(await store.remove(L.table, r.id))) return;
    notify(`Student ${r.student_name || ''} deleted`);
    // their payments, dues, documents and exams would otherwise be left behind without a student
    const linked = ['installments', 'fee_dues', 'discounts', 'documents', 'exams'].flatMap((c) => (store.data[c] || [])
      .filter((x) => r.student_id && x.student_id === r.student_id && !(emp && c === 'discounts' && x.status !== 'Pending')).map((x) => [c, x.id]));
    if (linked.length && (await ask(`Also delete this student's ${linked.length} linked record(s) (payments, due dates, discounts, documents, exams)? Choose Cancel to keep them.`))) {
      for (const [c, id] of linked) await store.remove(c, id); // eslint-disable-line no-await-in-loop
    }
  };

  // Columns after the page's Customize settings (renamed / hidden / reordered / added)
  const [listCfg] = useCustomization(`list-${tab}`);
  const [formCfg] = useCustomization(`form-${tab}`);
  const fieldChoices = formFields(tab, formCfg).map((f) => ({ key: f.name, label: f.label }));
  const listCols = applyListCustom(COLUMNS[tab], listCfg, (x) => ({ title: x.title, key: x.key, value: (r) => r[x.key] ?? '' }));

  const nameColIdx = Math.max(0, listCols.findIndex((c) => c.key === 'student_name'));
  const defaultOrder = [nameColIdx + 1, 'asc'];

  const columns = [
    { title: 'SL.no', value: (r, i) => i + 1, sortKey: (r) => r.created_at || '' },
    ...listCols,
    {
      title: 'Actions', export: false, sortKey: false, value: () => '',
      render: (r) => (
        <div className="row-actions">
          <Link to={{ page: 'student-edit', level: tab, id: r.id }} className="btn btn-sm btn-outline-secondary">Edit</Link>
          <Link to={{ page: 'inst-student', studentId: r.student_id }} className="btn btn-sm btn-outline-primary">Fees</Link>
          <a href="#" className="btn btn-sm btn-outline-danger" onClick={(e) => { e.preventDefault(); del(r); }}>Delete</a>
        </div>
      ),
    },
  ];

  return (
    <Shell>
      <PageHead title={`${L.label} Students`} sub={`${rows.length} student${rows.length === 1 ? '' : 's'} · add, edit, import and export ${L.label} admissions`}>
            <CustomizeButton pageKey={`list-${tab}`} title={`${L.label} students list`} mode="list"
              items={COLUMNS[tab].map((c) => ({ id: c.title, title: c.title }))} fieldChoices={fieldChoices} />
            <ImportStudents level={tab} listColumns={listCols} formCfg={formCfg} />
            <TrackerButton sheet={`${L.label} List`} />
            <Link to={{ page: 'student-add', level: tab }} className="btn btn-primary"><Icon name="plus" size={15} /> Add New Student</Link>
      </PageHead>
      <div className="card page-card">

        <div>
          <DataTable
            key={`${tab}-${listCols.map((c) => c.title).join('|')}`}
            id={`${tab}Table`}
            columns={columns}
            rows={rows}
            order={defaultOrder}
            buttons={true}
            title={`${L.label} Students`}
            onTracker={currentRole() === 'Employee' ? undefined : () => trackerFor(store.data, `${L.label} List`)}
            extraFilters={[...COMMON_FILTERS, ...LEVEL_FILTERS[tab]]}
          />
        </div>
      </div>
      {dialog}
    </Shell>
  );
}
