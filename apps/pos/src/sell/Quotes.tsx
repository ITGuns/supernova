import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { computeTotals } from '../lib/totals';
import { useCart } from '../store/cartStore';
import { useQuotes, type QuoteStatus } from '../store/quotesStore';
import { useSettings } from '../store/settingsStore';
import { useCustomers } from '../store/customerStore';
import { BagClock } from '../admin/illustrations';
import '../styles/sell.css';

// Sell → Quotes: view or process quotes. Open quotes convert to a sale on the
// register (Convert to sale), get emailed to the customer, or are archived.

type Filter = 'All quotes' | 'Open' | 'Completed' | 'Archived';

export function Quotes() {
  const nav = useNavigate();
  const quotes = useQuotes((s) => s.quotes);
  const addQuote = useQuotes((s) => s.addQuote);
  const updateQuote = useQuotes((s) => s.updateQuote);
  const deleteQuote = useQuotes((s) => s.deleteQuote);
  const lines = useCart((s) => s.lines);
  const loadLines = useCart((s) => s.loadLines);
  const orderDiscountBps = useCart((s) => s.orderDiscountBps);
  const customerName = useCart((s) => s.customerName);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);
  const customers = useCustomers((s) => s.customers);
  const [status, setStatus] = useState<Filter>('Open');
  const [customer, setCustomer] = useState('');
  const [num, setNum] = useState('');
  const [more, setMore] = useState(false);
  const [note, setNote] = useState('');
  const [applied, setApplied] = useState({ status: 'Open' as Filter, customer: '', num: '', note: '' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<string | null>(null);

  const rows = quotes.filter(
    (x) =>
      (applied.status === 'All quotes' || x.status === applied.status) &&
      (applied.customer.trim() === '' || x.customer.toLowerCase().includes(applied.customer.toLowerCase())) &&
      (applied.num.trim() === '' || x.num.toLowerCase().includes(applied.num.toLowerCase())) &&
      (applied.note.trim() === '' || x.note.toLowerCase().includes(applied.note.toLowerCase())),
  );
  const newQuote = () => {
    const totalMinor = lines.length > 0 ? computeTotals(lines, orderDiscountBps, 'USD', taxBps).totalMinor : 0;
    addQuote({ customer: customerName || 'Walk-in customer', totalMinor, lines, discountBps: orderDiscountBps });
  };
  const convert = (id: string) => {
    const q = quotes.find((x) => x.id === id);
    if (!q) return;
    loadLines(q.lines, { customerName: q.customer === 'Walk-in customer' ? '' : q.customer, discountBps: q.discountBps, note: q.note });
    updateQuote(id, { status: 'Completed' });
    nav('/sell');
  };
  const date = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const chip = (s: QuoteStatus) => (s === 'Open' ? 'open' : s === 'Completed' ? 'received' : 'cancelled');

  return (
    <main className="sell-page">
      <div className="sh-headrow">
        <h1 className="sell-title">Quotes</h1>
        {lines.length > 0 && <button className="btn-primary" onClick={newQuote}>New quote from current sale</button>}
      </div>
      <div className="sell-subbar">
        View or process quotes. <span className="rlink">Need help?</span>
      </div>

      <div className="sh-filters2">
        <div className="shf">
          <label>Status</label>
          <select className="sh-input" value={status} onChange={(e) => setStatus(e.target.value as Filter)}>
            <option>All quotes</option>
            <option>Archived</option>
            <option>Completed</option>
            <option>Open</option>
          </select>
        </div>
        <div className="shf"><label>Customer</label><input className="sh-input" placeholder="Search for customers" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
        <div className="shf"><label>Quote</label><input className="sh-input" placeholder="Search quote number" value={num} onChange={(e) => setNum(e.target.value)} /></div>
        {more && <div className="shf"><label>Note</label><input className="sh-input" placeholder="Search notes" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
        <div className="shf-actions">
          <span className="rlink" onClick={() => setMore((m) => !m)}>{more ? 'Less filters' : 'More filters'}</span>
          <button className="btn-p" onClick={() => setApplied({ status, customer, num, note })}>Search</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="astate sh-empty2">
          <BagClock />
          <div className="sh-empty-title">No quotes found</div>
          <div className="sh-empty-hint">Try a different search or update your filters.</div>
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
            <div key={x.id}>
              <div className="qt-row" onClick={() => setExpanded((e) => (e === x.id ? null : x.id))} role="button" tabIndex={0}>
                <span className="rlink">{x.num}</span>
                <span>{x.customer}</span>
                <span>{date(x.createdAt)}</span>
                <span>{date(x.expiresAt)}</span>
                <span className="r">{fmt(x.totalMinor)}</span>
                <span><span className={`tx-badge ${chip(x.status)}`}>{x.status}</span></span>
              </div>
              {expanded === x.id && (
                <div className="qt-expand">
                  <div className="qt-lines">
                    {x.lines.length === 0 && <div className="qt-muted">No items on this quote.</div>}
                    {x.lines.map((l) => (
                      <div key={l.lineId} className="sh-line">
                        <span>{l.quantity} × {l.name}</span>
                        <span className="r">{fmt(l.unitPriceMinor * l.quantity)}</span>
                      </div>
                    ))}
                    {x.note && <div className="qt-muted">Note: {x.note}</div>}
                    {emailed === x.id && <div className="qt-muted">Quote opened in your mail app for {x.customer}.</div>}
                  </div>
                  <div className="qt-actions2">
                    {x.status === 'Open' && <button className="btn-p" onClick={() => convert(x.id)}>Convert to sale</button>}
                    <button
                      className="btn-s"
                      onClick={() => {
                        const to = customers.find((c) => `${c.firstName} ${c.lastName}`.trim() === x.customer)?.email ?? '';
                        const body = [`Quote ${x.num}`, `Valid until ${date(x.expiresAt)}`, '', ...x.lines.map((l) => `${l.quantity} x ${l.name}  ${fmt(l.unitPriceMinor * l.quantity)}`), '', `TOTAL ${fmt(x.totalMinor)}`, x.note ? `\n${x.note}` : ''].join('\n');
                        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Quote ${x.num}`)}&body=${encodeURIComponent(body)}`;
                        setEmailed(x.id);
                      }}
                    >
                      Email quote
                    </button>
                    <button className="btn-s" onClick={() => window.print()}>Print quote</button>
                    {x.status !== 'Archived' && (
                      confirmArchive === x.id ? (
                        <span className="pe-inline">
                          <span>Archive this quote? It can’t be converted afterwards.</span>
                          <button className="btn-s" onClick={() => setConfirmArchive(null)}>Keep</button>
                          <button className="btn-danger" onClick={() => { updateQuote(x.id, { status: 'Archived' }); setConfirmArchive(null); }}>Archive quote</button>
                        </span>
                      ) : (
                        <button className="btn-s" onClick={() => setConfirmArchive(x.id)}>Archive</button>
                      )
                    )}
                    {x.status === 'Archived' && <button className="rlink pe-danger qt-del2" onClick={() => deleteQuote(x.id)}>Delete</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
