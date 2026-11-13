import { useDraft, DraftBanner } from '../components/draft.jsx';
import { useState } from 'react';
import { Shell, Link, useNav, useConfirm } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';

export const LOOKUPS = {
  boards: { one: 'Board', field: 'board_name', title: 'Manage Boards', msg: 'Are you sure to delete this board?' },
  courses: { one: 'Course', field: 'course_name', title: 'Manage Courses', msg: 'Are you sure to delete this course?' },
  combinations: { one: 'Combination', field: 'combination_name', title: 'Manage Combinations', msg: 'Are you sure to delete this combination?' },
};

export function LookupList({ kind }) {
  const store = useStore();
  const [ask, dialog] = useConfirm();
  const L = LOOKUPS[kind];
  const rows = [...store.data[kind]].sort((a, b) => String(a[L.field]).localeCompare(String(b[L.field])));
  return (
    <Shell>
      <h4>{L.title}</h4>
      <Link to={{ page: 'lookup-add', kind }} className="btn btn-primary mb-3">+ Add New {L.one}</Link>
      <div className="dt-scroll">
        <table className="table table-bordered">
          <thead><tr><th>SL.no</th><th>{L.one} Name</th><th>Level</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="text-muted">No {L.one.toLowerCase()}s yet. Use “Add New {L.one}”.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td>{r[L.field]}</td><td>{r.level}</td>
                <td>
                  <Link to={{ page: 'lookup-edit', kind, id: r.id }} className="btn btn-outline-secondary btn-sm">Edit</Link>{' '}
                  <a href="#" className="btn btn-outline-danger btn-sm" onClick={async (e) => { e.preventDefault(); if (await ask(L.msg)) store.remove(kind, r.id); }}>Delete</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </Shell>
  );
}

export function LookupForm({ kind, id }) {
  const store = useStore();
  const { go, back } = useNav();
  const L = LOOKUPS[kind];
  const row = id ? store.data[kind].find((r) => r.id === id) : null;
  const [name, setName] = useState(row?.[L.field] || '');
  const [level, setLevel] = useState(row?.level || 'SSLC');
  const draft = useDraft(`lookup:${kind}:${id || 'new'}`, { name, level }, (d) => { setName(d.name ?? ''); setLevel(d.level || 'SSLC'); });
  const submit = async (e) => {
    e.preventDefault();
    const data = { [L.field]: name.trim(), level };
    if (row) await store.update(kind, id, data); else await store.add(kind, data);
    draft.clear();
    back({ page: 'lookup', kind });
  };
  return (
    <Shell>
      <h4>{row ? `Edit ${L.one}` : `Add New ${L.one}`}</h4>
      <DraftBanner draft={draft} />
      <form onSubmit={submit} style={{ maxWidth: 720 }}>
        <div className="mb-3">
          <label htmlFor={L.field} className="form-label">{L.one} Name</label>
          <input id={L.field} type="text" className="form-control" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="level" className="form-label">Level</label>
          <select id="level" className="form-select" required value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="SSLC">SSLC</option><option value="PUC">PUC</option><option value="Degree">Degree</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">{row ? 'Update' : 'Save'}</button>{' '}
        <button type="button" className="btn btn-outline-secondary" onClick={() => back({ page: 'lookup', kind })}>Back</button>
      </form>
    </Shell>
  );
}
