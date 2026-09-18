import { useState, type KeyboardEvent } from 'react';
import { useSettings } from '../store/settingsStore';
import { newId, useSetup, type Outlet, type ReceiptTemplate } from '../store/setupStore';
import '../styles/setup.css';

const pct = (rateBps: number) => `${(rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export function OutletsSettings() {
  const [tab, setTab] = useState<'outlets' | 'receipts'>('outlets');
  const outlets = useSetup((s) => s.outlets);
  const templates = useSetup((s) => s.receiptTemplates);
  const set = useSetup((s) => s.set);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Inline rename state: which thing is being renamed, and the draft text.
  const [editingOutlet, setEditingOutlet] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingReg, setEditingReg] = useState<{ outletId: string; idx: number } | null>(null);
  const [draft, setDraft] = useState('');
  const outletTaxes = useSetup((s) => s.outletTaxes);
  const taxes = useSettings((s) => s.taxes);
  const taxGroups = useSettings((s) => s.taxGroups);
  const defaultTaxLabel = useSettings((s) => s.defaultTaxLabel);

  // Add outlet wizard: 1. Details → 2. Registers → 3. Review.
  const [wizard, setWizard] = useState<{ step: 1 | 2 | 3; name: string; taxId: string; address: string; registers: string[] } | null>(null);
  const [wizardError, setWizardError] = useState('');
  const openWizard = () => {
    setWizard({ step: 1, name: '', taxId: '', address: '', registers: ['Register 1'] });
    setWizardError('');
  };
  const finishWizard = () => {
    if (!wizard) return;
    const name = wizard.name.trim();
    if (!name) return setWizardError('Give the outlet a name.');
    if (outlets.some((o) => o.name.toLowerCase() === name.toLowerCase())) return setWizardError(`An outlet called “${name}” already exists.`);
    const id = newId();
    set({
      outlets: [...outlets, { id, name, registers: wizard.registers.map((r) => r.trim()).filter(Boolean).length ? wizard.registers.map((r) => r.trim()).filter(Boolean) : ['Register 1'], address: wizard.address.trim() }],
      outletTaxes: wizard.taxId ? { ...outletTaxes, [id]: wizard.taxId } : outletTaxes,
    });
    setWizard(null);
  };
  const outletTaxLabel = (id: string) => {
    const taxId = outletTaxes[id];
    const tax = taxId ? taxes.find((t) => t.id === taxId) : undefined;
    const group = taxId ? taxGroups.find((g) => g.id === taxId) : undefined;
    return tax ? `${tax.label} (${pct(tax.rateBps)})` : group ? group.name : defaultTaxLabel;
  };
  const addTemplate = () =>
    set({
      receiptTemplates: [...templates, { id: newId(), name: `Receipt template ${templates.length + 1}` }],
    });
  // The last outlet / template can't be removed: sales and receipts need one.
  const deleteOutlet = (id: string) => {
    if (outlets.length <= 1) return;
    set({ outlets: outlets.filter((o) => o.id !== id) });
    setExpanded(null);
  };
  const deleteTemplate = (id: string) => {
    if (templates.length <= 1) return;
    set({ receiptTemplates: templates.filter((t) => t.id !== id) });
  };
  const addRegister = (outletId: string) =>
    set({
      outlets: outlets.map((o): Outlet =>
        o.id === outletId ? { ...o, registers: [...o.registers, `Register ${o.registers.length + 1}`] } : o,
      ),
    });
  const deleteRegister = (outletId: string, idx: number) =>
    set({
      outlets: outlets.map((o): Outlet =>
        o.id === outletId && o.registers.length > 1 ? { ...o, registers: o.registers.filter((_, i) => i !== idx) } : o,
      ),
    });

  const saveOutletName = () => {
    if (editingOutlet !== null) {
      const name = draft.trim();
      if (name) {
        set({ outlets: outlets.map((o): Outlet => (o.id === editingOutlet ? { ...o, name } : o)) });
      }
    }
    setEditingOutlet(null);
  };
  const saveTemplateName = () => {
    if (editingTemplate !== null) {
      const name = draft.trim();
      if (name) {
        set({
          receiptTemplates: templates.map((t): ReceiptTemplate => (t.id === editingTemplate ? { ...t, name } : t)),
        });
      }
    }
    setEditingTemplate(null);
  };
  const saveRegisterName = () => {
    if (editingReg !== null) {
      const name = draft.trim();
      if (name) {
        set({
          outlets: outlets.map((o): Outlet =>
            o.id === editingReg.outletId
              ? { ...o, registers: o.registers.map((r, i) => (i === editingReg.idx ? name : r)) }
              : o,
          ),
        });
      }
    }
    setEditingReg(null);
  };

  const keyHandler = (save: () => void, cancel: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  return (
    <>
      <h1 className="page-title">Outlets and registers</h1>
      {wizard && (
        <div className="pm-overlay" onClick={() => setWizard(null)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>Add outlet · step {wizard.step} of 3</h2>
              <button className="pm-close" onClick={() => setWizard(null)} aria-label="Close">×</button>
            </div>
            <div className="reg-open-body">
              {wizardError && <div className="pe-error" role="alert">{wizardError}</div>}
              {wizard.step === 1 && (
                <>
                  <p className="reg-open-text">Outlets are the physical locations you sell from. Each one has its own registers, default tax and stock.</p>
                  <label className="reg-open-field">
                    <span>Outlet name</span>
                    <input value={wizard.name} autoFocus onChange={(e) => { setWizard({ ...wizard, name: e.target.value }); setWizardError(''); }} placeholder="e.g. Downtown" />
                  </label>
                  <label className="reg-open-field">
                    <span>Default sales tax</span>
                    <select value={wizard.taxId} onChange={(e) => setWizard({ ...wizard, taxId: e.target.value })}>
                      <option value="">Store default ({defaultTaxLabel})</option>
                      {taxes.map((t) => <option key={t.id} value={t.id}>{t.label} ({pct(t.rateBps)})</option>)}
                      {taxGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                  <label className="reg-open-field">
                    <span>Address <span className="pe-hint">(Optional) Printed on receipts</span></span>
                    <input value={wizard.address} onChange={(e) => setWizard({ ...wizard, address: e.target.value })} placeholder="Street, city, state" />
                  </label>
                  <button className="pm-complete" onClick={() => (wizard.name.trim() ? setWizard({ ...wizard, step: 2 }) : setWizardError('Give the outlet a name.'))}>Next</button>
                </>
              )}
              {wizard.step === 2 && (
                <>
                  <p className="reg-open-text">Name the registers at this outlet. You can add more later.</p>
                  {wizard.registers.map((r, i) => (
                    <label key={i} className="reg-open-field">
                      <span>Register {i + 1}</span>
                      <span className="pe-inline">
                        <input value={r} autoFocus={i === wizard.registers.length - 1} onChange={(e) => setWizard({ ...wizard, registers: wizard.registers.map((x, xi) => (xi === i ? e.target.value : x)) })} />
                        {wizard.registers.length > 1 && <button type="button" className="pe-x" onClick={() => setWizard({ ...wizard, registers: wizard.registers.filter((_, xi) => xi !== i) })} aria-label="Remove register">×</button>}
                      </span>
                    </label>
                  ))}
                  <span className="rlink" onClick={() => setWizard({ ...wizard, registers: [...wizard.registers, `Register ${wizard.registers.length + 1}`] })}>+ Add another register</span>
                  <div className="pe-actions" style={{ marginTop: 14 }}>
                    <button className="btn-s" onClick={() => setWizard({ ...wizard, step: 1 })}>Back</button>
                    <button className="pm-complete" onClick={() => setWizard({ ...wizard, step: 3 })}>Next</button>
                  </div>
                </>
              )}
              {wizard.step === 3 && (
                <>
                  <p className="reg-open-text">Review and create the outlet.</p>
                  <dl className="prp-dl">
                    <dt>Outlet</dt><dd>{wizard.name}</dd>
                    <dt>Default tax</dt><dd>{wizard.taxId ? taxes.find((t) => t.id === wizard.taxId)?.label ?? taxGroups.find((g) => g.id === wizard.taxId)?.name : `Store default (${defaultTaxLabel})`}</dd>
                    <dt>Address</dt><dd>{wizard.address || '—'}</dd>
                    <dt>Registers</dt><dd>{wizard.registers.filter((r) => r.trim()).join(', ') || 'Register 1'}</dd>
                  </dl>
                  <div className="pe-actions" style={{ marginTop: 14 }}>
                    <button className="btn-s" onClick={() => setWizard({ ...wizard, step: 2 })}>Back</button>
                    <button className="pm-complete" onClick={finishWizard}>Add outlet</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="sh-tabs">
        <button className={`sh-tab ${tab === 'outlets' ? 'active' : ''}`} onClick={() => setTab('outlets')}>
          Outlets and registers
        </button>
        <button className={`sh-tab ${tab === 'receipts' ? 'active' : ''}`} onClick={() => setTab('receipts')}>
          Receipts
        </button>
      </div>

      {tab === 'outlets' ? (
        <>
          <div className="subbar-row">
            <span>Manage your outlets and registers. <span className="rlink">Need help?</span></span>
            <button className="btn-p" onClick={openWizard}>
              Add outlet
            </button>
          </div>
          <div className="atable">
            <div className="athead out out4">
              <span>Outlet</span>
              <span>Number of registers</span>
              <span>Default tax</span>
              <span />
            </div>
            {outlets.map((o) => (
              <div key={o.id}>
                <div className="arow out out4" onClick={() => setExpanded((e) => (e === o.id ? null : o.id))}>
                  <span className="out-name">
                    <span className={`out-chev ${expanded === o.id ? 'open' : ''}`}>›</span>
                    {editingOutlet === o.id ? (
                      <input
                        className="inline-rename"
                        value={draft}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={saveOutletName}
                        onKeyDown={keyHandler(saveOutletName, () => setEditingOutlet(null))}
                      />
                    ) : (
                      o.name
                    )}
                  </span>
                  <span>
                    {o.registers.length} register{o.registers.length === 1 ? '' : 's'}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <select
                      className="set-select out-tax"
                      value={outletTaxes[o.id] ?? ''}
                      onChange={(e) => set({ outletTaxes: { ...outletTaxes, [o.id]: e.target.value } })}
                      title={outletTaxLabel(o.id)}
                    >
                      <option value="">Store default ({defaultTaxLabel})</option>
                      {taxes.map((t) => <option key={t.id} value={t.id}>{t.label} ({pct(t.rateBps)})</option>)}
                      {taxGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </span>
                  <span
                    className="c out-edit"
                    title="Rename outlet"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft(o.name);
                      setEditingOutlet(o.id);
                      setEditingReg(null);
                    }}
                  >
                    ✎
                  </span>
                </div>
                {expanded === o.id && (
                  <div className="out-expand">
                    {o.registers.map((r, idx) => (
                      <div key={`${o.id}-${idx}`} className="out-reg">
                        {editingReg && editingReg.outletId === o.id && editingReg.idx === idx ? (
                          <input
                            className="inline-rename"
                            value={draft}
                            autoFocus
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={saveRegisterName}
                            onKeyDown={keyHandler(saveRegisterName, () => setEditingReg(null))}
                          />
                        ) : (
                          <span>{r}</span>
                        )}
                        <span className="out-reg-actions">
                          <span
                            className="rlink"
                            onClick={() => {
                              setDraft(r);
                              setEditingReg({ outletId: o.id, idx });
                              setEditingOutlet(null);
                            }}
                          >
                            Edit
                          </span>
                          {o.registers.length > 1 && (
                            <span className="rlink" onClick={() => deleteRegister(o.id, idx)}>
                              Remove
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div className="out-reg out-reg-foot">
                      <span className="rlink" onClick={() => addRegister(o.id)}>+ Add register</span>
                      {outlets.length > 1 && (
                        <span className="rlink out-danger" onClick={() => deleteOutlet(o.id)}>
                          Delete outlet
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="subbar-row">
            <span>Manage your receipt templates.</span>
            <button className="btn-p" onClick={addTemplate}>
              Add receipt template
            </button>
          </div>
          <div className="atable">
            <div className="athead rcpt">
              <span>Template name</span>
              <span>Template style</span>
              <span />
            </div>
            {templates.map((t) => (
              <div key={t.id} className="arow rcpt">
                <span>
                  {editingTemplate === t.id ? (
                    <input
                      className="inline-rename"
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={saveTemplateName}
                      onKeyDown={keyHandler(saveTemplateName, () => setEditingTemplate(null))}
                    />
                  ) : (
                    t.name
                  )}
                </span>
                <span>Thermal</span>
                <span className="c out-edit out-edit-pair">
                  <span
                    title="Rename template"
                    onClick={() => {
                      setDraft(t.name);
                      setEditingTemplate(t.id);
                    }}
                  >
                    ✎
                  </span>
                  {templates.length > 1 && (
                    <span title="Delete template" onClick={() => deleteTemplate(t.id)}>
                      🗑
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
