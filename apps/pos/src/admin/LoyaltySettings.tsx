import { useState } from 'react';
import { useSetup } from '../store/setupStore';

function Chk({ on }: { on: boolean }) {
  return (
    <span className={`chk ${on ? 'on' : ''}`} role="checkbox" aria-checked={on}>
      {on ? '✓' : ''}
    </span>
  );
}

export function LoyaltySettings() {
  const enabled = useSetup((s) => s.loyaltyEnabled);
  const pct = useSetup((s) => s.loyaltyPct);
  const redemptionMin = useSetup((s) => s.loyaltyRedemptionMin);
  const signupBonus = useSetup((s) => s.loyaltySignupBonus);
  const welcomeEmail = useSetup((s) => s.loyaltyWelcomeEmail);
  const expiry = useSetup((s) => s.loyaltyExpiry);
  const set = useSetup((s) => s.set);

  // The percent field keeps free-form text while typing; the parsed value persists.
  const [pctText, setPctText] = useState(pct.toFixed(2));
  const onPct = (v: string) => {
    setPctText(v);
    set({ loyaltyPct: parseFloat(v) || 0 });
  };

  const earn = pct.toFixed(2);

  if (!enabled) {
    return (
      <>
        <h1 className="page-title">Loyalty</h1>
        <div className="page-subbar">Manage settings for your Retail POS Loyalty program.</div>
        <div className="loy-hero">
          <div className="loy-hero-h">Enable Loyalty to grow repeat business</div>
          <div className="loy-hero-t">Reward customers with a percentage of every sale to spend in-store or online, and watch them come back.</div>
          <button className="btn-p" onClick={() => set({ loyaltyEnabled: true })}>Enable Loyalty</button>
        </div>
        <div className="loy-cards">
          <div className="loy-card">
            <div className="loy-card-ic">🎁</div>
            <div className="loy-card-h">Reward every purchase</div>
            <div className="loy-card-t">Customers earn a set percentage of each sale as Loyalty dollars, in-store and online.</div>
          </div>
          <div className="loy-card">
            <div className="loy-card-ic">🔁</div>
            <div className="loy-card-h">Bring customers back</div>
            <div className="loy-card-t">Balances are redeemed at the register like cash, so shoppers have a reason to return.</div>
          </div>
          <div className="loy-card">
            <div className="loy-card-ic">📈</div>
            <div className="loy-card-h">Track what works</div>
            <div className="loy-card-t">See Loyalty earned and redeemed in reporting and on each customer’s profile.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Loyalty</h1>
      <div className="page-subbar">Manage settings for your Retail POS Loyalty program.</div>

      <div className="setwrap">
        <div className="setrow">
          <div>
            <div className="set-h">Earning percentage</div>
            <div className="set-desc">
              Choose how much Loyalty customers earn as a percentage of the retail price of every sale
              in-store and through Nova eCom.
            </div>
          </div>
          <div className="set-fields">
            <div className="set-field">
              <label>Loyalty earned per sale</label>
              <div className="pct-field">
                <input value={pctText} onChange={(e) => onPct(e.target.value)} inputMode="decimal" />
                <span className="pct-suffix">%</span>
              </div>
              <div className="set-help">
                With this percentage, a customer will earn ${earn} Loyalty on a $100.00 sale.
              </div>
            </div>
          </div>
        </div>

        <div className="setrow">
          <div>
            <div className="set-h">Redemption settings</div>
            <div className="set-desc">Set the requirements to redeem Loyalty.</div>
          </div>
          <div className="set-fields">
            <div className="chk-row" onClick={() => set({ loyaltyRedemptionMin: !redemptionMin })}>
              <Chk on={redemptionMin} />
              <div>
                <div className="chk-label">Set redemption minimum</div>
                <div className="chk-desc">
                  Customers can redeem Loyalty once they meet the minimum balance.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="setrow">
          <div>
            <div className="set-h">Sign-up</div>
            <div className="set-desc">
              Set up a sign-up bonus and welcome email for new Loyalty customers.
            </div>
          </div>
          <div className="set-fields">
            <div className="chk-row" onClick={() => set({ loyaltySignupBonus: !signupBonus })}>
              <Chk on={signupBonus} />
              <div>
                <div className="chk-label">Set sign-up bonus</div>
                <div className="chk-desc">
                  Customers will receive a Loyalty bonus once they confirm their details in the Loyalty
                  sign-up form. New customers can access the form in a welcome email, and guest customers
                  via a link or QR code on the sale receipt.
                </div>
              </div>
            </div>
            <div className="chk-row" onClick={() => set({ loyaltyWelcomeEmail: !welcomeEmail })}>
              <Chk on={welcomeEmail} />
              <div>
                <div className="chk-label">Send welcome email</div>
                <div className="chk-desc">
                  A welcome email with a Loyalty sign-up form will be sent to new customers. Once
                  customers fill out the form, they will receive a sign-up bonus.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="setrow">
          <div>
            <div className="set-h">Expiry</div>
            <div className="set-desc">
              Set an expiry policy to reward loyal customers and maintain your liability. Examine the
              liability of customer Loyalty balances to choose a policy that suits your needs. Ensure your
              Loyalty expiry policy complies with relevant local consumer regulations.
            </div>
          </div>
          <div className="set-fields">
            <div className="set-choices">
              <div
                className={`set-choice ${expiry !== 'Last purchase' ? 'active' : ''}`}
                onClick={() => set({ loyaltyExpiry: 'Never' })}
              >
                <b>No expiry</b>
                <div>Customer Loyalty balances do not expire.</div>
              </div>
              <div
                className={`set-choice ${expiry === 'Last purchase' ? 'active' : ''}`}
                onClick={() => set({ loyaltyExpiry: 'Last purchase' })}
              >
                <b>Expiry based on last purchase date</b>
                <div>
                  Customer Loyalty balances will expire after a specified period of time if they don’t
                  make a purchase where Loyalty is earned or redeemed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="loyalty-disable">
        <span className="bill-cancel" onClick={() => set({ loyaltyEnabled: false })}>
          Disable Loyalty
        </span>
        <div className="setrow">
          <div>
            <div className="set-h">Disable Loyalty</div>
            <div className="set-desc">Customers stop earning Loyalty and can’t redeem it in-store or online. Balances are kept.</div>
          </div>
          <div className="set-fields">
            <button className="btn-s danger" onClick={() => set({ loyaltyEnabled: false })}>
              Disable Loyalty
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
