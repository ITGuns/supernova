import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWholesale } from '../store/wholesaleStore';
import '../styles/reporting.css';

/**
 * Wholesale, laid out the way Lightspeed lays out its B2B section: a hero that
 * pitches the marketplace and connects an account, a strip of brands, then the
 * key features that unlock once the accounts are linked. Lightspeed's hero
 * connects NuORDER; Nova's connects the Nova Wholesale marketplace.
 */

const BULLETS = [
  'Discover and shop from thousands of brands in the Nova Wholesale Marketplace',
  'Sync purchase orders from brands directly into your POS—no manual entry required',
  'Restock faster with quick, easy reorders right from your POS',
];

const FEATURES: { art: JSX.Element; title: string; text: string; link: string; to: string }[] = [
  {
    art: <StoreArt />,
    title: 'Wholesale Marketplace',
    text: 'Discover and shop from thousands of brands in the Nova Wholesale Marketplace. Orders sync with your POS automatically.',
    link: 'See how you can shop',
    to: '/catalog',
  },
  {
    art: <SyncArt />,
    title: 'Sync purchase orders',
    text: 'Bring POs from the marketplace straight into your POS. Product details, vendors and pricing flow in seamlessly, eliminating manual entry',
    link: 'See how it works',
    to: '/inventory',
  },
  {
    art: <ReorderArt />,
    title: 'Reorder from your POS',
    text: 'Restock best-sellers in minutes by creating POs for marketplace brands directly in your POS. They’ll sync automatically — making repeat orders faster and easier.',
    link: 'Learn how it works',
    to: '/inventory/orders/new',
  },
  {
    art: <ReferArt />,
    title: 'Refer your favorite brands',
    text: 'Don’t see a brand you work with? Refer them and we’ll contact them for you to bring their products onto the marketplace.',
    link: 'Refer a brand',
    to: '/catalog/suppliers/new',
  },
];

export function WholesalePage() {
  const navigate = useNavigate();
  const account = useWholesale((s) => s.account);
  const connect = useWholesale((s) => s.connect);
  const disconnect = useWholesale((s) => s.disconnect);
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <main className="admin-main">
      <div className="ws-head">
        <h1 className="page-title">Wholesale</h1>
      </div>

      <section className="ws-hero">
        <div className="ws-hero-art" aria-hidden="true">
          <HeroArt />
        </div>
        <div className="ws-hero-body">
          <h2 className="ws-hero-h">Streamline ordering from 4,000+ brands</h2>
          <p className="ws-hero-p">
            Nova Wholesale is Nova&rsquo;s B2B wholesale platform, trusted by more than 4,000+ brands to manage products and
            orders. By connecting it with your POS, you&rsquo;ll unlock a faster, more efficient way to buy from thousands of
            brands. Your purchase orders can now sync automatically, so you can save time, cut manual work and keep your
            shelves stocked with products your customers love.
          </p>
          <p className="ws-hero-lead">With the integration, you can:</p>
          <ul className="ws-hero-list">
            {BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          {account ? (
            <div className="ws-connected">
              <div className="ws-connected-body">
                <b>Connected as {account.company || account.email}</b>
                <span>
                  {account.email} · linked {new Date(account.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <button className="btn-s" onClick={disconnect}>
                Disconnect account
              </button>
            </div>
          ) : (
            <div className="ws-cta">
              <button className="btn-p ws-connect" onClick={() => setConnectOpen(true)}>
                Connect account
              </button>
              <div className="ws-cta-side">
                <span>New to Nova Wholesale?</span>
                <button className="rlink ws-signup" onClick={() => setConnectOpen(true)}>
                  Sign up for a free account <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          )}

          <p className="ws-fine">
            By connecting Nova Wholesale, you acknowledge the terms of the{' '}
            <span className="rlink">Nova Service Agreement</span> apply.
          </p>
        </div>
      </section>

      <section className="ws-brands" aria-label="Brands on the marketplace">
        {['KEENLY', 'HAPPY SOCKS', 'Wrangle', 'habitat', 'KENDRA'].map((b) => (
          <span key={b} className="ws-brand">
            {b}
          </span>
        ))}
      </section>

      <section className="ws-features">
        <h2 className="ws-features-h">Key features once you&rsquo;ve integrated your accounts</h2>
        <div className="ws-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="ws-card">
              <div className="ws-card-art" aria-hidden="true">
                {f.art}
              </div>
              <div className="ws-card-h">{f.title}</div>
              <div className="ws-card-t">{f.text}</div>
              <button className="rlink ws-card-link" onClick={() => navigate(f.to)}>
                <span className="ws-card-ic" aria-hidden="true">
                  ↗
                </span>{' '}
                {f.link}
              </button>
            </div>
          ))}
        </div>
      </section>

      {connectOpen && <ConnectModal onClose={() => setConnectOpen(false)} onConnect={connect} />}
    </main>
  );
}

