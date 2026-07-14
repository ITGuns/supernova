import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useRegisterSession } from '../store/registerSessionStore';
import { initials, useUsers } from '../store/userStore';
import '../styles/sell.css';

export function CashManagement() {
  const status = useRegisterSession((s) => s.status);
  const movements = useRegisterSession((s) => s.movements);
  const addMovement = useRegisterSession((s) => s.addMovement);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const currentName = users.find((u) => u.id === currentUserId)?.name ?? 'Staff';
  const [mode, setMode] = useState<'add' | 'remove' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const closed = status === 'closed';

  const confirm = () => {
    const val = Math.round(parseFloat(amount || '0') * 100);
    if (!mode || !val || val <= 0) {
      setMode(null);
      return;
    }
    addMovement({ type: mode === 'add' ? 'ADD' : 'REMOVE', amountMinor: val, note, by: currentName });
    setMode(null);
    setAmount('');
    setNote('');
  };

  return (
    <main className="sell-page">
      <div className="csm-headrow">
        <h1 className="sell-title">Cash Management</h1>
        <div className="csm-headbtns">
          <button className="btn-danger" disabled={closed} onClick={() => { setMode('remove'); setAmount(''); setNote(''); }}>Remove cash</button>
          <button className="btn-primary" disabled={closed} onClick={() => { setMode('add'); setAmount(''); setNote(''); }}>Add cash</button>
        </div>
      </div>
      <div className="sell-subbar">
        Record your cash movements for the day. <Link className="rlink" to="/sell/status">Need help? ↗</Link>
      </div>

      {closed && (
        <div className="sell-note">
          The register is closed — cash movements can only be recorded while a register is open.{' '}
          <Link className="rlink" to="/sell/open-close">Open/Close register</Link>
        </div>
      )}

      {mode && !closed && (
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
        {movements.map((m) => {
          const u = users.find((x) => x.name === m.by);
          return (
            <div key={m.id} className="csm-row">
              <span>{new Date(m.at).toLocaleString()}</span>
              <span className="csm-user">
                <span className="cust-av csm-av" style={{ background: u?.av ?? '#4b3df5' }}>{initials(m.by)}</span>
                <span>{m.by}{u ? <><br /><span className="csm-email">{u.email}</span></> : null}</span>
              </span>
              <span>{m.note || (m.type === 'ADD' ? 'Cash in' : 'Cash out')}</span>
              <span className="r">{m.type === 'REMOVE' ? `-${fmt(m.amountMinor)}` : fmt(m.amountMinor)}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
