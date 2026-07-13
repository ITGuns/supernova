import { useState } from 'react';
import { Switch } from '../admin/controls';

interface Layout {
  id: string;
  name: string;
}

export function RegisterSettings() {
  const [training, setTraining] = useState(false);
  const [quickKeys, setQuickKeys] = useState(true);
  const [layouts, setLayouts] = useState<Layout[]>([
    { id: 'l1', name: 'all of it' },
    { id: 'l2', name: 'New Layout' },
    { id: 'l3', name: 'New Layout' },
  ]);
  const [current, setCurrent] = useState('l1');

  const addLayout = () => setLayouts((l) => [...l, { id: `l${Date.now()}`, name: 'New Layout' }]);
  const copyLayout = (id: string) => {
    const src = layouts.find((l) => l.id === id);
    if (src) setLayouts((l) => [...l, { id: `l${Date.now()}`, name: `${src.name} copy` }]);
  };
  const deleteLayout = (id: string) => setLayouts((l) => (l.length > 1 ? l.filter((x) => x.id !== id) : l));

  return (
    <main className="sell-page">
      <h1 className="sell-title">Settings</h1>
      <div className="sell-subbar">Manage your register settings</div>

      <div className="rs-section">
        <div className="rs-side">
          <div className="cr-h">Training mode</div>
          <div className="rs-desc">Enable training mode if you’re new to Nova Retail and want to learn the ropes. You’ll be selling like a pro in no time.</div>
        </div>
        <div className="rs-main">
          <button className="btn-primary" onClick={() => setTraining((t) => !t)}>
            {training ? 'Disable training mode' : 'Enable training mode'}
          </button>
        </div>
      </div>

      <div className="rs-divider" />

      <div className="rs-section">
        <div className="rs-side">
          <div className="cr-h">Quick keys</div>
          <div className="rs-desc">Assign products as quick keys to help process sales faster. Rename, reposition and recolor keys, or organize your buttons into folders and pages.</div>
        </div>
        <div className="rs-main">
          <div className="rs-toggle-row">
            <Switch on={quickKeys} onClick={() => setQuickKeys((v) => !v)} />
            <div>
              <div className="rs-toggle-label">Enable quick keys for this register</div>
              <div className="rs-desc">Toggle the switch to enable your Quick Keys for your register. You can turn this back on at anytime without losing your settings</div>
            </div>
          </div>

          {quickKeys && (
            <>
              <button className="btn-primary rs-add" onClick={addLayout}>Add layout</button>
              <div className="rs-layouts">
                {layouts.map((l) => (
                  <div key={l.id} className="rs-layout">
                    <span className="rs-layout-name">{l.name}</span>
                    <div className="rs-layout-actions">
                      {current === l.id ? (
                        <span className="rs-current">Current Layout</span>
                      ) : (
                        <button className="btn-s" onClick={() => setCurrent(l.id)}>Set as current layout</button>
                      )}
                      <span className="ic-edit" title="Rename">✎</span>
                      <span className="rs-ic" title="Duplicate" onClick={() => copyLayout(l.id)}>⧉</span>
                      <span className="rs-ic" title="Delete" onClick={() => deleteLayout(l.id)}>🗑</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
