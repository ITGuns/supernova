import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useCart } from '../store/cartStore';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { FULFILLMENT_LABEL, useFulfillments, type FulfillmentKind, type FulfillmentStatus } from '../store/fulfillmentStore';
import { countBucket, txQty, txTotal, useInventory, type StockTx, type StockTxKind, type StockTxStatus } from '../store/inventoryStore';
import { availableOf, useProducts } from '../store/productStore';
import { useSerialNumbers } from '../store/serialNumberStore';
import { useSetup } from '../store/setupStore';
import { downloadCsv } from '../lib/csv';
import '../styles/catalog.css';
import { BagPhone, CatBox, InventoryGraphic, ScannerGraphic } from './illustrations';

const NAV: ContextItem[] = [
  { key: 'stock', label: 'Stock control' },
  { key: 'counts', label: 'Inventory counts' },
  { key: 'special', label: 'Special orders' },
  { key: 'fulfillments', label: 'Fulfillments' },
  { key: 'serials', label: 'Serial numbers' },
];

/** The "Show" options on Stock control, in Lightspeed's order. */
type ShowFilter = 'all' | StockTxStatus | 'Partially received' | 'Overdue';
const SHOW_OPTIONS: ShowFilter[] = ['Open', 'Sent', 'Dispatched', 'Partially received', 'Received', 'Overdue', 'Cancelled'];
const partiallyReceived = (t: StockTx) => t.status === 'Received' && t.lines.some((l) => (l.received ?? l.quantity) < l.quantity);
const overdue = (t: StockTx, now = Date.now()) => t.dueAt !== null && t.dueAt < now && t.status !== 'Received' && t.status !== 'Cancelled';
const ONBOARDING_KEY = 'nova-stock-onboarding-dismissed';

type StockTab = 'orders' | 'transfers' | 'returns';
type CountTab = 'due' | 'upcoming' | 'completed' | 'canceled';
const KIND_OF: Record<StockTab, StockTxKind> = { orders: 'order', transfers: 'transfer', returns: 'return' };
const WORD: Record<StockTab, string> = { orders: 'order', transfers: 'transfer', returns: 'return' };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const readDismissed = () => {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
};

