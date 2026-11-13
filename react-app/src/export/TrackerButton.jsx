import { useState } from 'react';
import { useStore } from '../store.jsx';
import { currentRole } from '../os/permissions.js';
import Icon from '../components/Icon.jsx';
import { notify } from '../components/toast.jsx';

/** "Download Excel tracker" button: the complete workbook (Start Here, Summary + charts, master list, level & month lists, payments, pending fees) */
/** The full tracker carries academy-wide totals and charts, so it is for the owner login only */
export default function TrackerButton(props) {
  return currentRole() === 'Employee' ? null : <TrackerButtonInner {...props} />;
}
function TrackerButtonInner({ sheet, className = 'btn btn-outline-success', label = 'Excel Tracker', title }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { downloadTracker } = await import('./index.js');
      await downloadTracker(store.data, sheet);
      notify('Excel tracker downloaded');
    } catch (e) {
      notify(`Could not create the file: ${e?.message || e}`, 'error', 6000);
    }
    setBusy(false);
  };
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className={className} onClick={run} disabled={busy}
        title={title || 'Download the full Student & Fee Tracker workbook: guide, summary with charts, master list, level and month lists, payments and pending fees'}>
        <Icon name="excel" size={15} /> {busy ? 'Preparing…' : String(label).replace(/^[^\w]+\s*/u, '')}
      </button>
    </span>
  );
}

/** For DataTable's Save menu */
export async function trackerFor(data, sheet) {
  const { downloadTracker } = await import('./index.js');
  return downloadTracker(data, sheet);
}
