import { useSetup } from '../store/setupStore';
import { Switch } from './controls';

export function SavedPaymentSettings() {
  const on = useSetup((s) => s.savedPaymentEnabled);
  const set = useSetup((s) => s.set);

  return (
    <>
      <h1 className="page-title">Saved payment methods</h1>
      <div className="page-subbar">Manage whether your store can save customers’ card details.</div>
      <div className="setwrap">
        <div className="setrow">
          <div>
            <div className="set-h">Enable saved payment methods</div>
            <div className="set-desc">
              Allow your business to securely store customer cards and charge them for future sales.
            </div>
            <div className="set-desc" style={{ marginTop: 12 }}>
              Once enabled, you can manage team member access under Setup → Users.
            </div>
          </div>
          <div className="set-fields">
            <div className="switch-inline">
              <Switch on={on} onClick={() => set({ savedPaymentEnabled: !on })} />
              <span className="switch-label">Save payment methods</span>
            </div>
            <div className="switch-desc">
              Customer card information is stored securely and can be charged for future sales.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
