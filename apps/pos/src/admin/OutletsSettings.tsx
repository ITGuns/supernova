import { useState } from 'react';

interface Outlet {
  name: string;
  registers: string[];
}
interface Receipt {
  name: string;
  style: string;
}

export function OutletsSettings() {
  const [tab, setTab] = useState<'outlets' | 'receipts'>('outlets');
  const [outlets, setOutlets] = useState<Outlet[]>([
    { name: 'Main Outlet', registers: ['Main Register'] },
  ]);
  const [receipts, setReceipts] = useState<Receipt[]>([
    { name: 'Standard Receipt', style: 'Thermal' },
  ]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const addOutlet = () =>
    setOutlets((o) => [...o, { name: `Outlet ${o.length + 1}`, registers: ['Register 1'] }]);
  const addReceipt = () =>
    setReceipts((r) => [...r, { name: `Receipt template ${r.length + 1}`, style: 'Thermal' }]);

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
            <span>
              Manage your outlets and registers. <span className="rlink">Need help? ↗</span>
            </span>
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
              <div key={o.name}>
                <div className="arow out" onClick={() => setExpanded((e) => (e === o.name ? null : o.name))}>
                  <span className="out-name">
                    <span className={`out-chev ${expanded === o.name ? 'open' : ''}`}>›</span>
                    {o.name}
                  </span>
                  <span>
                    {o.registers.length} register{o.registers.length === 1 ? '' : 's'}
                  </span>
                  <span className="c out-edit">✎</span>
                </div>
                {expanded === o.name && (
                  <div className="out-expand">
                    {o.registers.map((r) => (
                      <div key={r} className="out-reg">
                        <span>{r}</span>
                        <span className="rlink">Edit</span>
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
            <span>
              Manage your receipt templates. <span className="rlink">Need help? ↗</span>
            </span>
            <button className="btn-p" onClick={addReceipt}>
              Add receipt template
            </button>
          </div>
          <div className="atable">
            <div className="athead rcpt">
              <span>Template name</span>
              <span>Template style</span>
              <span />
            </div>
            {receipts.map((r) => (
              <div key={r.name} className="arow rcpt">
                <span>{r.name}</span>
                <span>{r.style}</span>
                <span className="c out-edit">✎</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
