import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseCsv } from '../lib/csv';
import { fmt } from '../lib/format';
import { useCatalogMeta } from '../store/catalogMetaStore';
import {
  EMPTY_TX_DETAILS,
  txDiscount,
  txSubtotal,
  txTotal,
  useInventory,
  type ApplyMode,
  type StockTx,
  type StockTxDetails,
  type StockTxKind,
  type StockTxLine,
} from '../store/inventoryStore';
import { availableOf, useProducts, type Product } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { Switch } from './controls';
import { Field, Section } from './FormLayout';
import { IntInput, MoneyInput, NumInput } from './NumInput';
import '../styles/product-editor.css';

// Full-page stock transaction form, in the Lightspeed layout:
//   /inventory/receive         receive stock from a supplier (creates a received order)
//   /inventory/orders/new      order stock from a supplier (purchase order)
//   /inventory/transfers/new   transfer stock between outlets
//   /inventory/returns/new     return stock to a supplier
//   /inventory/stock/:id       view / edit / receive an existing transaction

const money = (minor: number) => (minor / 100).toFixed(2);
const toMinor = (s: string) => Math.max(0, Math.round((parseFloat(s) || 0) * 100));
const todayIso = () => new Date().toISOString().slice(0, 10);

const KIND_WORD: Record<StockTxKind, string> = { order: 'order', transfer: 'transfer', return: 'return' };

const APPLY_OPTIONS: { value: ApplyMode; label: string }[] = [
  { value: 'none', label: "Don't apply to items" },
  { value: 'quantity', label: 'Apply to items by quantity' },
  { value: 'cost', label: 'Apply to items by cost' },
];

interface Draft {
  number: string;
  from: string;
  to: string;
  lines: StockTxLine[];
  details: StockTxDetails;
}

const skuMatches = (p: Product, q: string) =>
  p.sku.toLowerCase() === q || (p.skuCodes ?? []).some((c) => c.code.toLowerCase() === q);

