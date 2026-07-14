import { useSetup } from '../store/setupStore';
import { Switch } from './controls';

export function StoreCreditSettings() {
  const on = useSetup((s) => s.storeCreditEnabled);
  const set = useSetup((s) => s.set);

  return (
    <>
      <h1 className="page-title">Store credit</h1>
      <div className="page-subbar">Manage whether store credit is available in-store and online.</div>
      <div className="setwrap">
        <div className="setrow">
          <div>
            <div className="set-h">Enable store credit</div>
          </div>
          <div className="set-fields">
            <Switch on={on} onClick={() => set({ storeCreditEnabled: !on })} />
            <div className="switch-label switch-mt">Enable issuing store credit in my store.</div>
            <div className="switch-desc">
              Disabling store credit means you can’t issue or pay by store credit in Retail POS, and
              customers can’t use store credit online.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
