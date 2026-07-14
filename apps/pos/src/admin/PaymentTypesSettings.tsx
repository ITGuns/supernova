import { useState } from 'react';
import { newId, useSetup, type PaymentType } from '../store/setupStore';
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

// The persisted icon is a free-form string (seeded types use emoji) — anything
// cash-like renders the cash art, everything else the card art.
const kindOf = (icon: string): 'cash' | 'card' => (icon === 'cash' || icon === '💵' ? 'cash' : 'card');

export function PaymentTypesSettings() {
  const types = useSetup((s) => s.paymentTypes);
  const set = useSetup((s) => s.set);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editIcon, setEditIcon] = useState<'cash' | 'card'>('card');

  const openEdit = (t: PaymentType) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditSub(t.sub);
    setEditIcon(kindOf(t.icon));
  };

  const addType = () =>
    set({
      paymentTypes: [
        ...types,
        { id: newId(), name: `Payment ${types.length + 1}`, sub: 'Other payment method', icon: 'card' },
      ],
    });

  const saveEdit = () => {
    if (editingId === null) return;
    set({
      paymentTypes: types.map((t) =>
        t.id === editingId ? { ...t, name: editName, sub: editSub, icon: editIcon } : t,
      ),
    });
    setEditingId(null);
  };

  const deleteType = () => {
    if (editingId === null) return;
    set({ paymentTypes: types.filter((t) => t.id !== editingId) });
    setEditingId(null);
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
            Get everything you need to process sales and get paid, all in one place. Nova Payments
            applications aren’t available in this demo.
          </div>
        </div>
      </div>

      <div className="paytypes-h">Payment types</div>
      <div className="paylist">
        {types.map((t) => (
          <div key={t.id} className="payrow">
            <PayIcon kind={kindOf(t.icon)} />
            <span className="pay-name">
              <span className="rlink" onClick={() => openEdit(t)}>
                {t.name}
              </span>
              {t.sub && <span className="pay-sub">{t.sub}</span>}
            </span>
            <span className="pay-edit" style={{ cursor: 'pointer' }} onClick={() => openEdit(t)}>
              ✎
            </span>
          </div>
        ))}
      </div>

      {editingId !== null && (
        <div className="pm-overlay" onClick={() => setEditingId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>Edit payment type</h2>
              <button className="pm-close" onClick={() => setEditingId(null)} aria-label="Close">
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
                  <button className="btn-s" onClick={() => setEditingId(null)} type="button">
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
