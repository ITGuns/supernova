import { useState } from 'react';

interface Row {
  label: string;
  status: string;
  tone: 'ok' | 'warn' | 'err';
  note: string;
}

const ROWS: Row[] = [
  { label: 'Internet connection', status: 'Online', tone: 'ok', note: 'Connected' },
  { label: 'Nova Hub', status: 'Not connected', tone: 'warn', note: 'Install Nova Hub to use hardware' },
  { label: 'Payment terminal', status: 'Not connected', tone: 'warn', note: 'No terminal paired' },
  { label: 'Receipt printer', status: 'Ready', tone: 'ok', note: 'Browser printing' },
  { label: 'Product sync', status: 'Up to date', tone: 'ok', note: 'Last synced just now' },
  { label: 'Register', status: 'Open', tone: 'ok', note: 'Opened today' },
];

export function RegisterStatus() {
  const [checking, setChecking] = useState(false);

  return (
    <main className="sell-page">
      <div className="sh-headrow">
        <h1 className="sell-title">Status</h1>
        <button className="btn-primary" onClick={() => { setChecking(true); setTimeout(() => setChecking(false), 1200); }}>
          {checking ? 'Checking…' : 'Run diagnostics'}
        </button>
      </div>
      <div className="sell-subbar">Check the status of your register and connected services.</div>

      <div className="st-table">
        {ROWS.map((r) => (
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
