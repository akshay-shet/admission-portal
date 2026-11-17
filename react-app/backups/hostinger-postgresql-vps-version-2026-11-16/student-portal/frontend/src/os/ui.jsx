/* Academy OS: shared building blocks (tiles, chips, cards, table, drawer, modal) */
import { useMemo, useState } from 'react';
import { exportXlsx } from './data.js';
import { useStore } from '../store.jsx';
import Icon from '../components/Icon.jsx';
import { niceTitle } from '../utils.js';

export function PageHead({ title, sub, children }) {
  return (
    <div className="os-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="os-sub">{sub}</div>}
      </div>
      <div className="os-actions">{children}</div>
    </div>
  );
}

export const Metric = ({ label, value, note, em }) => (
  <div className={`os-card os-metric${em ? ' em' : ''}`}>
    <label>{label}</label>
    <div className="val">{value}</div>
    {note && <small>{note}</small>}
  </div>
);

const tone = (t) => (/Paid|Verified|Complete|Approved|Active|Converted|Posted|Reconciled|Pass|Confirmed|Fully|Created|Allowed/.test(t) ? 'success'
  : /Overdue|Rejected|Missing|Fail|Inactive|Unpaid|High|Deleted|Hidden|Follow-up due/.test(t) ? 'danger'
    : /Pending|Part|Submitted|Follow|Draft|Unreconciled|Awaited|New|Medium|Contacted|Updated/.test(t) ? 'warning' : 'neutral');
export const Chip = ({ t }) => (t ? <span className={`os-chip ${tone(String(t))}`}>{t}</span> : null);

export function Card({ title, action, children, pad = true }) {
  return (
    <div className="os-card">
      {title && <div className="os-cardhead"><span className="os-kicker">{title}</span>{action}</div>}
      <div className={pad ? 'os-cardbody' : ''}>{children}</div>
    </div>
  );
}

