/* Small notifications in the bottom-right corner: notify('Saved'), notify('Could not save', 'error') */
import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

const listeners = new Set();
let seq = 0;

export function notify(message, tone = 'success', ms = 3200) {
  const t = { id: ++seq, message: String(message || ''), tone, ms };
  listeners.forEach((fn) => fn(t));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (t) => {
      setItems((x) => [...x.slice(-3), t]);
      setTimeout(() => setItems((x) => x.filter((y) => y.id !== t.id)), t.ms);
    };
    listeners.add(add);
    return () => listeners.delete(add);
  }, []);
  if (!items.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`app-toast ${t.tone}`}>
          <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check'} size={16} />
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}
