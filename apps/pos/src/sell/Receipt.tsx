import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';

export function Receipt() {
  const sale = useCart((s) => s.lastSale);
  const dismiss = useCart((s) => s.dismissLastSale);
  if (!sale) return null;

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
              <span>{t.method === 'CASH' ? 'Cash' : 'Card'}</span>
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
          <button className="rcpt-ghost" onClick={dismiss}>
            Print / Email
          </button>
          <button className="pm-complete rcpt-new" onClick={dismiss}>
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}