export function BarList({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows.length ? rows.map(([n, v, note]) => (
    <div className="os-barrow" key={n}>
      <div className="os-barlabel"><b>{n}</b><span>{note ?? v}</span></div>
      <div className="os-bartrack"><div className="os-barfill" style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
    </div>
  )) : <div className="os-empty">Nothing to show yet</div>;
}

/** Column chart: [{label, a, b}] (two series) */
export function Columns({ rows, aLabel, bLabel, fmt = (x) => x }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b || 0]));
  return (
    <div>
      <div className="os-chart">
        {rows.map((r) => (
          <div className="os-bgroup" key={r.label} title={`${r.label}: ${aLabel} ${fmt(r.a)}${bLabel ? ` · ${bLabel} ${fmt(r.b)}` : ''}`}>
            <div className="os-bcol" style={{ height: `${(r.a / max) * 100}%` }} />
            {bLabel && <div className="os-bcol gold" style={{ height: `${((r.b || 0) / max) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="os-months">{rows.map((r) => <span key={r.label}>{r.label}</span>)}</div>
      <div className="os-legend"><span className="sw a" />{aLabel}{bLabel && <><span className="sw b" />{bLabel}</>}</div>
    </div>
  );
}

export const Line = ({ k, v }) => <div className="os-line"><span>{k}</span><b>{v}</b></div>;

export function Drawer({ title, sub, onClose, children }) {
  return (
    <div className="os-overlay" onClick={onClose}>
      <aside className="os-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="os-drawerhead">
          <div><strong>{title}</strong><div className="os-sub">{sub}</div></div>
          <button type="button" className="os-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="os-drawerbody">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="confirm-backdrop os-modal-back" onClick={onClose}>
      <div className={`os-modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="os-modalhead"><strong>{title}</strong><button type="button" className="os-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="os-modalbody">{children}</div>
        {footer && <div className="os-modalfoot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Searchable, filterable, paged table with Excel export.
 * columns: [{ title, value: (r) => text, render?: (r) => node, export?: false }]
 */
export function OSTable({ columns, rows, filterBy, filterLabel = 'All statuses', filterOptions, filters = [], dateBy, dateLabel = 'Date', name = 'Export', extraTools, action, initialQuery = '', empty = 'No records yet', pageSize: fixedSize }) {
  const store = useStore();
  const pageSize = fixedSize || Number((store.data.settings || []).find((r) => r.id === 'academy-settings')?.academy?.rows_per_page) || 15;
  const [q, setQ] = useState(initialQuery);
  const [f, setF] = useState('');
  const [fx, setFx] = useState({}); // extra filters by label
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState(null); // [title, dir]
  const [page, setPage] = useState(0);
  const list = (v) => (Array.isArray(v) ? v : [v]).map((x) => String(x ?? '').trim()).filter(Boolean);
  const opts = useMemo(() => filterOptions || (filterBy ? [...new Set(rows.map(filterBy).filter(Boolean))].sort() : []), [rows, filterBy, filterOptions]);
  const fopts = useMemo(() => filters.map((x) => [...new Set(rows.flatMap((r) => list(x.get(r))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))), [rows, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = rows.filter((r) => (!f || filterBy(r) === f)
      && filters.every((x) => !fx[x.label] || list(x.get(r)).includes(fx[x.label]))
      && (!dateBy || (!from && !to) || list(dateBy(r)).some((d) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to)))
      && (!ql || columns.map((c) => String(c.value?.(r) ?? '')).join(' ').toLowerCase().includes(ql)));
    if (sort) {
      const c = columns.find((x) => x.title === sort[0]);
      if (c) {
        const key = c.sortValue || c.value;
        out = [...out].sort((a, b) => {
          const dmy = (v) => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(v ?? '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : v; };
          const x = dmy(key(a)); const y = dmy(key(b));
          const nx = typeof x === 'number' ? x : Number(String(x).replace(/[₹,\s]/g, '')); const ny = typeof y === 'number' ? y : Number(String(y).replace(/[₹,\s]/g, ''));
          const cmp = String(x) !== '' && String(y) !== '' && !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
          return sort[1] === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, f, fx, from, to, sort, columns, filterBy, filters, dateBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = shown.slice(cur * pageSize, cur * pageSize + pageSize);
  const exp = columns.filter((c) => c.export !== false && c.value);
  const doExport = () => exportXlsx(`${name.replace(/[^\w-]+/g, '_')}.xlsx`, exp.map((c) => niceTitle(c.title)), shown.map((r, i) => exp.map((c) => (c.title === 'SL.no' ? i + 1 : c.value(r, i) ?? ''))), name);
  const active = q || f || from || to || Object.values(fx).some(Boolean);
  const clear = () => { setQ(''); setF(''); setFx({}); setFrom(''); setTo(''); setPage(0); };
  const sortBy = (c) => { if (c.export === false && !c.sortValue) return; setSort((s) => (s && s[0] === c.title ? (s[1] === 'asc' ? [c.title, 'desc'] : null) : [c.title, 'asc'])); setPage(0); };
  return (
    <div className="os-card">
      <div className="os-toolrow">
        <div className="input-group input-group-sm os-search">
          <span className="input-group-text dt-search-ico"><Icon name="search" size={14} /></span>
          <input className="form-control form-control-sm" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search" />
        </div>
        {filterBy && (
          <select className="form-select form-select-sm os-select" value={f} onChange={(e) => { setF(e.target.value); setPage(0); }} aria-label="Filter">
            <option value="">{filterLabel}</option>
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        )}
        {filters.map((x, i) => (
          <select key={x.label} className="form-select form-select-sm os-select" value={fx[x.label] || ''} onChange={(e) => { setFx({ ...fx, [x.label]: e.target.value }); setPage(0); }} aria-label={x.label}>
            <option value="">All {x.label.toLowerCase()}</option>
            {fopts[i].map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        {dateBy && (
          <span className="d-inline-flex align-items-center gap-1 os-dates">
            <span className="os-sub">{dateLabel}</span>
            <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} aria-label={`${dateLabel} from`} />
            <span className="os-sub">to</span>
            <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} aria-label={`${dateLabel} to`} />
          </span>
        )}
        {active && <button type="button" className="btn btn-sm btn-link dt-clear" onClick={clear}><Icon name="x" size={13} /> Clear filters</button>}
        {extraTools}
        <span className="flex-grow-1" />
        <span className="dt-count">{shown.length}{shown.length !== rows.length ? ` of ${rows.length}` : ''} record{rows.length === 1 ? '' : 's'}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={doExport} disabled={!shown.length} title="Download this list as an Excel file"><Icon name="download" size={14} /> Excel</button>
        {action}
      </div>
      <div className="table-responsive">
        <table className="table os-table mb-0">
          <thead><tr>{columns.map((c) => { const can = !(c.export === false && !c.sortValue) && c.title !== 'SL.no'; const on = sort && sort[0] === c.title; return <th key={c.title} className={can ? 'os-sortable' : ''} onClick={can ? () => sortBy(c) : undefined} title={can ? 'Click to sort' : undefined}>{niceTitle(c.title)}{on && <span className="dt-caret">{sort[1] === 'asc' ? '▲' : '▼'}</span>}</th>; })}</tr></thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={r.id || r.student_id || i}>{columns.map((c) => <td key={c.title}>{c.render ? c.render(r, cur * pageSize + i) : c.value(r, cur * pageSize + i)}</td>)}</tr>
            ))}
            {!slice.length && <tr><td colSpan={columns.length} className="dataTables_empty"><div className="empty-state"><Icon name={rows.length ? 'search' : 'inbox'} size={28} /><b>{rows.length ? 'No records match your filters' : empty}</b>{rows.length ? <span>Try a different search or <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={clear}>clear the filters</button>.</span> : <span>Records you add will appear here.</span>}</div></td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="os-pager">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button>
          <span>Page {cur + 1} of {pages}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