export function InventoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { tab?: string; stockTab?: StockTab } | null;
  const [active, setActive] = useState(state?.tab ?? 'stock');

  // Persisted inventory data
  const transactions = useInventory((s) => s.transactions);
  const counts = useInventory((s) => s.counts);
  const suppliers = useCatalogMeta((s) => s.suppliers);

  // Stock control
  const [stockTab, setStockTab] = useState<StockTab>(state?.stockTab ?? 'orders');
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShowFilter>('all');
  const [outletFilter, setOutletFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created-desc' | 'created-asc' | 'due-asc' | 'due-desc'>('created-desc');
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [onboarding, setOnboarding] = useState(() => !readDismissed());

  const dismissOnboarding = () => {
    setOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* private mode: the card simply shows again next time */
    }
  };

  const kind = KIND_OF[stockTab];
  const outlets = Array.from(new Set(transactions.flatMap((t) => [t.from, t.to]).filter(Boolean)));

  const matchesSearch = (t: StockTx, needle: string) => {
    const n = needle.toLowerCase();
    return (
      t.number.toLowerCase().includes(n) ||
      t.from.toLowerCase().includes(n) ||
      t.to.toLowerCase().includes(n) ||
      t.details.supplierInvoice.toLowerCase().includes(n) ||
      t.details.note.toLowerCase().includes(n) ||
      t.lines.some((l) => l.name.toLowerCase().includes(n) || (l.sku ?? '').toLowerCase().includes(n))
    );
  };

  const currentList = transactions
    .filter(
      (t) =>
        t.kind === kind &&
        (q.trim() === '' || matchesSearch(t, q.trim())) &&
        (statusFilter === 'all' || (statusFilter === 'Partially received' ? partiallyReceived(t) : statusFilter === 'Overdue' ? overdue(t) : t.status === statusFilter)) &&
        (outletFilter === 'all' || t.from === outletFilter || t.to === outletFilter) &&
        (supplierFilter === 'all' || t.from === supplierFilter || t.to === supplierFilter),
    )
    .sort((a, b) => {
      if (sortBy === 'created-asc') return a.createdAt - b.createdAt;
      if (sortBy === 'created-desc') return b.createdAt - a.createdAt;
      const ad = a.dueAt ?? Number.MAX_SAFE_INTEGER;
      const bd = b.dueAt ?? Number.MAX_SAFE_INTEGER;
      return sortBy === 'due-asc' ? ad - bd : bd - ad;
    });

  const totalQty = currentList.reduce((s, t) => s + txQty(t), 0);
  const totalCost = currentList.reduce((s, t) => s + txTotal(t), 0);

  const clearFilters = () => {
    setQDraft('');
    setQ('');
    setStatusFilter('all');
    setOutletFilter('all');
    setSupplierFilter('all');
    setSortBy('created-desc');
  };

  const selStyle = {
    height: '38px',
    background: 'var(--panel)',
    color: 'var(--text)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    padding: '0 8px',
  } as const;

  const newPath: Record<StockTab, string> = {
    orders: '/inventory/orders/new',
    transfers: '/inventory/transfers/new',
    returns: '/inventory/returns/new',
  };

  // Inventory counts
  const [countTab, setCountTab] = useState<CountTab>('due');
  const [scannerOpen, setScannerOpen] = useState(true);
  const byBucket = (b: CountTab) => counts.filter((c) => countBucket(c) === b);
  const visibleCounts = byBucket(countTab).sort((a, b) => (countTab === 'upcoming' ? a.startAt - b.startAt : b.startAt - a.startAt));
  const countEmpty: Record<CountTab, string> = {
    due: 'You have no inventory counts due',
    upcoming: 'You have no upcoming inventory counts',
    completed: 'You have no completed inventory counts',
    canceled: 'You have no canceled inventory counts',
  };
  const whenOf = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  // Fulfillments: sales marked as unfulfilled at the register
  const fulfillments = useFulfillments((s) => s.fulfillments);
  const updateFulfillment = useFulfillments((s) => s.updateFulfillment);
  const loadLines = useCart((s) => s.loadLines);
  const sales = useCart((s) => s.sales);
  const setFulfillmentStatus = useCart((s) => s.setFulfillmentStatus);
  // Paid sales marked pack / pickup / delivery at the register.
  const saleFulfillments = sales.filter((x) => x.fulfillment).map((x) => ({ sale: x, f: x.fulfillment! }));
  const [fulTab, setFulTab] = useState<'all' | FulfillmentKind>('all');
  const [fulOutlet, setFulOutlet] = useState('all');
  const [fulStatus, setFulStatus] = useState<'all' | FulfillmentStatus>('all');
  const [fulType, setFulType] = useState<'all' | FulfillmentKind>('all');
  const visibleFulfillments = fulfillments.filter(
    (f) => (fulTab === 'all' || f.kind === fulTab) && (fulStatus === 'all' || f.status === fulStatus) && (fulType === 'all' || f.kind === fulType),
  );
  const saleStatusOf = (st: string): FulfillmentStatus => (st === 'Unfulfilled' ? 'Open' : st === 'Fulfilled' ? 'Completed' : 'Cancelled');
  const visibleSaleFulfillments = saleFulfillments.filter(
    ({ f }) => (fulTab === 'all' || f.kind === fulTab) && (fulStatus === 'all' || saleStatusOf(f.status) === fulStatus) && (fulType === 'all' || f.kind === fulType),
  );
  const outletName = outlets[0] ?? 'Main Outlet';
  // Inventory counts: pull the latest count data from the cloud again.
  const [resyncing, setResyncing] = useState(false);
  const resyncCounts = async () => {
    setResyncing(true);
    await useInventory.getState().syncFromDb();
    setResyncing(false);
  };

  // Special orders: customer demand (open fulfillments) the stock on hand can't cover.
  const products = useProducts((s) => s.products);
  const setupOutlets = useSetup((s) => s.outlets);
  const [specialTab, setSpecialTab] = useState<'to-order' | 'ordered'>('to-order');
  const [specialOutlet, setSpecialOutlet] = useState('all');
  const [specialSupplier, setSpecialSupplier] = useState('all');
  const [glossary, setGlossary] = useState(false);
  const openPo = (productId: string) => transactions.find((t) => t.kind === 'order' && (t.status === 'Open' || t.status === 'Sent' || t.status === 'Dispatched') && t.lines.some((x) => x.productId === productId));
  const specialRows = [
    ...fulfillments
      .filter((f) => f.status === 'Open')
      .flatMap((f) =>
        f.lines.map((l) => {
          const p = products.find((x) => x.id === l.variantId);
          if (!p) return null;
          const onHand = availableOf(p, products);
          if (onHand >= l.quantity) return null;
          const po = openPo(p.id);
          return { key: `${f.id}-${l.lineId}`, productId: p.id, name: p.name, customer: f.customerName, sale: f.number, supplier: p.supplier, needed: l.quantity - Math.max(0, onHand), onHand, outlet: outletName, ordered: !!po, orderId: po?.id ?? '', orderNumber: po?.number ?? '' };
        }),
      ),
    // Paid, unfulfilled sales whose products are out of stock still need ordering.
    ...saleFulfillments
      .filter(({ f }) => f.status === 'Unfulfilled')
      .flatMap(({ sale: x }) =>
        x.lines.map((l, i) => {
          const p = l.variantId ? products.find((y) => y.id === l.variantId) : undefined;
          if (!p || availableOf(p, products) > 0) return null;
          const po = openPo(p.id);
          return { key: `${x.orderNumber}-${i}`, productId: p.id, name: p.name, customer: x.customer ?? '', sale: x.orderNumber, supplier: p.supplier, needed: l.quantity, onHand: 0, outlet: outletName, ordered: !!po, orderId: po?.id ?? '', orderNumber: po?.number ?? '' };
        }),
      ),
  ].filter((r): r is NonNullable<typeof r> => r !== null);
  const visibleSpecial = specialRows.filter(
    (r) => (specialTab === 'ordered') === r.ordered && (specialOutlet === 'all' || r.outlet === specialOutlet) && (specialSupplier === 'all' || r.supplier === specialSupplier),
  );

  // Serial numbers
  const serials = useSerialNumbers((s) => s.serials);
  const addSerials = useSerialNumbers((s) => s.addSerials);
  const deleteSerial = useSerialNumbers((s) => s.deleteSerial);
  const [serialQ, setSerialQ] = useState('');
  const [serialProductQ, setSerialProductQ] = useState('');
  const [serialOutlet, setSerialOutlet] = useState('all');
  const [serialModal, setSerialModal] = useState(false);
  const [serialProduct, setSerialProduct] = useState('');
  const [serialAddOutlet, setSerialAddOutlet] = useState(setupOutlets[0]?.name ?? 'Main Outlet');
  const [serialText, setSerialText] = useState('');
  const [serialError, setSerialError] = useState('');
  const [serialNotice, setSerialNotice] = useState('');
  const visibleSerials = serials.filter((sn) => {
    const p = products.find((x) => x.id === sn.productId);
    return (
      (serialQ.trim() === '' || sn.serial.toLowerCase().includes(serialQ.trim().toLowerCase())) &&
      (serialProductQ.trim() === '' || sn.productName.toLowerCase().includes(serialProductQ.trim().toLowerCase()) || (p?.sku ?? '').toLowerCase().includes(serialProductQ.trim().toLowerCase())) &&
      (serialOutlet === 'all' || sn.outlet === serialOutlet)
    );
  });
  const exportSerials = () =>
    downloadCsv('serial-numbers.csv', [
      ['serial number', 'product', 'sku', 'outlet', 'status', 'date sold', 'sale'],
      ...visibleSerials.map((sn) => [sn.serial, sn.productName, products.find((x) => x.id === sn.productId)?.sku ?? '', sn.outlet, sn.status, sn.soldAt ? new Date(sn.soldAt).toISOString() : '', sn.saleOrderNumber]),
    ]);

  const retrieveFulfillment = (id: string) => {
    const f = fulfillments.find((x) => x.id === id);
    if (!f || f.status !== 'Open') return;
    loadLines(f.lines, { customerName: f.customerName, discountBps: f.discountBps, note: f.note });
    updateFulfillment(id, { status: 'Completed', completedAt: Date.now() });
    navigate('/sell');
  };

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'stock' && (
            <>
              <h1 className="page-title">Stock control</h1>
              <div className="sh-tabs">
                {(['orders', 'transfers', 'returns'] as StockTab[]).map((t) => (
                  <button key={t} className={`sh-tab ${stockTab === t ? 'active' : ''}`} onClick={() => setStockTab(t)}>
                    {cap(t)}
                  </button>
                ))}
              </div>
              <div className="subbar-row">
                <span>
                  Create, manage and update purchase orders or receive stock. <span className="rlink">Need help?</span>
                </span>
                <div className="page-actions">
                  {stockTab !== 'orders' && (
                    <button className="btn-s" onClick={() => navigate(newPath[stockTab])}>
                      {stockTab === 'transfers' ? 'Transfer stock' : 'Return stock'}
                    </button>
                  )}
                  <button className="btn-s" onClick={() => navigate('/inventory/receive')}>
                    Receive stock
                  </button>
                  <button className="btn-p" onClick={() => navigate('/inventory/orders/new')}>
                    Order stock
                  </button>
                </div>
              </div>

              {onboarding && (
                <div className="onb-cards">
                  <div className="onb-card single">
                    <InventoryGraphic />
                    <div>
                      <div className="onb-h">Update inventory levels to get selling.</div>
                      <div className="onb-t">
                        Track inventory levels to know exactly which products are in stock and able to be sold. We’ll help you get
                        your current inventory levels into Nova Retail depending on how you’re keeping track of your inventory at the
                        moment.
                      </div>
                      <div className="onb-actions">
                        <button className="btn-s" onClick={() => navigate('/inventory/receive')}>
                          Get started
                        </button>
                        <span className="rlink" onClick={dismissOnboarding}>
                          Dismiss
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Show</label>
                    <select
                      className="set-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as ShowFilter)}
                      style={selStyle}
                    >
                      <option value="all">All {stockTab}</option>
                      {SHOW_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s} {stockTab}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Search {stockTab}</label>
                    <input
                      value={qDraft}
                      onChange={(e) => setQDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setQ(qDraft)}
                      placeholder="Enter order number, supplier invoice number, note or product"
                    />
                  </div>
                  <div className="f-field">
                    <label>Outlet</label>
                    <select
                      className="set-select"
                      value={outletFilter}
                      onChange={(e) => setOutletFilter(e.target.value)}
                      style={selStyle}
                    >
                      <option value="all">All outlets</option>
                      {outlets.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {showAllFilters && (
                  <div className="sc-frow">
                    <div className="f-field">
                      <label>Supplier</label>
                      <select
                        className="set-select"
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        style={selStyle}
                      >
                        <option value="all">All suppliers</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="f-field">
                      <label>Created</label>
                      <select
                        className="set-select"
                        value={sortBy.startsWith('created') ? sortBy : ''}
                        onChange={(e) => e.target.value && setSortBy(e.target.value as typeof sortBy)}
                        style={selStyle}
                      >
                        <option value="">Sort by created…</option>
                        <option value="created-desc">Newest first</option>
                        <option value="created-asc">Oldest first</option>
                      </select>
                    </div>
                    <div className="f-field">
                      <label>Due</label>
                      <select
                        className="set-select"
                        value={sortBy.startsWith('due') ? sortBy : ''}
                        onChange={(e) => e.target.value && setSortBy(e.target.value as typeof sortBy)}
                        style={selStyle}
                      >
                        <option value="">Sort by due date…</option>
                        <option value="due-asc">Due soonest</option>
                        <option value="due-desc">Due latest</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="sc-factions split">
                  <span className="sc-links">
                    <span className="rlink" onClick={clearFilters}>
                      Clear filters
                    </span>
                    <span className="rlink" onClick={() => setShowAllFilters((v) => !v)}>
                      {showAllFilters ? 'Less filters' : 'More filters'}
                    </span>
                  </span>
                  <button className="btn-p" onClick={() => setQ(qDraft)}>
                    Search
                  </button>
                </div>
              </div>

              <div className="inv-count">
                Displaying {totalQty} total qty and {fmt(totalCost)} total cost
              </div>
              {currentList.length > 0 ? (
                <div className="atable">
                  <div className="inv-thead inv7">
                    <span className="s">{cap(WORD[stockTab])} number</span>
                    <span className="s">From</span>
                    <span className="s">To</span>
                    <span className="s">Status</span>
                    <span className="s">Created</span>
                    <span className="s r">Total qty.</span>
                    <span className="s r">Total cost</span>
                  </div>
                  {currentList.map((o) => (
                    <div key={o.id} className="inv-row inv7">
                      <span className="rlink strong" onClick={() => navigate(`/inventory/stock/${o.id}`)}>
                        {o.number}
                      </span>
                      <span>{o.from || '—'}</span>
                      <span>{o.to || '—'}</span>
                      <span>
                        <span className={`tx-badge ${o.status.toLowerCase()}`}>{o.status}</span>
                      </span>
                      <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="r">{txQty(o)}</span>
                      <span className="r">{fmt(txTotal(o))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="inv-thead standalone inv7">
                    <span className="s">{cap(WORD[stockTab])} number</span>
                    <span className="s">From</span>
                    <span className="s">To</span>
                    <span className="s">Status</span>
                    <span className="s">Created</span>
                    <span className="s r">Total qty.</span>
                    <span className="s r">Total cost</span>
                  </div>
                  <div className="astate">
                    <CatBox />
                    <div>No {stockTab} found. Try a different search or filter.</div>
                  </div>
                </>
              )}
            </>
          )}

          {active === 'counts' && (
            <>
              <div className="page-head">
                <h1 className="page-title">Inventory counts</h1>
              </div>
              <div className="sh-tabs">
                <button className={`sh-tab ${countTab === 'due' ? 'active' : ''}`} onClick={() => setCountTab('due')}>
                  Due ({byBucket('due').length})
                </button>
                <button className={`sh-tab ${countTab === 'upcoming' ? 'active' : ''}`} onClick={() => setCountTab('upcoming')}>
                  Upcoming ({byBucket('upcoming').length})
                </button>
                <button className={`sh-tab ${countTab === 'completed' ? 'active' : ''}`} onClick={() => setCountTab('completed')}>
                  Completed
                </button>
                <button className={`sh-tab ${countTab === 'canceled' ? 'active' : ''}`} onClick={() => setCountTab('canceled')}>
                  Canceled
                </button>
              </div>
              <div className="subbar-row">
                <span>
                  Create, schedule and complete counts to keep track of your inventory. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => navigate('/inventory/counts/new')}>
                  Add inventory count
                </button>
              </div>

              {scannerOpen && (
                <div className="scanner-card">
                  <ScannerGraphic />
                  <div className="scanner-body">
                    <div className="scanner-title">Get the job done faster with our free mobile app, Scanner</div>
                    <div className="scanner-text">
                      Perform on-the-go inventory counts using an iOS or Android device. Scanner and Nova
                      Retail work together to sync inventory levels and product details, saving time and
                      reducing manual mistakes.
                    </div>
                    <span className="rlink">Find out more ↗</span>
                  </div>
                  <span className="rlink scanner-dismiss" onClick={() => setScannerOpen(false)}>
                    OK, got it
                  </span>
                </div>
              )}

              {visibleCounts.length > 0 ? (
                <div className="atable">
                  <div className="cnt2-head sch">
                    <span className="s">Name</span>
                    <span className="s">Outlet</span>
                    <span className="s">{countTab === 'completed' ? 'Completed' : 'Scheduled'}</span>
                    <span className="s r">Status</span>
                  </div>
                  {visibleCounts.map((c) => (
                    <div key={c.id} className="cnt2-row sch">
                      <span className="cnt-name">
                        <span className="rlink" onClick={() => navigate(`/inventory/counts/${c.id}`)}>{c.name}</span>
                        <span className="cnt-meta">
                          {c.countType === 'full' ? 'Full count' : 'Partial count'}
                          {c.status === 'In progress' && (
                            <>
                              {' '}
                              <span className="chip-inprog">In progress</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span>{c.outlet}</span>
                      <span>{whenOf(countTab === 'completed' && c.completedAt ? c.completedAt : c.startAt)}</span>
                      <span className="r">{c.status === 'Planned' ? (countTab === 'upcoming' ? 'Upcoming' : 'Due') : c.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="astate">
                  <CatBox />
                  <div>{countEmpty[countTab]}</div>
                  {countTab === 'due' && (
                    <button className="btn-p" onClick={() => navigate('/inventory/counts/new')}>
                      Add inventory count
                    </button>
                  )}
                </div>
              )}
              <div className="inv-foot">
                If you’re experiencing problems with your inventory count data,{' '}
                <span className="rlink" onClick={resyncCounts}>{resyncing ? 'resyncing…' : 'resync your inventory counts'}</span>.
              </div>
            </>
          )}

          {active === 'special' && (
            <>
              <h1 className="page-title">Special orders</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${specialTab === 'to-order' ? 'active' : ''}`} onClick={() => setSpecialTab('to-order')}>
                  To order products ({specialRows.filter((r) => !r.ordered).length})
                </button>
                <button className={`sh-tab ${specialTab === 'ordered' ? 'active' : ''}`} onClick={() => setSpecialTab('ordered')}>
                  Ordered products ({specialRows.filter((r) => r.ordered).length})
                </button>
              </div>
              <div className="subbar-row">
                <span>
                  Products customers have bought or reserved that aren’t in stock yet. Order them from your supplier, then receive the stock to fulfill the sale. <span className="rlink">Need help?</span>
                </span>
                <span className="rlink" onClick={() => setGlossary((v) => !v)}>Glossary</span>
              </div>
              {glossary && (
                <div className="inv-glossary">
                  <b>To order</b> — a customer sale or fulfillment needs more units than you have on hand and no purchase order includes the product yet.{' '}
                  <b>Ordered</b> — an open purchase order includes the product; receiving it fulfills the demand.{' '}
                  <b>Special order demand</b> — the units still owed to customers, shown per product on Catalog → Products.
                </div>
              )}
              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Outlet</label>
                    <select className="set-select" value={specialOutlet} onChange={(e) => setSpecialOutlet(e.target.value)} style={selStyle}>
                      <option value="all">All outlets</option>
                      {setupOutlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Supplier</label>
                    <select className="set-select" value={specialSupplier} onChange={(e) => setSpecialSupplier(e.target.value)} style={selStyle}>
                      <option value="all">All suppliers</option>
                      {suppliers.map((sp) => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="inv-count">Displaying {visibleSpecial.length} special order product{visibleSpecial.length === 1 ? '' : 's'}</div>
              {visibleSpecial.length ? (
                <div className="atable">
                  <div className="inv-thead inv7">
                    <span className="s">Product</span>
                    <span className="s">Customer</span>
                    <span className="s">Sale</span>
                    <span className="s">Supplier</span>
                    <span className="s r">Needed</span>
                    <span className="s r">On hand</span>
                    <span className="s r">{specialTab === 'ordered' ? 'Purchase order' : ''}</span>
                  </div>
                  {visibleSpecial.map((r) => (
                    <div key={r.key} className="inv-row inv7">
                      <span className="rlink strong" onClick={() => navigate(`/catalog/products/${r.productId}`)}>{r.name}</span>
                      <span>{r.customer || '—'}</span>
                      <span>{r.sale}</span>
                      <span>{r.supplier || '—'}</span>
                      <span className="r">{r.needed}</span>
                      <span className="r">{r.onHand}</span>
                      <span className="r">
                        {r.ordered ? (
                          <span className="rlink" onClick={() => navigate(`/inventory/stock/${r.orderId}`)}>{r.orderNumber}</span>
                        ) : (
                          <button className="btn-s" onClick={() => navigate('/inventory/orders/new', { state: { productId: r.productId, quantity: r.needed } })}>Order stock</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="astate">
                  <CatBox />
                  <div>{specialTab === 'to-order' ? 'No products to order. Sales and fulfillments that need more stock than you have will show here.' : 'No ordered special order products.'}</div>
                </div>
              )}
            </>
          )}

          {active === 'serials' && (
            <>
              <h1 className="page-title">Serial numbers</h1>
              <div className="subbar-row">
                <span>
                  Use serial numbers to track inventory movement and the sales history of your products. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => setSerialModal(true)}>Add serial numbers</button>
              </div>
              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Serial number</label>
                    <input value={serialQ} onChange={(e) => setSerialQ(e.target.value)} placeholder="Enter serial number" />
                  </div>
                  <div className="f-field">
                    <label>Product</label>
                    <input value={serialProductQ} onChange={(e) => setSerialProductQ(e.target.value)} placeholder="Enter product name or SKU" />
                  </div>
                  <div className="f-field">
                    <label>Outlet</label>
                    <select className="set-select" value={serialOutlet} onChange={(e) => setSerialOutlet(e.target.value)} style={selStyle}>
                      <option value="all">All outlets</option>
                      {setupOutlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sc-factions split">
                  <span className="rlink" onClick={() => { setSerialQ(''); setSerialProductQ(''); setSerialOutlet('all'); }}>Clear filters</span>
                  <span className="rlink" onClick={exportSerials}>⤓ Export list</span>
                </div>
              </div>
              <div className="inv-count">Displaying {visibleSerials.length} serial number{visibleSerials.length === 1 ? '' : 's'}</div>
              {visibleSerials.length ? (
                <div className="atable">
                  <div className="inv-thead sn5">
                    <span className="s">Serial number</span>
                    <span className="s">Product</span>
                    <span className="s">Outlet</span>
                    <span className="s">Date sold</span>
                    <span />
                  </div>
                  {visibleSerials.map((sn) => (
                    <div key={sn.id} className="inv-row sn5">
                      <span className="strong">{sn.serial}</span>
                      <span className="rlink" onClick={() => navigate(`/catalog/products/${sn.productId}`)}>{sn.productName}</span>
                      <span>{sn.outlet}</span>
                      <span>{sn.soldAt ? `${new Date(sn.soldAt).toLocaleDateString()}${sn.saleOrderNumber ? ` · ${sn.saleOrderNumber}` : ''}` : <span className="tx-badge open">In stock</span>}</span>
                      <span className="r"><span className="ic" onClick={() => deleteSerial(sn.id)} title="Remove serial number">🗑</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="astate">
                  <CatBox />
                  <div>No serial numbers found. Add serial numbers to start tracking individual units.</div>
                </div>
              )}
              {serialModal && (
                <div className="pm-overlay" onClick={() => setSerialModal(false)}>
                  <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
                    <div className="pm-head">
                      <h2>Add serial numbers</h2>
                      <button className="pm-close" onClick={() => setSerialModal(false)} aria-label="Close">×</button>
                    </div>
                    <form
                      className="reg-open-body"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const p = products.find((x) => x.id === serialProduct);
                        if (!p) return setSerialError('Choose a product.');
                        const list = serialText.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
                        if (!list.length) return setSerialError('Enter at least one serial number.');
                        const n = addSerials(p.id, p.name, serialAddOutlet, list);
                        setSerialNotice(n ? `${n} serial number${n === 1 ? '' : 's'} added to ${p.name}.` : 'Those serial numbers are already on file for this product.');
                        setSerialText('');
                        setSerialModal(false);
                      }}
                    >
                      {serialError && <div className="pe-error" role="alert">{serialError}</div>}
                      <label className="reg-open-field">
                        <span>Product</span>
                        <select value={serialProduct} onChange={(e) => { setSerialProduct(e.target.value); setSerialError(''); }}>
                          <option value="">Select a product</option>
                          {products.filter((x) => x.enabled).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.sku}</option>)}
                        </select>
                      </label>
                      <label className="reg-open-field">
                        <span>Outlet</span>
                        <select value={serialAddOutlet} onChange={(e) => setSerialAddOutlet(e.target.value)}>
                          {setupOutlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                        </select>
                      </label>
                      <label className="reg-open-field">
                        <span>Serial numbers <span className="pe-hint">One per line, or separated by commas</span></span>
                        <textarea rows={5} value={serialText} onChange={(e) => { setSerialText(e.target.value); setSerialError(''); }} placeholder={'SN-0001\nSN-0002'} />
                      </label>
                      <button className="pm-complete" type="submit">Add serial numbers</button>
                    </form>
                  </div>
                </div>
              )}
              {serialNotice && <div className="sh-notice" role="status">{serialNotice} <span className="rlink" onClick={() => setSerialNotice('')}>Dismiss</span></div>}
            </>
          )}

          {active === 'fulfillments' && (
            <>
              <h1 className="page-title">Fulfillments</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${fulTab === 'all' ? 'active' : ''}`} onClick={() => setFulTab('all')}>
                  All
                </button>
                <button className={`sh-tab ${fulTab === 'pack' ? 'active' : ''}`} onClick={() => setFulTab('pack')}>
                  Pack orders ({fulfillments.filter((f) => f.kind === 'pack' && f.status === 'Open').length + saleFulfillments.filter(({ f }) => f.kind === 'pack' && f.status === 'Unfulfilled').length})
                </button>
                <button className={`sh-tab ${fulTab === 'pickup' ? 'active' : ''}`} onClick={() => setFulTab('pickup')}>
                  Customer pickup ({fulfillments.filter((f) => f.kind === 'pickup' && f.status === 'Open').length + saleFulfillments.filter(({ f }) => f.kind === 'pickup' && f.status === 'Unfulfilled').length})
                </button>
                <button className={`sh-tab ${fulTab === 'delivery' ? 'active' : ''}`} onClick={() => setFulTab('delivery')}>
                  Delivery ({fulfillments.filter((f) => f.kind === 'delivery' && f.status === 'Open').length + saleFulfillments.filter(({ f }) => f.kind === 'delivery' && f.status === 'Unfulfilled').length})
                </button>
              </div>
              <div className="subbar-row">
                <span>
                  View and manage fulfillments all in one place. <span className="rlink">Need help? ↗</span>
                </span>
              </div>
              <div className="filter-row">
                <div className="f-field">
                  <label>Outlet</label>
                  <select className="set-select" value={fulOutlet} onChange={(e) => setFulOutlet(e.target.value)} style={selStyle}>
                    <option value="all">All outlets</option>
                    <option value="Main Outlet">Main Outlet</option>
                  </select>
                </div>
                <div className="f-field">
                  <label>Status</label>
                  <select className="set-select" value={fulStatus} onChange={(e) => setFulStatus(e.target.value as 'all' | FulfillmentStatus)} style={selStyle}>
                    <option value="all">All</option>
                    <option value="Open">Open</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="f-field">
                  <label>Type</label>
                  <select className="set-select" value={fulType} onChange={(e) => setFulType(e.target.value as 'all' | FulfillmentKind)} style={selStyle}>
                    <option value="all">All</option>
                    <option value="pack">Pack orders</option>
                    <option value="pickup">Customer pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
              </div>
              <div className="ful-thead">
                <span>Sale receipt</span>
                <span>Outlet</span>
                <span>Status</span>
                <span>Type</span>
                <span>Customer</span>
              </div>
              {visibleFulfillments.length || visibleSaleFulfillments.length ? (
                <div className="atable">
                  {visibleSaleFulfillments.map(({ sale: x, f }) => (
                    <div key={x.orderNumber} className="ful-row">
                      <span>
                        <span className="rlink strong" onClick={() => navigate('/sell/sales-history')}>{x.orderNumber}</span>
                        <br />
                        <span className="cnt-meta">{x.lines.reduce((n, l) => n + l.quantity, 0)} item{x.lines.reduce((n, l) => n + l.quantity, 0) === 1 ? '' : 's'} · {new Date(x.at).toLocaleString()} · paid{f.note ? ` · ${f.note}` : ''}</span>
                      </span>
                      <span>{outletName}</span>
                      <span><span className={`tx-badge ${f.status === 'Unfulfilled' ? 'open' : f.status === 'Fulfilled' ? 'received' : 'cancelled'}`}>{f.status}</span></span>
                      <span>{FULFILLMENT_LABEL[f.kind]}</span>
                      <span className="ful-cust">
                        <span>{x.customer || '—'}</span>
                        {f.status === 'Unfulfilled' && (
                          <span className="ful-actions">
                            <button className="btn-s" onClick={() => setFulfillmentStatus(x.orderNumber, 'Fulfilled')}>Fulfill</button>
                            <span className="rlink" onClick={() => setFulfillmentStatus(x.orderNumber, 'Cancelled')}>Cancel</span>
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {visibleFulfillments.map((f) => (
                    <div key={f.id} className="ful-row">
                      <span>
                        <span className="rlink strong">{f.number}</span>
                        <br />
                        <span className="cnt-meta">{f.lines.reduce((n, l) => n + l.quantity, 0)} item{f.lines.reduce((n, l) => n + l.quantity, 0) === 1 ? '' : 's'} · {new Date(f.createdAt).toLocaleString()}{f.note ? ` · ${f.note}` : ''}</span>
                      </span>
                      <span>{outletName}</span>
                      <span><span className={`tx-badge ${f.status === 'Open' ? 'open' : f.status === 'Completed' ? 'received' : 'cancelled'}`}>{f.status}</span></span>
                      <span>{FULFILLMENT_LABEL[f.kind]}</span>
                      <span className="ful-cust">
                        <span>{f.customerName || '—'}</span>
                        {f.status === 'Open' && (
                          <span className="ful-actions">
                            <button className="btn-s" onClick={() => retrieveFulfillment(f.id)}>Retrieve to register</button>
                            <span className="rlink" onClick={() => updateFulfillment(f.id, { status: 'Cancelled', completedAt: Date.now() })}>Cancel</span>
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="astate ful-astate">
                  <BagPhone />
                  <div>No fulfillments found. Try a different search or update your filters.</div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
