/* Academy OS: one reusable list + add/edit form for record-based modules */
import { useDraft, DraftBanner } from '../components/draft.jsx';
import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { useConfirm } from '../components/Layout.jsx';
import { fmtDate } from '../utils.js';
import { OSTable, Chip, Modal } from './ui.jsx';
import { allStudents, nextNumber, INR, TODAY } from './data.js';
import Icon from '../components/Icon.jsx';
import { notify } from '../components/toast.jsx';

const FILTER_NAMES = { interest: 'Courses', document: 'Documents', result: 'Results', category: 'Categories', type: 'Types', priority: 'Priorities', program: 'Programs', account: 'Accounts' };
const cleanNum = (s) => String(s).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

export function cellValue(c, r) {
  const v = c.value ? c.value(r) : r[c.key];
  if (c.amount) return v === '' || v == null ? '' : INR(v);
  if (c.date) return fmtDate(v);
  return v ?? '';
}

/** Form fields for one record (used by the modal) */
export function RecordFields({ fields, v, setV, data, missing = [] }) {
  const students = useMemo(() => allStudents(data).sort((a, b) => String(a.student_name).localeCompare(String(b.student_name))), [data]);
  const staff = (data.employees || []).filter((e) => e.status !== 'Inactive').map((e) => e.name).filter(Boolean);
  const set = (name, value) => setV((o) => ({ ...o, [name]: value }));
  return (
    <div className="row g-2">
      {fields.filter((f) => !f.show || f.show(v)).map((f) => {
        const id = `rf_${f.name}`;
        const val = v[f.name] ?? '';
        let input;
        if (f.type === 'student') {
          input = (
            <select id={id} className="form-select form-select-sm" value={v.student_id || ''} onChange={(e) => {
              const s = students.find((x) => x.student_id === e.target.value);
              setV((o) => ({ ...o, student_id: s?.student_id || '', student_name: s?.student_name || '', program: s?.program || '', admission_number: s?.admission_number || '' }));
            }}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.level + s.id} value={s.student_id}>{s.student_name} · {s.admission_number || s.student_id} · {s.program}</option>)}
              {v.student_id && !students.some((s) => s.student_id === v.student_id) && <option value={v.student_id}>{v.student_name || v.student_id}</option>}
            </select>
          );
        } else if (f.type === 'select' || (f.type === 'staff' && staff.length)) {
          const opts = f.type === 'staff' ? staff : (typeof f.options === 'function' ? f.options(v, data) : f.options);
          input = (
            <select id={id} className="form-select form-select-sm" value={val} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">Select</option>
              {opts.map((o) => (typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o}>{o}</option>))}
              {val && !opts.some((o) => (typeof o === 'object' ? o.value : o) === val) && <option>{val}</option>}
            </select>
          );
        } else if (f.type === 'textarea') {
          input = <textarea id={id} rows={2} className="form-control form-control-sm" value={val} onChange={(e) => set(f.name, e.target.value)} />;
        } else if (f.type === 'date') {
          input = <input id={id} type="date" className="form-control form-control-sm" value={val} onChange={(e) => set(f.name, e.target.value)} />;
        } else if (f.type === 'amount') {
          input = <input id={id} type="text" inputMode="decimal" className="form-control form-control-sm" value={val} onChange={(e) => set(f.name, cleanNum(e.target.value))} />;
        } else {
          input = <input id={id} type="text" className="form-control form-control-sm" value={val} readOnly={f.readOnly} onChange={(e) => set(f.name, e.target.value)} />;
        }
        return (
          <div key={f.name} className={f.full || f.type === 'textarea' ? 'col-12' : f.col || 'col-md-6'}>
            <label className="form-label" htmlFor={id}>{f.label}{f.required && <span className="req"> *</span>}</label>
            {missing.includes(f.name) ? <div className="is-invalid-wrap">{input}<div className="invalid-feedback d-block">{f.label} is required</div></div> : input}
          </div>
        );
      })}
    </div>
  );
}

