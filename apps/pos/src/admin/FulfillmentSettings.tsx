import { useWorkflows } from '../store/workflowStore';
import { useSetup } from '../store/setupStore';
import { MoneyInput } from './NumInput';

function Chk({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <div className="chk-row" onClick={onClick}>
      <span className={`chk ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
      <div>
        <div className="chk-label">{label}</div>
        {hint && <div className="chk-hint">{hint}</div>}
      </div>
    </div>
  );
}

/** Setup → Fulfillments: how customer orders are packed, picked up and delivered. */
export function FulfillmentSettings() {
  const f = useWorkflows((s) => s.fulfillment);
  const setF = useWorkflows((s) => s.setFulfillment);
  const outlets = useSetup((s) => s.outlets);

  return (
    <>
      <h1 className="page-title">Fulfillments</h1>
      <div className="page-subbar">Manage fulfillment settings. <span className="rlink">Need help?</span></div>
      <div className="setwrap">
        <div className="setrow">
          <div>
            <div className="set-h">Sell across stores</div>
            <div className="set-desc">Fulfill sales using stock from other outlets when needed. <span className="rlink">Learn more about selling across stores</span></div>
          </div>
          <div className="set-fields">
            <Chk on={f.sellAcrossStores} onClick={() => setF({ sellAcrossStores: !f.sellAcrossStores })} label="Allow selling stock from other outlets" hint={outlets.length > 1 ? `Orders are routed to whichever of your ${outlets.length} outlets has the stock.` : 'You have one outlet — add more under Outlets and registers to route orders between them.'} />
          </div>
        </div>
        <div className="setrow">
          <div>
            <div className="set-h">Customer pickup</div>
            <div className="set-desc">Customers pay now and collect from the store when the order is ready.</div>
          </div>
          <div className="set-fields">
            <Chk on={f.pickupEnabled} onClick={() => setF({ pickupEnabled: !f.pickupEnabled })} label="Offer customer pickup at the register" />
            <Chk on={f.readyNotification} onClick={() => setF({ readyNotification: !f.readyNotification })} label="Email the customer when their order is ready to collect" />
            <div className="set-field">
              <label>Pickup instructions</label>
              <input className="set-input" value={f.pickupInstructions} onChange={(e) => setF({ pickupInstructions: e.target.value })} placeholder="e.g. Collect from the front desk, Mon–Fri 9–5" />
            </div>
          </div>
        </div>
        <div className="setrow">
          <div>
            <div className="set-h">Delivery</div>
            <div className="set-desc">Pack and deliver orders to the customer’s address.</div>
          </div>
          <div className="set-fields">
            <Chk on={f.deliveryEnabled} onClick={() => setF({ deliveryEnabled: !f.deliveryEnabled })} label="Offer delivery at the register" />
            <div className="set-field">
              <label>Delivery fee</label>
              <span className="pe-money"><span>$</span><MoneyInput className="set-input" minor={f.deliveryFeeMinor} onChange={(v) => setF({ deliveryFeeMinor: v })} placeholder="0.00" /></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
