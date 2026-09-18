import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeTotals } from '../lib/totals';
import { useCart } from '../store/cartStore';
import { FULFILLMENT_LABEL, useFulfillments, type FulfillmentKind } from '../store/fulfillmentStore';
import { useQuotes } from '../store/quotesStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { useRegister } from '../store/registerStore';
import { useSettings } from '../store/settingsStore';
import { useUsers } from '../store/userStore';
import { useCustomers } from '../store/customerStore';
import { MoneyInput } from '../admin/NumInput';
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

  const nav = useNavigate();
  const lines = useCart((s) => s.lines);
  const lastSale = useCart((s) => s.lastSale);
  const clear = useCart((s) => s.clear);
  const park = useCart((s) => s.park);
  const customerName = useCart((s) => s.customerName);
  const orderNote = useCart((s) => s.orderNote);
  const discountBps = useCart((s) => s.orderDiscountBps);
  const addCustomLine = useCart((s) => s.addCustomLine);
  const addQuote = useQuotes((s) => s.addQuote);
  const addFulfillment = useFulfillments((s) => s.addFulfillment);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);
  const empty = lines.length === 0;
  const [serviceOpen, setServiceOpen] = useState(false);
  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const assignAllLines = useCart((s) => s.assignAllLines);
  const openSaleNumber = useCart((s) => s.openSaleNumber);
  const users = useUsers((s) => s.users);
  const customers = useCustomers((s) => s.customers);
  const attachedEmail = customers.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === customerName.trim().toLowerCase())?.email ?? '';

  // Save the sale as a quote the customer can come back for.
  const createQuote = (note: string) => {
    if (empty) return;
    const totalMinor = computeTotals(lines, discountBps, 'USD', taxBps).totalMinor;
    addQuote({ customer: customerName || 'Walk-in customer', totalMinor, lines, discountBps, note });
    clear();
    setQuoteOpen(false);
    nav('/sell/quotes');
  };

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
          <button className="reg-action" disabled={empty || !!openSaleNumber} onClick={() => setParkOpen(true)}>
            <span className="ra-ic">◷</span> Park sale
          </button>
          <div className="reg-more">
            <button className="reg-action" onClick={() => setMoreOpen((v) => !v)}>
              ▾ More actions…
            </button>
            {moreOpen && (
              <div className="reg-more-menu" onMouseLeave={() => setMoreOpen(false)}>
                <button onClick={() => { setQuoteOpen(true); setMoreOpen(false); }} disabled={empty || !!openSaleNumber}>Create a quote</button>
                <button onClick={() => { setServiceOpen(true); setMoreOpen(false); }}>Create a service sale</button>
                <button onClick={() => { setMoreOpen(false); nav('/services/new', { state: { customerName, lines } }); }}>Create service</button>
                <button onClick={() => { setFulfilOpen(true); setMoreOpen(false); }} disabled={empty || !!openSaleNumber}>Mark as unfulfilled</button>
                <button onClick={() => { setAssignOpen(true); setMoreOpen(false); }} disabled={empty}>Assign all sale items</button>
                <button onClick={() => { clear(); setMoreOpen(false); }} disabled={empty}>
                  {openSaleNumber ? 'Dismiss sale' : 'Discard sale'}
                </button>
              </div>
            )}
          </div>
        </div>
        <RegisterCart onPay={() => !empty && setPayOpen(true)} />
      </div>
      </div>

      {parkOpen && (
        <NoteModal
          title="Park sale"
          text="Put this sale on hold to finish later. Add a note to make it easy to find."
          placeholder="Note (optional)"
          confirm="Park sale"
          onClose={() => setParkOpen(false)}
          onConfirm={(note) => { park(note); setParkOpen(false); }}
        />
      )}
      {quoteOpen && (
        <NoteModal
          title="Create quote"
          text={attachedEmail ? `A copy of the quote can be emailed to ${attachedEmail}.` : 'Quotes are saved under Sell → Quotes and can be converted to a sale later.'}
          placeholder="Add a note to the quote (optional)"
          confirm="Complete quote"
          emailTo={attachedEmail || undefined}
          onClose={() => setQuoteOpen(false)}
          onConfirm={createQuote}
        />
      )}
      {assignOpen && (
        <div className="pm-overlay" onClick={() => setAssignOpen(false)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>Assign all sale items</h2>
              <button className="pm-close" onClick={() => setAssignOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="reg-open-body">
              <p className="reg-open-text">Attribute every item in this sale to one staff member.</p>
              <div className="reg-userlist">
                {users.filter((u) => u.enabled).map((u) => (
                  <button key={u.id} className="btn-s" onClick={() => { assignAllLines(u.name); setAssignOpen(false); }}>{u.name}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {serviceOpen && <ServiceSaleModal onAdd={(name, priceMinor) => { addCustomLine({ name, priceMinor }); setServiceOpen(false); }} onClose={() => setServiceOpen(false)} />}
      {fulfilOpen && (
        <FulfillmentModal
          customerName={customerName}
          onClose={() => setFulfilOpen(false)}
          onSave={(kind, customer, note) => {
            addFulfillment({ kind, customerName: customer, lines, discountBps, note: note || orderNote });
            clear();
            setFulfilOpen(false);
            nav('/inventory', { state: { tab: 'fulfillments' } });
          }}
        />
      )}
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

/** A one-off service line: a name and a price, no product or stock behind it. */
function ServiceSaleModal({ onAdd, onClose }: { onAdd: (name: string, priceMinor: number) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [priceMinor, setPriceMinor] = useState(0);
  const ok = name.trim().length > 0 && priceMinor > 0;
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Create a service sale</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onAdd(name.trim(), priceMinor);
          }}
        >
          <p className="reg-open-text">Add a service or other charge that isn’t a catalog product. It’s added to the current sale as its own line.</p>
          <label className="reg-open-field">
            <span>Service</span>
            <input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Repair labour" />
          </label>
          <label className="reg-open-field">
            <span>Price ($)</span>
            <MoneyInput className="" minor={priceMinor} onChange={setPriceMinor} placeholder="0.00" />
          </label>
          <button className="pm-complete" type="submit" disabled={!ok}>Add to sale</button>
        </form>
      </div>
    </div>
  );
}

/** Park the sale as an order to pack, pick up or deliver; it's paid when retrieved. */
function FulfillmentModal({ customerName, onSave, onClose }: { customerName: string; onSave: (kind: FulfillmentKind, customer: string, note: string) => void; onClose: () => void }) {
  const [kind, setKind] = useState<FulfillmentKind>('pickup');
  const [customer, setCustomer] = useState(customerName);
  const [note, setNote] = useState('');
  const ok = customer.trim().length > 0;
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Mark as unfulfilled</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onSave(kind, customer.trim(), note.trim());
          }}
        >
          <p className="reg-open-text">The sale is saved under Inventory → Fulfillments to be packed, picked up or delivered, and paid for when it’s retrieved.</p>
          <label className="reg-open-field">
            <span>Fulfillment type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as FulfillmentKind)}>
              {(Object.keys(FULFILLMENT_LABEL) as FulfillmentKind[]).map((k) => <option key={k} value={k}>{FULFILLMENT_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="reg-open-field">
            <span>Customer</span>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" autoFocus={!customerName} />
          </label>
          <label className="reg-open-field">
            <span>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Collect Saturday" />
          </label>
          <button className="pm-complete" type="submit" disabled={!ok}>Save as unfulfilled</button>
        </form>
      </div>
    </div>
  );
}

/** A small confirm dialog with an optional note (Park sale, Create quote). */
function NoteModal({ title, text, placeholder, confirm, emailTo, onConfirm, onClose }: { title: string; text: string; placeholder: string; confirm: string; emailTo?: string; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(!!emailTo);
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>{title}</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(note.trim());
          }}
        >
          <p className="reg-open-text">{text}</p>
          {emailTo && (
            <label className="reg-check">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              <span>Email quote to {emailTo}</span>
            </label>
          )}
          <label className="reg-open-field">
            <span>Note</span>
            <input value={note} autoFocus onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
          </label>
          <button className="pm-complete" type="submit">{confirm}</button>
        </form>
      </div>
    </div>
  );
}
