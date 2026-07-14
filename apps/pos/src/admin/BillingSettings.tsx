import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBilling } from '../store/billingStore';
import { useSetup } from '../store/setupStore';
import '../styles/setup.css';
import { LicensesGraphic } from './illustrations';

type Tab = 'account' | 'manage' | 'subs' | 'upgrade';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 109,
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
    id: 'core',
    name: 'Core',
    price: 179,
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
    id: 'plus',
    name: 'Plus',
    price: 339,
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

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BillingSettings() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('account');
  const planId = useSetup((s) => s.billingPlanId);
  const freq = useSetup((s) => s.billingFrequency);
  const setSetup = useSetup((s) => s.set);
  const billing = useBilling();

  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]!;
  // Annual billing is 10% off the monthly rate.
  const annualTotal = Math.round(plan.price * 12 * 0.9);

  const [editingCard, setEditingCard] = useState(false);
  const [cardDraft, setCardDraft] = useState({ name: '', last4: '', expiry: '' });
  const [editingRecipient, setEditingRecipient] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [confirmFlash, setConfirmFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(false);

  const confirmPayment = () => {
    setConfirmFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setConfirmFlash(false), 2500);
  };

  const startCardEdit = () => {
    setCardDraft({ name: billing.cardName, last4: billing.cardLast4, expiry: billing.cardExpiry });
    setEditingCard(true);
  };
  const saveCard = () => {
    billing.set({ cardName: cardDraft.name, cardLast4: cardDraft.last4.slice(-4), cardExpiry: cardDraft.expiry });
    setEditingCard(false);
  };

  const startRecipientEdit = () => {
    setRecipientDraft(billing.recipientEmail);
    setEditingRecipient(true);
  };
  const saveRecipient = () => {
    billing.set({ recipientEmail: recipientDraft });
    setEditingRecipient(false);
  };

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
          <div className="page-subbar">Manage your account and payment details.</div>

          <div className="bill-plan-card">
            <h2>You’re currently on the {plan.name} plan</h2>
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
              <div className="set-desc">Payment details for your Nova Retail account.</div>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Credit card</div>
              <div className="bill-col-desc">
                This credit card is used for all account charges including apps billed by Nova Retail.
              </div>
              {editingCard ? (
                <div className="bill-form">
                  <label>Name on card</label>
                  <input className="set-input" value={cardDraft.name} onChange={(e) => setCardDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name on card" />
                  <label>Card number (last 4 digits)</label>
                  <input className="set-input" value={cardDraft.last4} onChange={(e) => setCardDraft((d) => ({ ...d, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="7248" />
                  <label>Expiry (MM / YYYY)</label>
                  <input className="set-input" value={cardDraft.expiry} onChange={(e) => setCardDraft((d) => ({ ...d, expiry: e.target.value }))} placeholder="03 / 2028" />
                  <div className="bill-form-actions">
                    <button className="btn-p" onClick={saveCard} disabled={!cardDraft.name.trim() || cardDraft.last4.length !== 4}>Save</button>
                    <button className="btn-s" onClick={() => setEditingCard(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bill-detail">{billing.cardName}</div>
                  <div className="bill-detail">•••• •••• •••• {billing.cardLast4}</div>
                  <div className="bill-detail">{billing.cardExpiry}</div>
                  <span className="rlink" onClick={startCardEdit}>Edit payment details</span>
                </>
              )}
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Billing recipient</div>
              <div className="bill-detail">Nova — Downtown</div>
              {editingRecipient ? (
                <div className="bill-form">
                  <label>Billing email</label>
                  <input className="set-input" value={recipientDraft} onChange={(e) => setRecipientDraft(e.target.value)} placeholder="billing@nova.local" />
                  <div className="bill-form-actions">
                    <button className="btn-p" onClick={saveRecipient} disabled={!recipientDraft.trim()}>Save</button>
                    <button className="btn-s" onClick={() => setEditingRecipient(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bill-detail">{billing.recipientEmail}</div>
                  <div className="bill-detail">+1 555 0100</div>
                  <div className="bill-detail">1200 Market St</div>
                  <div className="bill-detail">San Francisco, CA 94103</div>
                  <div className="bill-detail">United States</div>
                  <span className="rlink" onClick={startRecipientEdit}>Edit billing recipient</span>
                </>
              )}
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
                Your plan will renew on August 1, 2026. You will be charged USD{' '}
                {freq === 'monthly' ? usd(plan.price) : usd(annualTotal)}.
              </div>
              <div className="bill-col-h bill-mt">Recent payment</div>
              <div className="bill-col-desc">Your payment on July 1, 2026 for {usd(plan.price)} was successful.</div>
              <span className="rlink" onClick={() => nav('/sell/sales-history')}>View recent transactions</span>
            </div>
            <div className="bill-col">
              <div className="bill-col-h">Frequency</div>
              <div className="bill-col-desc">Your subscription is billed {freq === 'monthly' ? 'monthly' : 'annually'}.</div>
              <span className="rlink" onClick={() => setTab('upgrade')}>Change frequency</span>
            </div>
          </div>

          <div className="bill-cancel-row">
            {cancelNotice ? (
              <span className="saved-flash">This is a demo account — no cancellation was processed.</span>
            ) : askCancel ? (
              <div className="confirm-box">
                <span>Cancel your Nova Retail account? You’ll lose access to the register and back office at the end of your billing period.</span>
                <div className="confirm-actions">
                  <button className="btn-s" onClick={() => setAskCancel(false)}>Keep account</button>
                  <button className="btn-p" onClick={() => { setAskCancel(false); setCancelNotice(true); }}>Yes, cancel account</button>
                </div>
              </div>
            ) : (
              <span className="bill-cancel" onClick={() => setAskCancel(true)}>Cancel account</span>
            )}
          </div>
        </>
      )}

      {tab === 'manage' && (
        <>
          <div className="page-subbar">
            Buy or remove licenses and modules so that you have what you need to run your business.
          </div>
          <div className="bill-notice">
            <LicensesGraphic />
            <div className="bill-notice-text">
              <div className="bill-notice-h">All of your licenses are being used</div>
              <div className="bill-notice-t">
                You have <b>1 outlet</b> and <b>1 register</b> set up. Before you can add more outlets or
                registers, you’ll need to buy more licenses. To remove licenses, delete outlets or
                registers from your setup first.
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
                  <span>1 @ ${plan.price}/mo ({plan.name} plan)</span>
                  <span className="r">${plan.price}/mo</span>
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
          <div className="page-subbar">Upgrade your plan to get the best out of Nova Retail.</div>
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
                <div className="cur-v">{plan.name} 9.0</div>
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
                  ${plan.price}<span>/mo</span>
                </div>
                <div className="cur-sub">USD billed {freq === 'monthly' ? 'monthly' : 'annually'}</div>
              </div>
            </div>
          </div>

          <div className="plan-cards">
            {PLANS.map((p) => {
              const selected = p.id === planId;
              return (
                <div
                  key={p.id}
                  className={`plan-card ${selected ? 'selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSetup({ billingPlanId: p.id })}
                >
                  <div className="plan-name">
                    {selected && <span className="plan-check">✓</span>} {p.name}
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
              );
            })}
          </div>

          <div className="freq-block">
            <div className="freq-title">Billing frequency</div>
            <div className="seg">
              <button
                className={`seg-btn ${freq === 'monthly' ? 'active' : ''}`}
                onClick={() => setSetup({ billingFrequency: 'monthly' })}
              >
                Monthly billing
              </button>
              <button
                className={`seg-btn ${freq === 'annual' ? 'active' : ''}`}
                onClick={() => setSetup({ billingFrequency: 'annual' })}
              >
                Annual billing
              </button>
            </div>
            <div className="freq-total">
              <span>Total (USD)</span>
              <span>{freq === 'monthly' ? usd(plan.price) : usd(annualTotal)}</span>
            </div>
            <div className="save-row">
              <button className="btn-p" onClick={confirmPayment}>Confirm payment details</button>
              {confirmFlash && <span className="saved-flash">✓ Saved — {plan.name} plan, billed {freq === 'monthly' ? 'monthly' : 'annually'}</span>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