/** Links a marketplace account to this store. */
function ConnectModal({ onClose, onConnect }: { onClose: () => void; onConnect: (email: string, company: string) => void }) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    if (!email.includes('@')) {
      setError('Enter the email address on your Nova Wholesale account.');
      return;
    }
    onConnect(email, company);
    onClose();
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect account">
        <div className="pm-head">
          <h2>Connect account</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pm-body ws-modal-body">
          <p className="ws-modal-t">
            Link the Nova Wholesale account you order with. Purchase orders from the marketplace then sync into Inventory
            &rarr; Stock control.
          </p>
          <label className="ws-field">
            <span>Account email</span>
            <input
              className="ws-in"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="you@yourstore.com"
            />
          </label>
          <label className="ws-field">
            <span>Company name (optional)</span>
            <input className="ws-in" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Your store" />
          </label>
          {error && (
            <div className="pe-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="pm-foot">
          <button className="btn-s" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-p" onClick={save}>
            Connect account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Illustrations. Flat line art in the brand palette, like Lightspeed's. ---- */

function HeroArt() {
  return (
    <svg viewBox="0 0 260 190" className="ws-art" role="img">
      <circle cx="96" cy="95" r="78" className="ws-art-bg" />
      <rect x="112" y="40" width="132" height="96" rx="10" className="ws-art-panel" />
      <rect x="124" y="54" width="36" height="42" rx="7" className="ws-art-accent" />
      <rect x="170" y="58" width="58" height="7" rx="3.5" className="ws-art-line" />
      <rect x="170" y="74" width="40" height="7" rx="3.5" className="ws-art-line" />
      <rect x="124" y="108" width="12" height="16" rx="2" className="ws-art-bar" />
      <rect x="142" y="100" width="12" height="24" rx="2" className="ws-art-bar" />
      <rect x="160" y="112" width="12" height="12" rx="2" className="ws-art-bar" />
      <rect x="178" y="92" width="12" height="32" rx="2" className="ws-art-bar" />
      <rect x="196" y="84" width="12" height="40" rx="2" className="ws-art-accent" />
      <circle cx="70" cy="58" r="20" className="ws-art-fill" />
      <path d="M38 158c0-20 14-34 32-34s32 14 32 34z" className="ws-art-fill" />
      <rect x="66" y="96" width="54" height="36" rx="6" className="ws-art-panel" />
    </svg>
  );
}

function StoreArt() {
  return (
    <svg viewBox="0 0 64 56" className="ws-cart-art" role="img">
      <path d="M8 18h48l-4-12H12z" className="ws-art-accent" />
      <rect x="10" y="18" width="44" height="30" rx="3" className="ws-art-panel" />
      <rect x="18" y="28" width="12" height="20" rx="2" className="ws-art-accent" />
      <rect x="36" y="28" width="12" height="10" rx="2" className="ws-art-line" />
    </svg>
  );
}

function SyncArt() {
  return (
    <svg viewBox="0 0 64 56" className="ws-cart-art" role="img">
      <rect x="14" y="6" width="34" height="42" rx="4" className="ws-art-panel" />
      <rect x="21" y="15" width="20" height="4" rx="2" className="ws-art-line" />
      <rect x="21" y="24" width="20" height="4" rx="2" className="ws-art-line" />
      <rect x="21" y="33" width="12" height="4" rx="2" className="ws-art-line" />
      <circle cx="44" cy="42" r="12" className="ws-art-accent" />
      <path d="M39 42a5 5 0 0 1 9-3M49 42a5 5 0 0 1-9 3" className="ws-art-stroke" />
    </svg>
  );
}

function ReorderArt() {
  return (
    <svg viewBox="0 0 64 56" className="ws-cart-art" role="img">
      <path d="M8 12h8l6 24h26" className="ws-art-stroke" />
      <circle cx="26" cy="46" r="4" className="ws-art-accent" />
      <circle cx="44" cy="46" r="4" className="ws-art-accent" />
      <circle cx="40" cy="20" r="12" className="ws-art-accent" />
      <path d="M35 20a5 5 0 0 1 9-3M45 20a5 5 0 0 1-9 3" className="ws-art-stroke" />
    </svg>
  );
}

function ReferArt() {
  return (
    <svg viewBox="0 0 64 56" className="ws-cart-art" role="img">
      <path d="M16 18h32l4 32H12z" className="ws-art-accent" />
      <path d="M24 18v-4a8 8 0 0 1 16 0v4" className="ws-art-stroke" />
      <path d="M32 40c-6-4-8-7-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-8 10z" className="ws-art-panel" />
    </svg>
  );
}
