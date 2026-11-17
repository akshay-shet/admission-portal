import { useState } from 'react';
import { useStore } from '../store.jsx';
import Icon from './Icon.jsx';
import { currentRole } from '../os/permissions.js';

/**
 * Page customisation (shared by everyone using the portal, stored in the `settings` collection).
 *
 * Forms  ('form-sslc', 'form-installment', …):
 *   { items: { [field]: { label, hidden, type: 'text'|'select', options: [] } },
 *     extra: [{ name, label, type, options }] }            // added fields, saved on the record as `name`
 * Lists  ('list-sslc', 'list-installments', …):
 *   { items: { [baseTitle]: { title, hidden } }, order: [id…], extra: [{ id, title, key }] }
 */
export function useCustomization(pageKey) {
  const store = useStore();
  const doc = (store.data.settings || []).find((d) => d.id === pageKey);
  const cfg = doc?.config || {};
  const save = (config) => store.put('settings', pageKey, { config, updated_at: new Date().toISOString() });
  return [cfg, save];
}

/** Name used for the part of a form above its first heading */
export const FIRST_SECTION = 'Student Details';
export const END_SECTION = 'Additional Details';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'field';
const parseOptions = (txt) => String(txt || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/* ---------- applying a form customisation to a field spec list (StudentForm) ---------- */
export function applyFormCustom(fields, cfg) {
  const items = cfg?.items || {};
  const out = [];
  for (const f of fields) {
    const key = f.name || (f.t === 'gender' ? 'gender' : f.t === 'admno' ? 'admission_number' : null);
    const o = key ? items[key] : null;
    if (!o) { out.push(f); continue; }
    if (o.hidden) continue;
    let g = { ...f };
    if (o.label) g.label = o.label;
    const was = f.t === 'opt' || f.t === 'sel' ? 'select' : 'text';
    const want = o.type || was;
    if (f.type !== 'file' && (f.t === 'f' || f.t === 'opt' || f.t === 'sel')) {
      if (want === 'select' && (was === 'text' || o.options?.length)) {
        const opts = o.options?.length ? o.options : f.options;
        g = { t: 'opt', col: f.col, label: g.label, name: f.name, options: opts || [], ph: f.ph && typeof f.ph !== 'string' ? f.ph : `Select ${g.label || ''}`.trim(), req: f.req };
      } else if (want === 'text' && was === 'select') {
        g = { t: 'f', col: f.col, label: g.label, name: f.name, req: f.req };
      }
    }
    out.push(g);
  }
  // Added fields go at the end of the section chosen for them (or a new "Additional Details" section)
  const spec = (x) => (x.type === 'select'
    ? { t: 'opt', col: 'col-md-4', label: x.label, name: x.name, options: x.options || [], ph: `Select ${x.label}` }
    : { t: 'f', col: 'col-md-4', label: x.label, name: x.name });
  const endOf = (section) => {
    let start = section === FIRST_SECTION ? 0 : out.findIndex((f) => f.t === 'h5' && f.text === section);
    if (start < 0) return -1;
    if (section !== FIRST_SECTION) start += 1;
    let j = start;
    while (j < out.length && !(out[j].t === 'hr' || out[j].t === 'h5')) j++;
    return j;
  };
  const leftovers = [];
  for (const x of cfg?.extra || []) {
    const at = x.section && x.section !== END_SECTION ? endOf(x.section) : -1;
    if (at < 0) leftovers.push(x);
    else out.splice(at, 0, spec(x));
  }
  if (leftovers.length) out.push({ t: 'hr' }, { t: 'h5', text: END_SECTION }, ...leftovers.map(spec));
  return out;
}

/* ---------- applying a list customisation to DataTable columns ---------- */
export function applyListCustom(baseColumns, cfg, makeExtra) {
  const items = cfg?.items || {};
  const byId = new Map();
  for (const c of baseColumns) {
    const o = items[c.title];
    if (o?.hidden) continue;
    byId.set(c.title, o?.title ? { ...c, title: o.title, baseTitle: c.title } : { ...c, baseTitle: c.title });
  }
  for (const x of cfg?.extra || []) byId.set(x.id, { ...makeExtra(x), baseTitle: x.id });
  const order = (cfg?.order || []).filter((id) => byId.has(id));
  const rest = [...byId.keys()].filter((id) => !order.includes(id));
  return [...order, ...rest].map((id) => byId.get(id));
}

/* ---------- the Customize button + panel ---------- */
/**
 * mode 'form': items = [{ id, label, type: 'text'|'select'|'fixed', options }]
 * mode 'list': items = [{ id, title }], fieldChoices = [{ key, label }] for "Add column"
 */
/** Changing forms and lists affects everyone, so only the owner sees Customize */
export default function CustomizeButton(props) {
  return currentRole() === 'Employee' ? null : <CustomizeButtonInner {...props} />;
}
function CustomizeButtonInner({ pageKey, title, mode, items, fieldChoices = [] }) {
  const [cfg, save] = useCustomization(pageKey);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [newItem, setNewItem] = useState({ label: '', type: 'text', options: '', key: '', section: END_SECTION });
  const sections = [...new Set(items.map((x) => x.section).filter(Boolean)), END_SECTION];
  const [msg, setMsg] = useState('');

  const start = () => { setDraft(JSON.parse(JSON.stringify(cfg || {}))); setNewItem({ label: '', type: 'text', options: '', key: fieldChoices[0]?.key || '', section: END_SECTION }); setMsg(''); setOpen(true); };
  const it = (id) => draft.items?.[id] || {};
  const setIt = (id, patch) => setDraft((d) => ({ ...d, items: { ...(d.items || {}), [id]: { ...(d.items?.[id] || {}), ...patch } } }));
  const setExtra = (i, patch) => setDraft((d) => ({ ...d, extra: d.extra.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const delExtra = (i) => setDraft((d) => ({ ...d, extra: d.extra.filter((_, j) => j !== i), order: (d.order || []).filter((id) => id !== d.extra[i].id) }));

  // list ordering
  const listIds = () => {
    const all = [...items.map((x) => x.id), ...(draft.extra || []).map((x) => x.id)];
    const order = (draft.order || []).filter((id) => all.includes(id));
    return [...order, ...all.filter((id) => !order.includes(id))];
  };
  const move = (id, dir) => setDraft((d) => {
    const ids = listIds(); const i = ids.indexOf(id); const j = i + dir;
    if (j < 0 || j >= ids.length) return d;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { ...d, order: ids };
  });

  const add = () => {
    if (mode === 'form') {
      if (!newItem.label.trim()) { setMsg('Type a heading for the new field.'); return; }
      const name = `cf_${slug(newItem.label)}_${Date.now().toString(36).slice(-4)}`;
      const opts = parseOptions(newItem.options);
      if (newItem.type === 'select' && !opts.length) { setMsg('Add the dropdown options, separated by commas.'); return; }
      setDraft((d) => ({ ...d, extra: [...(d.extra || []), { name, label: newItem.label.trim(), type: newItem.type, options: opts, section: newItem.section }] }));
    } else {
      const choice = fieldChoices.find((c) => c.key === newItem.key);
      if (!choice) { setMsg('Choose which detail the new column shows.'); return; }
      const id = `x_${newItem.key}_${Date.now().toString(36).slice(-4)}`;
      setDraft((d) => ({ ...d, extra: [...(d.extra || []), { id, key: newItem.key, title: newItem.label.trim() || choice.label }] }));
    }
    setNewItem({ label: '', type: 'text', options: '', key: newItem.key, section: newItem.section });
    setMsg('');
  };

  const commit = async () => {
    try { await save(draft); setOpen(false); }
    catch (e) { setMsg(e?.code === 'invalid_argument' ? 'You do not have permission to change the layout.' : `Could not save: ${e?.message || e}`); }
  };
  const reset = async () => { try { await save({}); setOpen(false); } catch (e) { setMsg(`Could not reset: ${e?.message || e}`); } };

  // A field added through Customize: heading, type, options, section, delete
  const addedRow = (x, i) => (
    <div className="cust-row added" key={x.name}>
      <input className="form-control form-control-sm" aria-label="Heading" value={x.label} onChange={(e) => setExtra(i, { label: e.target.value })} />
      <select className="form-select form-select-sm cust-type" aria-label="Box type" value={x.type} onChange={(e) => setExtra(i, { type: e.target.value })}>
        <option value="text">Text box</option>
        <option value="select">Dropdown</option>
      </select>
      <div className="d-flex gap-1">
        {x.type === 'select' && (
          <input className="form-control form-control-sm" placeholder="Options, comma separated" value={(x.options || []).join(', ')} onChange={(e) => setExtra(i, { options: parseOptions(e.target.value) })} />
        )}
        <select className="form-select form-select-sm" aria-label="Section" title="Section of the form" value={x.section || END_SECTION} onChange={(e) => setExtra(i, { section: e.target.value })}>
          {sections.map((sec) => <option key={sec} value={sec}>In: {sec}</option>)}
        </select>
      </div>
      <button type="button" className="btn btn-sm btn-outline-danger cust-x" aria-label="Delete field" onClick={() => delExtra(i)}>✕</button>
    </div>
  );

  const hidden = draft ? (mode === 'form' ? items : items).filter((x) => it(x.id).hidden) : [];

  return (
    <>
      <button type="button" className="btn btn-outline-secondary customize-btn" onClick={start} title={`Customize ${title}`}><Icon name="sliders" size={15} /> Customize</button>
      {open && draft && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-label={`Customize ${title}`}>
          <div className="confirm-box cust-box">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
              <div>
                <h5 className="mb-1">Customize: {title}</h5>
                <p className="small text-muted mb-0">
                  {mode === 'form'
                    ? 'Rename any heading, switch a box between Text and Dropdown, remove it with ✕, or add new fields. Changes apply for everyone using the portal.'
                    : 'Rename columns, change their order with ↑ ↓, remove them with ✕, or add a column. Excel / CSV / PDF exports follow this list.'}
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setOpen(false)} />
            </div>

            <div className="cust-list">
              {mode === 'form' && items.filter((x) => !it(x.id).hidden).map((x, idx, arr) => {
                const o = it(x.id);
                const head = x.section && (idx === 0 || arr[idx - 1].section !== x.section);
                const added = (draft.extra || []).map((e, i) => ({ e, i })).filter(({ e }) => (e.section || END_SECTION) === x.section);
                const lastOfSection = idx === arr.length - 1 || arr[idx + 1].section !== x.section;
                const type = o.type || (x.type === 'select' ? 'select' : 'text');
                return (
                  <div key={x.id} className="cust-group">
                  {head && <div className="cust-section">{x.section}</div>}
                  <div className="cust-row">
                    <input className="form-control form-control-sm" aria-label={`Heading for ${x.label}`} value={o.label ?? x.label} onChange={(e) => setIt(x.id, { label: e.target.value })} />
                    {x.type === 'fixed'
                      ? <span className="cust-fixed">{x.note || 'Fixed type'}</span>
                      : (
                        <select className="form-select form-select-sm cust-type" aria-label="Box type" value={type} onChange={(e) => setIt(x.id, { type: e.target.value })}>
                          <option value="text">Text box</option>
                          <option value="select">Dropdown</option>
                        </select>
                      )}
                    {type === 'select' && x.type !== 'fixed'
                      ? <input className="form-control form-control-sm" placeholder="Options, comma separated" aria-label="Dropdown options"
                          value={(o.options ?? x.options ?? []).join(', ')} onChange={(e) => setIt(x.id, { options: parseOptions(e.target.value) })} />
                      : <span />}
                    <button type="button" className="btn btn-sm btn-outline-danger cust-x" title="Remove from the form" aria-label={`Remove ${x.label}`} onClick={() => setIt(x.id, { hidden: true })}>✕</button>
                  </div>
                  {lastOfSection && added.map(({ e, i }) => addedRow(e, i))}
                  </div>
                );
              })}

              {mode === 'list' && listIds().map((id) => {
                const base = items.find((x) => x.id === id);
                const ex = (draft.extra || []).find((x) => x.id === id);
                if (base && it(id).hidden) return null;
                const exIdx = ex ? draft.extra.indexOf(ex) : -1;
                return (
                  <div className="cust-row list" key={id}>
                    <div className="btn-group btn-group-sm">
                      <button type="button" className="btn btn-outline-secondary" aria-label="Move up" onClick={() => move(id, -1)}>↑</button>
                      <button type="button" className="btn btn-outline-secondary" aria-label="Move down" onClick={() => move(id, 1)}>↓</button>
                    </div>
                    <input className="form-control form-control-sm" aria-label="Column heading"
                      value={base ? (it(id).title ?? base.title) : ex.title}
                      onChange={(e) => (base ? setIt(id, { title: e.target.value }) : setExtra(exIdx, { title: e.target.value }))} />
                    <span className="cust-fixed">{base ? (base.title !== (it(id).title ?? base.title) ? `was “${base.title}”` : '') : `shows ${fieldChoices.find((c) => c.key === ex.key)?.label || ex.key}`}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger cust-x" title="Remove column" aria-label="Remove column"
                      onClick={() => (base ? setIt(id, { hidden: true }) : delExtra(exIdx))}>✕</button>
                  </div>
                );
              })}

              {mode === 'form' && (() => {
                const shown = new Set(items.filter((x) => !it(x.id).hidden).map((x) => x.section));
                const rest = (draft.extra || []).map((e, i) => ({ e, i })).filter(({ e }) => !shown.has(e.section || END_SECTION));
                return rest.length > 0 && (
                  <div className="cust-group">
                    <div className="cust-section">{END_SECTION}</div>
                    {rest.map(({ e, i }) => addedRow(e, i))}
                  </div>
                );
              })()}
            </div>

            <div className="cust-add">
              <div className="cust-add-title">{mode === 'form' ? '+ Add a field' : '+ Add a column'}</div>
              <div className="cust-row">
                {mode === 'list' && (
                  <select className="form-select form-select-sm" aria-label="Detail to show" value={newItem.key} onChange={(e) => setNewItem({ ...newItem, key: e.target.value })}>
                    {fieldChoices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                )}
                <input className="form-control form-control-sm" placeholder={mode === 'form' ? 'Heading, e.g. Blood Group' : 'Heading (optional)'} value={newItem.label}
                  onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} />
                {mode === 'form' && (
                  <select className="form-select form-select-sm cust-type" aria-label="New field type" value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}>
                    <option value="text">Text box</option>
                    <option value="select">Dropdown</option>
                  </select>
                )}
                {mode === 'form' && (
                  <div className="d-flex gap-1">
                    {newItem.type === 'select' && (
                      <input className="form-control form-control-sm" placeholder="Options, comma separated" value={newItem.options} onChange={(e) => setNewItem({ ...newItem, options: e.target.value })} />
                    )}
                    <select className="form-select form-select-sm" aria-label="Add to section" value={newItem.section} onChange={(e) => setNewItem({ ...newItem, section: e.target.value })}>
                      {sections.map((sec) => <option key={sec} value={sec}>Add to: {sec}</option>)}
                    </select>
                  </div>
                )}
                <button type="button" className="btn btn-sm btn-primary" onClick={add}>Add</button>
              </div>
            </div>

            {hidden.length > 0 && (
              <div className="cust-hidden">
                <span className="text-muted small">Removed:</span>
                {hidden.map((x) => (
                  <button type="button" key={x.id} className="btn btn-sm btn-light border" onClick={() => setIt(x.id, { hidden: false })} title="Put it back">↺ {x.label || x.title}</button>
                ))}
              </div>
            )}

            {msg && <div className="alert alert-warning py-2 mt-2 mb-0">{msg}</div>}
            <div className="d-flex justify-content-between gap-2 mt-3 flex-wrap">
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={reset}>Reset to default</button>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={commit}>Save layout</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
