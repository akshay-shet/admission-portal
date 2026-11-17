import { useMemo, useState, useRef, useEffect } from 'react';
import { saveFile, inArtifact, useStore } from '../store.jsx';
import { batchLabel, niceTitle } from '../utils.js';
import Icon from './Icon.jsx';
import { notify } from './toast.jsx';

const allOf = (label) => {
  const l = String(label || '').toLowerCase();
  const pl = /(ch|sh|ss|s|x)$/.test(l) ? `${l}es` : /[^aeiou]y$/.test(l) ? `${l.slice(0, -1)}ies` : `${l}s`;
  return `All ${pl}`;
};

/**
 * Data grid with integrated Board, Batch & Search filters,
 * unified Save dropdown (Copy, CSV, Excel, PDF, Print, JSON),
 * pagination, and clean headers (no UP/DOWN arrows).
 */
export default function DataTable({
  id,
  columns,
  rows,
  order = [0, 'asc'],
  buttons = true,
  className = 'table table-bordered table-striped table-hover',
  style,
  footer,
  title = 'Student Portal',
  showFilters = true,
  onTracker,
  extraFilters = [],   // [{ key, label, value: (row) => string | string[] }]
  dateFilter,          // { label, value: (row) => 'yyyy-mm-dd' | [...] }
}) {
  const [tempBoard, setTempBoard] = useState('');
  const [tempBatch, setTempBatch] = useState('');
  const [tempSearch, setTempSearch] = useState('');
  const [tempSearchField, setTempSearchField] = useState('');

  const [appliedBoard, setAppliedBoard] = useState('');
  const [appliedBatch, setAppliedBatch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedSearchField, setAppliedSearchField] = useState('');
  const [tempExtra, setTempExtra] = useState({});
  const [appliedExtra, setAppliedExtra] = useState({});
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const asList = (v) => (Array.isArray(v) ? v : [v]).map((x) => String(x ?? '').trim()).filter(Boolean);
  const extraOptions = useMemo(() => extraFilters.map((f) => [...new Set(rows.flatMap((r) => asList(f.value(r))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))), [rows, extraFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sort, setSort] = useState(order);
  const [page, setPage] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const store = useStore();
  const pageLength = Number((store.data.settings || []).find((r) => r.id === 'academy-settings')?.academy?.rows_per_page) || 10;

  // Searchable column fields (exclude row index 'SL.no' and 'Actions')
  const searchFields = useMemo(() => {
    return columns.filter((c) => c.title !== '#' && c.title !== 'SL.no' && c.title !== 'Actions' && c.title !== 'Action' && c.value);
  }, [columns]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSaveOpen(false);
      }
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setSearchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Distinct boards from rows and defaults
  const distinctBoards = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const b = r.board_id || r.board_name;
      if (b) set.add(String(b).trim());
    });
    ['BISE', 'BOSSE', 'KSOU', 'State'].forEach((b) => set.add(b));
    return Array.from(set).filter(Boolean).sort();
  }, [rows]);

  // Distinct batches from rows and defaults
  const distinctBatches = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const b = r.admission_batch || r.batch;
      if (b) set.add(String(b).trim());
    });
    ['1', '2', '3', '4'].forEach((b) => set.add(b));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const handleApply = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAppliedBoard(tempBoard);
    setAppliedBatch(tempBatch);
    setAppliedSearch(tempSearch);
    setAppliedSearchField(tempSearchField);
    setAppliedExtra(tempExtra);
    setAppliedFrom(tempFrom);
    setAppliedTo(tempTo);
    setSearchMenuOpen(false);
    setPage(0);
  };

  // filters apply as soon as they change
  useEffect(() => { handleApply(); }, [tempBoard, tempBatch, tempSearch, tempSearchField, tempExtra, tempFrom, tempTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    setTempBoard('');
    setTempBatch('');
    setTempSearch('');
    setTempSearchField('');
    setAppliedBoard('');
    setAppliedBatch('');
    setAppliedSearch('');
    setAppliedSearchField('');
    setTempExtra({}); setAppliedExtra({}); setTempFrom(''); setTempTo(''); setAppliedFrom(''); setAppliedTo('');
    setSearchMenuOpen(false);
    setPage(0);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (appliedBoard) {
        const b = String(r.board_id || r.board_name || '').toLowerCase();
        if (b !== appliedBoard.toLowerCase()) return false;
      }
      if (appliedBatch) {
        const b = String(r.admission_batch || r.batch || '').toLowerCase();
        if (b !== appliedBatch.toLowerCase()) return false;
      }
      for (const f of extraFilters) {
        const want = appliedExtra[f.key];
        if (want && !asList(f.value(r)).includes(want)) return false;
      }
      if (dateFilter && (appliedFrom || appliedTo)) {
        const ds = asList(dateFilter.value(r)).map((d) => d.slice(0, 10));
        if (!ds.some((d) => (!appliedFrom || d >= appliedFrom) && (!appliedTo || d <= appliedTo))) return false;
      }
      if (appliedSearch) {
        const q = appliedSearch.trim().toLowerCase();
        if (appliedSearchField) {
          const col = columns.find((c) => c.title === appliedSearchField);
          if (col && col.value) {
            const val = String(col.value(r) ?? '').toLowerCase();
            if (!val.includes(q)) return false;
          }
        } else {
          const matches = columns.some((c) => c.value && String(c.value(r) ?? '').toLowerCase().includes(q));
          if (!matches) return false;
        }
      }
      return true;
    });
  }, [rows, appliedBoard, appliedBatch, appliedSearch, appliedSearchField, columns, appliedExtra, appliedFrom, appliedTo, extraFilters, dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const [ci, dir] = sort;
    const col = columns[ci];
    if (!col || !col.value || col.sortKey === false) return filtered;
    const key = col.sortKey || col.value;
    const out = [...filtered];
    out.sort((a, b) => {
      const dmy = (v) => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(v ?? '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : v; };
      const x = dmy(key(a));
      const y = dmy(key(b));
      const nx = Number(x);
      const ny = Number(y);
      const cmp = x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny)
        ? nx - ny
        : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
      return dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageLength));
  const cur = Math.min(page, pages - 1);
  const visible = sorted.slice(cur * pageLength, cur * pageLength + pageLength);
  const exportCols = columns.filter((c) => c.export !== false && c.value);

  const flash = (msg) => { notify(msg); };
  const matrix = () => sorted.map((r, i) => exportCols.map((c) => String(c.exportValue ? c.exportValue(r, i) : c.value(r, i) ?? '')));
  const head = exportCols.map((c) => niceTitle(c.title));

  const doCopy = async () => {
    const text = [head, ...matrix()].map((r) => r.join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`Copied ${sorted.length} rows to clipboard`);
    } catch {
      flash('Copy is blocked here. Use CSV or Excel instead.');
    }
  };

  const doCsv = () => {
    const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [head, ...matrix()].map((r) => r.map(esc).join(',')).join('\n');
    saveFile(`${title}.csv`, '\uFEFF' + csv);
    flash(`Exported ${title}.csv`);
  };

  const doExcel = async () => {
    const { downloadStyledSheet } = await import('../export/index.js');
    await downloadStyledSheet({ filename: `${title}.xlsx`, title, head, rows: matrix(), sheetName: title });
    flash(`Exported ${title}.xlsx`);
  };
  const doTracker = async () => {
    flash('Preparing the Excel tracker…');
    try { const name = await onTracker(); flash(`Exported ${name}`); } catch (e) { flash(`Could not create the tracker: ${e?.message || e}`); }
  };

  const doPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({
      orientation: head.length > 8 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: head.length > 20 ? 'a3' : 'a4',
    });
    doc.setFontSize(14);
    doc.text(title, 40, 32);
    autoTable(doc, {
      head: [head],
      body: matrix(),
      startY: 44,
      styles: { fontSize: head.length > 20 ? 6 : 8 },
      headStyles: { fillColor: [33, 37, 41] },
    });
    saveFile(`${title}.pdf`, doc.output('blob'));
    flash(`Exported ${title}.pdf`);
  };

  const doPrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rowsHtml = matrix().map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
    w.document.write(`<html><head><title>${esc(title)}</title><style>body{font-family:Segoe UI,sans-serif}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #999;padding:4px}</style></head><body><h1>${esc(title)}</h1><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const doJson = () => {
    const data = sorted.map((r, i) => {
      const obj = {};
      exportCols.forEach((c) => {
        obj[c.title] = c.exportValue ? c.exportValue(r, i) : c.value(r, i) ?? '';
      });
      return obj;
    });
    saveFile(`${title}.json`, JSON.stringify(data, null, 2));
    flash(`Exported ${title}.json (${sorted.length} records)`);
  };

  const pageNums = [];
  for (let i = 0; i < pages; i++) {
    if (pages <= 7 || i === 0 || i === pages - 1 || Math.abs(i - cur) <= 1) pageNums.push(i);
    else if (pageNums[pageNums.length - 1] !== '…') pageNums.push('…');
  }

  const anyFilter = !!(tempBoard || tempBatch || tempSearch || tempSearchField || tempFrom || tempTo || Object.values(tempExtra).some(Boolean));
  const sortBy = (ci) => {
    const c = columns[ci];
    if (!c || !c.value || c.sortKey === false) return;
    setSort(([i, d]) => [ci, i === ci && d === 'asc' ? 'desc' : 'asc']);
  };

  return (
    <div className="dataTables_wrapper">
      {/* Filters (apply instantly) + Export menu */}
      <div className="dt-toolbar">
        {showFilters ? (
          <form className="dt-filters" onSubmit={handleApply}>
            <label htmlFor={`${id}-board`} className="visually-hidden">Board</label>
            <select id={`${id}-board`} className="form-select form-select-sm dt-select" value={tempBoard} onChange={(e) => setTempBoard(e.target.value)}>
              <option value="">All boards</option>
              {distinctBoards.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <label htmlFor={`${id}-batch`} className="visually-hidden">Batch</label>
            <select id={`${id}-batch`} className="form-select form-select-sm dt-select" value={tempBatch} onChange={(e) => setTempBatch(e.target.value)}>
              <option value="">All batches</option>
              {distinctBatches.map((b) => <option key={b} value={b}>{batchLabel(b) || b}</option>)}
            </select>
            {extraFilters.map((f, i) => (
              <span key={f.key} className="d-contents">
                <label htmlFor={`${id}-x-${f.key}`} className="visually-hidden">{f.label}</label>
                <select id={`${id}-x-${f.key}`} className="form-select form-select-sm dt-select"
                  value={tempExtra[f.key] || ''} onChange={(e) => setTempExtra({ ...tempExtra, [f.key]: e.target.value })}>
                  <option value="">{allOf(f.label)}</option>
                  {extraOptions[i].map((o) => <option key={o} value={o}>{f.format ? f.format(o) : o}</option>)}
                </select>
              </span>
            ))}
            {dateFilter && (
              <span className="dt-dates">
                <span className="small text-muted">{dateFilter.label || 'Date'}</span>
                <input id={`${id}-from`} type="date" className="form-control form-control-sm" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} aria-label="From date" />
                <span className="small text-muted">to</span>
                <input id={`${id}-to`} type="date" className="form-control form-control-sm" value={tempTo} onChange={(e) => setTempTo(e.target.value)} aria-label="To date" />
              </span>
            )}
            <div className="dt-search" ref={searchDropdownRef}>
              <div className="input-group input-group-sm">
                <button type="button" className="btn btn-outline-secondary dropdown-toggle dt-field" onClick={() => setSearchMenuOpen((prev) => !prev)}
                  title={`Search in: ${tempSearchField ? niceTitle(tempSearchField) : 'All fields'}`}>
                  {tempSearchField ? niceTitle(tempSearchField) : 'All fields'}
                </button>
                <span className="input-group-text dt-search-ico"><Icon name="search" size={14} /></span>
                <input id={`${id}-search`} type="search" className="form-control form-control-sm" aria-label="Search"
                  placeholder={tempSearchField ? `Search ${niceTitle(tempSearchField).toLowerCase()}…` : 'Search…'}
                  value={tempSearch} onChange={(e) => setTempSearch(e.target.value)} autoComplete="off" />
              </div>
              {searchMenuOpen && (
                <ul className="dropdown-menu show shadow dt-menu" style={{ left: 0 }}>
                  <li className="dropdown-header">Search in</li>
                  <li>
                    <button type="button" className={`dropdown-item d-flex justify-content-between ${!tempSearchField ? 'active' : ''}`}
                      onClick={() => { setTempSearchField(''); setSearchMenuOpen(false); }}>
                      <span>All fields</span>{!tempSearchField && <span>✓</span>}
                    </button>
                  </li>
                  <li><hr className="dropdown-divider my-1" /></li>
                  {searchFields.map((c) => (
                    <li key={c.title}>
                      <button type="button" className={`dropdown-item d-flex justify-content-between ${tempSearchField === c.title ? 'active' : ''}`}
                        onClick={() => { setTempSearchField(c.title); setSearchMenuOpen(false); }}>
                        <span>{niceTitle(c.title)}</span>{tempSearchField === c.title && <span>✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {anyFilter && <button type="button" className="btn btn-sm btn-link dt-clear" onClick={handleReset}><Icon name="x" size={13} /> Clear filters</button>}
            <button type="submit" className="visually-hidden" tabIndex={-1}>Apply</button>
          </form>
        ) : (
          <div className="dt-filters">
            <div className="input-group input-group-sm dt-search">
              <span className="input-group-text dt-search-ico"><Icon name="search" size={14} /></span>
              <input id={`${id}-search`} type="search" className="form-control form-control-sm" placeholder="Search…" aria-label="Search"
                value={tempSearch} onChange={(e) => setTempSearch(e.target.value)} />
            </div>
          </div>
        )}

        <div className="dt-right">
          <span className="dt-count">{sorted.length === rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'}` : `${sorted.length} of ${rows.length} records`}</span>
          {buttons && (
            <div className="position-relative" ref={dropdownRef}>
              <button type="button" className="btn btn-outline-secondary btn-sm dropdown-toggle d-inline-flex align-items-center gap-1"
                onClick={() => setSaveOpen((prev) => !prev)} aria-expanded={saveOpen}>
                <Icon name="download" size={14} /> Export
              </button>
              {saveOpen && (
                <ul className="dropdown-menu show shadow dt-menu" style={{ right: 0, left: 'auto' }}>
                  <li className="dropdown-header">Download this list</li>
                  {onTracker && <li><button type="button" className="dropdown-item" onClick={() => { doTracker(); setSaveOpen(false); }}><Icon name="excel" size={14} /> Excel tracker (full workbook)</button></li>}
                  <li><button type="button" className="dropdown-item" onClick={() => { doExcel(); setSaveOpen(false); }}><Icon name="excel" size={14} /> Excel (this list)</button></li>
                  <li><button type="button" className="dropdown-item" onClick={() => { doCsv(); setSaveOpen(false); }}><Icon name="file" size={14} /> CSV</button></li>
                  <li><button type="button" className="dropdown-item" onClick={() => { doPdf(); setSaveOpen(false); }}><Icon name="report" size={14} /> PDF</button></li>
                  {!inArtifact() && <li><button type="button" className="dropdown-item" onClick={() => { doPrint(); setSaveOpen(false); }}><Icon name="print" size={14} /> Print</button></li>}
                  <li><hr className="dropdown-divider my-1" /></li>
                  <li><button type="button" className="dropdown-item" onClick={() => { doCopy(); setSaveOpen(false); }}><Icon name="copy" size={14} /> Copy to clipboard</button></li>
                  <li><button type="button" className="dropdown-item" onClick={() => { doJson(); setSaveOpen(false); }}><Icon name="save" size={14} /> JSON (backup)</button></li>
                </ul>
              )}
            </div>
          )}
        </div>
      </div>


      <div className="dt-scroll">
        <table id={id} className={`${className} dataTable`} style={style}>
          <thead>
            <tr>
              {columns.map((c, i) => {
                const can = c.value && c.sortKey !== false;
                return (
                  <th key={c.title + i} className={can ? 'dt-sortable' : ''} onClick={can ? () => sortBy(i) : undefined}
                    aria-sort={sort[0] === i ? (sort[1] === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {niceTitle(c.title)}{can && sort[0] === i && <span className="dt-caret">{sort[1] === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="dataTables_empty">
                  <div className="empty-state">
                    <Icon name={rows.length === 0 ? 'inbox' : 'search'} size={28} />
                    <b>{rows.length === 0 ? 'No records yet' : 'No records match your filters'}</b>
                    <span>{rows.length === 0 ? 'Records you add will appear here.' : <>Try a different search or <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={handleReset}>clear the filters</button>.</>}</span>
                  </div>
                </td>
              </tr>
            )}
            {visible.map((r, i) => (
              <tr key={r.id}>
                {columns.map((c, ci) => (
                  <td key={ci}>
                    {c.render ? c.render(r, cur * pageLength + i) : c.value(r, cur * pageLength + i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer(visible)}</tfoot>}
        </table>
      </div>

      <div className="dataTables_info">
        {sorted.length === 0
          ? 'Showing 0 to 0 of 0 entries'
          : `Showing ${cur * pageLength + 1} to ${Math.min(sorted.length, (cur + 1) * pageLength)} of ${sorted.length} entries`}
        {rows.length !== sorted.length ? ` (filtered from ${rows.length})` : ''}
      </div>

      <div className="dataTables_paginate">
        <button
          type="button"
          className={`paginate_button previous ${cur === 0 ? 'disabled' : ''}`}
          onClick={() => setPage(Math.max(0, cur - 1))}
        >
          Previous
        </button>
        {pageNums.map((p, i) => (p === '…'
          ? <span key={'e' + i} className="ellipsis">…</span>
          : (
            <button
              type="button"
              key={p}
              className={`paginate_button ${p === cur ? 'current' : ''}`}
              onClick={() => setPage(p)}
            >
              {p + 1}
            </button>
          )))}
        <button
          type="button"
          className={`paginate_button next ${cur >= pages - 1 ? 'disabled' : ''}`}
          onClick={() => setPage(Math.min(pages - 1, cur + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
