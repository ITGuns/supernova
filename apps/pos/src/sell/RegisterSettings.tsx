import { useNavigate } from 'react-router-dom';
import { Switch } from '../admin/controls';
import { useRegister } from '../store/registerStore';

export function RegisterSettings() {
  const nav = useNavigate();
  const training = useRegister((s) => s.trainingMode);
  const quickKeys = useRegister((s) => s.quickKeysEnabled);
  const layouts = useRegister((s) => s.layouts);
  const current = useRegister((s) => s.currentLayoutId);
  const toggleTraining = useRegister((s) => s.toggleTraining);
  const toggleQuickKeys = useRegister((s) => s.toggleQuickKeys);
  const addLayout = useRegister((s) => s.addLayout);
  const duplicateLayout = useRegister((s) => s.duplicateLayout);
  const deleteLayout = useRegister((s) => s.deleteLayout);
  const setCurrentLayout = useRegister((s) => s.setCurrentLayout);

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
          <button className="btn-primary" onClick={toggleTraining}>
            {training ? 'Disable training mode' : 'Enable training mode'}
          </button>
          {training && (
            <div className="rs-desc rs-training-note">
              Training mode is on. Sales made on the register are marked as training and won’t
              affect your inventory.
            </div>
          )}
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
            <Switch on={quickKeys} onClick={toggleQuickKeys} />
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
                        <button className="btn-s" onClick={() => setCurrentLayout(l.id)}>Set as current layout</button>
                      )}
                      <button
                        className="rs-ic ic-edit"
                        title="Edit layout"
                        onClick={() => nav(`/sell/settings/layout/${l.id}`)}
                      >
                        ✎
                      </button>
                      <button className="rs-ic" title="Duplicate" onClick={() => duplicateLayout(l.id)}>⧉</button>
                      <button
                        className="rs-ic"
                        title={layouts.length <= 1 ? 'You need at least one layout' : 'Delete'}
                        disabled={layouts.length <= 1}
                        onClick={() => deleteLayout(l.id)}
                      >
                        🗑
                      </button>
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
