import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useSettings } from '../store/settingsStore';
import { useSetup } from '../store/setupStore';
import '../styles/setup.css';
import { RadioRow } from './controls';
import { BillingSettings } from './BillingSettings';
import { LoyaltySettings } from './LoyaltySettings';
import { OutletsSettings } from './OutletsSettings';
import { PaymentTypesSettings } from './PaymentTypesSettings';
import { SalesTaxSettings } from './SalesTaxSettings';
import { SavedPaymentSettings } from './SavedPaymentSettings';
import { SecuritySettings } from './SecuritySettings';
import { StoreCreditSettings } from './StoreCreditSettings';
import { UsersSettings } from './UsersSettings';

const NAV: ContextItem[] = [
  { key: 'general', label: 'General' },
  { key: 'billing', label: 'Billing' },
  { key: 'outlets', label: 'Outlets and registers' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'devices', label: 'Devices and label printing' },
  { key: 'payments', label: 'Payment types' },
  { key: 'onaccount', label: 'On-account' },
  { key: 'taxes', label: 'Sales taxes' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'users', label: 'Users' },
  { key: 'security', label: 'Security' },
  { key: 'apps', label: 'Apps' },
  { key: 'storecredit', label: 'Store credit' },
  { key: 'saved', label: 'Saved payment methods' },
];

const CURRENCIES = [
  'USD — United States Dollar',
  'EUR — Euro',
  'GBP — British Pound Sterling',
  'CAD — Canadian Dollar',
  'AUD — Australian Dollar',
];

const TIME_ZONES = [
  '(UTC-08:00) Pacific Time (US & Canada)',
  '(UTC-07:00) Mountain Time (US & Canada)',
  '(UTC-06:00) Central Time (US & Canada)',
  '(UTC-05:00) Eastern Time (US & Canada)',
  '(UTC+00:00) London',
  '(UTC+10:00) Sydney',
];

const BARCODE_OPTIONS = ['Disabled', 'Only allow SKUs', 'Allow embedded prices', 'Allow embedded weights'];

const APPS = [
  { id: 'acct', name: 'Nova Accounting', cat: 'Accounting', icon: '📊', color: '#4b3df5', desc: 'Sync sales, taxes and payouts to your books automatically.' },
  { id: 'shiftly', name: 'shiftly', cat: 'Team management', icon: '🕒', color: '#6d3bf5', desc: 'Scheduling, time cards and team activity for hourly teams.' },
  { id: 'reach', name: 'Reachbox', cat: 'Marketing', icon: '✉️', color: '#e0483f', desc: 'Email campaigns and automations powered by your sales data.' },
  { id: 'ecom', name: 'Nova eCom', cat: 'eCommerce', icon: '🛒', color: '#3fae6b', desc: 'Publish your catalog and sync inventory to your online store.' },
  { id: 'insight', name: 'Insights+', cat: 'Analytics', icon: '📈', color: '#e6a817', desc: 'Advanced dashboards, forecasting and multi-outlet reporting.' },
  { id: 'loyal', name: 'LoyalLoop', cat: 'Loyalty', icon: '🎁', color: '#7c3aed', desc: 'Run points, rewards and referral programs at the register.' },
];

