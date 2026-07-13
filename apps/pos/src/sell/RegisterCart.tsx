import { fmt } from '../lib/format';
import { computeTotals } from '../lib/totals';
import { useCart } from '../store/cartStore';
import { useSettings } from '../store/settingsStore';

export function RegisterCart({ onPay }: { onPay: () => void }) {
  const lines = useCart((s) => s.lines);
  const discountBps = useCart((s) => s.orderDiscountBps);
  const inc = useCart((s) => s.incrementLine);
  const dec = useCart((s) => s.decrementLine);
  const remove = useCart((s) => s.removeLine);
  const toggleDiscount = useCart((s) => s.toggleDiscount);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);

  const totals = computeTotals(lines, discountBps, 'USD', taxBps);
  const empty = lines.length === 0;

  return (
    <section className="dcart">
      <div className="dcart-customer">
        <span className="dcart-cust-icon">☺</span>
        <input placeholder="Add a customer" />
      </div>

      <div className="dcart-lines">
        {empty && <div className="dcart-empty">Add products to start a sale</div>}
        {lines.map((l) => (
          <div key={l.lineId} className="dline">
            <div className="dline-main">
              <div className="dline-name">{l.name}</div>
              <div className="dline-unit">{fmt(l.unitPriceMinor)} ea</div>
            </div>
            <div className="dstepper">
              <button onClick={() => dec(l.lineId)} aria-label="Decrease">
                −
              </button>
              <span>{l.quantity}</span>
              <button onClick={() => inc(l.lineId)} aria-label="Increase">
                +
              </button>
            </div>
            <div className="dline-total">{fmt(l.unitPriceMinor * l.quantity)}</div>
            <button className="dline-x" onClick={() => remove(l.lineId)} aria-label="Remove">
              ×
            </button>
          </div>
        ))}
      </div>

      {!empty && (
        <div className="dcart-totals">
          <div className="dtrow">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotalMinor)}</span>
          </div>
          {totals.discountMinor > 0 && (
            <div className="dtrow disc">
              <span>Discount</span>
              <span>−{fmt(totals.discountMinor)}</span>
            </div>
          )}
          <div className="dtrow">
            <span>Tax</span>
            <span>{fmt(totals.taxMinor)}</span>
          </div>
        </div>
      )}

      <div className="dcart-add">
        <span className="dcart-add-label">ADD</span>
        <button
          className={`dcart-add-link ${discountBps > 0 ? 'on' : ''}`}
          disabled={empty}
          onClick={toggleDiscount}
        >
          <span className="lock">🔒</span> Discount
        </button>
        <button className="dcart-add-link" disabled>
          <span className="lock">🔒</span> Promo code
        </button>
        <button className="dcart-add-link note" disabled>
          Note
        </button>
      </div>

      <button className={`dpay ${empty ? 'dpay-empty' : ''}`} disabled={empty} onClick={onPay}>
        <span className="dpay-l">
          Pay{' '}
          <span className="dpay-items">
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}
          </span>
        </span>
        <span className="dpay-amt">{fmt(totals.totalMinor)}</span>
      </button>
    </section>
  );
}
