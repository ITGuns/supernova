import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { BagClock } from '../admin/illustrations';

const TABS = ['All', 'Process return', 'Continue sale'];

interface HSale {
  receipt: string;
  at: string;
  customer: string;
  soldBy: string;
  outlet: string;
  note: string;
  totalMinor: number;
  status: string;
  lines: { name: string; qty: number; priceMinor: number }[];
}

const SEED: HSale[] = [];

const initials = (n: string) => n.split(' ').map((s) => s.charAt(0)).join('').slice(0, 2).toUpperCase();

export function SalesHistory() {
  const sales = useCart((s) => s.sales);
  const [tab, setTab] = useState('All');
  const location = useLocation();
  const initialCustomer = (location.state as { customerName?: string } | null)?.customerName || '';
  const [customerFilter, setCustomerFilter] = useState(initialCustomer);
  const [receiptFilter, setReceiptFilter] = useState('');
  const [more, setMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const liveMapped: HSale[] = sales.map((s) => ({
    receipt: s.orderNumber.replace('#', ''),
    at: new Date(s.at).toLocaleString(),
    customer: '',
    soldBy: 'Aleina',
    outlet: 'Main Outlet',
    note: '',
    totalMinor: s.totalMinor,
    status: s.training ? 'Training' : 'Completed',
    lines: s.lines.map((l) => ({ name: l.name, qty: l.quantity, priceMinor: l.unitPriceMinor })),
  }));
  const allSales = [...liveMapped, ...SEED];

  const filtered = allSales.filter((s) => {
    const cust = customerFilter.trim().toLowerCase();
    const rec = receiptFilter.trim().toLowerCase();
    if (cust && !(s.customer.toLowerCase().includes(cust) || s.note.toLowerCase().includes(cust))) return false;
    if (rec && !(s.receipt.toLowerCase().includes(rec) || s.note.toLowerCase().includes(rec))) return false;
    return true;
  });

  const clearFilters = () => {
    setCustomerFilter('');
    setReceiptFilter('');
  };

  return (
    <main className="sell-page">
      <h1 className="sell-title">Sales history</h1>
      <div className="sh-tabs">
        {TABS.map((t) => (
          <button key={t} className={`sh-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="sell-subbar">
        View, edit and manage your sales all in one place. <span className="rlink">Need help?</span>
      </div>

      <div className="sh-filters2">
        <div className="shf"><label>Date</label><div className="sh-input sh-date">📅 Jul 6, 2026 to Jul 6, 2026 <span className="drf-chev">▾</span></div></div>
        <div className="shf"><label>Time range</label><div className="sh-input muted">🕓 Choose a time range</div></div>
        <div className="shf"><label>Customer</label><input className="sh-input" placeholder="Enter a customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} /></div>
        <div className="shf"><label>Receipt or note</label><input className="sh-input" placeholder="Enter a receipt or note" value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value)} /></div>
        {more && (
          <>
            <div className="shf"><label>Product</label><input className="sh-input" placeholder="Enter a product name or SKU" /></div>
            <div className="shf"><label>Sale total</label><input className="sh-input" placeholder="$ Enter sale total" /></div>
            <div className="shf"><label>Outlet</label><div className="sh-input">All outlets <span className="drf-chev">▾</span></div></div>
            <div className="shf"><label>Register</label><div className="sh-input muted disabled">All registers <span className="drf-chev">▾</span></div></div>
            <div className="shf"><label>Status</label><div className="sh-input">All sales <span className="drf-chev">▾</span></div></div>
            <div className="shf"><label>User</label><div className="sh-input">All users <span className="drf-chev">▾</span></div></div>
            <div className="shf"><label>Payment type</label><div className="sh-input muted">All payment types <span className="drf-chev">▾</span></div></div>
          </>
        )}
        <div className="shf-actions">
          <span className="rlink" onClick={clearFilters}>Clear filters</span>
          <span className="rlink" onClick={() => setMore((m) => !m)}>{more ? 'Less filters' : 'More filters'}</span>
          <button className="btn-p">Search</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="astate sh-empty2">
          <BagClock />
          <div className="sh-empty-title">No sales found.</div>
          <div className="sh-empty-hint">Try a different search or update your filters.</div>
        </div>
      ) : (
        <>
          <div className="disp-row sh-disp">
            <span>Displaying {filtered.length} sale{filtered.length === 1 ? '' : 's'} from Jul 6, 2026 - Jul 6, 2026</span>
            <span className="rlink">⤓ Export list</span>
          </div>
          <div className="sh-table2">
            <div className="sh-thead2">
              <span />
              <span className="s">Receipt</span>
              <span className="s">Customer</span>
              <span className="s">Sold by</span>
              <span>Note</span>
              <span className="r s">Sale total</span>
              <span>Status</span>
              <span />
            </div>
            {filtered.map((s) => (
              <div key={s.receipt + s.at}>
                <div className="sh-row2" onClick={() => setExpanded((e) => (e === s.receipt ? null : s.receipt))}>
                  <span className={`sh-chev ${expanded === s.receipt ? 'open' : ''}`}>›</span>
                  <span><span className="rlink">{s.receipt}</span><br /><span className="sh-time">{s.at}</span></span>
                  <span>{s.customer || '-'}</span>
                  <span className="sh-soldby"><span className="cust-av sh-av">{initials(s.soldBy)}</span><span>{s.soldBy}<br /><span className="sh-time">{s.outlet}</span></span></span>
                  <span>{s.note || '-'}</span>
                  <span className="r">{fmt(s.totalMinor)}</span>
                  <span>{s.status}</span>
                  <span className="sh-return" title="Return">↩</span>
                </div>
                {expanded === s.receipt && (
                  <div className="sh-expand">
                    {s.lines.map((l, i) => (
                      <div key={i} className="sh-line">
                        <span>{l.qty} × {l.name}</span>
                        <span className="r">{fmt(l.priceMinor * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
