import { useState } from 'react';
import { fmt } from '../lib/format';
import { computeTotals } from '../lib/totals';
import { useCart } from '../store/cartStore';
import { useQuotes, type QuoteStatus } from '../store/quotesStore';
import { useSettings } from '../store/settingsStore';
import { BagClock } from '../admin/illustrations';
import '../styles/sell.css';

const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Declined'];

export function Quotes() {
  const quotes = useQuotes((s) => s.quotes);
  const addQuote = useQuotes((s) => s.addQuote);
  const updateQuote = useQuotes((s) => s.updateQuote);
  const deleteQuote = useQuotes((s) => s.deleteQuote);
  const lines = useCart((s) => s.lines);
  const orderDiscountBps = useCart((s) => s.orderDiscountBps);
  const customerName = useCart((s) => s.customerName);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);
  const [q, setQ] = useState('');

  const rows = quotes.filter(
    (x) => q.trim() === '' || x.num.toLowerCase().includes(q.toLowerCase()) || x.customer.toLowerCase().includes(q.toLowerCase()),
  );
  const newQuote = () => {
    const totalMinor = lines.length > 0 ? computeTotals(lines, orderDiscountBps, 'USD', taxBps).totalMinor : 0;
    addQuote({ customer: customerName || 'Walk-in customer', totalMinor });
  };
  const date = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <main className="sell-page">
      <div className="sh-headrow">
        <h1 className="sell-title">Quotes</h1>
        <button className="btn-primary" onClick={newQuote}>New quote</button>
      </div>
      <div className="sell-subbar">Create and manage customer quotes.</div>

      <div className="qt-filter">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by quote number or customer" />
      </div>

      {rows.length === 0 ? (
        <div className="astate sh-empty2">
          <BagClock />
          <div className="sh-empty-title">No quotes found.</div>
          <div className="sh-empty-hint">Try a different search or create a new quote.</div>
        </div>
      ) : (
        <div className="qt-table">
          <div className="qt-head">
            <span>Quote</span>
            <span>Customer</span>
            <span>Created</span>
            <span>Expires</span>
            <span className="r">Total</span>
            <span>Status</span>
          </div>
          {rows.map((x) => (
            <div key={x.id} className="qt-row">
              <span className="rlink">{x.num}</span>
              <span>{x.customer}</span>
              <span>{date(x.createdAt)}</span>
              <span>{date(x.expiresAt)}</span>
              <span className="r">{fmt(x.totalMinor)}</span>
              <span className="qt-actions">
                <select value={x.status} onChange={(e) => updateQuote(x.id, { status: e.target.value as QuoteStatus })}>
                  {STATUSES.map((st) => <option key={st}>{st}</option>)}
                  {x.status === 'Expired' && <option>Expired</option>}
                </select>
                <button className="qt-del" onClick={() => deleteQuote(x.id)} aria-label="Delete quote">×</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
