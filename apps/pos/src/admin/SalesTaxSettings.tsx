import { useState } from 'react';
import { useSettings, type TaxGroup } from '../store/settingsStore';
import { useSetup } from '../store/setupStore';
import { NumInput } from './NumInput';

// Setup → Sales taxes: the tax rates you charge, groups that combine several
// rates, and which rate each outlet uses by default.

// Display a basis-points rate as a percentage, e.g. 825 → "8.25%".
const pct = (rateBps: number) => `${(rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export function SalesTaxSettings() {
  const taxes = useSettings((s) => s.taxes);
  const addTax = useSettings((s) => s.addTax);
  const updateTax = useSettings((s) => s.updateTax);
  const deleteTax = useSettings((s) => s.deleteTax);
  const taxGroups = useSettings((s) => s.taxGroups);
  const addTaxGroup = useSettings((s) => s.addTaxGroup);
  const updateTaxGroup = useSettings((s) => s.updateTaxGroup);
  const deleteTaxGroup = useSettings((s) => s.deleteTaxGroup);
  const defaultTaxLabel = useSettings((s) => s.defaultTaxLabel);
  const setDefaultTax = useSettings((s) => s.setDefaultTax);
  const outlets = useSetup((s) => s.outlets);
  const outletTaxes = useSetup((s) => s.outletTaxes);
  const setSetup = useSetup((s) => s.set);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [groupEditing, setGroupEditing] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupTaxIds, setGroupTaxIds] = useState<string[]>([]);
  const [outletEditing, setOutletEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isNew = editingId === 'new';
  const openAdd = () => {
    setEditingId('new');
    setEditName('');
    setEditRate('');
    setError('');
  };
  const saveEdit = () => {
    const name = editName.trim();
    const rate = Math.round((parseFloat(editRate) || 0) * 100);
    if (!name) return setError('Enter a name for the tax.');
    if (rate < 0 || rate > 10000) return setError('Enter a rate between 0 and 100%.');
    if (taxes.some((t) => t.id !== editingId && t.label.toLowerCase() === name.toLowerCase())) return setError(`A tax called “${name}” already exists.`);
    if (isNew) addTax(name, rate);
    else if (editingId) updateTax(editingId, { label: name, rateBps: rate });
    setEditingId(null);
  };
  const removeTax = () => {
    if (editingId === null || isNew) return;
    deleteTax(editingId);
    setEditingId(null);
  };

  const groupRate = (g: TaxGroup) => g.taxIds.reduce((a, id) => a + (taxes.find((t) => t.id === id)?.rateBps ?? 0), 0);
  const openGroup = (g?: TaxGroup) => {
    setGroupEditing(g?.id ?? 'new');
    setGroupName(g?.name ?? '');
    setGroupTaxIds(g?.taxIds ?? []);
    setError('');
  };
  const saveGroup = () => {
    const name = groupName.trim();
    if (!name) return setError('Enter a name for the group.');
    if (groupTaxIds.length < 2) return setError('Choose at least two taxes to combine.');
    if (groupEditing === 'new') addTaxGroup(name, groupTaxIds);
    else if (groupEditing) updateTaxGroup(groupEditing, { name, taxIds: groupTaxIds });
    setGroupEditing(null);
  };

  const outletTaxLabel = (outletId: string) => {
    const id = outletTaxes[outletId];
    const tax = id ? taxes.find((t) => t.id === id) : undefined;
    const group = id ? taxGroups.find((g) => g.id === id) : undefined;
    return tax ? `${tax.label} (${pct(tax.rateBps)})` : group ? `${group.name} (${pct(groupRate(group))})` : `${defaultTaxLabel} · store default`;
  };

  return (
    <>
      <div className="crumb">
        Setup <span className="crumb-sep">›</span> Sales Taxes
      </div>
      <h1 className="page-title">Sales Tax</h1>
      <div className="page-subbar">Set up the taxes you charge and the default tax each outlet applies. <span className="rlink">Need help?</span></div>

      <div className="tax-addbar">
        <button className="tax-add-btn" onClick={openAdd}>Add Sales Tax</button>
        <button className="btn-s" onClick={() => openGroup()} disabled={taxes.length < 2} title={taxes.length < 2 ? 'Add at least two taxes to combine them' : ''}>Combine Taxes into a Group</button>
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
            <span className="tax-name">{t.label}{t.label === defaultTaxLabel && <span className="tx-badge open" style={{ marginLeft: 8 }}>Default</span>}</span>
            <span className="r">{pct(t.rateBps)}</span>
            <span>Nova Retail</span>
            <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <span
                className="rlink"
                style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                onClick={() => {
                  setEditingId(t.id);
                  setEditName(t.label);
                  setEditRate(String(t.rateBps / 100));
                  setError('');
                }}
              >
                ✎ Edit
              </span>
              {t.label !== defaultTaxLabel && <span className="rlink" onClick={() => setDefaultTax(t.label)}>Make default</span>}
            </span>
          </div>
        ))}
        {taxGroups.map((g) => (
          <div key={g.id} className="tax-row tax-group">
            <span className="tax-name">
              {g.name} <span className="tx-badge">Group</span>
              <span className="tax-group-members">{g.taxIds.map((id) => taxes.find((t) => t.id === id)?.label ?? '?').join(' + ')}</span>
            </span>
            <span className="r">{pct(groupRate(g))}</span>
            <span>Nova Retail</span>
            <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <span className="rlink" onClick={() => openGroup(g)}>✎ Edit</span>
              <span className="rlink" onClick={() => deleteTaxGroup(g.id)}>Delete</span>
            </span>
          </div>
        ))}
      </div>

      <h2 className="set-h" style={{ marginTop: 28 }}>Default Outlet Taxes</h2>
      <div className="page-subbar">The tax applied to products that use the outlet default. Products can override this with their own tax.</div>
      <div className="tax-table">
        <div className="tax-head tax-head3">
          <span>Outlet Name</span>
          <span>Default Sales Tax</span>
          <span style={{ textAlign: 'center' }}>Edit Outlet</span>
        </div>
        {outlets.map((o) => (
          <div key={o.id} className="tax-row tax-row3">
            <span className="tax-name">{o.name}</span>
            <span>
              {outletEditing === o.id ? (
                <select
                  className="set-select"
                  autoFocus
                  value={outletTaxes[o.id] ?? ''}
                  onChange={(e) => {
                    setSetup({ outletTaxes: { ...outletTaxes, [o.id]: e.target.value } });
                    setOutletEditing(null);
                  }}
                  onBlur={() => setOutletEditing(null)}
                >
                  <option value="">Store default ({defaultTaxLabel})</option>
                  {taxes.map((t) => <option key={t.id} value={t.id}>{t.label} ({pct(t.rateBps)})</option>)}
                  {taxGroups.map((g) => <option key={g.id} value={g.id}>{g.name} ({pct(groupRate(g))})</option>)}
                </select>
              ) : (
                outletTaxLabel(o.id)
              )}
            </span>
            <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span className="rlink" onClick={() => setOutletEditing(o.id)}>✎ Edit</span>
            </span>
          </div>
        ))}
      </div>

      {editingId !== null && (
        <div className="pm-overlay" onClick={() => setEditingId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>{isNew ? 'Add sales tax' : 'Edit sales tax'}</h2>
              <button className="pm-close" onClick={() => setEditingId(null)} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {error && <div className="pe-error" role="alert">{error}</div>}
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>Tax name</label>
                <input className="set-input" value={editName} autoFocus onChange={(e) => { setEditName(e.target.value); setError(''); }} placeholder="e.g. State sales tax" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>Tax rate (%)</label>
                <NumInput className="set-input" value={editRate} onCommit={(t) => { setEditRate(t); setError(''); }} placeholder="e.g. 8.25" style={{ width: '100%', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Entered as a percentage. Products using this tax add it at the register.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                {isNew ? (
                  <span />
                ) : (
                  <button type="button" onClick={removeTax} style={{ background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', padding: '8px 0' }}>
                    Delete tax rate
                  </button>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingId(null)} type="button">Cancel</button>
                  <button className="btn-p" onClick={saveEdit} disabled={!editName.trim()} type="button">{isNew ? 'Add Sales Tax' : 'Save changes'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {groupEditing !== null && (
        <div className="pm-overlay" onClick={() => setGroupEditing(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>{groupEditing === 'new' ? 'Combine Taxes into a Group' : 'Edit tax group'}</h2>
              <button className="pm-close" onClick={() => setGroupEditing(null)} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {error && <div className="pe-error" role="alert">{error}</div>}
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>Group name</label>
                <input className="set-input" value={groupName} autoFocus onChange={(e) => { setGroupName(e.target.value); setError(''); }} placeholder="e.g. State + County" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>Taxes in this group</label>
                {taxes.map((t) => (
                  <label key={t.id} className="pe-check" style={{ margin: '4px 0' }}>
                    <input type="checkbox" checked={groupTaxIds.includes(t.id)} onChange={() => { setGroupTaxIds((ids) => (ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id])); setError(''); }} />
                    <span>{t.label} · {pct(t.rateBps)}</span>
                  </label>
                ))}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Combined rate: <b>{pct(groupTaxIds.reduce((a, id) => a + (taxes.find((t) => t.id === id)?.rateBps ?? 0), 0))}</b>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button className="btn-s" onClick={() => setGroupEditing(null)} type="button">Cancel</button>
                <button className="btn-p" onClick={saveGroup} type="button">{groupEditing === 'new' ? 'Create group' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
