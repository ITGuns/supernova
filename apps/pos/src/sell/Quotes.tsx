import { useState } from 'react';
import { fmt } from '../lib/format';
import { BagClock } from '../admin/illustrations';

interface Quote {
  id: string;
  num: string;
  customer: string;
  created: string;
  expires: string;
  totalMinor: number;
  status: string;
}

const SEED: Quote[] = [];

export function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>(SEED);
  const [q, setQ] = useState('');

  const rows = quotes.filter(
    (x) => q.trim() === '' || x.num.toLowerCase().includes(q.toLowerCase()) || x.customer.toLowerCase().includes(q.toLowerCase()),
  );
  const addQuote = () =>
    setQuotes((qs) => [
      { id: `q${Date.now()}`, num: `Q-10${43 + qs.length}`, customer: 'Walk-in customer', created: 'Today', expires: 'In 14 days', totalMinor: 0, status: 'Draft' },
      ...qs,
    ]);

  return (
    <main className="sell-page">
      <div className="sh-headrow">
        <h1 className="sell-title">Quotes</h1>
        <button className="btn-primary" onClick={addQuote}>New quote</button>
      </div>
      <div className="sell-subbar">
        Create and manage customer quotes. <span className="rlink">Need help?</span>
      </div>

      <div className="qt-filter">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by quote number or customer" />
        <button className="btn-primary">Search</button>
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
              <span>{x.created}</span>
              <span>{x.expires}</span>
              <span className="r">{fmt(x.totalMinor)}</span>
              <span><span className={`qt-chip ${x.status === 'Draft' ? 'draft' : 'open'}`}>{x.status}</span></span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
