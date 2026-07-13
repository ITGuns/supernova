import { useState } from 'react';
import { fmt } from '../lib/format';

interface Movement {
  id: string;
  at: string;
  user: string;
  email: string;
  init: string;
  av: string;
  type: string;
  amountMinor: number;
}

export function CashManagement() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [mode, setMode] = useState<'add' | 'remove' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const confirm = () => {
    const val = Math.round(parseFloat(amount || '0') * 100);
    if (!val || val <= 0) {
      setMode(null);
      return;
    }
    setMovements((m) => [
      {
        id: `${Date.now()}`,
        at: 'Just now',
        user: 'Aleina (Aleina)',
        email: 'aleina@nova.local',
        init: 'A',
        av: '#4b3df5',
        type: mode === 'add' ? (note || 'Cash in') : (note || 'Cash out'),
        amountMinor: mode === 'remove' ? -val : val,
      },
      ...m,
    ]);
    setMode(null);
    setAmount('');
    setNote('');
  };

  return (
    <main className="sell-page">
      <div className="csm-headrow">
        <h1 className="sell-title">Cash Management</h1>
        <div className="csm-headbtns">
          <button className="btn-danger" onClick={() => { setMode('remove'); setAmount(''); setNote(''); }}>Remove cash</button>
          <button className="btn-primary" onClick={() => { setMode('add'); setAmount(''); setNote(''); }}>Add cash</button>
        </div>
      </div>
      <div className="sell-subbar">
        Record your cash movements for the day. <span className="rlink">Need help? ↗</span>
      </div>

      {mode && (
        <div className="csm-form">
          <div className="csm-form-h">{mode === 'add' ? 'Add cash' : 'Remove cash'}</div>
          <div className="csm-form-row">
            <div className="csm-fg">
              <label>Amount ($)</label>
              <input type="number" min="0" step="0.01" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="csm-fg wide">
              <label>Reason / note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Petty cash, Bank drop" />
            </div>
          </div>
          <div className="csm-form-actions">
            <button className="btn-ghost-d" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirm}>Confirm</button>
          </div>
        </div>
      )}

      <div className="csm-table">
        <div className="csm-head">
          <span>Date</span>
          <span>User</span>
          <span>Types</span>
          <span className="r">Transactions ($)</span>
        </div>
        {movements.length === 0 && <div className="csm-empty">No cash movements recorded yet.</div>}
        {movements.map((m) => (
          <div key={m.id} className="csm-row">
            <span>{m.at}</span>
            <span className="csm-user">
              <span className="cust-av csm-av" style={{ background: m.av }}>{m.init}</span>
              <span>{m.user}<br /><span className="csm-email">{m.email}</span></span>
            </span>
            <span>{m.type}</span>
            <span className="r">{(m.amountMinor / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
