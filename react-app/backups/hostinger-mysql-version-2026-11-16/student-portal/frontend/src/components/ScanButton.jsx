import { useRef, useState } from 'react';

/**
 * "Scan" next to every Choose File box.
 * 1. Asks the scanner helper running on this PC (scanner/Start-Scanner.bat) to scan with the
 *    connected scanner, and attaches the scanned page as a JPEG.
 * 2. If the helper isn't running (or this is a phone/tablet), offers the device camera instead.
 */
const HELPER = 'http://127.0.0.1:5055';

async function helperAvailable() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const r = await fetch(`${HELPER}/status`, { signal: ctrl.signal, cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export default function ScanButton({ name, label, onScanned, disabled, children }) {
  const [state, setState] = useState('idle'); // idle | checking | scanning | offline | error
  const [msg, setMsg] = useState('');
  const cameraRef = useRef(null);

  const fileName = () => `${(label || name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-scan-${new Date().toISOString().slice(0, 10)}.jpg`;

  const scan = async () => {
    setMsg('');
    setState('checking');
    const status = await helperAvailable();
    if (!status) { setState('offline'); return; }
    if (Array.isArray(status.scanners) && status.scanners.length === 0) {
      setState('error');
      setMsg('No scanner found. Connect and switch on the scanner, then press Scan again.');
      return;
    }
    setState('scanning');
    try {
      const r = await fetch(`${HELPER}/scan`, { cache: 'no-store' });
      if (r.status === 409) { setState('idle'); setMsg('Scan cancelled.'); return; }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Scanner error ${r.status}`);
      }
      const blob = await r.blob();
      const file = new File([blob], fileName(), { type: 'image/jpeg' });
      setState('idle');
      setMsg('');
      onScanned(file);
    } catch (e) {
      setState('error');
      setMsg(`Scan failed: ${e.message}`);
    }
  };

  const onCamera = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) { setState('idle'); onScanned(f); }
  };

  const busy = state === 'checking' || state === 'scanning';
  return (
    <>
      <div className="input-group file-scan">
        {children}
        <button type="button" className="btn btn-outline-primary scan-btn" onClick={scan} disabled={disabled || busy}
          title="Scan from the scanner connected to this PC">
          {state === 'scanning' ? 'Scanning…' : state === 'checking' ? 'Connecting…' : 'Scan'}
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onCamera} />
      {(state === 'offline' || state === 'error' || msg) && (
        <div className={`scan-note ${state === 'error' ? 'is-error' : ''}`} role="status">
          {state === 'offline' ? (
            <>
              Scanner not connected. On this PC, open the portal folder and double-click
              <strong> scanner\Start-Scanner.bat</strong>, keep that window open, then press Scan again.
            </>
          ) : msg}
          {(state === 'offline' || state === 'error') && (
            <div className="scan-note-actions">
              <button type="button" className="btn btn-sm btn-primary" onClick={scan}>Try again</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => cameraRef.current?.click()}>Use camera instead</button>
              <button type="button" className="btn btn-sm btn-link" onClick={() => { setState('idle'); setMsg(''); }}>Close</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
