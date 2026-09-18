import { useState } from 'react';
import { fmt } from '../lib/format';
import { tenderShort } from '../lib/tenders';
import { useSetup } from '../store/setupStore';
import { useCart } from '../store/cartStore';
import { useCustomers } from '../store/customerStore';
import { useSettings } from '../store/settingsStore';
import { useWorkflows } from '../store/workflowStore';
import { FULFILLMENT_LABEL } from '../store/fulfillmentStore';

const fmtWhen = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function Receipt() {
  const sale = useCart((s) => s.lastSale);
  const dismiss = useCart((s) => s.dismissLastSale);
  const storeName = useSettings((s) => s.storeName);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const customers = useCustomers((s) => s.customers);
  const notices = useCart((s) => s.lastSaleNotices);
  const pickupInstructions = useWorkflows((s) => s.fulfillment.pickupInstructions);
  const [emailTo, setEmailTo] = useState<string | null>(null);
  const [emailed, setEmailed] = useState('');
  const [gift, setGift] = useState(false);
  if (!sale) return null;
  const customerEmail = sale.customer ? customers.find((c) => `${c.firstName} ${c.lastName}`.trim() === sale.customer)?.email ?? '' : '';
  const paid = sale.tenders.reduce((a, t) => a + t.amountMinor, 0) - sale.changeMinor;
  const balance = sale.paidMinor !== undefined ? sale.totalMinor - sale.paidMinor : 0;
  // A gift receipt hides prices; print it by flagging the print area, then unflag.
  const printGift = () => {
    setGift(true);
    setTimeout(() => {
      window.print();
      setGift(false);
    }, 50);
  };

  const subtotal = sale.lines.reduce((a, l) => a + l.unitPriceMinor * l.quantity, 0);
  // Anything between the line subtotal and the charged total is discount/tax;
  // the sale record stores only the final total, so show the net adjustment.
  const adjustment = sale.totalMinor - subtotal;

  return (
    <div className="rcpt-wrap">
      <div className="rcpt">
        <div className="rcpt-check">✓</div>
        <h2>{sale.status === 'Layaway' || sale.status === 'On account' ? `Sale saved ${sale.status === 'Layaway' ? 'as layaway' : 'on account'}` : 'Sale complete'}</h2>
        <div className="rcpt-order">
          Sale {sale.orderNumber} · {fmt(sale.paidMinor !== undefined ? sale.paidMinor : sale.totalMinor)} paid
          {sale.paidMinor !== undefined && ` · ${fmt(sale.totalMinor - sale.paidMinor)} to pay`}
        </div>
        {sale.emailReceipt && customerEmail && !emailed && <div className="rcpt-email">Receipt emailed to {customerEmail}</div>}
        {emailed && <div className="rcpt-email">Receipt emailed to {emailed}</div>}
        {notices.length > 0 && (
          <div className="rcpt-notice" role="status">
            {notices.map((n) => <div key={n}>⚑ {n}</div>)}
          </div>
        )}
        {sale.fulfillment && (
          <div className="rcpt-email">
            {FULFILLMENT_LABEL[sale.fulfillment.kind]} · {sale.fulfillment.status}{sale.fulfillment.note ? ` · ${sale.fulfillment.note}` : ''}
            {sale.fulfillment.kind === 'pickup' && pickupInstructions ? ` · ${pickupInstructions}` : ''}
          </div>
        )}
        <div className="rcpt-rows">
          <div className="dtrow pm-total">
            <span>Total</span>
            <span>{fmt(sale.totalMinor)}</span>
          </div>
          {sale.tenders.map((t) => (
            <div key={t.id} className="dtrow">
              <span>{tenderShort(t.method, paymentTypes)}{t.reference ? ` · ${t.reference}` : ''}</span>
              <span>{fmt(t.amountMinor)}</span>
            </div>
          ))}
          {sale.changeMinor > 0 && (
            <div className="dtrow pm-total rcpt-change">
              <span>Change</span>
              <span>{fmt(sale.changeMinor)}</span>
            </div>
          )}
          {balance > 0 && (
            <>
              <div className="dtrow">
                <span>Paid</span>
                <span>{fmt(paid)}</span>
              </div>
              <div className="dtrow pm-total">
                <span>Balance to pay</span>
                <span>{fmt(balance)}</span>
              </div>
            </>
          )}
        </div>
        {emailTo !== null && (
          <form
            className="rcpt-emailform"
            onSubmit={(e) => {
              e.preventDefault();
              if (emailTo.trim()) {
                // Hand the receipt to the device's mail app, addressed to the customer.
                const body = [
                  `${storeName} — Receipt ${sale.orderNumber}`,
                  fmtWhen(sale.at),
                  '',
                  ...sale.lines.map((l) => `${l.quantity} x ${l.name}${l.serial ? ` (serial ${l.serial})` : ''}  ${fmt(l.unitPriceMinor * l.quantity)}`),
                  '',
                  `Subtotal ${fmt(subtotal)}`,
                  adjustment !== 0 ? `${adjustment < 0 ? 'Discount' : 'Tax'} ${fmt(Math.abs(adjustment))}` : '',
                  `TOTAL ${fmt(sale.totalMinor)}`,
                  ...sale.tenders.map((t) => `${tenderShort(t.method, paymentTypes)} ${fmt(t.amountMinor)}`),
                  '',
                  'Thank you for shopping with us!',
                ].filter((x) => x !== '').join('\n');
                window.location.href = `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodeURIComponent(`Receipt ${sale.orderNumber} from ${storeName}`)}&body=${encodeURIComponent(body)}`;
                setEmailed(emailTo.trim());
                setEmailTo(null);
              }
            }}
          >
            <input type="email" value={emailTo} autoFocus onChange={(e) => setEmailTo(e.target.value)} placeholder="Customer's email address" />
            <button className="btn-p" type="submit">Send</button>
            <button className="btn-s" type="button" onClick={() => setEmailTo(null)}>Cancel</button>
          </form>
        )}
        <div className="rcpt-actions">
          <button className="rcpt-ghost" onClick={() => window.print()}>
            Print receipt
          </button>
          <button className="rcpt-ghost" onClick={() => setEmailTo(customerEmail)}>
            Email receipt
          </button>
          <button className="rcpt-ghost" onClick={printGift}>
            Gift receipt
          </button>
          <button className="pm-complete rcpt-new" onClick={dismiss}>
            Complete sale
          </button>
        </div>
      </div>

      {/* Printable till receipt — only visible in @media print (see index.css). */}
      <div className={`rcpt-print ${gift ? 'gift' : ''}`} aria-hidden="true">
        <div className="rcpt-print-brand">✦ nova</div>
        <div className="rcpt-print-store">{storeName}</div>
        <hr />
        <div className="rcpt-print-meta">
          <div><span>Receipt</span><b>{sale.orderNumber}</b></div>
          <div><span>Date</span><span>{fmtWhen(sale.at)}</span></div>
          {sale.soldBy && <div><span>Cashier</span><span>{sale.soldBy}</span></div>}
          {sale.customer && <div><span>Customer</span><span>{sale.customer}</span></div>}
        </div>
        <hr />
        <div className="rcpt-print-lines">
          {sale.lines.map((l, i) => (
            <div key={i}>
              <span>{l.quantity}× {l.name}{l.serial ? ` · SN ${l.serial}` : ''}{l.note ? ` — ${l.note}` : ''}</span>
              <span>{gift ? '' : fmt(l.unitPriceMinor * l.quantity)}</span>
            </div>
          ))}
        </div>
        <hr />
        {gift ? (
          <div className="rcpt-print-totals"><div><span>GIFT RECEIPT</span><span /></div></div>
        ) : (
        <div className="rcpt-print-totals">
          <div><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {adjustment !== 0 && (
            <div><span>{adjustment < 0 ? 'Discount' : 'Tax'}</span><span>{adjustment < 0 ? `−${fmt(-adjustment)}` : fmt(adjustment)}</span></div>
          )}
          <div className="rcpt-print-grand"><span>TOTAL</span><span>{fmt(sale.totalMinor)}</span></div>
          {sale.tenders.map((t) => (
            <div key={t.id}><span>{tenderShort(t.method, paymentTypes)}</span><span>{fmt(t.amountMinor)}</span></div>
          ))}
          {sale.changeMinor > 0 && <div><span>Change</span><span>{fmt(sale.changeMinor)}</span></div>}
          {balance > 0 && <div><span>Balance to pay</span><span>{fmt(balance)}</span></div>}
        </div>
        )}
        {sale.note && <div className="rcpt-print-note">Note: {sale.note}</div>}
        {sale.fulfillment && <div className="rcpt-print-note">{FULFILLMENT_LABEL[sale.fulfillment.kind]}{sale.fulfillment.note ? `: ${sale.fulfillment.note}` : ''}{sale.fulfillment.kind === 'pickup' && pickupInstructions ? ` — ${pickupInstructions}` : ''}</div>}
        {sale.training && <div className="rcpt-print-training">TRAINING MODE — NOT A SALE</div>}
        <div className="rcpt-print-foot">Thank you for shopping with us!</div>
      </div>
    </div>
  );
}
