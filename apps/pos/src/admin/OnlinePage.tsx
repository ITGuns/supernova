import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useOnline } from '../store/onlineStore';
import { useProducts } from '../store/productStore';
import { Switch } from './controls';
import '../styles/reporting.css';

// Online: the Lightspeed overview (online store vs AI Showroom) plus the
// setup pages for each option and customer accounts.

const NAV: ContextItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'showroom', label: 'AI Showroom' },
  { key: 'store', label: 'Online store' },
  { key: 'accounts', label: 'Customer Accounts' },
];

const COMPARE: { feature: string; store: boolean; showroom: boolean }[] = [
  { feature: 'Included in your Nova plan', store: true, showroom: true },
  { feature: 'Professional website', store: true, showroom: true },
  { feature: 'Products with up-to-date prices and stock', store: true, showroom: true },
  { feature: 'Location, hours and contact info', store: true, showroom: true },
  { feature: 'Tools to share in-store offers and events', store: true, showroom: true },
  { feature: 'Search visibility on Google, Bing and more', store: true, showroom: true },
  { feature: 'Online checkout and payment options', store: true, showroom: false },
];

export function OnlinePage() {
  const [active, setActive] = useState('overview');
  const enabled = useOnline((s) => s.enabled);
  const subdomain = useOnline((s) => s.subdomain);
  const showroom = useOnline((s) => s.showroom);
  const showroomTagline = useOnline((s) => s.showroomTagline);
  const customerAccounts = useOnline((s) => s.customerAccounts);
  const set = useOnline((s) => s.set);
  const products = useProducts((s) => s.products);
  const live = products.filter((p) => p.enabled);
  const url = `https://${subdomain || 'my-store'}.novashop.com`;

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'overview' && (
            <>
              <div className="on-hero">
                <h1 className="page-title">Go online and grow with a 1.5x advantage</h1>
                <p>Retailers selling in-store and online report higher year-over-year sales growth. Start driving more revenue with online presence options included in your plan.</p>
                <button className="btn-p" onClick={() => setActive('store')}>Explore options</button>
              </div>
              <h2 className="on-h2">What you can achieve with an online presence</h2>
              <div className="on-three">
                <div className="on-card"><b>A new revenue stream</b><span>Sell 24/7 and reach customers beyond your location with an online store that keeps working when your physical store is closed.</span></div>
                <div className="on-card"><b>More customers in-store</b><span>Not ready to sell online? Get found on Google and other search engines with a website that shows your products and locations, so customers come in ready to buy.</span></div>
                <div className="on-card"><b>Stronger customer loyalty</b><span>Build trust by sharing your story, highlighting what makes your business unique and giving customers more reasons to return.</span></div>
              </div>
              <h2 className="on-h2">Take your business online—your way</h2>
              <div className="om-cards">
                <div className={`om-card ${enabled ? 'on' : ''}`}>
                  <div className="om-ic">🛒</div>
                  <div className="om-h">Online store to sell products</div>
                  <div className="om-t">Create an online store to start selling online and open a new revenue stream for your business</div>
                  <ul className="om-list">
                    <li>Fast setup—no tech skills needed</li>
                    <li>Selling products and gift cards</li>
                    <li>Product details and stock that update automatically</li>
                    <li>100+ shipping and payment options</li>
                  </ul>
                  <span className="pe-inline">
                    <button className="btn-p" onClick={() => setActive('store')}>Set up online store</button>
                    <span className="rlink">Learn more</span>
                  </span>
                </div>
                <div className={`om-card ${showroom ? 'on' : ''}`}>
                  <div className="om-ic">✨</div>
                  <div className="om-h">AI Showroom to drive foot traffic</div>
                  <div className="om-t">Get an AI-generated website to bring more customers to your physical store</div>
                  <ul className="om-list">
                    <li>Built with AI specifically for your business</li>
                    <li>Ready to use right away</li>
                    <li>Up-to-date catalog that is easy to find online</li>
                    <li>Location, hours and contact info in one place</li>
                  </ul>
                  <span className="pe-inline">
                    <button className="btn-p" onClick={() => setActive('showroom')}>Set up AI Showroom</button>
                    <span className="rlink">Learn more</span>
                  </span>
                </div>
              </div>
              <h2 className="on-h2">Compare your options</h2>
              <p className="on-p">You can build a modern, trustworthy online presence with an online store or an AI Showroom. Compare what each offers and choose what is best for your goals.</p>
              <table className="pe-table on-compare">
                <thead><tr><th /><th>Online store</th><th>AI Showroom</th></tr></thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.feature}><td>{r.feature}</td><td className="c">{r.store ? '✓' : ''}</td><td className="c">{r.showroom ? '✓' : ''}</td></tr>
                  ))}
                </tbody>
              </table>
              <h2 className="on-h2">Get inspired by demo websites created with Nova</h2>
              <div className="on-demos">
                <div className="on-card"><b>Pawfect Supply</b><span>A demo online store for pet supplies and everyday pet care products.</span><em>pawfect-store.company.site</em></div>
                <div className="on-card"><b>VELOX</b><span>A demo online store for bikes, cycling gear and accessories.</span><em>urbanride-velox.company.site</em></div>
                <div className="on-card"><b>Juniper Home</b><span>A demo AI Showroom for home decor and interior products.</span><em>juniper-home.company.site</em></div>
                <div className="on-card"><b>CROSSWALK</b><span>A demo AI Showroom for fashion, eyewear and accessories.</span><em>crosswalk-store.company.site</em></div>
              </div>
              <h2 className="on-h2">Join thousands of retailers already online with Nova</h2>
              <div className="on-stats">
                <div><b>16</b><span>years in ecommerce</span></div>
                <div><b>100k+</b><span>live online stores and websites</span></div>
              </div>
              <div className="on-card on-help">
                <b>Need help choosing?</b>
                <span>Not sure which option fits your business? Our team will guide you through the options and help you get started.</span>
                <button className="btn-s">Get help</button>
              </div>
            </>
          )}

          {active === 'store' && (
            <>
              <h1 className="page-title">Online store</h1>
              <div className="page-subbar"><span className="page-subbar-text">Sell your catalog online with a hosted storefront.</span></div>
              <div className="fin-cards">
                <div className="fin-card">
                  <div className="fin-card-l">Storefront</div>
                  <div className="fin-card-v">{enabled ? 'Live' : 'Off'}</div>
                  <div className="fin-card-s">{enabled ? 'Customers can browse and order online' : 'Turn on to publish your store'}</div>
                </div>
                <div className="fin-card">
                  <div className="fin-card-l">Products online</div>
                  <div className="fin-card-v">{live.length}</div>
                  <div className="fin-card-s">
                    Active products publish automatically — <Link className="rlink" to="/catalog">manage catalog</Link>
                  </div>
                </div>
              </div>
              <div className="setwrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Online storefront</div>
                    <div className="set-desc">Publish your active products to a hosted storefront at your own address.</div>
                  </div>
                  <div className="set-fields">
                    <div className="switch-inline">
                      <Switch on={enabled} onClick={() => set({ enabled: !enabled })} />
                      <span className="switch-label">{enabled ? 'Storefront is live' : 'Storefront is off'}</span>
                    </div>
                  </div>
                </div>
                <div className="setrow">
                  <div>
                    <div className="set-h">Store address</div>
                    <div className="set-desc">Your storefront’s web address. Letters, numbers and dashes only.</div>
                  </div>
                  <div className="set-fields">
                    <div className="online-urlrow">
                      <input className="set-input" value={subdomain} onChange={(e) => set({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="my-store" />
                      <span className="online-url">{url}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {active === 'showroom' && (
            <>
              <h1 className="page-title">AI Showroom</h1>
              <div className="page-subbar"><span className="page-subbar-text">A lightweight, shareable page that showcases your products so customers visit, call or message to buy.</span></div>
              <div className="setwrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Showroom</div>
                    <div className="set-desc">Built from your active products, store hours and contact details.</div>
                  </div>
                  <div className="set-fields">
                    <div className="switch-inline">
                      <Switch on={showroom} onClick={() => set({ showroom: !showroom })} />
                      <span className="switch-label">{showroom ? 'Showroom is live' : 'Showroom is off'}</span>
                    </div>
                    {showroom && <div className="online-url">{url}/showroom</div>}
                  </div>
                </div>
                <div className="setrow">
                  <div>
                    <div className="set-h">Tagline</div>
                    <div className="set-desc">One line at the top of the showroom.</div>
                  </div>
                  <div className="set-fields">
                    <input className="set-input" value={showroomTagline} onChange={(e) => set({ showroomTagline: e.target.value })} placeholder="e.g. Curated gear for every ride" />
                  </div>
                </div>
              </div>
            </>
          )}

          {active === 'accounts' && (
            <>
              <h1 className="page-title">Customer Accounts</h1>
              <div className="page-subbar"><span className="page-subbar-text">Let customers sign in to your online store to see their orders, balances and saved details.</span></div>
              <div className="setwrap">
                <div className="setrow">
                  <div>
                    <div className="set-h">Customer accounts</div>
                    <div className="set-desc">Accounts use the same customer records as the register, so store credit, Loyalty and on-account balances carry over.</div>
                  </div>
                  <div className="set-fields">
                    <div className="switch-inline">
                      <Switch on={customerAccounts} onClick={() => set({ customerAccounts: !customerAccounts })} />
                      <span className="switch-label">{customerAccounts ? 'Customers can create accounts' : 'Guest checkout only'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
