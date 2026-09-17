import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useCart } from '../store/cartStore';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { FULFILLMENT_LABEL, useFulfillments, type FulfillmentKind, type FulfillmentStatus } from '../store/fulfillmentStore';
import { countBucket, txQty, txTotal, useInventory, type StockTx, type StockTxKind, type StockTxStatus } from '../store/inventoryStore';
import '../styles/catalog.css';
import { BagPhone, CatBox, InventoryGraphic, ScannerGraphic } from './illustrations';

const NAV: ContextItem[] = [
  { key: 'stock', label: 'Stock control' },
  { key: 'counts', label: 'Inventory counts' },
  { key: 'fulfillments', label: 'Fulfillments' },
];

const TX_STATUSES: StockTxStatus[] = ['Open', 'Sent', 'Dispatched', 'Received', 'Cancelled'];
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
  const [statusFilter, setStatusFilter] = useState<'all' | StockTxStatus>('all');
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
        (statusFilter === 'all' || t.status === statusFilter) &&
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
  const [fulTab, setFulTab] = useState<'all' | FulfillmentKind>('all');
  const [fulOutlet, setFulOutlet] = useState('all');
  const [fulStatus, setFulStatus] = useState<'all' | FulfillmentStatus>('all');
  const [fulType, setFulType] = useState<'all' | FulfillmentKind>('all');
  const visibleFulfillments = fulfillments.filter(
    (f) => (fulTab === 'all' || f.kind === fulTab) && (fulStatus === 'all' || f.status === fulStatus) && (fulType === 'all' || f.kind === fulType),
  );
  const outletName = outlets[0] ?? 'Main Outlet';
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
                        Receive stock from your suppliers to set the inventory levels of the products you sell. Every order you
                        receive updates stock on hand, so your counts and reports stay accurate.
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
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | StockTxStatus)}
                      style={selStyle}
                    >
                      <option value="all">All {stockTab}</option>
                      {TX_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
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
                  Pack orders ({fulfillments.filter((f) => f.kind === 'pack' && f.status === 'Open').length})
                </button>
                <button className={`sh-tab ${fulTab === 'pickup' ? 'active' : ''}`} onClick={() => setFulTab('pickup')}>
                  Customer pickup ({fulfillments.filter((f) => f.kind === 'pickup' && f.status === 'Open').length})
                </button>
                <button className={`sh-tab ${fulTab === 'delivery' ? 'active' : ''}`} onClick={() => setFulTab('delivery')}>
                  Delivery ({fulfillments.filter((f) => f.kind === 'delivery' && f.status === 'Open').length})
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
              {visibleFulfillments.length ? (
                <div className="atable">
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
