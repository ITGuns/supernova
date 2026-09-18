import { useState } from 'react';
import { IntInput, MoneyInput, NumInput } from '../admin/NumInput';
import { useCheckout } from '../lib/checkout';
import { fmt } from '../lib/format';
import { runRules } from '../lib/rules';
import { FULFILLMENT_LABEL } from '../store/fulfillmentStore';
import { saleBalance, useCart } from '../store/cartStore';
import { useCustomFields } from '../store/customFieldStore';
import { useCustomers } from '../store/customerStore';
import { useSerialNumbers } from '../store/serialNumberStore';
import { useSettings } from '../store/settingsStore';
import { useUsers } from '../store/userStore';
import { useSetup } from '../store/setupStore';
import { isCash, tenderLabel } from '../lib/tenders';
import '../styles/sell.css';

// The sale panel on the Sell screen: customer, lines (click a line to edit
// quantity, price, discount, note and who sold it), sale-wide Discount /
// Promo code / Note, totals with removable tax, and Pay.

export function RegisterCart({ onPay }: { onPay: () => void }) {
  const lines = useCart((s) => s.lines);
  const discountBps = useCart((s) => s.orderDiscountBps);
  const discountMinor = useCart((s) => s.orderDiscountMinor);
  const taxRemoved = useCart((s) => s.taxRemoved);
  const promoCode = useCart((s) => s.promoCode);
  const openSaleNumber = useCart((s) => s.openSaleNumber);
  const sales = useCart((s) => s.sales);
  const inc = useCart((s) => s.incrementLine);
  const dec = useCart((s) => s.decrementLine);
  const remove = useCart((s) => s.removeLine);
  const updateLine = useCart((s) => s.updateLine);
  const setOrderDiscount = useCart((s) => s.setOrderDiscount);
  const setTaxRemoved = useCart((s) => s.setTaxRemoved);
  const setPromoCode = useCart((s) => s.setPromoCode);
  const customerName = useCart((s) => s.customerName);
  const setCustomer = useCart((s) => s.setCustomer);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);
  const fulfillment = useCart((s) => s.fulfillment);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const customFields = useCart((s) => s.customFields);
  const setCustomFields = useCart((s) => s.setCustomFields);
  const pendingSerial = useCart((s) => s.pendingSerial);
  const paying = useCart((s) => s.paying);
  const pendingTenders = useCart((s) => s.pendingTenders);
  const removePendingTender = useCart((s) => s.removePendingTender);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const pendingPaid = pendingTenders.reduce((a, t) => a + t.amountMinor, 0);
  const setLineSerial = useCart((s) => s.setLineSerial);
  const serials = useSerialNumbers((s) => s.serials);
  const saleFields = useCustomFields((s) => s.fields).filter((f) => f.application === 'Sales');
  const [notice, setNotice] = useState('');
  const customers = useCustomers((s) => s.customers);
  const addCustomer = useCustomers((s) => s.addCustomer);
  const groups = useCustomers((s) => s.groups);
  const users = useUsers((s) => s.users);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoText, setPromoText] = useState('');
  const [promoErr, setPromoErr] = useState('');
  const [newCustomer, setNewCustomer] = useState<string | null>(null);

  const totals = useCheckout();
  const empty = lines.length === 0;
  const manualDiscount = totals.discountMinor - totals.promotions.reduce((a, p) => a + p.amountMinor, 0) - lines.reduce((a, l) => a + Math.round(l.unitPriceMinor * l.quantity * ((l.discountPct ?? 0) / 100)), 0);
  const serialLine = pendingSerial ? lines.find((l) => l.lineId === pendingSerial) : undefined;
  const serialChoices = serialLine ? serials.filter((sn) => sn.productId === serialLine.variantId && sn.status === 'In stock' && !lines.some((l) => l.serial === sn.serial && l.lineId !== serialLine.lineId)) : [];
  const openSale = openSaleNumber ? sales.find((s) => s.orderNumber === openSaleNumber) : undefined;
  const paidSoFar = openSale?.paidMinor ?? 0;
  const toPay = Math.max(0, totals.totalMinor - paidSoFar);

  const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();
  const attached = customers.find((c) => fullName(c).toLowerCase() === customerName.trim().toLowerCase());
  const typedUnknown = customerName.trim().length > 1 && !attached;

  const applyPromo = () => {
    if (setPromoCode(promoText)) {
      setPromoOpen(false);
      setPromoText('');
      setPromoErr('');
    } else {
      setPromoErr('That promo code isn’t active.');
    }
  };

  return (
    <section className={`dcart ${paying ? 'dcart-paying' : ''}`}>
      <div className="dcart-customer">
        <span className="dcart-cust-icon">☺</span>
        {attached ? (
          <>
            <span className="dcart-cust-name">
              {fullName(attached)}
              <span className="dcart-cust-sub">
                {attached.group}
                {attached.storeCreditMinor > 0 ? ` · Store credit ${fmt(attached.storeCreditMinor)}` : ''}
                {attached.accountMinor > 0 ? ` · On account ${fmt(attached.accountMinor)}` : ''}
              </span>
            </span>
            <button className="dcart-cust-x" onClick={() => setCustomer('')} aria-label="Remove customer">🗑</button>
          </>
        ) : (
          <input placeholder="Add a customer" list="dcart-cust-list" value={customerName} onChange={(e) => setCustomer(e.target.value)} />
        )}
        <datalist id="dcart-cust-list">
          {customers.map((c) => (
            <option key={c.id} value={fullName(c)} />
          ))}
        </datalist>
      </div>
      {typedUnknown && (
        <button className="dcart-addcust" onClick={() => setNewCustomer(customerName.trim())}>
          + Add “{customerName.trim()}” as a new customer
        </button>
      )}

      {notice && (
        <div className="dcart-open dcart-notice">
          {notice} <button className="dtrow-link" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}
      {fulfillment && (
        <div className="dcart-open">
          {FULFILLMENT_LABEL[fulfillment.kind]}{fulfillment.note ? ` · ${fulfillment.note}` : ''} — the sale goes to Inventory → Fulfillments once it’s paid.
          <button className="dtrow-x" onClick={() => setFulfillment(null)} aria-label="Remove fulfillment">🗑</button>
        </div>
      )}
      {openSale && (
        <div className="dcart-open">
          Continuing {openSale.status === 'Layaway' ? 'layaway' : 'on account'} sale {openSale.orderNumber} · {fmt(paidSoFar)} paid so far. Existing items are locked.
        </div>
      )}

      <div className="dcart-lines">
        {empty && <div className="dcart-empty">Add products to start a sale</div>}
        {lines.map((l) => {
          const lineTotal = Math.round(l.unitPriceMinor * l.quantity * (1 - (l.discountPct ?? 0) / 100));
          const open = expanded === l.lineId;
          return (
            <div key={l.lineId} className={`dline ${open ? 'open' : ''} ${l.locked ? 'locked' : ''}`}>
              <div className="dline-row">
                <div className="dline-main" onClick={() => setExpanded(open ? null : l.lineId)} role="button" tabIndex={0}>
                  <div className="dline-name">
                    <span className="dline-chev">{open ? '▾' : '›'}</span> {l.name}
                    {l.locked && <span className="dline-lock" title="Locked — part of the original sale">🔒</span>}
                  </div>
                  <div className="dline-unit">
                    {l.priceNote && l.basePriceMinor !== undefined && l.basePriceMinor !== l.unitPriceMinor && <s className="dline-was">{fmt(l.basePriceMinor)}</s>}
                    {fmt(l.unitPriceMinor)} ea
                    {(l.discountPct ?? 0) > 0 && <span className="dline-promo"> · {l.discountPct}% off</span>}
                    {l.priceNote && <span className="dline-promo"> · {l.priceNote}</span>}
                    {l.serial && <span className="dline-note"> · Serial {l.serial}</span>}
                    {l.giftCard && <span className="dline-note"> · #{l.giftCard.number}</span>}
                    {l.note && <span className="dline-note"> · {l.note}</span>}
                    {l.soldBy && <span className="dline-note"> · Sold by {l.soldBy}</span>}
                  </div>
                </div>
                <div className="dstepper">
                  <button onClick={() => dec(l.lineId)} aria-label="Decrease" disabled={l.locked}>−</button>
                  <span>{l.quantity}</span>
                  <button onClick={() => inc(l.lineId)} aria-label="Increase" disabled={l.locked}>+</button>
                </div>
                <div className="dline-total">{fmt(lineTotal)}</div>
                <button className="dline-x" onClick={() => remove(l.lineId)} aria-label="Remove" disabled={l.locked}>×</button>
              </div>
              {open && (
                <div className="dline-edit">
                  <label>
                    <span>Quantity</span>
                    <IntInput className="dline-in" int={l.quantity} disabled={l.locked} onChange={(n) => updateLine(l.lineId, { quantity: Math.max(0, n ?? 0) })} />
                  </label>
                  <label>
                    <span>Price</span>
                    <MoneyInput className="dline-in" minor={l.unitPriceMinor} disabled={l.locked} onChange={(v) => updateLine(l.lineId, { unitPriceMinor: v })} />
                  </label>
                  <label>
                    <span>Discount %</span>
                    <NumInput className="dline-in" value={l.discountPct ? String(l.discountPct) : ''} disabled={l.locked} placeholder="0" onCommit={(t) => updateLine(l.lineId, { discountPct: Math.min(100, Math.max(0, parseFloat(t) || 0)) })} />
                  </label>
                  <label className="wide">
                    <span>Note</span>
                    <input className="dline-in" value={l.note ?? ''} disabled={l.locked} onChange={(e) => updateLine(l.lineId, { note: e.target.value })} placeholder="Shown on the receipt" />
                  </label>
                  <label>
                    <span>Sold by</span>
                    <select className="dline-in" value={l.soldBy ?? ''} disabled={l.locked} onChange={(e) => updateLine(l.lineId, { soldBy: e.target.value })}>
                      <option value="">Current user</option>
                      {users.filter((u) => u.enabled).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!empty && (
        <div className="dcart-totals">
          <div className="dtrow">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotalMinor)}</span>
          </div>
          {(discountBps > 0 || discountMinor > 0) && manualDiscount > 0 && (
            <div className="dtrow disc">
              <span>
                Discount{discountBps > 0 ? ` (${discountBps / 100}%)` : ''}
                <button className="dtrow-x" onClick={() => setOrderDiscount({})} aria-label="Remove discount">🗑</button>
              </span>
              <span>−{fmt(manualDiscount)}</span>
            </div>
          )}
          {totals.promotions.map((p) => (
            <div key={p.name} className="dtrow disc">
              <span>{p.name}</span>
              <span>−{fmt(p.amountMinor)}</span>
            </div>
          ))}
          {taxRemoved || totals.taxRows.length <= 1 ? (
            <div className="dtrow">
              <span>
                Tax{totals.taxRows[0] && !taxRemoved ? ` · ${totals.taxRows[0].name} ${(totals.taxRows[0].rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%` : ''}{totals.taxInclusive && !taxRemoved ? ' (included)' : ''}
                {taxRemoved ? (
                  <button className="dtrow-link" onClick={() => setTaxRemoved(false)}>Restore</button>
                ) : (
                  (taxBps > 0 || totals.taxRows.length > 0) && <button className="dtrow-x" onClick={() => setTaxRemoved(true)} aria-label="Remove tax" title="Remove tax from this sale">🗑</button>
                )}
              </span>
              <span>{taxRemoved ? 'Removed' : fmt(totals.taxMinor)}</span>
            </div>
          ) : (
            totals.taxRows.map((r) => (
              <div key={r.id} className="dtrow">
                <span>
                  {r.name} {(r.rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%{totals.taxInclusive ? ' (included)' : ''}
                  <button className="dtrow-x" onClick={() => setTaxRemoved(true)} aria-label="Remove tax" title="Remove tax from this sale">🗑</button>
                </span>
                <span>{fmt(r.amountMinor)}</span>
              </div>
            ))
          )}
          {openSale && (
            <>
              <div className="dtrow">
                <span>Paid</span>
                <span>−{fmt(paidSoFar)}</span>
              </div>
              <div className="dtrow">
                <span>Balance</span>
                <span>{fmt(toPay)}</span>
              </div>
            </>
          )}
          {(paying || pendingTenders.length > 0) && (
            <>
              <div className="dtrow pm-total"><span>Total to pay</span><span>{fmt(toPay)}</span></div>
              {pendingTenders.map((t) => (
                <div key={t.id} className="dtrow dcart-payment">
                  <span>
                    {isCash(t.method) ? '💵 ' : ''}{tenderLabel(t.method, paymentTypes)}{t.reference ? ` · ${t.reference}` : ''}
                    <button className="dtrow-x" onClick={() => removePendingTender(t.id)} aria-label="Remove payment">🗑</button>
                  </span>
                  <span>−{fmt(t.amountMinor)}</span>
                </div>
              ))}
              <div className="dtrow pm-total dcart-balance"><span>Balance</span><span>{fmt(Math.max(0, toPay - pendingPaid))}</span></div>
            </>
          )}
        </div>
      )}

      <div className="dcart-add">
        <span className="dcart-add-label">ADD</span>
        <button className={`dcart-add-link ${discountBps > 0 || discountMinor > 0 ? 'on' : ''}`} disabled={empty} onClick={() => setDiscountOpen(true)}>
          <span className="lock">🔒</span> Discount
        </button>
        <button className={`dcart-add-link ${promoCode ? 'on' : ''}`} disabled={empty} onClick={() => { setPromoOpen((v) => !v); setPromoErr(''); }}>
          <span className="lock">🔒</span> Promo code{promoCode ? ` · ${promoCode}` : ''}
        </button>
        <button className={`dcart-add-link note ${orderNote ? 'on' : ''}`} onClick={() => setShowNote((v) => !v)}>
          Note{orderNote ? ' ●' : ''}
        </button>
      </div>

      {showNote && (
        <div className="dcart-extra">
          <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Add a note to this sale" />
          {saleFields.map((f) => (
            <label key={f.id} className="dcart-cf">
              <span>{f.name}</span>
              {f.type === 'Checkbox' ? (
                <input type="checkbox" checked={customFields[f.id] === 'yes'} onChange={(e) => setCustomFields({ ...customFields, [f.id]: e.target.checked ? 'yes' : '' })} />
              ) : f.type === 'Dropdown' ? (
                <select value={customFields[f.id] ?? ''} onChange={(e) => setCustomFields({ ...customFields, [f.id]: e.target.value })}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type === 'Date' ? 'date' : f.type === 'Number' ? 'number' : 'text'} value={customFields[f.id] ?? ''} onChange={(e) => setCustomFields({ ...customFields, [f.id]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
      )}
      {promoOpen && (
        <div className="dcart-extra">
          <div className="dcart-promo">
            <input value={promoText} onChange={(e) => { setPromoText(e.target.value); setPromoErr(''); }} placeholder="Enter promo code" onKeyDown={(e) => e.key === 'Enter' && applyPromo()} />
            <button className="btn-s" onClick={applyPromo}>Add</button>
            {promoCode && <button className="btn-s" onClick={() => { setPromoCode(''); setPromoOpen(false); }}>Remove</button>}
          </div>
          {promoErr && <span className="dcart-promo-msg err">{promoErr}</span>}
        </div>
      )}

      {paying ? (
        <div className="dpay dpay-paying">
          <span className="dpay-l">Balance</span>
          <span className="dpay-amt">{fmt(Math.max(0, toPay - pendingPaid))}</span>
        </div>
      ) : (
      <button className={`dpay ${empty ? 'dpay-empty' : ''}`} disabled={empty} onClick={onPay}>
        <span className="dpay-l">
          {pendingTenders.length ? 'Pay balance' : 'Pay'}{' '}
          <span className="dpay-items">
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}
          </span>
        </span>
        <span className="dpay-amt">{fmt(Math.max(0, toPay - pendingPaid))}</span>
      </button>
      )}

      {serialLine && (
        <div className="pm-overlay" onClick={() => setLineSerial(serialLine.lineId, '')}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>Serial number</h2>
              <button className="pm-close" onClick={() => setLineSerial(serialLine.lineId, '')} aria-label="Close">×</button>
            </div>
            <div className="reg-open-body">
              <p className="reg-open-text">Which <b>{serialLine.name}</b> is being sold? Choose its serial number, or scan it.</p>
              <SerialPicker choices={serialChoices.map((c) => c.serial)} onPick={(serial) => setLineSerial(serialLine.lineId, serial)} />
              <button className="btn-s" onClick={() => setLineSerial(serialLine.lineId, '')}>No serial number</button>
            </div>
          </div>
        </div>
      )}

      {discountOpen && (
        <DiscountModal
          bps={discountBps}
          amountMinor={discountMinor}
          onApply={(d) => { setOrderDiscount(d); setDiscountOpen(false); }}
          onClose={() => setDiscountOpen(false)}
        />
      )}

      {newCustomer !== null && (
        <QuickCustomerModal
          name={newCustomer}
          groups={groups}
          onClose={() => setNewCustomer(null)}
          onCreate={(c) => {
            const created = addCustomer({ ...c, code: `${c.firstName.toLowerCase() || 'cust'}-${String(Date.now()).slice(-4)}`, storeCreditMinor: 0, loyaltyMinor: 0, accountMinor: 0 });
            setCustomer(fullName(created));
            setNewCustomer(null);
            const outcome = runRules('Customer added', { customerName: fullName(created) });
            if (outcome.messages.length) setNotice(outcome.messages.join(' · '));
          }}
        />
      )}
    </section>
  );
}

/** Whole-sale discount as a percentage or an amount, like Lightspeed's Discount pop-up. */
function DiscountModal({ bps, amountMinor, onApply, onClose }: { bps: number; amountMinor: number; onApply: (d: { bps?: number; amountMinor?: number }) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'pct' | 'amount'>(amountMinor > 0 ? 'amount' : 'pct');
  const [pct, setPct] = useState(bps > 0 ? String(bps / 100) : '');
  const [amt, setAmt] = useState(amountMinor);
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Add a discount</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(mode === 'pct' ? { bps: Math.round((parseFloat(pct) || 0) * 100) } : { amountMinor: amt });
          }}
        >
          <p className="reg-open-text">Applies to every item in the sale, including items added afterwards when it’s a percentage.</p>
          <div className="pe-seg reg-seg" role="group" aria-label="Discount type">
            <button type="button" className={mode === 'pct' ? 'active' : ''} onClick={() => setMode('pct')}>%</button>
            <button type="button" className={mode === 'amount' ? 'active' : ''} onClick={() => setMode('amount')}>$</button>
          </div>
          <label className="reg-open-field">
            <span>{mode === 'pct' ? 'Discount (%)' : 'Discount ($)'}</span>
            {mode === 'pct' ? (
              <NumInput className="" value={pct} onCommit={setPct} placeholder="0" autoFocus />
            ) : (
              <MoneyInput className="" minor={amt} onChange={setAmt} placeholder="0.00" autoFocus />
            )}
          </label>
          <div className="pe-actions">
            <button type="button" className="btn-s" onClick={onClose}>Cancel</button>
            <button className="pm-complete" type="submit">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The "Add customer" pop-up reached from the sale: the contact fields Lightspeed requires. */
function QuickCustomerModal({ name, groups, onCreate, onClose }: { name: string; groups: string[]; onCreate: (c: { firstName: string; lastName: string; email: string; phone: string; group: string }) => void; onClose: () => void }) {
  const [first, ...rest] = name.split(' ');
  const [firstName, setFirstName] = useState(first ?? '');
  const [lastName, setLastName] = useState(rest.join(' '));
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [group, setGroup] = useState(groups[0] ?? 'All Customers');
  const ok = firstName.trim().length > 0;
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Add customer</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form
          className="reg-open-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onCreate({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), group });
          }}
        >
          <div className="reg-two">
            <label className="reg-open-field"><span>First name</span><input value={firstName} autoFocus onChange={(e) => setFirstName(e.target.value)} /></label>
            <label className="reg-open-field"><span>Last name</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          </div>
          <label className="reg-open-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" /></label>
          <label className="reg-open-field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="reg-open-field"><span>Customer group</span><select value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
          <button className="pm-complete" type="submit" disabled={!ok}>Create new customer</button>
        </form>
      </div>
    </div>
  );
}

/** Pick from the serials in stock, or type / scan one. */
function SerialPicker({ choices, onPick }: { choices: string[]; onPick: (serial: string) => void }) {
  const [typed, setTyped] = useState('');
  const q = typed.trim().toLowerCase();
  const shown = choices.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 12);
  return (
    <>
      <label className="reg-open-field">
        <span>Scan or type a serial</span>
        <input value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) onPick(typed.trim()); }} placeholder="Serial number" />
      </label>
      <div className="reg-userlist">
        {shown.map((c) => <button key={c} className="btn-s" onClick={() => onPick(c)}>{c}</button>)}
        {shown.length === 0 && <span className="pe-muted">{choices.length ? 'No serials match.' : 'No serials on file for this product.'}</span>}
      </div>
    </>
  );
}

export { saleBalance };
