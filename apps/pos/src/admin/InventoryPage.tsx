import { useState } from 'react';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useCatalogMeta } from '../store/catalogMetaStore';
import {
  useInventory,
  type StockTx,
  type StockTxKind,
  type StockTxLine,
  type StockTxStatus,
} from '../store/inventoryStore';
import { useProducts } from '../store/productStore';
import '../styles/catalog.css';
import { BagPhone, CatBox, ScannerGraphic } from './illustrations';

const NAV: ContextItem[] = [
  { key: 'stock', label: 'Stock control' },
  { key: 'counts', label: 'Inventory counts' },
  { key: 'fulfillments', label: 'Fulfillments' },
];

const TX_STATUSES: StockTxStatus[] = ['Draft', 'Open', 'Sent', 'Dispatched', 'Received', 'Cancelled'];

const statusBadge = (status: StockTxStatus) => ({
  background:
    status === 'Received'
      ? 'rgba(63, 174, 107, 0.12)'
      : status === 'Sent' || status === 'Dispatched' || status === 'Open'
      ? 'rgba(75, 61, 245, 0.12)'
      : 'rgba(90, 90, 96, 0.12)',
  color:
    status === 'Received'
      ? '#3fae6b'
      : status === 'Sent' || status === 'Dispatched' || status === 'Open'
      ? '#4b3df5'
      : '#5a5a60',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
});

const txQty = (t: StockTx) => t.lines.reduce((s, l) => s + l.quantity, 0);