function Chk({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <label className="set-chk" onClick={onClick}>
      <span className={`set-chk-box ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
      <span>
        {label}
        {hint && <div className="set-chk-hint">{hint}</div>}
      </span>
    </label>
  );
}

export function SetupPage() {
  const nav = useNavigate();
  const [active, setActive] = useState('general');
  const [devTab, setDevTab] = useState<'devices' | 'label'>('label');
  const setup = useSetup();
  const storeName = useSettings((s) => s.storeName);
  const setStoreName = useSettings((s) => s.setStoreName);
  const taxes = useSettings((s) => s.taxes);
  const defaultTaxLabel = useSettings((s) => s.defaultTaxLabel);
  const setDefaultTax = useSettings((s) => s.setDefaultTax);

  // On-account: radio choice derived from the store; "limit" stays selected
  // locally while the limit amount is still being typed.
  const [onAcct, setOnAcct] = useState(() =>
    !setup.onAccountEnabled ? 'no' : setup.onAccountLimit ? 'limit' : 'nolimit',
  );
  const pickOnAcct = (v: string) => {
    setOnAcct(v);
    if (v === 'no') setup.set({ onAccountEnabled: false });
    else if (v === 'nolimit') setup.set({ onAccountEnabled: true, onAccountLimit: '' });
    else setup.set({ onAccountEnabled: true });
  };

  // Contact information: edited as a draft, persisted on Save.
  const [contact, setContact] = useState(() => ({
    firstName: setup.contactFirstName,
    lastName: setup.contactLastName,
    email: setup.contactEmail,
    phone: setup.contactPhone,
    website: setup.contactWebsite,
    twitter: setup.contactTwitter,
    street1: setup.contactStreet1,
    street2: setup.contactStreet2,
    suburb: setup.contactSuburb,
    city: setup.contactCity,
    zip: setup.contactZip,
    state: setup.contactState,
    country: setup.contactCountry,
  }));
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const c = (k: keyof typeof contact) => ({
    value: contact[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setContact((prev) => ({ ...prev, [k]: e.target.value })),
  });
  const saveGeneral = () => {
    setup.set({
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      contactWebsite: contact.website,
      contactTwitter: contact.twitter,
      contactStreet1: contact.street1,
      contactStreet2: contact.street2,
      contactSuburb: contact.suburb,
      contactCity: contact.city,
      contactZip: contact.zip,
      contactState: contact.state,
      contactCountry: contact.country,
    });
    setSavedFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2000);
  };

  const label = NAV.find((n) => n.key === active)?.label ?? 'Setup';

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'general' && (
            <>
              <h1 className="page-title">General setup</h1>
              <div className="page-subbar">Configure your store settings and contact information.</div>
              <div className="setwrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Store settings</div>
                    <div className="set-desc">Update your store name, currency and timezone.</div>
                  </div>
                  <div className="set-fields">
                    <div className="set-two">
                      <div className="set-field">
                        <label>Store name</label>
                        <input className="set-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                      </div>
                      <div className="set-field">
                        <label>Private URL</label>
                        <input className="set-input" defaultValue="nova-downtown.retail.novapos.io" readOnly />
                      </div>
                    </div>
                    <div className="set-two">
                      <div className="set-field">
                        <label>Default currency</label>
                        <select className="set-select" value={setup.currency} onChange={(e) => setup.set({ currency: e.target.value })}>
                          {CURRENCIES.map((cur) => <option key={cur}>{cur}</option>)}
                        </select>
                      </div>
                      <div className="set-field">
                        <label>Time zone</label>
                        <select className="set-select" value={setup.timeZone} onChange={(e) => setup.set({ timeZone: e.target.value })}>
                          {TIME_ZONES.map((tz) => <option key={tz}>{tz}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="setrow">
                  <div><div className="set-h">Tax settings</div></div>
                  <div className="set-fields">
                    <div className="set-field">
                      <label>Default sales tax</label>
                      <select className="set-select" value={defaultTaxLabel} onChange={(e) => setDefaultTax(e.target.value)}>
                        {taxes.map((o) => <option key={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="setrow">
                  <div>
                    <div className="set-h">Barcode and SKU settings</div>
                    <div className="set-desc">Control how SKUs are generated and how barcodes will be formatted.</div>
                  </div>
                  <div className="set-fields">
                    <div className="set-sub">SKU GENERATION</div>
                    <Chk on={setup.genSku} onClick={() => setup.set({ genSku: !setup.genSku })} label="Generate SKUs by number" hint="SKUs will be generated by sequence number instead of product name." />
                    {setup.genSku && (
                      <div className="set-field set-indent">
                        <label>Current sequence number</label>
                        <input className="set-input" value={setup.sequenceNumber} onChange={(e) => setup.set({ sequenceNumber: e.target.value })} />
                      </div>
                    )}
                    <div className="set-note">
                      ⓘ We have moved label printing settings to the new “Devices and printing” page{' '}
                      <span className="rlink" onClick={() => setActive('devices')}>here</span>.
                    </div>
                    <div className="set-sub">BARCODES</div>
                    <div className="set-field">
                      <label>Embedded barcodes</label>
                      <select className="set-select" value={setup.embeddedBarcodes} onChange={(e) => setup.set({ embeddedBarcodes: e.target.value })}>
                        {BARCODE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="setrow">
                  <div><div className="set-h">Customer settings</div></div>
                  <div className="set-fields">
                    <Chk on={setup.autoCust} onClick={() => setup.set({ autoCust: !setup.autoCust })} label="Automatically add customers from emailed receipts to the sale" />
                  </div>
                </div>

                <div className="setrow">
                  <div><div className="set-h">Web register scanning behavior</div></div>
                  <div className="set-fields">
                    <Chk on={setup.combineSku} onClick={() => setup.set({ combineSku: !setup.combineSku })} label="Combine items with the same SKU" hint="In the Web register, products with the same SKU will merge into one line item. The quantity will increase as products are added or scanned." />
                  </div>
                </div>

                <div className="setrow">
                  <div>
                    <div className="set-h">Contact information</div>
                    <div className="set-desc">Manage your contact information including name, phone number and address details.</div>
                  </div>
                  <div className="set-fields">
                    <div className="set-sub">BASIC DETAILS</div>
                    <div className="set-two">
                      <div className="set-field"><label>First name</label><input className="set-input" placeholder="Enter first name" {...c('firstName')} /></div>
                      <div className="set-field"><label>Last name</label><input className="set-input" placeholder="Enter last name" {...c('lastName')} /></div>
                    </div>
                    <div className="set-two">
                      <div className="set-field"><label>Email</label><input className="set-input" placeholder="Enter email address" {...c('email')} /></div>
                      <div className="set-field"><label>Phone</label><input className="set-input" placeholder="Enter phone number" {...c('phone')} /></div>
                    </div>
                    <div className="set-two">
                      <div className="set-field"><label>Website</label><input className="set-input" placeholder="Enter website URL" {...c('website')} /></div>
                      <div className="set-field"><label>Twitter</label><input className="set-input" placeholder="Enter Twitter URL" {...c('twitter')} /></div>
                    </div>
                    <div className="set-sub">PHYSICAL ADDRESS</div>
                    <div className="set-two">
                      <div className="set-field"><label>Street address</label><input className="set-input" placeholder="Enter street address line 1" {...c('street1')} /></div>
                      <div className="set-field"><label>Street address</label><input className="set-input" placeholder="Enter street address line 2" {...c('street2')} /></div>
                    </div>
                    <div className="set-two">
                      <div className="set-field"><label>Suburb</label><input className="set-input" placeholder="Enter suburb" {...c('suburb')} /></div>
                      <div className="set-field"><label>City</label><input className="set-input" placeholder="Enter city" {...c('city')} /></div>
                    </div>
                    <div className="set-two">
                      <div className="set-field"><label>ZIP code</label><input className="set-input" placeholder="Enter ZIP code" {...c('zip')} /></div>
                      <div className="set-field"><label>State</label><input className="set-input" placeholder="Enter state" {...c('state')} /></div>
                    </div>
                    <div className="set-field">
                      <label>Country</label>
                      <select className="set-select" {...c('country')}>
                        <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Australia</option>
                      </select>
                    </div>
                    <Chk on={setup.diffPostal} onClick={() => setup.set({ diffPostal: !setup.diffPostal })} label="Use different address for postal address" />
                    <div className="save-row">
                      <button className="btn-p" onClick={saveGeneral}>Save</button>
                      {savedFlash && <span className="saved-flash">✓ Saved</span>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {active === 'apps' && (
            <>
              <h1 className="page-title">Apps</h1>
              <div className="page-subbar">Discover and manage apps and integrations for your store.</div>
              <div className="apps-grid">
                {APPS.map((a) => {
                  const on = setup.connectedApps.includes(a.id);
                  return (
                    <div key={a.id} className="app-card">
                      <div className="app-icon" style={{ background: a.color }}>{a.icon}</div>
                      <div className="app-name">{a.name}</div>
                      <div className="app-cat">{a.cat}</div>
                      <div className="app-desc">{a.desc}</div>
                      <button className={`app-btn ${on ? 'btn-s' : 'btn-p'}`} onClick={() => setup.toggleApp(a.id)}>
                        {on ? '✓ Connected' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {active === 'onaccount' && (
            <>
              <h1 className="page-title">On-account</h1>
              <div className="page-subbar">Manage your store’s on-account settings.</div>
              <div className="dev-wrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Creating new customers</div>
                    <div className="set-desc">Select the default setting for how new customers can use an on-account balance</div>
                  </div>
                  <div className="set-fields">
                    <div className="oa-group-label">Allow on-account balance</div>
                    <div className="oa-radios">
                      <RadioRow value="no" current={onAcct} onSelect={pickOnAcct} label="No" />
                      <RadioRow value="nolimit" current={onAcct} onSelect={pickOnAcct} label="Yes, with no balance limit" />
                      <RadioRow value="limit" current={onAcct} onSelect={pickOnAcct} label="Yes, but with a balance limit" />
                    </div>
                    {onAcct === 'limit' && (
                      <div className="set-field oa-limit">
                        <label>Default balance limit ($)</label>
                        <input className="set-input" placeholder="0.00" value={setup.onAccountLimit} onChange={(e) => setup.set({ onAccountLimit: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {active === 'inventory' && (
            <>
              <h1 className="page-title">Inventory</h1>
              <div className="page-subbar">Manage your store’s inventory settings.</div>
              <div className="dev-wrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Purchase orders</div>
                    <div className="set-desc">Configure purchase order settings for your store.</div>
                  </div>
                  <div className="set-fields">
                    <Chk
                      on={setup.hideOnOrder}
                      onClick={() => setup.set({ hideOnOrder: !setup.hideOnOrder })}
                      label="Hide products on order from Add from Recommendations"
                      hint="Add from recommendations on purchase orders will filter out products that are on order."
                    />
                  </div>
                </div>
                <div className="setrow">
                  <div>
                    <div className="set-h">Replenishment</div>
                    <div className="set-desc">Configure replenishment settings for your store.</div>
                  </div>
                  <div className="set-fields">
                    <div className="set-field">
                      <label>Default replenish method</label>
                      <select className="set-select">
                        <option>Min and max quantity</option>
                        <option>Reorder point</option>
                        <option>Sales velocity</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {active === 'devices' && (
            <>
              <h1 className="page-title">Devices and label printing</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${devTab === 'devices' ? 'active' : ''}`} onClick={() => setDevTab('devices')}>Devices</button>
                <button className={`sh-tab ${devTab === 'label' ? 'active' : ''}`} onClick={() => setDevTab('label')}>Label printing</button>
              </div>
              <div className="page-subbar">
                {devTab === 'devices' ? 'Manage devices and label printing for your store.' : 'Manage label printing settings and customization'}
              </div>
              <div className="dev-wrap">
                {devTab === 'label' ? (
                  <>
                    <div className="setrow">
                      <div>
                        <div className="set-h">Label editor</div>
                        <div className="set-desc">Create and customize printing labels</div>
                      </div>
                      <div className="set-fields">
                        <div className="dev-line">Custom label templates unavailable.</div>
                        <div className="dev-line muted">
                          Connect to Nova Hub on the <span className="rlink" onClick={() => setDevTab('devices')}>Devices tab</span> to enable custom label templates.
                        </div>
                      </div>
                    </div>
                    <div className="setrow">
                      <div><div className="set-h">Settings</div></div>
                      <div className="set-fields">
                        <div className="set-field">
                          <label>Default label type setting</label>
                          <select className="set-select">
                            <option>Continuous feed (wide)</option>
                            <option>Continuous feed (narrow)</option>
                            <option>Die-cut (small)</option>
                            <option>Die-cut (large)</option>
                          </select>
                          <span className="dev-hint">Available settings depend on label printer connected</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="setrow">
                      <div>
                        <div className="set-h">Nova Hub</div>
                        <div className="set-desc">Connect Nova Hub to use receipt printers, cash drawers, scanners and label printers with the Web register.</div>
                      </div>
                      <div className="set-fields">
                        <div className="dev-hub">
                          <div className="dev-hub-title">Nova Hub is not connected</div>
                          <div className="dev-line muted">Nova Hub isn’t available in this demo — hardware and register status are shown on the register status page.</div>
                          <button className="btn-p" onClick={() => nav('/sell/status')}>Open register status</button>
                        </div>
                      </div>
                    </div>
                    <div className="setrow">
                      <div><div className="set-h">Connected devices</div></div>
                      <div className="set-fields">
                        <div className="atable">
                          <div className="athead dev"><span>Device</span><span>Type</span><span className="c">Status</span></div>
                          <div className="dev-empty">No devices connected. Connect Nova Hub to detect your hardware.</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {active === 'taxes' && <SalesTaxSettings />}

          {active === 'payments' && <PaymentTypesSettings />}

          {active === 'outlets' && <OutletsSettings />}

          {active === 'security' && <SecuritySettings />}

          {active === 'storecredit' && <StoreCreditSettings />}

          {active === 'saved' && <SavedPaymentSettings />}

          {active === 'users' && <UsersSettings />}

          {active === 'loyalty' && <LoyaltySettings />}

          {active === 'billing' && <BillingSettings />}

          {!['general', 'inventory', 'onaccount', 'apps', 'devices', 'taxes', 'payments', 'users', 'loyalty', 'billing', 'outlets', 'security', 'storecredit', 'saved'].includes(active) && (
            <>
              <h1 className="page-title">{label}</h1>
              <div className="page-subbar">Manage {label.toLowerCase()} for your store.</div>
              <div className="placeholder-card">
                <div className="placeholder-icon">⚙️</div>
                <div className="placeholder-title">{label}</div>
                <div className="placeholder-hint">This settings page is being built to match X-Series.</div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
