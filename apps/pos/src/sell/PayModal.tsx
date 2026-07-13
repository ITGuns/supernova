import { useState } from 'react';
import { fmt } from '../lib/format';
import { computeTotals } from '../lib/totals';
import { useCart, type Tender, type TenderMethod } from '../store/cartStore';
import { useSettings } from '../store/settingsStore';

const uid = (): string => crypto.randomUUID();

export function PayModal({ onClose }: { onClose: () => void }) {
  const lines = useCart((s) => s.lines);
  const discountBps = useCart((s) => s.orderDiscountBps);
  const completeSale = useCart((s) => s.completeSale);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);

  const totals = computeTotals(lines, discountBps, 'USD', taxBps);
  const totalMinor = totals.totalMinor;

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [entryMinor, setEntryMinor] = useState(0);

  const tendered = tenders.reduce((s, t) => s + t.amountMinor, 0);
  const remaining = Math.max(0, totalMinor - tendered);
  const change = Math.max(0, tendered - totalMinor);
  const canComplete = tendered >= totalMinor;

  const addTender = (method: TenderMethod, amount: number) => {
    if (amount <= 0) return;
    setTenders((prev) => [...prev, { id: uid(), method, amountMinor: amount }]);
    setEntryMinor(0);
  };
  const removeTender = (id: string) => setTenders((prev) => prev.filter((t) => t.id !== id));
  const pressDigit = (d: number) => setEntryMinor((v) => Math.min(v * 10 + d, 99_999_99));
  const backspace = () => setEntryMinor((v) => Math.floor(v / 10));

  const complete = () => {
    completeSale({
      totalMinor,
      tenders,
      changeMinor: change,
      lines: lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
      })),
    });
    onClose();
  };

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h2>Payment</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="pm-body">
          <div className="pm-receipt">
            <div className="pm-receipt-title">Sale summary</div>
            <div className="pm-lines">
              {lines.map((l) => (
                <div key={l.lineId} className="pm-line">
                  <span className="pm-qty">{l.quantity}×</span>
                  <span className="pm-name">{l.name}</span>
                  <span className="pm-amt">{fmt(l.unitPriceMinor * l.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="pm-totals">
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
              <div className="dtrow pm-total">
                <span>Total</span>
                <span>{fmt(totalMinor)}</span>
              </div>
            </div>
          </div>

          <div className="pm-card">
            <div className="pm-due">
              <div className="pm-due-label">{canComplete ? 'Change due' : 'Amount due'}</div>
              <div className={`pm-due-amt ${canComplete ? 'is-change' : ''}`}>
                {fmt(canComplete ? change : remaining)}
              </div>
            </div>

            <button
              className="pm-primary"
              disabled={remaining === 0}
              onClick={() => addTender('CARD', remaining)}
            >
              💳 Card <span className="pm-primary-amt">{fmt(remaining)}</span>
            </button>

            <div className="pm-cash">
              <div className="pm-cash-head">Cash</div>
              <div className="pm-entry">{fmt(entryMinor)}</div>
              <div className="pm-quick">
                <button disabled={remaining === 0} onClick={() => addTender('CASH', remaining)}>
                  Exact
                </button>
                <button onClick={() => addTender('CASH', 2000)}>$20</button>
                <button onClick={() => addTender('CASH', 5000)}>$50</button>
              </div>
              <div className="pm-keypad">
                {keys.map((k) => (
                  <button key={k} onClick={() => pressDigit(k)}>
                    {k}
                  </button>
                ))}
                <button onClick={() => setEntryMinor((v) => Math.min(v * 100, 99_999_99))}>00</button>
                <button onClick={() => pressDigit(0)}>0</button>
                <button onClick={backspace}>⌫</button>
              </div>
              <button className="pm-addcash" disabled={entryMinor === 0} onClick={() => addTender('CASH', entryMinor)}>
                Add cash
              </button>
            </div>

            {tenders.length > 0 && (
              <div className="pm-tenders">
                {tenders.map((t) => (
                  <div key={t.id} className="pm-tender">
                    <span>{t.method === 'CASH' ? '💵 Cash' : '💳 Card'}</span>
                    <span className="pm-tender-amt">{fmt(t.amountMinor)}</span>
                    <button onClick={() => removeTender(t.id)} aria-label="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button className="pm-complete" disabled={!canComplete} onClick={complete}>
          {canComplete ? (
            <>
              Complete sale{change > 0 && <span className="pm-change"> · Change {fmt(change)}</span>}
            </>
          ) : (
            <>Remaining {fmt(remaining)}</>
          )}
        </button>
      </div>
    </div>
  );
}
