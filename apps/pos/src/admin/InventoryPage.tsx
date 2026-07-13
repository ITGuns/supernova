import { useState } from 'react';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { BagPhone, CatBox, ScannerGraphic } from './illustrations';

const NAV: ContextItem[] = [
  { key: 'stock', label: 'Stock control' },
  { key: 'counts', label: 'Inventory counts' },
  { key: 'fulfillments', label: 'Fulfillments' },
];

interface StockTransaction {
  id: string;
  type: 'order' | 'transfer' | 'return';
  number: string;
  from: string;
  to: string;
  status: string; // 'Draft' | 'Sent' | 'Received' | 'Canceled'
  created: string;
  qty: number;
  cost: string;
}

interface Count {
  name: string;
  when: string;
  outlet: string;
  status: string;
}

export function InventoryPage() {
  const [active, setActive] = useState('stock');

  // Stock control
  const [stockTab, setStockTab] = useState<'orders' | 'transfers' | 'returns'>('orders');
  const [q, setQ] = useState('');

  const [orders, setOrders] = useState<StockTransaction[]>([]);
  const [transfers, setTransfers] = useState<StockTransaction[]>([]);
  const [returns, setReturns] = useState<StockTransaction[]>([]);

  // Edit stock transaction state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'order' | 'transfer' | 'return'>('order');
  const [txNumber, setTxNumber] = useState('');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');
  const [txStatus, setTxStatus] = useState('Draft');
  const [txQty, setTxQty] = useState(0);
  const [txCost, setTxCost] = useState('$0.00');

  const startEditTx = (tx: StockTransaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxNumber(tx.number);
    setTxFrom(tx.from);
    setTxTo(tx.to);
    setTxStatus(tx.status);
    setTxQty(tx.qty);
    setTxCost(tx.cost);
  };

  const saveTxEdit = () => {
    if (!editingTxId) return;
    const updater = (prev: StockTransaction[]) =>
      prev.map((t) => {
        if (t.id === editingTxId) {
          return {
            ...t,
            number: txNumber,
            from: txFrom,
            to: txTo,
            status: txStatus,
            qty: Number(txQty),
            cost: txCost,
          };
        }
        return t;
      });
    if (txType === 'order') setOrders(updater);
    else if (txType === 'transfer') setTransfers(updater);
    else if (txType === 'return') setReturns(updater);
    setEditingTxId(null);
  };

  const deleteTx = () => {
    if (!editingTxId) return;
    const filterer = (prev: StockTransaction[]) => prev.filter((t) => t.id !== editingTxId);
    if (txType === 'order') setOrders(filterer);
    else if (txType === 'transfer') setTransfers(filterer);
    else if (txType === 'return') setReturns(filterer);
    setEditingTxId(null);
  };

  const handleOrderStock = () => {
    const newTx: StockTransaction = {
      id: `o-${Date.now()}`,
      type: 'order',
      number: `PO-10${orders.length + 1}`,
      from: 'Roast Co.',
      to: 'Main Outlet',
      status: 'Draft',
      created: 'just now',
      qty: 0,
      cost: '$0.00',
    };
    setOrders((o) => [...o, newTx]);
    startEditTx(newTx);
  };

  const handleReceiveStock = () => {
    const newTx: StockTransaction = {
      id: `t-${Date.now()}`,
      type: 'transfer',
      number: `ST-20${transfers.length + 1}`,
      from: 'Warehouse A',
      to: 'Main Outlet',
      status: 'Received',
      created: 'just now',
      qty: 50,
      cost: '$0.00',
    };
    setTransfers((t) => [...t, newTx]);
    startEditTx(newTx);
  };

  // Filter lists based on type and search query
  const currentList = (stockTab === 'orders' ? orders : stockTab === 'transfers' ? transfers : returns).filter(
    (t) =>
      q.trim() === '' ||
      t.number.toLowerCase().includes(q.toLowerCase()) ||
      t.from.toLowerCase().includes(q.toLowerCase()) ||
      t.to.toLowerCase().includes(q.toLowerCase())
  );

  // Inventory counts
  const [countTab, setCountTab] = useState<'due' | 'upcoming' | 'completed' | 'canceled'>('due');
  const [scannerOpen, setScannerOpen] = useState(true);
  const [counts, setCounts] = useState<Count[]>([]);
  const addCount = () =>
    setCounts((c) => [
      { name: `Main Outlet — Count ${c.length + 1}`, when: 'just now', outlet: 'Main Outlet', status: 'Partial' },
      ...c,
    ]);

  // Fulfillments
  const [fulTab, setFulTab] = useState<'all' | 'pack' | 'pickup' | 'delivery'>('all');

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
                    <div className="f-select sel">All {stockTab}</div>
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
                    <div className="f-select sel">All outlets</div>
                  </div>
                </div>
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Supplier</label>
                    <div className="f-select sel">Select a supplier</div>
                  </div>
                  <div className="f-field">
                    <label>Created</label>
                    <div className="f-select sel">📅 Choose date range…</div>
                  </div>
                  <div className="f-field">
                    <label>Due</label>
                    <div className="f-select sel">📅 Jul 10, 2026 to Jul 10, 2026</div>
                  </div>
                </div>
                <div className="sc-factions">
                  <span className="rlink" onClick={() => setQ('')}>
                    Clear filters
                  </span>
                  <span className="rlink">Less filters</span>
                  <button className="btn-p">Search</button>
                </div>
              </div>

              {currentList.length > 0 ? (
                <>
                  <div className="inv-count">
                    Displaying {currentList.reduce((s, o) => s + o.qty, 0)} total qty and{' '}
                    {stockTab === 'orders' ? `$${(currentList.reduce((s, o) => s + parseFloat(o.cost.replace('$', '') || '0'), 0)).toFixed(2)}` : '$0.00'}{' '}
                    total cost
                  </div>
                  <div className="atable">
                    <div className="inv-thead">
                      <span className="s">{stockTab === 'orders' ? 'Order' : stockTab === 'transfers' ? 'Transfer' : 'Return'} number</span>
                      <span className="s">From</span>
                      <span className="s">To</span>
                      <span className="s">Status</span>
                      <span className="s">Created</span>
                      <span className="s r">Total qty.</span>
                      <span className="s r">Total cost</span>
                    </div>
                    {currentList.map((o) => (
                      <div key={o.id} className="inv-row">
                        <span className="rlink" onClick={() => startEditTx(o)} style={{ cursor: 'pointer', fontWeight: 600 }}>
                          {o.number}
                        </span>
                        <span>{o.from}</span>
                        <span>{o.to}</span>
                        <span>
                          <span
                            style={{
                              background:
                                o.status === 'Received'
                                  ? 'rgba(63, 174, 107, 0.12)'
                                  : o.status === 'Sent'
                                  ? 'rgba(75, 61, 245, 0.12)'
                                  : 'rgba(90, 90, 96, 0.12)',
                              color:
                                o.status === 'Received'
                                  ? '#3fae6b'
                                  : o.status === 'Sent'
                                  ? '#4b3df5'
                                  : '#5a5a60',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {o.status}
                          </span>
                        </span>
                        <span>{o.created}</span>
                        <span className="r">{o.qty}</span>
                        <span className="r">{o.cost}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="inv-count">Displaying 0 total qty and $0.00 total cost</div>
                  <div className="inv-thead standalone">
                    <span className="s">Order number</span>
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
                  Due ({counts.length})
                </button>
                <button className={`sh-tab ${countTab === 'upcoming' ? 'active' : ''}`} onClick={() => setCountTab('upcoming')}>
                  Upcoming (0)
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

              {countTab === 'due' ? (
                <>
                  <div className="cnt2-head">
                    <span className="s">Name</span>
                    <span className="s">Outlet</span>
                    <span className="s r">Count</span>
                  </div>
                  {counts.map((c) => (
                    <div key={c.name} className="cnt2-row">
                      <span className="cnt-name">
                        <span className="rlink">{c.name}</span>
                        <span className="cnt-meta">
                          <span className="chip-inprog">In progress</span> {c.when}
                        </span>
                      </span>
                      <span>{c.outlet}</span>
                      <span className="r">{c.status}</span>
                    </div>
                  ))}
                  <div className="cnt-foot">
                    If you’re experiencing problems with your inventory count data, <span className="rlink">resync</span> your inventory counts.
                  </div>
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
                  <div className="f-select sel">Main Outlet</div>
                </div>
                <div className="f-field">
                  <label>Status</label>
                  <div className="f-select sel">All</div>
                </div>
                <div className="f-field">
                  <label>Type</label>
                  <div className="f-select sel">All</div>
                </div>
                <button className="btn-p f-search">Search</button>
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
                Edit {txType === 'order' ? 'Purchase Order' : txType === 'transfer' ? 'Stock Transfer' : 'Return'}
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
                    placeholder="e.g. PO-101"
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
                    onChange={(e) => setTxStatus(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Received">Received</option>
                    <option value="Canceled">Canceled</option>
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

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Total Qty
                  </label>
                  <input
                    className="set-input"
                    type="number"
                    value={txQty}
                    onChange={(e) => setTxQty(Number(e.target.value))}
                    placeholder="0"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Total Cost
                  </label>
                  <input
                    className="set-input"
                    value={txCost}
                    onChange={(e) => setTxCost(e.target.value)}
                    placeholder="$0.00"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
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
