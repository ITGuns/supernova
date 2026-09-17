import { fmt } from '../lib/format';
import { tenderShort } from '../lib/tenders';
import { useSetup } from '../store/setupStore';
import { useCart } from '../store/cartStore';
import { useSettings } from '../store/settingsStore';

const fmtWhen = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function Receipt() {
  const sale = useCart((s) => s.lastSale);
  const dismiss = useCart((s) => s.dismissLastSale);
  const storeName = useSettings((s) => s.storeName);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  if (!sale) return null;

  const subtotal = sale.lines.reduce((a, l) => a + l.unitPriceMinor * l.quantity, 0);
  // Anything between the line subtotal and the charged total is discount/tax;
  // the sale record stores only the final total, so show the net adjustment.
  const adjustment = sale.totalMinor - subtotal;

  return (
    <div className="pm-overlay">
      <div className="rcpt">
        <div className="rcpt-check">✓</div>
        <h2>Payment successful</h2>
        <div className="rcpt-order">Sale {sale.orderNumber} · {fmt(sale.totalMinor)} paid</div>
        <div className="rcpt-rows">
          <div className="dtrow pm-total">
            <span>Total paid</span>
            <span>{fmt(sale.totalMinor)}</span>
          </div>
          {sale.tenders.map((t) => (
            <div key={t.id} className="dtrow">
              <span>{tenderShort(t.method, paymentTypes)}</span>
              <span>{fmt(t.amountMinor)}</span>
            </div>
          ))}
          {sale.changeMinor > 0 && (
            <div className="dtrow disc">
              <span>Change given</span>
              <span>{fmt(sale.changeMinor)}</span>
            </div>
          )}
        </div>
        <div className="rcpt-actions">
          <button className="rcpt-ghost" onClick={() => window.print()}>
            Print receipt
          </button>
          <button className="pm-complete rcpt-new" onClick={dismiss}>
            New sale
          </button>
        </div>
      </div>

      {/* Printable till receipt — only visible in @media print (see index.css). */}
      <div className="rcpt-print" aria-hidden="true">
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
              <span>{l.quantity}× {l.name}</span>
              <span>{fmt(l.unitPriceMinor * l.quantity)}</span>
            </div>
          ))}
        </div>
        <hr />
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
        </div>
        {sale.note && <div className="rcpt-print-note">Note: {sale.note}</div>}
        {sale.training && <div className="rcpt-print-training">TRAINING MODE — NOT A SALE</div>}
        <div className="rcpt-print-foot">Thank you for shopping with us!</div>
      </div>
    </div>
  );
}
