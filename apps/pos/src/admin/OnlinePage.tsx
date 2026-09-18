import { Link } from 'react-router-dom';
import { useOnline } from '../store/onlineStore';
import { useProducts } from '../store/productStore';
import { Switch } from './controls';
import '../styles/reporting.css';

export function OnlinePage() {
  const enabled = useOnline((s) => s.enabled);
  const subdomain = useOnline((s) => s.subdomain);
  const showroom = useOnline((s) => s.showroom);
  const showroomTagline = useOnline((s) => s.showroomTagline);
  const set = useOnline((s) => s.set);
  const products = useProducts((s) => s.products);
  const live = products.filter((p) => p.enabled);
  const url = `https://${subdomain || 'my-store'}.novashop.com`;

  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">Online</h1>
        <div className="page-subbar">
          <span className="page-subbar-text">Online marketing — reach customers beyond the store with an online store or an AI Showroom.</span>
        </div>

        <div className="om-cards">
          <div className={`om-card ${enabled ? 'on' : ''}`}>
            <div className="om-ic">🛒</div>
            <div className="om-h">Online store</div>
            <div className="om-t">A full storefront where customers browse your catalog, pay online and choose pickup or delivery. Stock and prices stay in sync with the register.</div>
            <ul className="om-list">
              <li>Sell 24/7 from your existing catalog</li>
              <li>Orders arrive as fulfillments to pack, pick up or deliver</li>
              <li>Loyalty, promotions and price books apply online too</li>
            </ul>
            <button className="btn-p" onClick={() => set({ enabled: !enabled })}>{enabled ? 'Turn off online store' : 'Turn on online store'}</button>
          </div>
          <div className={`om-card ${showroom ? 'on' : ''}`}>
            <div className="om-ic">✨</div>
            <div className="om-h">AI Showroom</div>
            <div className="om-t">A lightweight, shareable page that showcases your best products with generated descriptions and photos — no online payments, customers call, message or visit to buy.</div>
            <ul className="om-list">
              <li>Set up in minutes from your active products</li>
              <li>Share the link on social media and messages</li>
              <li>Upgrade to the online store whenever you’re ready</li>
            </ul>
            <div className="om-field">
              <input className="set-input" value={showroomTagline} onChange={(e) => set({ showroomTagline: e.target.value })} placeholder="Tagline, e.g. Curated gear for every ride" />
            </div>
            <button className="btn-p" onClick={() => set({ showroom: !showroom })}>{showroom ? 'Turn off AI Showroom' : 'Turn on AI Showroom'}</button>
            {showroom && <div className="online-url">{`https://${subdomain || 'my-store'}.novashop.com/showroom`}</div>}
          </div>
        </div>

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
                <input
                  className="set-input"
                  value={subdomain}
                  onChange={(e) => set({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="my-store"
                />
                <span className="online-url">{url}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
