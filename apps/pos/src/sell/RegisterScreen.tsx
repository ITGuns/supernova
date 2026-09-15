import { useState } from 'react';
import { useCart } from '../store/cartStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { useRegister } from '../store/registerStore';
import { ParkedTray } from './ParkedTray';
import { PayModal } from './PayModal';
import { QuickKeys } from './QuickKeys';
import { Receipt } from './Receipt';
import { RegisterCart } from './RegisterCart';

export function RegisterScreen() {
  const [query, setQuery] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const lines = useCart((s) => s.lines);
  const lastSale = useCart((s) => s.lastSale);
  const clear = useCart((s) => s.clear);
  const park = useCart((s) => s.park);
  const empty = lines.length === 0;

  const training = useRegister((s) => s.trainingMode);
  const quickKeysEnabled = useRegister((s) => s.quickKeysEnabled);
  const registerStatus = useRegisterSession((s) => s.status);

  return (
    <main className="register">
      {training && (
        <div className="reg-training-banner">
          Training mode — sales are marked as training and won’t affect inventory
        </div>
      )}
      <div className="reg-cols">
      <div className="reg-col reg-qk">
        <div className="reg-label">Search for products</div>
        <div className="reg-search">
          <span className="reg-search-icon">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing or scanning"
            autoFocus
          />
          {query && (
            <button className="reg-search-clear" onClick={() => setQuery('')} aria-label="Clear">
              ×
            </button>
          )}
        </div>
        {quickKeysEnabled || query ? (
          <QuickKeys query={query} />
        ) : (
          <div className="qk-grid">
            <div className="qk-empty">
              Quick keys are turned off for this register. Search for products above, or enable
              quick keys in Settings.
            </div>
          </div>
        )}
      </div>

      <div className="reg-col reg-cart-col">
        <div className="reg-actions">
          <button className="reg-action retrieve" onClick={() => setParkedOpen(true)}>
            <span className="ra-ic">↗</span> Retrieve sale
          </button>
          <button className="reg-action" disabled={empty} onClick={park}>
            <span className="ra-ic">◷</span> Park sale
          </button>
          <div className="reg-more">
            <button className="reg-action" onClick={() => setMoreOpen((v) => !v)}>
              ▾ More actions…
            </button>
            {moreOpen && (
              <div className="reg-more-menu" onMouseLeave={() => setMoreOpen(false)}>
                <button onClick={() => { clear(); setMoreOpen(false); }} disabled={empty}>
                  Discard sale
                </button>
                <button disabled>Create a quote</button>
                <button disabled>Create a service sale</button>
                <button disabled>Mark as unfulfilled</button>
              </div>
            )}
          </div>
        </div>
        <RegisterCart onPay={() => !empty && setPayOpen(true)} />
      </div>
      </div>

      {registerStatus === 'closed' && <OpenRegisterPrompt />}
      {payOpen && <PayModal onClose={() => setPayOpen(false)} />}
      {parkedOpen && <ParkedTray onClose={() => setParkedOpen(false)} />}
      {lastSale && <Receipt />}
    </main>
  );
}

/**
 * Sales must belong to a register session so the closure can reconcile
 * them: while the register is closed, the register asks for an opening
 * float before anything can be sold.
 */
function OpenRegisterPrompt() {
  const openingFloatMinor = useRegisterSession((s) => s.openingFloatMinor);
  const closures = useRegisterSession((s) => s.closures);
  const openRegister = useRegisterSession((s) => s.openRegister);
  const [openFloat, setOpenFloat] = useState('');
  const last = closures[0];
  const open = () => openRegister(openFloat === '' ? openingFloatMinor : Math.max(0, Math.round(parseFloat(openFloat || '0') * 100)));

  return (
    <div className="pm-overlay">
      <div className="pm reg-open" role="dialog" aria-labelledby="reg-open-title">
        <div className="pm-head">
          <h2 id="reg-open-title">Open register</h2>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            open();
          }}
        >
          <p className="reg-open-text">
            {last
              ? `The register was closed by ${last.by} at ${new Date(last.closedAt).toLocaleString()}.`
              : 'The register is closed.'}{' '}
            Set an opening float to start selling.
          </p>
          <label className="reg-open-field">
            <span>Opening float ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openFloat}
              autoFocus
              onChange={(e) => setOpenFloat(e.target.value)}
              placeholder={(openingFloatMinor / 100).toFixed(2)}
            />
          </label>
          <button className="pm-complete" type="submit">
            Open register
          </button>
        </form>
      </div>
    </div>
  );
}
