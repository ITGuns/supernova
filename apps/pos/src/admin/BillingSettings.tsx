import { useState } from 'react';
import { LicensesGraphic } from './illustrations';

type Tab = 'account' | 'manage' | 'subs' | 'upgrade';

const PLANS = [
  {
    name: 'Basic',
    price: 109,
    selected: false,
    groups: [
      {
        h: 'Basic features',
        items: [
          'Integrated payments',
          'Inventory management',
          'Basic sales and tax reporting',
          'Basic Nova eCom',
          'User permission management',
          'Unique customer profiles',
          'Access third-party apps',
          '24/7 Chat support',
          'Store credit & gift cards',
          'Promotions',
        ],
      },
    ],
  },
  {
    name: 'Core',
    price: 179,
    selected: true,
    groups: [
      { h: 'All features in Basic', items: [] },
      {
        h: 'Core features',
        items: [
          'Inventory reporting',
          'Advanced Sales reporting',
          'Mobile Scanner App with selling',
          'Staff performance reporting',
          'Accounting integrations',
          'Advanced Nova eCom',
          'In-store loyalty',
          'Email marketing',
          'eCommerce integrations',
        ],
      },
    ],
  },
  {
    name: 'Plus',
    price: 339,
    selected: false,
    groups: [
      { h: 'All features in Core & Basic', items: [] },
      {
        h: 'Plus features',
        items: [
          'Demand forecasting',
          'Prepared reports',
          'Saved reports',
          'Scheduled reports',
          'Custom user roles',
          'Workflow customization',
          'Developer API access',
          'Single sign-on (SSO)',
          '24/7 phone support',
        ],
      },
    ],
  },
];

