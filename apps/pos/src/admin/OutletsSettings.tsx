import { useState, type KeyboardEvent } from 'react';
import { newId, useSetup, type Outlet, type ReceiptTemplate } from '../store/setupStore';
import '../styles/setup.css';

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

  const addOutlet = () =>
    set({
      outlets: [...outlets, { id: newId(), name: `Outlet ${outlets.length + 1}`, registers: ['Register 1'] }],
    });
  const addTemplate = () =>
    set({
      receiptTemplates: [...templates, { id: newId(), name: `Receipt template ${templates.length + 1}` }],
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
            <span>Manage your outlets and registers.</span>
            <button className="btn-p" onClick={addOutlet}>
              Add outlet
            </button>
          </div>
          <div className="atable">
            <div className="athead out">
              <span>Outlet</span>
              <span>Number of registers</span>
              <span />
            </div>
            {outlets.map((o) => (
              <div key={o.id}>
                <div className="arow out" onClick={() => setExpanded((e) => (e === o.id ? null : o.id))}>
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
                      </div>
                    ))}
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
                <span
                  className="c out-edit"
                  title="Rename template"
                  onClick={() => {
                    setDraft(t.name);
                    setEditingTemplate(t.id);
                  }}
                >
                  ✎
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
