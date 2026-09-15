import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { useProducts, type Product } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { Switch } from './controls';
import { Field, Section } from './FormLayout';
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

  const [draft, setDraft] = useState<Draft>(() => ({
    number: existing?.number ?? nextNumber(kind),
    from: existing?.from ?? (kind === 'order' ? '' : defaultOutlet),
    to: existing?.to ?? (kind === 'return' ? '' : defaultOutlet),
    lines: existing?.lines.map((l) => ({ ...l })) ?? [],
    details: {
      ...EMPTY_TX_DETAILS,
      ...(existing?.details ?? {}),
      ...(existing ? {} : { deliveryDate: receiveMode ? todayIso() : '' }),
    },
  }));
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
    ? 'Receive stock from a supplier and update your inventory levels.'
    : kind === 'order'
    ? 'Create a purchase order to send to your supplier.'
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
          <span>{subtitle}</span>
          {actions}
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}
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
              {kind === 'return' ? (
                <Field label="Supplier">
                  <select className="pe-input" value={draft.to} onChange={(e) => set({ to: e.target.value })}>
                    <option value="">Select a supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label={kind === 'order' ? 'Delivery recipient' : 'Destination outlet'}>
                  <select className="pe-input" value={draft.to} onChange={(e) => set({ to: e.target.value })}>
                    {outletNames.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              )}
              {kind === 'order' && (
                <Field label="Supplier invoice number" hint="(Optional)">
                  <input className="pe-input" value={draft.details.supplierInvoice} onChange={(e) => setDetails({ supplierInvoice: e.target.value })} />
                </Field>
              )}
              <Field label="Delivery date">
                <input className="pe-input" type="date" value={draft.details.deliveryDate} onChange={(e) => setDetails({ deliveryDate: e.target.value })} />
              </Field>
              <Field label={kind === 'order' ? 'Order number' : kind === 'transfer' ? 'Transfer number' : 'Return number'} hint="Must be a unique number">
                <input className="pe-input" value={draft.number} maxLength={20} onChange={(e) => set({ number: e.target.value })} />
                <span className="pe-counter">{draft.number.length}/20 characters</span>
              </Field>
              {kind === 'order' && (
                <Field label="Supplier invoice date" hint="(Optional)">
                  <input className="pe-input" type="date" value={draft.details.invoiceDate} onChange={(e) => setDetails({ invoiceDate: e.target.value })} />
                </Field>
              )}
              <Field label="Note" hint="(Optional)" wide>
                <textarea className="pe-input pe-textarea pe-note" maxLength={200} value={draft.details.note} onChange={(e) => setDetails({ note: e.target.value })} />
                <span className="pe-counter">{draft.details.note.length}/200 characters</span>
              </Field>
            </div>
          </fieldset>
        </Section>

        <Section title="Products" hint={locked ? 'The products on this transaction.' : 'Search or scan to add a product'}>
          {!locked && (
            <div className="pe-searchwrap">
              <input
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
              <label className="pe-switchrow">
                <span>Quick scan mode</span>
                <Switch on={quickScan} onClick={() => setQuickScan((v) => !v)} />
              </label>
            )}
          </div>
          {draft.lines.length ? (
            <table className="pe-table pe-lines">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="r">{kind === 'order' ? 'Ordered' : 'Quantity'}</th>
                  {showReceived && <th className="r">Received</th>}
                  <th className="r">Supply price</th>
                  <th className="r">Total</th>
                  {!locked && <th />}
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={l.productId}>
                    <td>{l.name}</td>
                    <td className="pe-muted">{l.sku ?? ''}</td>
                    <td className="r">
                      <input className="pe-input pe-qty" type="number" min={0} value={l.quantity} disabled={locked} onChange={(e) => setLine(i, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                    </td>
                    {showReceived && (
                      <td className="r">
                        <input className="pe-input pe-qty" type="number" min={0} value={receivedQty(l)} disabled={locked} onChange={(e) => setLine(i, { received: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                      </td>
                    )}
                    <td className="r">
                      <span className="pe-money"><span>$</span>
                        <input className="pe-input pe-cost" type="number" min={0} step="0.01" value={money(l.costMinor ?? 0)} disabled={locked} onChange={(e) => setLine(i, { costMinor: toMinor(e.target.value) })} />
                      </span>
                    </td>
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
                <input
                  className="pe-input pe-cost"
                  type="number"
                  min={0}
                  step={draft.details.discountMode === 'pct' ? '0.1' : '0.01'}
                  disabled={locked}
                  value={draft.details.discountMode === 'pct' ? String(draft.details.discountValue) : money(draft.details.discountValue)}
                  onChange={(e) =>
                    setDetails({
                      discountValue:
                        draft.details.discountMode === 'pct' ? Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) : toMinor(e.target.value),
                    })
                  }
                />
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
                  <input className="pe-input pe-cost" type="number" min={0} step="0.01" disabled={locked} value={money(draft.details.shippingMinor)} onChange={(e) => setDetails({ shippingMinor: toMinor(e.target.value) })} />
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
                  <input className="pe-input pe-cost" type="number" min={0} step="0.01" disabled={locked} value={money(draft.details.dutyMinor)} onChange={(e) => setDetails({ dutyMinor: toMinor(e.target.value) })} />
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