export function InventoryPage() {
  const [active, setActive] = useState('stock');

  // Persisted inventory data
  const transactions = useInventory((s) => s.transactions);
  const addTx = useInventory((s) => s.addTransaction);
  const updTx = useInventory((s) => s.updateTransaction);
  const delTx = useInventory((s) => s.deleteTransaction);
  const receiveTx = useInventory((s) => s.receiveTransaction);
  const counts = useInventory((s) => s.counts);
  const addCountStore = useInventory((s) => s.addCount);
  const updateCount = useInventory((s) => s.updateCount);

  const products = useProducts((s) => s.products);
  const suppliers = useCatalogMeta((s) => s.suppliers);

  // Stock control
  const [stockTab, setStockTab] = useState<'orders' | 'transfers' | 'returns'>('orders');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StockTxStatus>('all');
  const [outletFilter, setOutletFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created-desc' | 'created-asc' | 'due-asc' | 'due-desc'>('created-desc');
  const [showAllFilters, setShowAllFilters] = useState(true);

  // Edit stock transaction state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txKind, setTxKind] = useState<StockTxKind>('order');
  const [txNumber, setTxNumber] = useState('');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');
  const [txStatus, setTxStatus] = useState<StockTxStatus>('Draft');
  const [txLines, setTxLines] = useState<StockTxLine[]>([]);

  const startEditTx = (tx: StockTx) => {
    setEditingTxId(tx.id);
    setTxKind(tx.kind);
    setTxNumber(tx.number);
    setTxFrom(tx.from);
    setTxTo(tx.to);
    setTxStatus(tx.status);
    setTxLines(tx.lines.map((l) => ({ ...l })));
  };

  const saveTxEdit = () => {
    if (!editingTxId) return;
    const orig = transactions.find((t) => t.id === editingTxId);
    if (txStatus === 'Received' && orig && orig.status !== 'Received') {
      // Save fields first, then let the store apply the received quantities to product stock.
      updTx(editingTxId, { number: txNumber, from: txFrom, to: txTo, lines: txLines });
      receiveTx(editingTxId);
    } else {
      updTx(editingTxId, { number: txNumber, from: txFrom, to: txTo, status: txStatus, lines: txLines });
    }
    setEditingTxId(null);
  };

  const deleteTx = () => {
    if (!editingTxId) return;
    delTx(editingTxId);
    setEditingTxId(null);
  };

  // Default lines: the first few products from the catalog with sensible quantities.
  const defaultLines = (): StockTxLine[] =>
    products.slice(0, 3).map((p, i) => ({ productId: p.id, name: p.name, quantity: i === 0 ? 10 : 5 }));

  const handleOrderStock = () => {
    const tx = addTx({
      kind: 'order',
      from: suppliers[0]?.name ?? 'Supplier',
      to: 'Main Outlet',
      status: 'Open',
      dueAt: Date.now() + 7 * 86400000,
      lines: defaultLines(),
    });
    setStockTab('orders');
    startEditTx(tx);
  };

  const handleReceiveStock = () => {
    const tx = addTx({
      kind: 'transfer',
      from: 'Warehouse A',
      to: 'Main Outlet',
      status: 'Sent',
      dueAt: Date.now() + 2 * 86400000,
      lines: defaultLines(),
    });
    setStockTab('transfers');
    startEditTx(tx);
  };

  const handleCreateReturn = () => {
    const tx = addTx({
      kind: 'return',
      from: 'Main Outlet',
      to: suppliers[0]?.name ?? 'Supplier',
      status: 'Open',
      dueAt: null,
      lines: defaultLines(),
    });
    setStockTab('returns');
    startEditTx(tx);
  };

  const kind: StockTxKind = stockTab === 'orders' ? 'order' : stockTab === 'transfers' ? 'transfer' : 'return';
  const outlets = Array.from(new Set(transactions.map((t) => t.to)));

  const currentList = transactions
    .filter(
      (t) =>
        t.kind === kind &&
        (q.trim() === '' ||
          t.number.toLowerCase().includes(q.toLowerCase()) ||
          t.from.toLowerCase().includes(q.toLowerCase()) ||
          t.to.toLowerCase().includes(q.toLowerCase()) ||
          t.lines.some((l) => l.name.toLowerCase().includes(q.toLowerCase()))) &&
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

  const clearFilters = () => {
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

  // Inventory counts
  const [countTab, setCountTab] = useState<'due' | 'completed' | 'canceled'>('due');
  const [scannerOpen, setScannerOpen] = useState(true);
  const dueCounts = counts.filter((c) => c.status === 'In progress');
  const completedCounts = counts.filter((c) => c.status === 'Completed');
  const canceledCounts = counts.filter((c) => c.status === 'Cancelled');
  const visibleCounts = countTab === 'due' ? dueCounts : countTab === 'completed' ? completedCounts : canceledCounts;
  const addCount = () =>
    addCountStore({ name: `Main Outlet — Count ${counts.length + 1}`, outlet: 'Main Outlet', status: 'In progress' });

  // Fulfillments
  const [fulTab, setFulTab] = useState<'all' | 'pack' | 'pickup' | 'delivery'>('all');
  const [fulOutlet, setFulOutlet] = useState('all');
  const [fulStatus, setFulStatus] = useState('all');
  const [fulType, setFulType] = useState('all');

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'stock' && (
            <>
              <h1 className="page-title">Stock control</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${stockTab === 'orders' ? 'active' : ''}`} onClick={() => setStockTab('orders')}>
                  Orders
                </button>
                <button className={`sh-tab ${stockTab === 'transfers' ? 'active' : ''}`} onClick={() => setStockTab('transfers')}>
                  Transfers
                </button>
                <button className={`sh-tab ${stockTab === 'returns' ? 'active' : ''}`} onClick={() => setStockTab('returns')}>
                  Returns
                </button>
              </div>
              <div className="subbar-row">
                <span>
                  Create, manage and update purchase orders or receive stock. <span className="rlink">Need help?</span>
                </span>
                <div className="page-actions">
                  {stockTab === 'returns' && (
                    <button className="btn-s" onClick={handleCreateReturn}>
                      Create return
                    </button>
                  )}
                  <button className="btn-s" onClick={handleReceiveStock}>
                    Receive stock
                  </button>
                  <button className="btn-p" onClick={handleOrderStock}>
                    Order stock
                  </button>
                </div>
              </div>

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
                    <label>Search orders</label>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
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
                <div className="sc-factions">
                  <span className="rlink" onClick={clearFilters}>
                    Clear filters
                  </span>
                  <span className="rlink" onClick={() => setShowAllFilters((v) => !v)}>
                    {showAllFilters ? 'Less filters' : 'More filters'}
                  </span>
                </div>
              </div>

              {currentList.length > 0 ? (
                <>
                  <div className="inv-count">
                    Displaying {currentList.length} {stockTab === 'orders' ? 'order' : stockTab === 'transfers' ? 'transfer' : 'return'}
                    {currentList.length === 1 ? '' : 's'} · {currentList.reduce((s, o) => s + txQty(o), 0)} total qty
                  </div>
                  <div className="atable">
                    <div className="inv-thead">
                      <span className="s">{stockTab === 'orders' ? 'Order' : stockTab === 'transfers' ? 'Transfer' : 'Return'} number</span>
                      <span className="s">From</span>
                      <span className="s">To</span>
                      <span className="s">Status</span>
                      <span className="s">Created</span>
                      <span className="s r">Total qty.</span>
                      <span />
                    </div>
                    {currentList.map((o) => (
                      <div key={o.id} className="inv-row">
                        <span className="rlink" onClick={() => startEditTx(o)} style={{ cursor: 'pointer', fontWeight: 600 }}>
                          {o.number}
                        </span>
                        <span>{o.from}</span>
                        <span>{o.to}</span>
                        <span>
                          <span style={statusBadge(o.status)}>{o.status}</span>
                        </span>
                        <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                        <span className="r">{txQty(o)}</span>
                        <span className="r">
                          {(o.status === 'Open' || o.status === 'Sent') && (
                            <span className="rlink" onClick={() => receiveTx(o.id)}>
                              Receive
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="inv-count">Displaying 0 {stockTab} · 0 total qty</div>
                  <div className="inv-thead standalone">
                    <span className="s">Order number</span>
                    <span className="s">From</span>
                    <span className="s">To</span>
                    <span className="s">Status</span>
                    <span className="s">Created</span>
                    <span className="s r">Total qty.</span>
                    <span />
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
                  Due ({dueCounts.length})
                </button>
                <button className={`sh-tab ${countTab === 'completed' ? 'active' : ''}`} onClick={() => setCountTab('completed')}>
                  Completed ({completedCounts.length})
                </button>
                <button className={`sh-tab ${countTab === 'canceled' ? 'active' : ''}`} onClick={() => setCountTab('canceled')}>
                  Canceled ({canceledCounts.length})
                </button>
              </div>
              <div className="subbar-row">
                <span>
                  Create, schedule and complete counts to keep track of your inventory. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={addCount}>
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
                <>
                  <div className="cnt2-head act">
                    <span className="s">Name</span>
                    <span className="s">Outlet</span>
                    <span className="s r">Status</span>
                    <span />
                  </div>
                  {visibleCounts.map((c) => (
                    <div key={c.id} className="cnt2-row act">
                      <span className="cnt-name">
                        <span className="rlink">{c.name}</span>
                        <span className="cnt-meta">
                          {c.status === 'In progress' && <span className="chip-inprog">In progress</span>}{' '}
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <span>{c.outlet}</span>
                      <span className="r">{c.status}</span>
                      <span className="cnt-actions">
                        {c.status === 'In progress' && (
                          <>
                            <span className="rlink" onClick={() => updateCount(c.id, { status: 'Completed' })}>
                              Complete
                            </span>
                            <span className="rlink" onClick={() => updateCount(c.id, { status: 'Cancelled' })}>
                              Cancel
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="astate">
                  <CatBox />
                  <div>No {countTab} counts.</div>
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
                  Pack orders
                </button>
                <button className={`sh-tab ${fulTab === 'pickup' ? 'active' : ''}`} onClick={() => setFulTab('pickup')}>
                  Customer pickup
                </button>
                <button className={`sh-tab ${fulTab === 'delivery' ? 'active' : ''}`} onClick={() => setFulTab('delivery')}>
                  Delivery
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
                  <select className="set-select" value={fulStatus} onChange={(e) => setFulStatus(e.target.value)} style={selStyle}>
                    <option value="all">All</option>
                    <option value="Open">Open</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="f-field">
                  <label>Type</label>
                  <select className="set-select" value={fulType} onChange={(e) => setFulType(e.target.value)} style={selStyle}>
                    <option value="all">All</option>
                    <option value="Pack orders">Pack orders</option>
                    <option value="Customer pickup">Customer pickup</option>
                    <option value="Delivery">Delivery</option>
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
              <div className="astate ful-astate">
                <BagPhone />
                <div>No fulfillments found. Try a different search or update your filters.</div>
              </div>
            </>
          )}
        </div>
      </main>

      {editingTxId !== null && (
        <div className="pm-overlay" onClick={() => setEditingTxId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pm-head">
              <h2>
                Edit {txKind === 'order' ? 'Purchase Order' : txKind === 'transfer' ? 'Stock Transfer' : 'Return'}
              </h2>
              <button className="pm-close" onClick={() => setEditingTxId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Reference number
                  </label>
                  <input
                    className="set-input"
                    value={txNumber}
                    onChange={(e) => setTxNumber(e.target.value)}
                    placeholder="e.g. PO-1001"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Status
                  </label>
                  <select
                    className="set-select"
                    value={txStatus}
                    onChange={(e) => setTxStatus(e.target.value as StockTxStatus)}
                    style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                  >
                    {TX_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Source / From
                  </label>
                  <input
                    className="set-input"
                    value={txFrom}
                    onChange={(e) => setTxFrom(e.target.value)}
                    placeholder="Source outlet or supplier"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Destination / To
                  </label>
                  <input
                    className="set-input"
                    value={txTo}
                    onChange={(e) => setTxTo(e.target.value)}
                    placeholder="Destination outlet"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="set-field">
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Products ({txLines.reduce((s, l) => s + l.quantity, 0)} total qty)
                </label>
                {txLines.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {txLines.map((l, i) => (
                      <div key={l.productId} className="txline-row">
                        <span className="txline-name">{l.name}</span>
                        <input
                          className="set-input"
                          type="number"
                          min={0}
                          value={l.quantity}
                          onChange={(e) =>
                            setTxLines((lines) =>
                              lines.map((x, xi) => (xi === i ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x)),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    No products in your catalog yet — add products first to build stock transactions with lines.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={deleteTx}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    padding: '8px 0',
                    outline: 'none',
                  }}
                >
                  Delete Transaction
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingTxId(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-p" onClick={saveTxEdit} disabled={!txNumber.trim()} type="button">
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
