import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { MOVEMENT_LABEL, useRegisterSession, type CashMovementKind } from '../store/registerSessionStore';
import { initials, useUsers } from '../store/userStore';
import '../styles/sell.css';

// Sell → Cash management: record cash going in and out of the drawer during
// the day (cash in / petty cash in / cash out / petty cash out), and set the
// opening float if the register was opened without one.

export function CashManagement() {
  const status = useRegisterSession((s) => s.status);
  const movements = useRegisterSession((s) => s.movements);
  const openingFloat = useRegisterSession((s) => s.openingFloatMinor);
  const addMovement = useRegisterSession((s) => s.addMovement);
  const setOpeningFloat = useRegisterSession((s) => s.setOpeningFloat);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const currentName = users.find((u) => u.id === currentUserId)?.name ?? 'Staff';
  const [mode, setMode] = useState<'add' | 'remove' | null>(null);
  const [kind, setKind] = useState<CashMovementKind>('cash_in');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [floatText, setFloatText] = useState('');
  const [floatNote, setFloatNote] = useState('');
  const closed = status === 'closed';
  const floatNotSet = !closed && openingFloat === 0 && movements.length === 0;

  const open = (m: 'add' | 'remove') => {
    setMode(m);
    setKind(m === 'add' ? 'cash_in' : 'cash_out');
    setAmount('');
    setNote('');
  };

  const confirm = () => {
    const val = Math.round(parseFloat(amount || '0') * 100);
    if (!mode || !val || val <= 0) {
      setMode(null);
      return;
    }
    addMovement({ type: mode === 'add' ? 'ADD' : 'REMOVE', kind, amountMinor: val, note, by: currentName });
    setMode(null);
    setAmount('');
    setNote('');
  };

  if (floatNotSet) {
    return (
      <main className="sell-page">
        <h1 className="sell-title">Cash Management</h1>
        <div className="sell-subbar">
          Set opening cash drawer amount. <Link className="rlink" to="/sell/status">Need help?</Link>
        </div>
        <div className="csm-form">
          <div className="csm-form-row">
            <div className="csm-fg">
              <label>Opening float</label>
              <div className="csm-money"><span>$</span><input type="number" min="0" step="0.01" value={floatText} autoFocus onChange={(e) => setFloatText(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="csm-fg wide">
              <label>Note <span className="csm-opt">Optional</span></label>
              <input value={floatNote} onChange={(e) => setFloatNote(e.target.value)} />
            </div>
          </div>
          <div className="csm-form-actions">
            <button className="btn-primary" onClick={() => setOpeningFloat(Math.max(0, Math.round(parseFloat(floatText || '0') * 100)))}>Set float</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sell-page">
      <div className="csm-headrow">
        <h1 className="sell-title">Cash Management</h1>
        <div className="csm-headbtns">
          <button className="btn-danger" disabled={closed} onClick={() => open('remove')}>Remove cash</button>
          <button className="btn-primary" disabled={closed} onClick={() => open('add')}>Add cash</button>
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
          <div className="csm-kinds" role="group" aria-label="Movement type">
            {(mode === 'add' ? (['cash_in', 'petty_cash_in'] as CashMovementKind[]) : (['cash_out', 'petty_cash_out'] as CashMovementKind[])).map((k) => (
              <button key={k} type="button" className={`csm-kind ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
                <b>{MOVEMENT_LABEL[k]}</b>
                <span>
                  {k === 'cash_in' && 'Cash added to the drawer, such as topping up the float.'}
                  {k === 'petty_cash_in' && 'Change returned after a store expense.'}
                  {k === 'cash_out' && 'Cash removed for tip-outs or safe drops.'}
                  {k === 'petty_cash_out' && 'Cash taken for store expenses like stationery.'}
                </span>
              </button>
            ))}
          </div>
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
          const label = m.kind ? MOVEMENT_LABEL[m.kind] : m.type === 'ADD' ? 'Cash in' : 'Cash out';
          return (
            <div key={m.id} className="csm-row">
              <span>{new Date(m.at).toLocaleString()}</span>
              <span className="csm-user">
                <span className="cust-av csm-av" style={{ background: u?.av ?? '#4b3df5' }}>{initials(m.by)}</span>
                <span>{m.by}{u ? <><br /><span className="csm-email">{u.email}</span></> : null}</span>
              </span>
              <span>{label}{m.note ? <><br /><span className="csm-email">{m.note}</span></> : null}</span>
              <span className="r">{m.type === 'REMOVE' ? `-${fmt(m.amountMinor)}` : fmt(m.amountMinor)}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
