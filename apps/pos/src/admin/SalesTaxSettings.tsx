import { useState } from 'react';
import { useSettings } from '../store/settingsStore';

// Display a basis-points rate as a percentage, e.g. 825 → "8.25%".
const pct = (rateBps: number) => `${(rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export function SalesTaxSettings() {
  const taxes = useSettings((s) => s.taxes);
  const addTax = useSettings((s) => s.addTax);
  const updateTax = useSettings((s) => s.updateTax);
  const deleteTax = useSettings((s) => s.deleteTax);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');

  const add = () => addTax(`Sales Tax ${taxes.length + 1}`, 0);

  const saveEdit = () => {
    if (editingId === null) return;
    updateTax(editingId, {
      label: editName,
      rateBps: Math.round((parseFloat(editRate) || 0) * 100),
    });
    setEditingId(null);
  };

  const removeTax = () => {
    if (editingId === null) return;
    deleteTax(editingId);
    setEditingId(null);
  };

  return (
    <>
      <div className="crumb">
        Setup <span className="crumb-sep">›</span> Sales Taxes
      </div>
      <h1 className="page-title">Sales Tax</h1>

      <div className="tax-addbar">
        <button className="tax-add-btn" onClick={add}>
          Add Sales Tax
        </button>
      </div>

      <div className="tax-table">
        <div className="tax-head">
          <span>Name</span>
          <span className="r">Rate</span>
          <span>Imported From</span>
          <span style={{ textAlign: 'center' }}>Actions</span>
        </div>
        {taxes.map((t) => (
          <div key={t.id} className="tax-row">
            <span className="tax-name">{t.label}</span>
            <span className="r">{pct(t.rateBps)}</span>
            <span>Nova Retail</span>
            <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span
                className="rlink"
                style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                onClick={() => {
                  setEditingId(t.id);
                  setEditName(t.label);
                  setEditRate(String(t.rateBps / 100));
                }}
              >
                ✎ Edit
              </span>
            </span>
          </div>
        ))}
      </div>

      {editingId !== null && (
        <div className="pm-overlay" onClick={() => setEditingId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>Edit sales tax</h2>
              <button className="pm-close" onClick={() => setEditingId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Tax name
                </label>
                <input
                  className="set-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Sales Tax, Food (0%)"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Tax rate (%)
                </label>
                <input
                  className="set-input"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  placeholder="e.g. 8.25"
                  inputMode="decimal"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Entered as a percentage — this rate drives the default-tax dropdown and checkout.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={removeTax}
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
                  Delete tax rate
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
