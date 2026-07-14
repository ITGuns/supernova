import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';
import { BagClock } from '../admin/illustrations';
import '../styles/sell.css';

const TABS = ['All', 'Process return', 'Continue sale'];

interface HSale {
  orderNumber: string;
  receipt: string;
  at: number;
  customer: string;
  soldBy: string;
  outlet: string;
  note: string;
  totalMinor: number;
  status: string;
  training: boolean;
  methods: string[];
  lines: { name: string; qty: number; priceMinor: number }[];
}

const initials = (n: string) => n.split(' ').map((s) => s.charAt(0)).join('').slice(0, 2).toUpperCase();
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).getTime();
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function SalesHistory() {
  const sales = useCart((s) => s.sales);
  const parked = useCart((s) => s.parked);
  const retrieve = useCart((s) => s.retrieve);
  const markReturned = useCart((s) => s.markReturned);
  const users = useUsers((s) => s.users);
  const outlet = useSetup((s) => s.outlets)[0];
  const outletName = outlet?.name ?? 'Main Outlet';
  const [tab, setTab] = useState('All');
  const location = useLocation();
  const navigate = useNavigate();
  const initialCustomer = (location.state as { customerName?: string } | null)?.customerName || '';
  const [customerFilter, setCustomerFilter] = useState(initialCustomer);
  const [receiptFilter, setReceiptFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [totalFilter, setTotalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState(() => isoDate(Date.now()));
  const [dateTo, setDateTo] = useState(() => isoDate(Date.now()));
  const [more, setMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const allSales: HSale[] = sales.map((s) => ({
    orderNumber: s.orderNumber,
    receipt: s.orderNumber.replace('#', ''),
    at: s.at,
    customer: s.customer ?? '',
    soldBy: s.soldBy ?? 'Staff',
    outlet: outletName,
    note: s.note ?? '',
    totalMinor: s.totalMinor,
    status: s.status ?? 'Completed',
    training: !!s.training,
    methods: s.tenders.map((t) => t.method),
    lines: s.lines.map((l) => ({ name: l.name, qty: l.quantity, priceMinor: l.unitPriceMinor })),
  }));

  const filtered = allSales.filter((s) => {
    if (dateFrom && s.at < dayStart(dateFrom)) return false;
    if (dateTo && s.at > dayEnd(dateTo)) return false;
    const cust = customerFilter.trim().toLowerCase();
    if (cust && !(s.customer.toLowerCase().includes(cust) || s.note.toLowerCase().includes(cust))) return false;
    const rec = receiptFilter.trim().toLowerCase();
    if (rec && !(s.receipt.toLowerCase().includes(rec) || s.note.toLowerCase().includes(rec))) return false;
    const prod = productFilter.trim().toLowerCase();
    if (prod && !s.lines.some((l) => l.name.toLowerCase().includes(prod))) return false;
    const tot = totalFilter.trim();
    if (tot) {
      const minor = Math.round(parseFloat(tot.replace(/[^0-9.]/g, '') || 'NaN') * 100);
      if (!(fmt(s.totalMinor).includes(tot) || s.totalMinor === minor)) return false;
    }
    if (statusFilter === 'Training' && !s.training) return false;
    if ((statusFilter === 'Completed' || statusFilter === 'Returned') && s.status !== statusFilter) return false;
    if (paymentFilter !== 'All' && !s.methods.includes(paymentFilter === 'Cash' ? 'CASH' : 'CARD')) return false;
    if (userFilter !== 'All' && s.soldBy !== userFilter) return false;
    return true;
  });
  const visible = tab === 'Process return' ? filtered.filter((s) => s.status === 'Completed' && !s.training) : filtered;

  const clearFilters = () => {
    setCustomerFilter('');
    setReceiptFilter('');
    setProductFilter('');
    setTotalFilter('');
    setStatusFilter('All');
    setPaymentFilter('All');
    setUserFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const doReturn = (s: HSale) => {
    if (s.status !== 'Returned') markReturned(s.orderNumber);
  };

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['Receipt', 'Date', 'Customer', 'Sold by', 'Note', 'Total', 'Status'],
      ...visible.map((s) => [s.receipt, new Date(s.at).toLocaleString(), s.customer, s.soldBy, s.note, (s.totalMinor / 100).toFixed(2), s.training ? `${s.status} (Training)` : s.status]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="sell-page">
      <h1 className="sell-title">Sales history</h1>
      <div className="sh-tabs">
        {TABS.map((t) => (
          <button key={t} className={`sh-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="sell-subbar">View, edit and manage your sales all in one place.</div>

      {tab === 'Continue sale' ? (
        parked.length === 0 ? (
          <div className="astate sh-empty2">
            <BagClock />
            <div className="sh-empty-title">No parked sales.</div>
            <div className="sh-empty-hint">Park a sale at the register to continue it later.</div>
          </div>
        ) : (
          <div className="sh-parked">
            <div className="sh-parked-row head"><span>Sale</span><span>Parked</span><span>Items</span><span className="r">Subtotal</span><span /></div>
            {parked.map((p) => {
              const items = p.lines.reduce((n, l) => n + l.quantity, 0);
              return (
                <div key={p.id} className="sh-parked-row">
                  <span className="rlink">{p.label}</span>
                  <span>{new Date(p.parkedAt).toLocaleString()}</span>
                  <span>{items} item{items === 1 ? '' : 's'}</span>
                  <span className="r">{fmt(p.lines.reduce((n, l) => n + l.unitPriceMinor * l.quantity, 0))}</span>
                  <span><button className="btn-p" onClick={() => { retrieve(p.id); navigate('/sell'); }}>Retrieve</button></span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          <div className="sh-filters2">
            <div className="shf"><label>Date from</label><input type="date" className="sh-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div className="shf"><label>Date to</label><input type="date" className="sh-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            <div className="shf"><label>Customer</label><input className="sh-input" placeholder="Enter a customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} /></div>
            <div className="shf"><label>Receipt or note</label><input className="sh-input" placeholder="Enter a receipt or note" value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value)} /></div>
            {more && (
              <>
                <div className="shf"><label>Product</label><input className="sh-input" placeholder="Enter a product name" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} /></div>
                <div className="shf"><label>Sale total</label><input className="sh-input" placeholder="$ Enter sale total" value={totalFilter} onChange={(e) => setTotalFilter(e.target.value)} /></div>
                <div className="shf"><label>Outlet</label><select className="sh-input"><option>{outletName}</option></select></div>
                <div className="shf"><label>Register</label><select className="sh-input"><option>{outlet?.registers[0] ?? 'Main Register'}</option></select></div>
                <div className="shf"><label>Status</label><select className="sh-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="All">All sales</option><option>Completed</option><option>Returned</option><option>Training</option></select></div>
                <div className="shf"><label>User</label><select className="sh-input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><option value="All">All users</option>{users.map((u) => <option key={u.id}>{u.name}</option>)}</select></div>
                <div className="shf"><label>Payment type</label><select className="sh-input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option value="All">All payment types</option><option>Cash</option><option>Card</option></select></div>
              </>
            )}
            <div className="shf-actions">
              <span className="rlink" onClick={clearFilters}>Clear filters</span>
              <span className="rlink" onClick={() => setMore((m) => !m)}>{more ? 'Less filters' : 'More filters'}</span>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="astate sh-empty2">
              <BagClock />
              <div className="sh-empty-title">No sales found.</div>
              <div className="sh-empty-hint">Try a different search or update your filters.</div>
            </div>
          ) : (
            <>
              <div className="disp-row sh-disp">
                <span>Displaying {visible.length} sale{visible.length === 1 ? '' : 's'} from {dateFrom ? fmtDay(dateFrom) : 'earliest'} - {dateTo ? fmtDay(dateTo) : 'latest'}</span>
                <span className="rlink" onClick={exportCsv}>⤓ Export list</span>
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
                {visible.map((s) => (
                  <div key={s.orderNumber}>
                    <div className="sh-row2" onClick={() => setExpanded((e) => (e === s.orderNumber ? null : s.orderNumber))}>
                      <span className={`sh-chev ${expanded === s.orderNumber ? 'open' : ''}`}>›</span>
                      <span><span className="rlink">{s.receipt}</span><br /><span className="sh-time">{new Date(s.at).toLocaleString()}</span></span>
                      <span>{s.customer || '-'}</span>
                      <span className="sh-soldby"><span className="cust-av sh-av">{initials(s.soldBy)}</span><span>{s.soldBy}<br /><span className="sh-time">{s.outlet}</span></span></span>
                      <span>{s.note || '-'}</span>
                      <span className="r">{fmt(s.totalMinor)}</span>
                      <span>{s.status}{s.training && <> <span className="qt-chip draft">Training</span></>}</span>
                      {tab === 'Process return' ? (
                        <span><button className="btn-s" onClick={(e) => { e.stopPropagation(); doReturn(s); }}>Return</button></span>
                      ) : s.status === 'Returned' ? (
                        <span />
                      ) : (
                        <span className="sh-return" title="Return" onClick={(e) => { e.stopPropagation(); doReturn(s); }}>↩</span>
                      )}
                    </div>
                    {expanded === s.orderNumber && (
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
        </>
      )}
    </main>
  );
}
