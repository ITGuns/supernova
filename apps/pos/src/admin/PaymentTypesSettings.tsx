import { useState } from 'react';
import { PaymentsGraphic } from './illustrations';

function PayIcon({ kind }: { kind: 'cash' | 'card' }) {
  if (kind === 'cash') {
    return (
      <svg viewBox="0 0 28 20" className="pay-ic-svg" aria-hidden="true">
        <rect x="1" y="1" width="26" height="18" rx="2.5" fill="#dff3e6" stroke="#3fae6b" strokeWidth="1.3" />
        <circle cx="14" cy="10" r="4" fill="none" stroke="#3fae6b" strokeWidth="1.4" />
        <circle cx="5" cy="10" r="1" fill="#3fae6b" />
        <circle cx="23" cy="10" r="1" fill="#3fae6b" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 20" className="pay-ic-svg" aria-hidden="true">
      <rect x="1" y="1" width="26" height="18" rx="2.5" fill="#e2ecf9" stroke="#5b8fd6" strokeWidth="1.3" />
      <rect x="1" y="5" width="26" height="3.5" fill="#5b8fd6" />
      <rect x="5" y="13" width="8" height="2.4" rx="1.2" fill="#9fbfe6" />
    </svg>
  );
}

interface PayType {
  name: string;
  sub: string;
  icon: 'cash' | 'card';
}

export function PaymentTypesSettings() {
  const [types, setTypes] = useState<PayType[]>([
    { name: 'Cash', sub: '', icon: 'cash' },
    { name: 'Card', sub: 'Nova Payments', icon: 'card' },
    { name: 'Gift card', sub: 'Other payment method', icon: 'card' },
    { name: 'Store credit', sub: 'Other payment method', icon: 'card' },
  ]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editIcon, setEditIcon] = useState<'cash' | 'card'>('card');

  const addType = () =>
    setTypes((t) => [
      ...t,
      { name: `Payment ${t.length + 1}`, sub: 'Other payment method', icon: 'card' },
    ]);

  const saveEdit = () => {
    if (editingIndex === null) return;
    setTypes((prev) =>
      prev.map((t, idx) => {
        if (idx === editingIndex) {
          return { name: editName, sub: editSub, icon: editIcon };
        }
        return t;
      })
    );
    setEditingIndex(null);
  };

  const deleteType = () => {
    if (editingIndex === null) return;
    setTypes((prev) => prev.filter((_, idx) => idx !== editingIndex));
    setEditingIndex(null);
  };

  return (
    <>
      <h1 className="page-title">Payment types</h1>
      <div className="subbar-row">
        <span>Add and manage the payments you accept in your stores.</span>
        <button className="btn-p" onClick={addType}>
          Add payment type
        </button>
      </div>

      <div className="promo-card">
        <PaymentsGraphic />
        <div>
          <div className="promo-title">Apply for Nova Payments to process card payments</div>
          <div className="promo-text">
            Get everything you need to process sales and get paid, all in one place. Learn more about the
            Nova Payment application process in our <span className="rlink">Help Center ↗</span>.
          </div>
          <button className="btn-s">Apply now</button>
        </div>
      </div>

      <div className="paytypes-h">Payment types</div>
      <div className="paylist">
        {types.map((t, index) => (
          <div key={`${t.name}-${index}`} className="payrow">
            <PayIcon kind={t.icon} />
            <span className="pay-name">
              <span
                className="rlink"
                onClick={() => {
                  setEditingIndex(index);
                  setEditName(t.name);
                  setEditSub(t.sub);
                  setEditIcon(t.icon);
                }}
              >
                {t.name}
              </span>
              {t.sub && <span className="pay-sub">{t.sub}</span>}
            </span>
            <span
              className="pay-edit"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setEditingIndex(index);
                setEditName(t.name);
                setEditSub(t.sub);
                setEditIcon(t.icon);
              }}
            >
              ✎
            </span>
          </div>
        ))}
      </div>

      {editingIndex !== null && (
        <div className="pm-overlay" onClick={() => setEditingIndex(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>Edit payment type</h2>
              <button className="pm-close" onClick={() => setEditingIndex(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Payment method name
                </label>
                <input
                  className="set-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Cash, Card"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Subtitle / description
                </label>
                <input
                  className="set-input"
                  value={editSub}
                  onChange={(e) => setEditSub(e.target.value)}
                  placeholder="e.g. Other payment method"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Icon / Type
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setEditIcon('cash')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: editIcon === 'cash' ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                      background: editIcon === 'cash' ? 'rgba(75, 61, 245, 0.08)' : 'var(--panel)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <PayIcon kind="cash" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIcon('card')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: editIcon === 'card' ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                      background: editIcon === 'card' ? 'rgba(75, 61, 245, 0.08)' : 'var(--panel)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <PayIcon kind="card" /> Card / Other
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={deleteType}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    padding: '8px 0',
                    outline: 'none',
                  }}
                >
                  Delete payment type
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingIndex(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-p" onClick={saveEdit} disabled={!editName.trim()} type="button">
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
