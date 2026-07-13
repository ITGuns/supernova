import { useState } from 'react';

interface Tax {
  name: string;
  rate: string;
  from: string;
}

export function SalesTaxSettings() {
  const [taxes, setTaxes] = useState<Tax[]>([
    { name: 'Sales Tax', rate: '8.25%', from: 'Nova Retail' },
    { name: 'Food (0%)', rate: '0%', from: 'Nova Retail' },
    { name: 'No Tax', rate: '0%', from: 'Nova Retail' },
  ]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editFrom, setEditFrom] = useState('');

  const addTax = () =>
    setTaxes((t) => [...t, { name: `Sales Tax ${t.length + 1}`, rate: '0%', from: 'Manual' }]);

  const saveEdit = () => {
    if (editingIndex === null) return;
    setTaxes((prev) =>
      prev.map((t, idx) => {
        if (idx === editingIndex) {
          return { name: editName, rate: editRate, from: editFrom };
        }
        return t;
      })
    );
    setEditingIndex(null);
  };

  const deleteTax = () => {
    if (editingIndex === null) return;
    setTaxes((prev) => prev.filter((_, idx) => idx !== editingIndex));
    setEditingIndex(null);
  };

  return (
    <>
      <div className="crumb">
        <span className="rlink">Setup</span> <span className="crumb-sep">›</span> Sales Taxes
      </div>
      <h1 className="page-title">Sales Tax</h1>

      <div className="tax-addbar">
        <button className="tax-add-btn" onClick={addTax}>
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
        {taxes.map((t, i) => (
          <div key={i} className="tax-row">
            <span className="tax-name">{t.name}</span>
            <span className="r">{t.rate}</span>
            <span>{t.from}</span>
            <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span
                className="rlink"
                style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                onClick={() => {
                  setEditingIndex(i);
                  setEditName(t.name);
                  setEditRate(t.rate);
                  setEditFrom(t.from);
                }}
              >
                ✎ Edit
              </span>
            </span>
          </div>
        ))}
      </div>

      {editingIndex !== null && (
        <div className="pm-overlay" onClick={() => setEditingIndex(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>Edit sales tax</h2>
              <button className="pm-close" onClick={() => setEditingIndex(null)} aria-label="Close">
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
                  placeholder="e.g. 8.25%, 0%"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Imported from / source
                </label>
                <input
                  className="set-input"
                  value={editFrom}
                  onChange={(e) => setEditFrom(e.target.value)}
                  placeholder="e.g. Nova Retail, Manual"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={deleteTax}
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