export function BillingSettings() {
  const [tab, setTab] = useState<Tab>('account');
  const [freq, setFreq] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      <h1 className="page-title">Billing</h1>
      <div className="sh-tabs">
        <button className={`sh-tab ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>
          Account
        </button>
        <button className={`sh-tab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>
          Manage plan
        </button>
        <button className={`sh-tab ${tab === 'subs' ? 'active' : ''}`} onClick={() => setTab('subs')}>
          App subscriptions
        </button>
        <button className={`sh-tab ${tab === 'upgrade' ? 'active' : ''}`} onClick={() => setTab('upgrade')}>
          Upgrade plan
        </button>
      </div>

      {tab === 'account' && (
        <>
          <div className="page-subbar">
            Manage your account and payment details. <span className="rlink">Want more information? ↗</span>
          </div>

          <div className="bill-plan-card">
            <h2>You’re currently on the Core plan</h2>
            <p>
              Whether you need to add more locations or access our most advanced features, Nova Retail
              can help you upgrade your business.
            </p>
            <button className="btn-p" onClick={() => setTab('upgrade')}>
              View our pricing plans
            </button>
          </div>

          <div className="bill-section">
            <div className="bill-sec-label">
              <div className="set-h">Payment</div>
              <div className="set-desc">
                Payment details for your Nova Retail account.{' '}
                <span className="rlink">Understand how your bills are being charged. ↗</span>
              </div>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Credit card</div>
              <div className="bill-col-desc">
                This credit card is used for all account charges including apps billed by Nova Retail.
              </div>
              <div className="bill-detail">Alex Kim</div>
              <div className="bill-detail">•••• •••• •••• 7248</div>
              <div className="bill-detail">03 / 2028</div>
              <span className="rlink">Edit payment details</span>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Billing recipient</div>
              <div className="bill-detail">Nova — Downtown</div>
              <div className="bill-detail">alex@nova.local</div>
              <div className="bill-detail">+1 555 0100</div>
              <div className="bill-detail">1200 Market St</div>
              <div className="bill-detail">San Francisco, CA 94103</div>
              <div className="bill-detail">United States</div>
              <span className="rlink">Edit billing recipient</span>
            </div>
          </div>

          <div className="bill-divider" />

          <div className="bill-section">
            <div className="bill-sec-label">
              <div className="set-h">Billing</div>
              <div className="set-desc">Billing details for your Nova Retail subscription.</div>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Plan renewal</div>
              <div className="bill-col-desc">
                Your plan will renew on August 1, 2026. You will be charged USD $179.00.
              </div>
              <span className="rlink">Preview next renewal</span>
              <div className="bill-col-h bill-mt">Recent payment</div>
              <div className="bill-col-desc">Your payment on July 1, 2026 for $179.00 was successful.</div>
              <span className="rlink">View details ↗</span>
              <span className="rlink">View recent transactions</span>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Frequency</div>
              <div className="bill-col-desc">Your subscription is billed monthly.</div>
              <span className="rlink">Change frequency</span>
            </div>
          </div>

          <div className="bill-cancel-row">
            <span className="bill-cancel">Cancel account</span>
          </div>
        </>
      )}

      {tab === 'manage' && (
        <>
          <div className="page-subbar">
            Buy or remove licenses and modules so that you have what you need to run your business.{' '}
            <span className="rlink">Want more information? ↗</span>
          </div>
          <div className="bill-notice">
            <LicensesGraphic />
            <div className="bill-notice-text">
              <div className="bill-notice-h">All of your licenses are being used</div>
              <div className="bill-notice-t">
                You have <b>1 outlet</b> and <b>1 register</b> set up. Before you can add more outlets or
                registers, you’ll need to buy more licenses. To remove licenses,{' '}
                <span className="rlink">delete outlets or registers from your setup</span> first.
              </div>
            </div>
          </div>
          <div className="bill-section">
            <div className="bill-sec-label">
              <div className="set-h">Licenses</div>
              <div className="set-desc">
                Charges are based on current licenses bought for outlets and registers. Listed prices are
                exclusive of tax, discounts or account credit.
              </div>
            </div>
            <div className="bill-lic-wrap">
              <button className="btn-s bill-lic-btn" onClick={() => setTab('upgrade')}>
                Edit licenses
              </button>
              <div className="atable">
                <div className="athead lic">
                  <span>Item</span>
                  <span>Number of licenses</span>
                  <span />
                  <span className="r">Total</span>
                </div>
                <div className="arow lic">
                  <span>Outlets</span>
                  <span>1</span>
                  <span>1 @ $179/mo (Core plan)</span>
                  <span className="r">$179/mo</span>
                </div>
                <div className="arow lic">
                  <span>Registers</span>
                  <span>1</span>
                  <span>1 free register</span>
                  <span className="r">$0/mo</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'subs' && (
        <>
          <div className="page-subbar">Manage subscriptions for apps billed through Nova Retail.</div>
          <div className="placeholder-card">
            <div className="placeholder-icon">🧩</div>
            <div className="placeholder-title">No app subscriptions</div>
            <div className="placeholder-hint">
              Apps you subscribe to through the Nova App Store will appear here.
            </div>
          </div>
        </>
      )}

      {tab === 'upgrade' && (
        <>
          <div className="page-subbar">
            Upgrade your plan to get the best out of Nova Retail.{' '}
            <span className="rlink">Want more information? ↗</span>
          </div>
          <div className="bill-section">
            <div className="bill-sec-label">
              <div className="set-h">Your current plan</div>
              <div className="set-desc">
                Details of your current plan and additional modules. Prices don’t include tax, discounts
                or account credits.
              </div>
            </div>
            <div className="cur-plan">
              <div>
                <div className="cur-k">Plan</div>
                <div className="cur-v">Core 9.0</div>
              </div>
              <div>
                <div className="cur-k">Licenses</div>
                <div className="cur-v">1 Outlet, 1 Register</div>
              </div>
              <div>
                <div className="cur-k">Modules</div>
                <div className="cur-v">No modules</div>
              </div>
              <div className="cur-price">
                <div className="cur-k">Current plan price</div>
                <div className="cur-amt">
                  $179<span>/mo</span>
                </div>
                <div className="cur-sub">USD billed monthly</div>
              </div>
            </div>
          </div>

          <div className="plan-cards">
            {PLANS.map((p) => (
              <div key={p.name} className={`plan-card ${p.selected ? 'selected' : ''}`}>
                <div className="plan-name">
                  {p.selected && <span className="plan-check">✓</span>} {p.name}
                </div>
                <div className="plan-price">
                  ${p.price}
                  <span>/ mo</span>
                </div>
                <div className="plan-billed">USD billed monthly</div>
                {p.groups.map((g) => (
                  <div key={g.h} className="plan-group">
                    <div className="plan-group-h">{g.h}</div>
                    {g.items.map((it) => (
                      <div key={it} className="plan-feat">
                        {it}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="freq-block">
            <div className="freq-title">Billing frequency</div>
            <div className="seg">
              <button
                className={`seg-btn ${freq === 'monthly' ? 'active' : ''}`}
                onClick={() => setFreq('monthly')}
              >
                Monthly billing
              </button>
              <button
                className={`seg-btn ${freq === 'annual' ? 'active' : ''}`}
                onClick={() => setFreq('annual')}
              >
                Annual billing
              </button>
            </div>
            <div className="freq-total">
              <span>Total (USD)</span>
              <span>{freq === 'monthly' ? '$179.00' : '$1,932.00'}</span>
            </div>
            <button className="btn-p">Confirm payment details</button>
          </div>
        </>
      )}
    </>
  );
}
