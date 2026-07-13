import { useState } from 'react';
import { Switch } from './controls';

export function SavedPaymentSettings() {
  const [on, setOn] = useState(false);

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
              Once enabled, you can manage team member access under <span className="rlink">User roles</span>.
            </div>
          </div>
          <div className="set-fields">
            <div className="switch-inline">
              <Switch on={on} onClick={() => setOn((v) => !v)} />
              <span className="switch-label">Save payment methods</span>
            </div>
            <div className="switch-desc">
              To store customer card information securely and charge for future sales,{' '}
              <span className="rlink">activate Nova Payments</span>.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