/** Add / edit dialog for one record of a module */
export function RecordModal({ cfg, row, onClose }) {
  const store = useStore();
  const rows = store.data[cfg.collection] || [];
  const [v, setV] = useState(() => row || {
    ...(cfg.numberField ? { [cfg.numberField]: nextNumber(rows, cfg.numberField, cfg.prefix) } : {}),
    ...Object.fromEntries(cfg.fields.filter((f) => f.type === 'date' && f.today).map((f) => [f.name, TODAY()])),
    ...(cfg.defaults || {}),
  });
  const [err, setErr] = useState('');
  const [missing, setMissing] = useState([]);
  const draft = useDraft(`record:${cfg.collection}:${row?.id || 'new'}`, v, (d) => setV(d));
  const save = async () => {
    const miss = cfg.fields.filter((f) => f.required && (!f.show || f.show(v)) && !(f.type === 'student' ? v.student_id : String(v[f.name] ?? '').trim()));
    setMissing(miss.map((f) => f.name));
    if (miss.length) { setErr(`Please fill in ${miss.length} required field${miss.length > 1 ? 's' : ''}`); return; }
    let out = { ...v };
    cfg.fields.filter((f) => f.type === 'amount').forEach((f) => { out[f.name] = out[f.name] === '' || out[f.name] == null ? '' : Number(out[f.name]); });
    if (cfg.beforeSave) out = cfg.beforeSave(out, store.data, !row);
    const ok = row ? await store.update(cfg.collection, row.id, out) : await store.add(cfg.collection, { ...out, created_at: new Date().toISOString() });
    if (ok === false) return;
    draft.clear();
    notify(`${cfg.single} ${row ? 'updated' : 'added'}`);
    onClose(true);
  };
  return (
    <Modal title={`${row ? 'Edit' : 'New'} ${cfg.single}`} onClose={() => onClose(false)} wide={cfg.fields.length > 6}
      footer={<>{err && <span className="text-danger me-auto small">{err}</span>}
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onClose(false)}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button></>}>
      <DraftBanner draft={draft} />
      <RecordFields fields={cfg.fields} v={v} setV={setV} data={store.data} missing={missing} />
    </Modal>
  );
}

/** List of a module's records with add / edit / delete */
export default function Records({ cfg, rowsFilter, extraActions, tools, hideAdd, canEdit = () => true, canDelete = () => true, readOnly }) {
  const store = useStore();
  const [ask, dialog] = useConfirm();
  const [edit, setEdit] = useState(null); // null | 'new' | row
  let rows = store.data[cfg.collection] || [];
  if (rowsFilter) rows = rows.filter(rowsFilter);
  rows = [...rows].sort(cfg.sort || ((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));
  const columns = [
    { title: 'SL.no', value: (r, i) => i + 1, export: false },
    ...cfg.columns.map((c) => ({ title: c.title, value: (r) => cellValue(c, r), sortValue: c.date ? (r) => String(c.value ? c.value(r) : r[c.key] || '') : c.amount ? (r) => Number(c.value ? c.value(r) : r[c.key]) || 0 : undefined, render: c.chip ? (r) => <Chip t={cellValue(c, r)} /> : c.render })),
    {
      title: 'Action', export: false, value: () => '',
      render: (r) => (
        <div className="row-actions">
          {extraActions?.(r)}
          {!readOnly && canEdit(r) && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(r)}>Edit</button>}
          {!readOnly && canDelete(r) && <button type="button" className="btn btn-sm btn-outline-danger" onClick={async () => { if (await ask(`Delete this ${cfg.single.toLowerCase()}?`)) { if (await store.remove(cfg.collection, r.id)) notify(`${cfg.single} deleted`); } }}>Delete</button>}
        </div>
      ),
    },
  ];
  return (
    <>
      <OSTable action={!hideAdd && !readOnly && <button type="button" className="btn btn-primary btn-sm os-add" onClick={() => setEdit('new')}><Icon name="plus" size={14} /> {cfg.addLabel || `New ${cfg.single}`}</button>}
        columns={columns} rows={rows} name={cfg.title} filterBy={cfg.filterKey ? (r) => r[cfg.filterKey] : undefined}
        filterOptions={cfg.filterOptions} filterLabel={cfg.filterLabel} extraTools={tools}
        filters={(cfg.filters || []).map((k) => ({ label: FILTER_NAMES[k] || k, get: (r) => r[k] || '' }))}
        dateBy={cfg.dateKey ? (r) => String(r[cfg.dateKey] || '').slice(0, 10) : undefined} dateLabel={cfg.dateLabel || 'Date'} empty={`No ${cfg.title.toLowerCase()} yet. Use “${cfg.addLabel || `New ${cfg.single}`}” to add one.`} />
      {edit && <RecordModal cfg={cfg} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {dialog}
    </>
  );
}
