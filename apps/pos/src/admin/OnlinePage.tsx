import { Link } from 'react-router-dom';
import { useOnline } from '../store/onlineStore';
import { useProducts } from '../store/productStore';
import { Switch } from './controls';
import '../styles/reporting.css';

export function OnlinePage() {
  const enabled = useOnline((s) => s.enabled);
  const subdomain = useOnline((s) => s.subdomain);
  const set = useOnline((s) => s.set);
  const products = useProducts((s) => s.products);
  const live = products.filter((p) => p.enabled);
  const url = `https://${subdomain || 'my-store'}.novashop.com`;

  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">Online</h1>
        <div className="page-subbar">
          <span className="page-subbar-text">Sell your catalog online with a hosted storefront.</span>
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
