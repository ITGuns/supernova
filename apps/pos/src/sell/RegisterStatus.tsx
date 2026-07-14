import { useEffect, useState } from 'react';
import { useProducts } from '../store/productStore';
import { useRegisterSession } from '../store/registerSessionStore';

interface Row {
  label: string;
  status: string;
  tone: 'ok' | 'warn' | 'err';
  note: string;
}

export function RegisterStatus() {
  const regStatus = useRegisterSession((s) => s.status);
  const openedAt = useRegisterSession((s) => s.openedAt);
  const productCount = useProducts((s) => s.products.length);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(() => Date.now());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const runDiagnostics = () => {
    setChecking(true);
    setTimeout(() => {
      setOnline(navigator.onLine);
      setLastChecked(Date.now());
      setChecking(false);
    }, 800);
  };

  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  const rows: Row[] = [
    online
      ? { label: 'Internet connection', status: 'Online', tone: 'ok', note: 'Connected' }
      : { label: 'Internet connection', status: 'Offline', tone: 'err', note: 'No internet connection' },
    { label: 'Nova Hub', status: 'Not connected', tone: 'warn', note: 'Install Nova Hub to use hardware' },
    { label: 'Payment terminal', status: 'Not connected', tone: 'warn', note: 'No terminal paired' },
    { label: 'Receipt printer', status: 'Ready', tone: 'ok', note: 'Browser printing' },
    { label: 'Product sync', status: 'Up to date', tone: 'ok', note: `${productCount} product${productCount === 1 ? '' : 's'} synced` },
    regStatus === 'open'
      ? { label: 'Register', status: 'Open', tone: 'ok', note: openedAt ? `Opened ${new Date(openedAt).toLocaleString()}` : 'Opened today' }
      : { label: 'Register', status: 'Closed', tone: 'warn', note: 'Open the register to start selling' },
  ];

  return (
    <main className="sell-page">
      <div className="sh-headrow">
        <h1 className="sell-title">Status</h1>
        <button className="btn-primary" onClick={runDiagnostics} disabled={checking}>
          {checking ? 'Checking…' : 'Run diagnostics'}
        </button>
      </div>
      <div className="sell-subbar">Check the status of your register and connected services. Last checked {time(lastChecked)}.</div>

      <div className="st-table">
        {rows.map((r) => (
          <div key={r.label} className="st-row">
            <span className={`st-dot ${r.tone}`} />
            <span className="st-label">{r.label}</span>
            <span className="st-note">{r.note}</span>
            <span className={`st-status ${r.tone}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
