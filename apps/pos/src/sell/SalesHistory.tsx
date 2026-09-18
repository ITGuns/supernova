import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { isCash, methodOf, tenderLabel as tenderName } from '../lib/tenders';
import { refundAmountFor, refundFor, returnedQty, saleBalance, useCart, type CompletedSale, type SaleFulfillment, type Tender } from '../store/cartStore';
import { IntInput } from '../admin/NumInput';
import { CASH, STORE_CREDIT, isGiftCard } from '../lib/tenders';
import { FULFILLMENT_LABEL } from '../store/fulfillmentStore';
import { useCustomers } from '../store/customerStore';
import { useSettings } from '../store/settingsStore';
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
  balanceMinor: number;
  status: string;
  training: boolean;
  methods: string[];
  tenders: Tender[];
  lines: { name: string; qty: number; priceMinor: number; note?: string; returned: number; serial?: string }[];
  /** What a return would (or did) hand back, per tender method. */
  refund: Tender[];
  refundedAt?: number;
  fulfillment?: SaleFulfillment;
  sale: CompletedSale;
}

type DatePreset = 'Today' | 'Yesterday' | 'Last 7 days' | 'This month' | 'Last month' | 'All time' | 'Custom';
const DATE_PRESETS: DatePreset[] = ['Today', 'Yesterday', 'Last 7 days', 'This month', 'Last month', 'All time', 'Custom'];


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
  const voidSale = useCart((s) => s.voidSale);
  const continueSale = useCart((s) => s.continueSale);
  const returnItems = useCart((s) => s.returnItems);
  const updateTenders = useCart((s) => s.updateTenders);
  const setFulfillmentStatus = useCart((s) => s.setFulfillmentStatus);
  const customersList = useCustomers((s) => s.customers);
  const updateCustomer = useCustomers((s) => s.updateCustomer);
  const storeName = useSettings((s) => s.storeName);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState('original');
  const [editPay, setEditPay] = useState<HSale | null>(null);
  const [editTenders, setEditTenders] = useState<Tender[]>([]);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const tenderLabel = (m: string) => tenderName(m, paymentTypes);
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
  const [datePreset, setDatePreset] = useState<DatePreset>('Today');
  const [dateFrom, setDateFrom] = useState(() => isoDate(Date.now()));
  const [dateTo, setDateTo] = useState(() => isoDate(Date.now()));
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [more, setMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<HSale | null>(null);
  const [notice, setNotice] = useState('');
  const [, setSearchTick] = useState(0);

  // Date presets set the from/to pair; "Custom" leaves the pickers editable.
  const applyPreset = (p: DatePreset) => {
    setDatePreset(p);
    const now = new Date();
    const day = (d: Date) => isoDate(d.getTime());
    if (p === 'Today') { setDateFrom(day(now)); setDateTo(day(now)); }
    else if (p === 'Yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); setDateFrom(day(y)); setDateTo(day(y)); }
    else if (p === 'Last 7 days') { const y = new Date(now); y.setDate(y.getDate() - 6); setDateFrom(day(y)); setDateTo(day(now)); }
    else if (p === 'This month') { setDateFrom(day(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(day(now)); }
    else if (p === 'Last month') { setDateFrom(day(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setDateTo(day(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (p === 'All time') { setDateFrom(''); setDateTo(''); }
  };
  // Sale awaiting return confirmation. Returning is irreversible (restocks
  // inventory and removes the sale from revenue), so never do it on one click.
  const [confirmReturn, setConfirmReturn] = useState<HSale | null>(null);

  const allSales: HSale[] = sales.map((s) => ({
    orderNumber: s.orderNumber,
    receipt: s.orderNumber.replace('#', ''),
    at: s.at,
    customer: s.customer ?? '',
    soldBy: s.soldBy ?? 'Staff',
    outlet: outletName,
    note: s.note ?? '',
    totalMinor: s.totalMinor,
    balanceMinor: saleBalance(s),
    status: s.status ?? 'Completed',
    training: !!s.training,
    methods: s.tenders.map((t) => t.method),
    tenders: s.tenders,
    lines: s.lines.map((l, i) => ({ name: l.name, qty: l.quantity, priceMinor: l.unitPriceMinor, note: l.note, returned: returnedQty(s, i), serial: l.serial })),
    fulfillment: s.fulfillment,
    sale: s,
    refund: s.status === 'Returned' ? (s.refundTenders ?? []) : refundFor(s),
    refundedAt: s.refundedAt,
  }));

  const filtered = allSales.filter((s) => {
    if (dateFrom && s.at < dayStart(dateFrom)) return false;
    if (dateTo && s.at > dayEnd(dateTo)) return false;
    if (timeFrom || timeTo) {
      const d = new Date(s.at);
      const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      if (timeFrom && hm < timeFrom) return false;
      if (timeTo && hm > timeTo) return false;
    }
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
    if (statusFilter !== 'All' && statusFilter !== 'Training' && s.status !== statusFilter) return false;
    if (paymentFilter !== 'All' && !s.methods.includes(paymentFilter)) return false;
    if (userFilter !== 'All' && s.soldBy !== userFilter) return false;
    return true;
  });
  // Process return: paid sales only. Continue sale: open layaway / on-account sales (parked sales are listed separately below).
  const visible =
    tab === 'Process return'
      ? filtered.filter((s) => (s.status === 'Completed' || s.status === 'Partially returned') && !s.training)
      : tab === 'Continue sale'
      ? allSales.filter((s) => s.status === 'Layaway' || s.status === 'On account')
      : filtered;

  const clearFilters = () => {
    setCustomerFilter('');
    setReceiptFilter('');
    setProductFilter('');
    setTotalFilter('');
    setStatusFilter('All');
    setPaymentFilter('All');
    setUserFilter('All');
    setDatePreset('All time');
    setDateFrom('');
    setDateTo('');
    setTimeFrom('');
    setTimeTo('');
  };

  const doReturn = (s: HSale) => {
    if (s.status === 'Returned' || s.status === 'Voided') return;
    const q: Record<number, number> = {};
    s.lines.forEach((l, i) => { q[i] = l.qty - l.returned; });
    setReturnQty(q);
    setRefundMethod('original');
    setConfirmReturn(s);
  };
  const returnSelection = confirmReturn ? confirmReturn.lines.map((_, i) => ({ index: i, quantity: returnQty[i] ?? 0 })).filter((it) => it.quantity > 0) : [];
  const returnAmount = confirmReturn ? refundAmountFor(confirmReturn.sale, returnSelection) : 0;
  const returnTenders: Tender[] = confirmReturn
    ? refundMethod === 'original'
      ? refundFor(confirmReturn.sale, returnAmount)
      : [{ id: `r-${Date.now()}`, method: refundMethod, amountMinor: returnAmount }]
    : [];
  const commitReturn = () => {
    if (!confirmReturn || !returnSelection.length) return;
    returnItems(confirmReturn.orderNumber, returnSelection, returnTenders);
    // A refund to store credit lands on the customer's account.
    if (refundMethod === STORE_CREDIT && confirmReturn.customer) {
      const c = customersList.find((x) => `${x.firstName} ${x.lastName}`.trim() === confirmReturn.customer);
      if (c) updateCustomer(c.id, { storeCreditMinor: c.storeCreditMinor + returnAmount });
    }
    setConfirmReturn(null);
  };
  void markReturned;
  const emailReceipt = (s: HSale) => {
    const to = customersList.find((x) => `${x.firstName} ${x.lastName}`.trim() === s.customer)?.email ?? '';
    const body = [`${storeName} — Receipt ${s.receipt}`, new Date(s.at).toLocaleString(), '', ...s.lines.map((l) => `${l.qty} x ${l.name}  ${fmt(l.priceMinor * l.qty)}`), '', `TOTAL ${fmt(s.totalMinor)}`, ...s.tenders.map((t) => `${tenderLabel(t.method)} ${fmt(t.amountMinor)}`), '', 'Thank you for shopping with us!'].join('\n');
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Receipt ${s.receipt} from ${storeName}`)}&body=${encodeURIComponent(body)}`;
    setNotice(`Receipt ${s.receipt} opened in your mail app${to ? ` for ${to}` : ''}.`);
  };

  const printReceipt = (s: HSale) => {
    // Print the till receipt of a past sale: swap it into the print area, print, restore.
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) return;
    const lines = s.lines.map((l) => `<div><span>${l.qty}× ${l.name}</span><span>${fmt(l.priceMinor * l.qty)}</span></div>`).join('');
    const tenders = s.tenders.map((t) => `<div><span>${tenderLabel(t.method)}</span><span>${fmt(t.amountMinor)}</span></div>`).join('');
    w.document.write(`<html><head><title>Receipt ${s.receipt}</title><style>body{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:16px;width:300px}div{display:flex;justify-content:space-between;margin:2px 0}hr{border:0;border-top:1px dashed #999;margin:8px 0}.g{font-weight:700;font-size:14px}</style></head><body><div><b>Receipt</b><span>${s.receipt}</span></div><div><span>Date</span><span>${new Date(s.at).toLocaleString()}</span></div>${s.customer ? `<div><span>Customer</span><span>${s.customer}</span></div>` : ''}<div><span>Cashier</span><span>${s.soldBy}</span></div><hr/>${lines}<hr/><div class="g"><span>TOTAL</span><span>${fmt(s.totalMinor)}</span></div>${tenders}${s.note ? `<hr/><div>Note: ${s.note}</div>` : ''}<hr/><div><span>Thank you for shopping with us!</span></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
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

      {tab === 'Continue sale' && visible.length > 0 && (
        <div className="sh-table2 sh-open">
          <div className="sh-thead2">
            <span />
            <span className="s">Receipt</span>
            <span className="s">Customer</span>
            <span className="s">Sold by</span>
            <span>Note</span>
            <span className="r s">Balance</span>
            <span>Status</span>
            <span />
          </div>
          {visible.map((s) => (
            <div key={s.orderNumber} className="sh-row2">
              <span />
              <span><span className="rlink">{s.receipt}</span><br /><span className="sh-time">{new Date(s.at).toLocaleString()}</span></span>
              <span>{s.customer || '-'}</span>
              <span>{s.soldBy}</span>
              <span>{s.note || '-'}</span>
              <span className="r">{fmt(s.balanceMinor)} of {fmt(s.totalMinor)}</span>
              <span>{s.status}</span>
              <span><button className="btn-p" onClick={() => { continueSale(s.orderNumber); navigate('/sell'); }}>Continue sale</button></span>
            </div>
          ))}
        </div>
      )}
      {tab === 'Continue sale' ? (
        parked.length === 0 ? (
          visible.length === 0 ? (
            <div className="astate sh-empty2">
              <BagClock />
              <div className="sh-empty-title">No open sales.</div>
              <div className="sh-empty-hint">Parked, layaway and on-account sales appear here so you can continue them.</div>
            </div>
          ) : null
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
            <div className="shf">
              <label>Date</label>
              <select className="sh-input" value={datePreset} onChange={(e) => applyPreset(e.target.value as DatePreset)}>
                {DATE_PRESETS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {datePreset === 'Custom' && (
              <>
                <div className="shf"><label>From</label><input type="date" className="sh-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                <div className="shf"><label>To</label><input type="date" className="sh-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              </>
            )}
            <div className="shf">
              <label>Time range</label>
              <span className="sh-timerange">
                <input type="time" className="sh-input" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
                <span>–</span>
                <input type="time" className="sh-input" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
              </span>
            </div>
            <div className="shf"><label>Customer</label><input className="sh-input" placeholder="Enter a customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} /></div>
            <div className="shf"><label>Receipt or note</label><input className="sh-input" placeholder="Enter a receipt or note" value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value)} /></div>
            {more && (
              <>
                <div className="shf"><label>Product</label><input className="sh-input" placeholder="Enter a product name" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} /></div>
                <div className="shf"><label>Sale total</label><input className="sh-input" placeholder="$ Enter sale total" value={totalFilter} onChange={(e) => setTotalFilter(e.target.value)} /></div>
                <div className="shf"><label>Outlet</label><select className="sh-input"><option>{outletName}</option></select></div>
                <div className="shf"><label>Register</label><select className="sh-input"><option>{outlet?.registers[0] ?? 'Main Register'}</option></select></div>
                <div className="shf"><label>Status</label><select className="sh-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="All">All sales</option><option>Completed</option><option>Returned</option><option>Partially returned</option><option>Voided</option><option>Layaway</option><option>On account</option><option>Training</option></select></div>
                <div className="shf"><label>User</label><select className="sh-input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><option value="All">All users</option>{users.map((u) => <option key={u.id}>{u.name}</option>)}</select></div>
                <div className="shf"><label>Payment type</label><select className="sh-input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option value="All">All payment types</option>{paymentTypes.map((t) => <option key={t.id} value={methodOf(t)}>{t.name}</option>)}</select></div>
              </>
            )}
            <div className="shf-actions">
              <span className="rlink" onClick={clearFilters}>Clear filters</span>
              <span className="rlink" onClick={() => setMore((m) => !m)}>{more ? 'Less filters' : 'More filters'}</span>
              <button className="btn-p" onClick={() => setSearchTick((t) => t + 1)}>Search</button>
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
                      <span>{s.status}{s.balanceMinor > 0 && ` · ${fmt(s.balanceMinor)} owing`}{s.fulfillment && ` · ${FULFILLMENT_LABEL[s.fulfillment.kind]} ${s.fulfillment.status.toLowerCase()}`}{s.training && <> <span className="qt-chip draft">Training</span></>}</span>
                      {tab === 'Process return' ? (
                        <span><button className="btn-s" onClick={(e) => { e.stopPropagation(); doReturn(s); }}>Return items</button></span>
                      ) : (s.status === 'Completed' || s.status === 'Partially returned') && !s.training ? (
                        <span className="sh-return" title="Return items" onClick={(e) => { e.stopPropagation(); doReturn(s); }}>↩</span>
                      ) : (
                        <span />
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
                        {s.tenders.length > 0 && (
                          <div className="sh-line sh-pay">
                            <span>Paid — {s.tenders.map((t) => `${tenderLabel(t.method)} ${fmt(t.amountMinor)}${t.reference ? ` (${t.reference})` : ''}`).join(' · ')}</span>
                            <span className="r">{fmt(s.tenders.reduce((a, t) => a + t.amountMinor, 0))}</span>
                          </div>
                        )}
                        {s.status === 'Returned' && s.refund.length > 0 && (
                          <div className="sh-line sh-refund">
                            <span>
                              Refunded{s.refundedAt ? ` ${new Date(s.refundedAt).toLocaleString()}` : ''} —{' '}
                              {s.refund.map((t) => `${tenderLabel(t.method)} ${fmt(t.amountMinor)}`).join(' · ')}
                            </span>
                            <span className="r">−{fmt(s.refund.reduce((a, t) => a + t.amountMinor, 0))}</span>
                          </div>
                        )}
                        <div className="sh-actions">
                          {(s.status === 'Completed' || s.status === 'Partially returned') && !s.training && <button className="btn-s" onClick={() => doReturn(s)}>Return items</button>}
                          {(s.status === 'Layaway' || s.status === 'On account') && <button className="btn-p" onClick={() => { continueSale(s.orderNumber); navigate('/sell'); }}>Continue sale</button>}
                          {s.status !== 'Voided' && <button className="btn-s" onClick={() => { setEditPay(s); setEditTenders(s.tenders.map((t) => ({ ...t }))); }}>Edit payments</button>}
                          {s.fulfillment?.status === 'Unfulfilled' && <button className="btn-p" onClick={() => setFulfillmentStatus(s.orderNumber, 'Fulfilled')}>Fulfill sale</button>}
                          <button className="btn-s" onClick={() => printReceipt(s)}>Print receipt</button>
                          <button className="btn-s" onClick={() => emailReceipt(s)}>Email receipt</button>
                          <button className="btn-s" onClick={() => printReceipt({ ...s, lines: s.lines, tenders: [], totalMinor: 0 })}>Gift receipt</button>
                          {s.status !== 'Voided' && s.status !== 'Returned' && <button className="btn-s danger" onClick={() => setConfirmVoid(s)}>Void</button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {notice && (
        <div className="sh-notice" role="status">
          {notice} <span className="rlink" onClick={() => setNotice('')}>Dismiss</span>
        </div>
      )}
      {confirmVoid && (
        <div className="pm-overlay" onClick={() => setConfirmVoid(null)}>
          <div className="pm sh-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pm-head">
              <h2>Void sale {confirmVoid.receipt}?</h2>
              <button className="pm-close" onClick={() => setConfirmVoid(null)} aria-label="Close">×</button>
            </div>
            <div className="pm-body sh-confirm-body">
              <div className="pm-receipt">
                <p className="sh-confirm-hint">
                  Voiding puts every product back into stock and removes the sale and its payments from your reports. Any payment already taken is <b>not</b> refunded to the customer automatically — refund it separately if needed. This can’t be undone.
                </p>
              </div>
            </div>
            <div className="sh-confirm-actions">
              <button className="btn-s" onClick={() => setConfirmVoid(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { voidSale(confirmVoid.orderNumber); setConfirmVoid(null); }}>Void sale</button>
            </div>
          </div>
        </div>
      )}
      {confirmReturn && (
        <div className="pm-overlay" onClick={() => setConfirmReturn(null)}>
          <div className="pm sh-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sh-confirm-title">
            <div className="pm-head">
              <h2 id="sh-confirm-title">Return items from sale {confirmReturn.receipt}</h2>
              <button className="pm-close" onClick={() => setConfirmReturn(null)} aria-label="Close">×</button>
            </div>
            <div className="pm-body sh-confirm-body">
              <div className="pm-receipt">
                <div className="pm-receipt-title">Choose what’s coming back</div>
                <div className="pm-lines">
                  {confirmReturn.lines.map((l, i) => (
                    <div key={i} className="pm-line sh-ret-line">
                      <span className="pm-name">{l.name}{l.serial ? ` · SN ${l.serial}` : ''}<br /><span className="pe-muted">{l.qty} sold{l.returned ? ` · ${l.returned} already returned` : ''} · {fmt(l.priceMinor)} each</span></span>
                      <span className="sh-ret-qty">
                        <IntInput className="" int={returnQty[i] ?? 0} onChange={(n) => setReturnQty({ ...returnQty, [i]: Math.max(0, Math.min(l.qty - l.returned, n ?? 0)) })} />
                        <span className="pe-muted">of {l.qty - l.returned}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pm-totals">
                  <label className="reg-open-field">
                    <span>Refund to</span>
                    <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                      <option value="original">Original payment method{confirmReturn.tenders.length > 1 ? 's' : ''}</option>
                      <option value={CASH}>Cash</option>
                      {paymentTypes.filter((t) => methodOf(t) !== CASH).map((t) => <option key={t.id} value={methodOf(t)}>{t.name}</option>)}
                      {confirmReturn.customer && <option value={STORE_CREDIT}>Store credit ({confirmReturn.customer})</option>}
                      {confirmReturn.tenders.filter((t) => isGiftCard(t.method)).map((t) => <option key={t.id} value={t.method}>{tenderLabel(t.method)}</option>)}
                    </select>
                  </label>
                  {returnTenders.map((t) => (
                    <div key={t.id} className="dtrow disc">
                      <span>Refund to {tenderLabel(t.method).toLowerCase()}</span>
                      <span>−{fmt(t.amountMinor)}</span>
                    </div>
                  ))}
                  <div className="dtrow pm-total"><span>Refund total</span><span>{fmt(returnAmount)}</span></div>
                </div>
                <p className="sh-confirm-hint">
                  Returned items go back into stock and the refund comes off reported revenue. Order discounts and tax are refunded in proportion.
                  {returnTenders.some((t) => isCash(t.method)) && ' Hand the cash refund to the customer from the till.'} This can’t be undone.
                </p>
              </div>
            </div>
            <div className="sh-confirm-actions">
              <button className="btn-s" onClick={() => setConfirmReturn(null)}>Cancel</button>
              <button className="btn-p" disabled={returnSelection.length === 0} onClick={commitReturn}>Refund {fmt(returnAmount)}</button>
            </div>
          </div>
        </div>
      )}
      {editPay && (
        <div className="pm-overlay" onClick={() => setEditPay(null)}>
          <div className="pm sh-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pm-head">
              <h2>Edit payments · {editPay.receipt}</h2>
              <button className="pm-close" onClick={() => setEditPay(null)} aria-label="Close">×</button>
            </div>
            <div className="pm-body sh-confirm-body">
              <div className="pm-receipt">
                <p className="sh-confirm-hint">Correct which payment type was used (for example a sale rung up as cash that was actually paid by card). Amounts stay the same so the sale still balances.</p>
                {editTenders.map((t, i) => (
                  <div key={t.id} className="sh-edit-tender">
                    <select value={t.method} onChange={(e) => setEditTenders(editTenders.map((x, xi) => (xi === i ? { ...x, method: e.target.value } : x)))}>
                      <option value={CASH}>Cash</option>
                      {paymentTypes.filter((pt) => methodOf(pt) !== CASH).map((pt) => <option key={pt.id} value={methodOf(pt)}>{pt.name}</option>)}
                      {(t.method === STORE_CREDIT || t.method === 'LOYALTY' || isGiftCard(t.method)) && <option value={t.method}>{tenderLabel(t.method)}</option>}
                    </select>
                    <input value={t.reference ?? ''} onChange={(e) => setEditTenders(editTenders.map((x, xi) => (xi === i ? { ...x, reference: e.target.value } : x)))} placeholder="Reference (optional)" />
                    <span className="r">{fmt(t.amountMinor)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="sh-confirm-actions">
              <button className="btn-s" onClick={() => setEditPay(null)}>Cancel</button>
              <button className="btn-p" onClick={() => { updateTenders(editPay.orderNumber, editTenders); setEditPay(null); setNotice(`Payments on ${editPay.receipt} updated.`); }}>Save payments</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