export function StockTxEditor() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const transactions = useInventory((s) => s.transactions);
  const nextNumber = useInventory((s) => s.nextNumber);
  const addTx = useInventory((s) => s.addTransaction);
  const updTx = useInventory((s) => s.updateTransaction);
  const delTx = useInventory((s) => s.deleteTransaction);
  const receiveTx = useInventory((s) => s.receiveTransaction);
  const sendReturn = useInventory((s) => s.sendReturn);
  const products = useProducts((s) => s.products);
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const outlets = useSetup((s) => s.outlets);

  const existing = id ? transactions.find((t) => t.id === id) : undefined;
  const receiveMode = pathname.endsWith('/receive');
  const kind: StockTxKind = existing
    ? existing.kind
    : pathname.includes('/transfers/')
    ? 'transfer'
    : pathname.includes('/returns/')
    ? 'return'
    : 'order';
  const locked = existing?.status === 'Received' || existing?.status === 'Cancelled' || (kind === 'return' && existing?.status === 'Sent');

  const outletNames = outlets.map((o) => o.name);
  const defaultOutlet = outletNames[0] ?? 'Main Outlet';

  // Special orders → "Order stock" arrives with the product (and units) to order.
  const preset = (useLocation().state as { productId?: string; quantity?: number } | null) ?? null;
  const [draft, setDraft] = useState<Draft>(() => {
    const presetProduct = preset?.productId ? products.find((p) => p.id === preset.productId) : undefined;
    return {
      number: existing?.number ?? nextNumber(kind),
      from: existing?.from ?? (kind === 'order' ? presetProduct?.supplier ?? '' : defaultOutlet),
      to: existing?.to ?? (kind === 'return' ? '' : defaultOutlet),
      lines:
        existing?.lines.map((l) => ({ ...l })) ??
        (presetProduct ? [{ productId: presetProduct.id, name: presetProduct.name, sku: presetProduct.sku, quantity: Math.max(1, preset?.quantity ?? 1), costMinor: presetProduct.supplierPriceMinor ?? 0 }] : []),
      details: {
        ...EMPTY_TX_DETAILS,
        ...(existing?.details ?? {}),
        ...(existing ? {} : { deliveryDate: receiveMode ? todayIso() : '', orderingFor: defaultOutlet }),
      },
    };
  });
  const csvRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quickScan, setQuickScan] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'receive' | 'send-return' | null>(null);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };
  const setDetails = (patch: Partial<StockTxDetails>) => setDraft((d) => ({ ...d, details: { ...d.details, ...patch } }));
  const setLine = (i: number, patch: Partial<StockTxLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, li) => (li === i ? { ...l, ...patch } : l)) }));
  const removeLine = (i: number) => setDraft((d) => ({ ...d, lines: d.lines.filter((_, li) => li !== i) }));

  const addProduct = (p: Product) => {
    setDraft((d) => {
      const i = d.lines.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        // Scanning the same product again bumps its quantity.
        return { ...d, lines: d.lines.map((l, li) => (li === i ? { ...l, quantity: l.quantity + 1, received: l.received === undefined ? undefined : l.received + 1 } : l)) };
      }
      const line: StockTxLine = { productId: p.id, name: p.name, sku: p.sku, quantity: 1, costMinor: p.supplierPriceMinor ?? 0 };
      return { ...d, lines: [...d.lines, line] };
    });
    setSearch('');
    setError('');
  };

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.skuCodes ?? []).some((c) => c.code.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [products, search]);

  const onSearchKey = (key: string) => {
    if (key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) => skuMatches(p, q));
    if (exact) addProduct(exact);
    else if (quickScan || hits.length === 1) {
      if (hits[0]) addProduct(hits[0]);
    }
  };

  // Money math on the draft, via the same helpers the list uses.
  const asTx = (status: StockTx['status']): StockTx => ({
    id: existing?.id ?? 'draft',
    kind,
    number: draft.number,
    from: draft.from,
    to: draft.to,
    status,
    createdAt: existing?.createdAt ?? Date.now(),
    dueAt: draft.details.deliveryDate ? new Date(`${draft.details.deliveryDate}T00:00:00`).getTime() : null,
    lines: draft.lines,
    details: draft.details,
  });
  // On the receive page (and once received) totals follow the received quantities.
  const useReceived = receiveMode || existing?.status === 'Received';
  const preview = asTx(useReceived ? 'Received' : existing?.status ?? 'Open');
  const subtotal = txSubtotal(preview);
  const discount = txDiscount(preview);
  const total = txTotal(preview);
  const totalQty = draft.lines.reduce((s, l) => s + (useReceived ? l.received ?? l.quantity : l.quantity), 0);

  // Landed cost per unit: supply price plus this line's share of shipping and duty.
  const extras = draft.details.shippingMinor + draft.details.dutyMinor;
  const landedPerUnit = (l: StockTxLine): number => {
    const qty = useReceived ? l.received ?? l.quantity : l.quantity;
    const cost = l.costMinor ?? 0;
    if (qty <= 0) return cost;
    const share = (amount: number, mode: ApplyMode) => {
      if (mode === 'quantity' && totalQty > 0) return (amount * qty) / totalQty;
      if (mode === 'cost' && subtotal > 0) return (amount * cost * qty) / subtotal;
      return 0;
    };
    const extra = share(draft.details.shippingMinor, draft.details.shippingApply) + share(draft.details.dutyMinor, draft.details.dutyApply);
    return Math.round(cost + extra / qty);
  };
  const onHand = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    return p ? availableOf(p, products) : 0;
  };

  // Products from this supplier that have dropped to their reorder point / minimum.
  const recommendations = products.filter((p) => {
    if (!p.enabled || p.trackInventory === false || draft.lines.some((l) => l.productId === p.id)) return false;
    if (kind === 'order' && draft.from && p.supplier !== draft.from) return false;
    const stock = availableOf(p, products);
    return p.replenishMethod === 'reorder' ? p.reorderPoint != null && stock <= p.reorderPoint : p.minQty != null && stock <= p.minQty;
  });
  const addRecommendations = () => {
    if (!recommendations.length) return;
    setDraft((d) => ({
      ...d,
      lines: [
        ...d.lines,
        ...recommendations.map((p): StockTxLine => {
          const stock = availableOf(p, products);
          const qty = p.replenishMethod === 'reorder' ? p.reorderQty ?? 1 : Math.max(1, (p.maxQty ?? stock + 1) - stock);
          return { productId: p.id, name: p.name, sku: p.sku, quantity: Math.max(1, qty), costMinor: p.supplierPriceMinor ?? 0 };
        }),
      ],
    }));
    setNotice(`${recommendations.length} product${recommendations.length === 1 ? '' : 's'} added from recommendations.`);
  };

  // CSV with sku (or product name) + quantity (+ optional cost) columns.
  const importCsv = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(typeof reader.result === 'string' ? reader.result : '');
      const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
      const iSku = idx('sku', 'sku code', 'code', 'supplier code');
      const iName = idx('product', 'name', 'product name');
      const iQty = idx('quantity', 'qty', 'order quantity', 'ordered');
      const iCost = idx('cost', 'cost price', 'supply price', 'supplier price', 'price');
      let added = 0;
      let missed = 0;
      setDraft((d) => {
        const lines = [...d.lines];
        for (const r of rows.slice(1)) {
          const sku = iSku >= 0 ? (r[iSku] ?? '').trim().toLowerCase() : '';
          const name = iName >= 0 ? (r[iName] ?? '').trim().toLowerCase() : '';
          const p = products.find((x) => (sku && (x.sku.toLowerCase() === sku || (x.suppliers ?? []).some((c) => c.code.toLowerCase() === sku))) || (name && x.name.toLowerCase() === name));
          if (!p) {
            missed++;
            continue;
          }
          const qty = Math.max(1, Math.floor(parseFloat(iQty >= 0 ? r[iQty] ?? '1' : '1') || 1));
          const costText = iCost >= 0 ? (r[iCost] ?? '').replace(/[^0-9.]/g, '') : '';
          const cost = costText ? Math.round(parseFloat(costText) * 100) : p.supplierPriceMinor ?? 0;
          const at = lines.findIndex((l) => l.productId === p.id);
          if (at >= 0) lines[at] = { ...lines[at]!, quantity: qty, costMinor: cost };
          else lines.push({ productId: p.id, name: p.name, sku: p.sku, quantity: qty, costMinor: cost });
          added++;
        }
        return { ...d, lines };
      });
      setNotice(`${added} product${added === 1 ? '' : 's'} loaded from ${file.name}${missed ? ` · ${missed} row${missed === 1 ? '' : 's'} didn’t match a product` : ''}.`);
    };
    reader.readAsText(file);
  };

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Stock transaction not found</h1>
          <button className="btn-s" onClick={() => nav('/inventory')}>Back to stock control</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/inventory', { state: { tab: 'stock', stockTab: kind === 'order' ? 'orders' : kind === 'transfer' ? 'transfers' : 'returns' } });

  const validate = (needLines: boolean): boolean => {
    const number = draft.number.trim();
    if (!number) {
      setError('Enter an order number.');
      return false;
    }
    if (number.length > 20) {
      setError('The order number can be 20 characters at most.');
      return false;
    }
    if (transactions.some((t) => t.id !== existing?.id && t.number.trim().toLowerCase() === number.toLowerCase())) {
      setError(`Order number “${number}” is already used. Must be a unique number.`);
      return false;
    }
    if (kind === 'order' && !draft.from) {
      setError('Choose a supplier.');
      return false;
    }
    if (kind === 'return' && !draft.to) {
      setError('Choose the supplier the stock is returned to.');
      return false;
    }
    if (kind === 'transfer' && draft.from === draft.to) {
      setError('Choose two different outlets to transfer between.');
      return false;
    }
    if (needLines && !draft.lines.length) {
      setError('Add at least one product.');
      return false;
    }
    if (draft.lines.some((l) => l.quantity <= 0)) {
      setError('Every product needs a quantity of at least 1.');
      return false;
    }
    return true;
  };

  /** Persist the draft; returns the saved transaction. */
  const persist = (status: StockTx['status']): StockTx => {
    const number = draft.number.trim();
    const patch = {
      number,
      from: draft.from,
      to: draft.to,
      lines: draft.lines,
      details: draft.details,
      dueAt: preview.dueAt,
    };
    if (existing) {
      updTx(existing.id, { ...patch, status });
      return { ...existing, ...patch, status };
    }
    return addTx({ kind, status, ...patch });
  };

  const save = () => {
    if (!validate(false)) return;
    persist(existing?.status ?? 'Open');
    back();
  };

  const markSent = () => {
    if (!validate(true)) return;
    persist('Sent');
    back();
  };

  const receive = () => {
    if (!validate(true)) return;
    const saved = persist(existing?.status ?? 'Open');
    receiveTx(saved.id);
    back();
  };

  const doSendReturn = () => {
    if (!validate(true)) return;
    const saved = persist('Open');
    sendReturn(saved.id);
    back();
  };

  const remove = () => {
    if (existing) delTx(existing.id);
    back();
  };

  const title = existing ? existing.number : receiveMode ? 'Receive stock' : kind === 'order' ? 'Order stock' : kind === 'transfer' ? 'Transfer stock' : 'Return stock';
  const subtitle = existing
    ? existing.status === 'Received'
      ? `Received ${existing.details.receivedAt ? new Date(existing.details.receivedAt).toLocaleString() : ''}`.trim()
      : `${existing.status} ${KIND_WORD[kind]} — created ${new Date(existing.createdAt).toLocaleDateString()}`
    : receiveMode
    ? 'Count and receive products that have been delivered from your suppliers to ensure your inventory stays accurate.'
    : kind === 'order'
    ? 'Add products to this purchase order to keep track of inbound inventory.'
    : kind === 'transfer'
    ? 'Move stock from one outlet to another.'
    : 'Send stock back to a supplier.';

  const receivedQty = (l: StockTxLine) => l.received ?? l.quantity;
  const showReceived = receiveMode || (existing && kind !== 'return');

  const actions = (
    <span className="pe-actions">
      <button className="btn-s" onClick={back}>Cancel</button>
      {!locked && (
        <>
          <button className="btn-s" onClick={save}>Save</button>
          {kind === 'order' && !receiveMode && existing?.status !== 'Sent' && existing?.status !== 'Dispatched' && (
            <button className="btn-s" onClick={markSent}>Mark as sent</button>
          )}
          {kind !== 'return' && (
            <button className="btn-p" onClick={() => (existing ? setConfirmAction('receive') : receive())}>Receive</button>
          )}
          {kind === 'return' && (
            <button className="btn-p" onClick={() => (existing ? setConfirmAction('send-return') : doSendReturn())}>Send return</button>
          )}
        </>
      )}
    </span>
  );

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to stock control">‹</button>
          <h1 className="page-title">{title}</h1>
          {existing && <span className={`tx-badge ${existing.status.toLowerCase()}`}>{existing.status}</span>}
        </div>
        <div className="pe-subbar">
          <span>{subtitle}{!existing && <> <span className="rlink">Need help?</span></>}</span>
          {actions}
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}
        {notice && <div className="pe-notice" role="status">{notice} <span className="rlink" onClick={() => setNotice('')}>Dismiss</span></div>}
        {confirmAction && (
          <div className="pe-confirm" role="alertdialog">
            <span>
              {confirmAction === 'receive'
                ? `Receive ${draft.number} — add ${draft.lines.reduce((s, l) => s + receivedQty(l), 0)} units into ${draft.to || 'stock'}? This updates stock on hand.`
                : `Send ${draft.number} — remove ${totalQty} units from stock on hand?`}
            </span>
            <span className="pe-actions">
              <button className="btn-s" onClick={() => setConfirmAction(null)}>Not now</button>
              <button className="btn-p" onClick={confirmAction === 'receive' ? receive : doSendReturn}>
                {confirmAction === 'receive' ? 'Receive' : 'Send return'}
              </button>
            </span>
          </div>
        )}

        <Section
          title={kind === 'order' ? (receiveMode || existing?.status === 'Received' ? 'Delivery details' : 'Order details') : kind === 'transfer' ? 'Transfer details' : 'Return details'}
          hint={
            kind === 'order'
              ? 'Choose the supplier the stock is coming from and the outlet receiving it.'
              : kind === 'transfer'
              ? 'Choose the outlet the stock is leaving and the outlet receiving it.'
              : 'Choose the outlet the stock is leaving and the supplier receiving it.'
          }
        >
          <fieldset className="pe-fieldset" disabled={locked}>
            <div className="pe-grid2">
              {kind === 'order' ? (
                <Field label="Supplier">
                  <select className="pe-input" value={draft.from} onChange={(e) => set({ from: e.target.value })} autoFocus={!existing}>
                    <option value="">Select a supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Source outlet">
                  <select className="pe-input" value={draft.from} onChange={(e) => set({ from: e.target.value })}>
                    {outletNames.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              )}
              {kind === 'order' && (
                <Field label="Ordering for">
                  <select className="pe-input" value={draft.details.orderingFor ?? draft.to} onChange={(e) => setDetails({ orderingFor: e.target.value })}>
                    {outletNames.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              )}
              {kind === 'return' ? (
                <Field label="Supplier">
                  <select className="pe-input" value={draft.to} onChange={(e) => set({ to: e.target.value })}>
                    <option value="">Select a supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label={kind === 'order' ? 'Deliver to' : 'Destination outlet'}>
                  <select className="pe-input" value={draft.to} onChange={(e) => set({ to: e.target.value })}>
                    {outletNames.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Delivery date" hint={kind === 'order' && !receiveMode ? '(Optional)' : undefined}>
                <input className="pe-input" type="date" value={draft.details.deliveryDate} onChange={(e) => setDetails({ deliveryDate: e.target.value })} />
              </Field>
              <Field label={kind === 'order' ? 'Order number' : kind === 'transfer' ? 'Transfer number' : 'Return number'} hint="Must be a unique number · 20 characters max">
                <input className="pe-input" value={draft.number} maxLength={20} onChange={(e) => set({ number: e.target.value })} />
                <span className="pe-counter">{draft.number.length}/20 characters</span>
              </Field>
              {kind === 'order' && (
                <Field label="Supplier invoice number" hint="(Optional)">
                  <input className="pe-input" value={draft.details.supplierInvoice} onChange={(e) => setDetails({ supplierInvoice: e.target.value })} />
                </Field>
              )}
              {kind === 'order' && (
                <Field label="Supplier invoice date" hint="(Optional)">
                  <input className="pe-input" type="date" value={draft.details.invoiceDate} onChange={(e) => setDetails({ invoiceDate: e.target.value })} />
                </Field>
              )}
              <Field label="Note" hint="(Optional) · 200 characters max" wide>
                <textarea className="pe-input pe-textarea pe-note" maxLength={200} value={draft.details.note} onChange={(e) => setDetails({ note: e.target.value })} />
                <span className="pe-counter">{draft.details.note.length}/200 characters</span>
              </Field>
            </div>
            {kind === 'order' && !existing && (
              <div className="pe-preview-card">
                <span className="pe-caps">Preview</span>
                <b>{draft.number || 'Order number'}</b>
                <span>{draft.from || 'Supplier'} → {draft.to}{draft.details.deliveryDate ? ` · due ${new Date(`${draft.details.deliveryDate}T00:00:00`).toLocaleDateString()}` : ''}</span>
              </div>
            )}
          </fieldset>
        </Section>

        <Section title={kind === 'order' && !receiveMode ? 'Products and costs' : 'Products'} hint={locked ? 'The products on this transaction.' : 'Search or scan to add a product'}>
          {!locked && kind === 'order' && (
            <div className="pe-cards two pe-gap">
              <button type="button" className="pe-card" onClick={() => searchRef.current?.focus()}>
                <b>Choose products</b>
                <span>Search or scan products to add them to this {receiveMode ? 'delivery' : 'order'}.</span>
              </button>
              <button type="button" className="pe-card" onClick={() => csvRef.current?.click()}>
                <b>Import from CSV</b>
                <span>Upload a file with sku, quantity and cost columns.</span>
              </button>
              <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          )}
          {!locked && (
            <div className="pe-searchwrap">
              <input
                ref={searchRef}
                className="pe-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => onSearchKey(e.key)}
                placeholder="Search or scan to add a product"
              />
              {hits.length > 0 && (
                <div className="pe-catalog-hits pe-hits">
                  {hits.map((p) => (
                    <button key={p.id} type="button" className="pe-catalog-hit" onClick={() => addProduct(p)}>
                      <span>{p.name}</span>
                      <span className="pe-muted">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && !hits.length && <div className="pe-muted pe-nohit">No products match “{search.trim()}”.</div>}
            </div>
          )}
          <div className="pe-rowhead">
            <span className="pe-subhead">{kind === 'order' ? `Add products to this ${receiveMode ? 'delivery' : 'order'}` : `Products in this ${KIND_WORD[kind]}`}</span>
            {!locked && (
              <span className="pe-inline">
                {kind === 'order' && !receiveMode && (
                  <span className="rlink" onClick={addRecommendations} title={recommendations.length ? `${recommendations.length} product${recommendations.length === 1 ? '' : 's'} at or below their reorder point` : 'No products are at their reorder point'}>
                    Add products from recommendations{recommendations.length ? ` (${recommendations.length})` : ''}
                  </span>
                )}
                <label className="pe-switchrow">
                  <span>Quick scan mode</span>
                  <Switch on={quickScan} onClick={() => setQuickScan((v) => !v)} />
                </label>
              </span>
            )}
          </div>
          {draft.lines.length ? (
            <table className="pe-table pe-lines">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Current inventory</th>
                  <th className="r">{kind === 'order' ? (showReceived ? 'Ordered' : 'Quantity') : 'Quantity'}</th>
                  {showReceived && <th className="r">Received quantity</th>}
                  <th className="r">{kind === 'order' ? (showReceived ? 'Supplier price per unit (USD)' : 'Cost price (USD)') : 'Supply price'}</th>
                  {showReceived && <th className="r">Landed cost per unit (USD)</th>}
                  <th className="r">Total cost (USD)</th>
                  {!locked && <th />}
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={l.productId}>
                    <td>{l.name}<br /><span className="pe-muted">{l.sku ?? ''}</span></td>
                    <td className="r">{onHand(l.productId)}</td>
                    <td className="r">
                      <IntInput className="pe-input pe-qty" int={l.quantity} disabled={locked} onChange={(n) => setLine(i, { quantity: Math.max(0, n ?? 0) })} />
                    </td>
                    {showReceived && (
                      <td className="r">
                        <IntInput className="pe-input pe-qty" int={receivedQty(l)} disabled={locked} onChange={(n) => setLine(i, { received: Math.max(0, n ?? 0) })} />
                      </td>
                    )}
                    <td className="r">
                      <span className="pe-money"><span>$</span>
                        <MoneyInput className="pe-input pe-cost" minor={l.costMinor ?? 0} disabled={locked} onChange={(v) => setLine(i, { costMinor: v })} />
                      </span>
                    </td>
                    {showReceived && <td className="r">{fmt(landedPerUnit(l))}</td>}
                    <td className="r">{fmt((useReceived ? receivedQty(l) : l.quantity) * (l.costMinor ?? 0))}</td>
                    {!locked && (
                      <td className="r"><button type="button" className="pe-x" onClick={() => removeLine(i)} aria-label={`Remove ${l.name}`}>×</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="pe-empty">
              {locked ? 'No products on this transaction.' : `No products yet. Search or scan above to add products to this ${receiveMode ? 'delivery' : KIND_WORD[kind]}.`}
            </div>
          )}

          <div className="pe-totals">
            <div className="pe-totrow">
              <span>Subtotal of products</span>
              <span className="pe-totval">{fmt(subtotal)}</span>
            </div>
            <div className="pe-totrow">
              <span>Discount</span>
              <span className="pe-totctl">
                <span className="pe-seg" role="group" aria-label="Discount type">
                  <button type="button" className={draft.details.discountMode === 'pct' ? 'active' : ''} disabled={locked} onClick={() => setDetails({ discountMode: 'pct', discountValue: 0 })}>%</button>
                  <button type="button" className={draft.details.discountMode === 'amount' ? 'active' : ''} disabled={locked} onClick={() => setDetails({ discountMode: 'amount', discountValue: 0 })}>$</button>
                </span>
                {draft.details.discountMode === 'pct' ? (
                  <NumInput
                    className="pe-input pe-cost"
                    disabled={locked}
                    value={String(draft.details.discountValue)}
                    onCommit={(t) => setDetails({ discountValue: Math.min(100, Math.max(0, parseFloat(t) || 0)) })}
                  />
                ) : (
                  <MoneyInput className="pe-input pe-cost" disabled={locked} minor={draft.details.discountValue} onChange={(v) => setDetails({ discountValue: v })} />
                )}
              </span>
              <span className="pe-totval">−{fmt(discount)}</span>
            </div>
            <div className="pe-totrow">
              <span>Total shipping</span>
              <span className="pe-totctl">
                <select className="pe-input pe-apply" value={draft.details.shippingApply} disabled={locked} onChange={(e) => setDetails({ shippingApply: e.target.value as ApplyMode })}>
                  {APPLY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="pe-money"><span>$</span>
                  <MoneyInput className="pe-input pe-cost" disabled={locked} minor={draft.details.shippingMinor} onChange={(v) => setDetails({ shippingMinor: v })} />
                </span>
              </span>
              <span className="pe-totval">{fmt(draft.details.shippingMinor)}</span>
            </div>
            <div className="pe-totrow">
              <span>Total import duty</span>
              <span className="pe-totctl">
                <select className="pe-input pe-apply" value={draft.details.dutyApply} disabled={locked} onChange={(e) => setDetails({ dutyApply: e.target.value as ApplyMode })}>
                  {APPLY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="pe-money"><span>$</span>
                  <MoneyInput className="pe-input pe-cost" disabled={locked} minor={draft.details.dutyMinor} onChange={(v) => setDetails({ dutyMinor: v })} />
                </span>
              </span>
              <span className="pe-totval">{fmt(draft.details.dutyMinor)}</span>
            </div>
            <div className="pe-totrow grand">
              <span>ORDER TOTAL</span>
              <span className="pe-totval">{fmt(total)}</span>
            </div>
          </div>
        </Section>

        <div className="pe-foot">
          {existing && !locked ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>Delete {existing.number}? This can't be undone.</span>
                <button className="btn-danger" onClick={remove}>Delete</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete {KIND_WORD[kind]}</button>
            )
          ) : (
            <span />
          )}
          {actions}
        </div>
      </div>
    </main>
  );
}
