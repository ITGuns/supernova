import { useMemo, useState } from 'react';
import { fmt } from '../lib/format';
import { movementsFor } from '../lib/movements';
import { useAdjustmentReasons } from '../store/adjustmentReasonsStore';
import { useCart } from '../store/cartStore';
import { categoryLabel, useCatalogMeta } from '../store/catalogMetaStore';
import { useInventoryAdjustments } from '../store/inventoryAdjustmentStore';
import { useInventory } from '../store/inventoryStore';
import { availableOf, useProducts, type Product } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';
import { IntInput } from './NumInput';

// The panel under an expanded product row on Catalog → Products: the
// product's details and inventory, plus Lightspeed's row actions —
// Adjust Inventory, View inventory movements, Duplicate and Delete.

export function ProductRowPanel({
  product,
  members,
  onDetails,
  onDuplicate,
  onDelete,
}: {
  product: Product;
  members: Product[];
  onDetails: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const products = useProducts((s) => s.products);
  const categories = useCatalogMeta((s) => s.categories);
  const outlets = useSetup((s) => s.outlets);
  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [movementsFor_, setMovementsFor] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const p = product;
  const cost = p.supplierPriceMinor ?? 0;
  const markup = cost > 0 ? Math.round(((p.priceMinor - cost) / cost) * 1000) / 10 : null;
  const isFamily = members.length > 1;

  return (
    <div className="prp">
      <div className="prp-grid">
        <div className="prp-card">
          <div className="prp-title">Details</div>
          <dl className="prp-dl">
            <dt>SKU</dt><dd>{isFamily ? `${members.length} variants` : p.sku}</dd>
            <dt>Category</dt><dd>{categoryLabel(categories, p.categoryId) || '—'}</dd>
            <dt>Brand</dt><dd>{p.brand || '—'}</dd>
            <dt>Supplier</dt><dd>{p.supplier || '—'}{p.suppliers?.[0]?.code ? ` · ${p.suppliers[0].code}` : ''}</dd>
            <dt>Supply price</dt><dd>{cost > 0 ? fmt(cost) : '—'}</dd>
            <dt>Markup</dt><dd>{markup === null ? '—' : `${markup}%`}</dd>
            <dt>Retail price</dt><dd>{fmt(p.priceMinor)}</dd>
            <dt>Tags</dt><dd>{p.tags?.length ? p.tags.join(', ') : '—'}</dd>
          </dl>
          {p.description && <p className="prp-desc">{p.description}</p>}
        </div>
        <div className="prp-card">
          <div className="prp-title">Inventory</div>
          <table className="pe-table prp-table">
            <thead>
              <tr><th>Outlet</th>{isFamily && <th>Variant</th>}<th className="r">Stock</th><th className="r">Reorder point</th><th className="r">Reorder amount</th></tr>
            </thead>
            <tbody>
              {(outlets.length ? outlets : [{ id: 'main', name: 'Main Outlet' }]).map((o) =>
                members.map((m) => (
                  <tr key={`${o.id}-${m.id}`}>
                    <td>{o.name}</td>
                    {isFamily && <td>{m.name}</td>}
                    <td className="r">{m.trackInventory === false ? 'Not tracked' : availableOf(m, products)}</td>
                    <td className="r">{m.replenishMethod === 'reorder' ? m.reorderPoint ?? '—' : m.minQty ?? '—'}</td>
                    <td className="r">{m.replenishMethod === 'reorder' ? m.reorderQty ?? '—' : m.maxQty ?? '—'}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="prp-actions">
        <button className="btn-s" onClick={() => onDetails(p)}>Details</button>
        {members.length === 1 ? (
          <>
            <button className="btn-s" onClick={() => setAdjustFor(p)}>Adjust Inventory</button>
            <button className="btn-s" onClick={() => setMovementsFor(p)}>View inventory movements</button>
          </>
        ) : (
          <span className="prp-pick">
            <select className="pe-input prp-select" defaultValue="" onChange={(e) => { const m = members.find((x) => x.id === e.target.value); if (m) setAdjustFor(m); e.target.value = ''; }}>
              <option value="" disabled>Adjust Inventory…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className="pe-input prp-select" defaultValue="" onChange={(e) => { const m = members.find((x) => x.id === e.target.value); if (m) setMovementsFor(m); e.target.value = ''; }}>
              <option value="" disabled>View inventory movements…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </span>
        )}
        <button className="btn-s" onClick={() => onDuplicate(p)}>Duplicate</button>
        {confirmDelete ? (
          <span className="pe-inline">
            <span>Delete {isFamily ? `all ${members.length} variants` : `“${p.name}”`}? This can’t be undone.</span>
            <button className="btn-danger" onClick={() => onDelete(p)}>Delete</button>
            <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
          </span>
        ) : (
          <button className="btn-s danger" onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
      {adjustFor && <AdjustInventoryModal product={adjustFor} onClose={() => setAdjustFor(null)} />}
      {movementsFor_ && <MovementsModal product={movementsFor_} onClose={() => setMovementsFor(null)} />}
    </div>
  );
}

/** Lightspeed's two-step Adjust Inventory pop-up: choose the outlet, then the reason and quantity. */
export function AdjustInventoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const outlets = useSetup((s) => s.outlets);
  const reasons = useAdjustmentReasons((s) => s.reasons);
  const products = useProducts((s) => s.products);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const addAdjustment = useInventoryAdjustments((s) => s.addAdjustment);
  const [step, setStep] = useState<1 | 2>(outlets.length <= 1 ? 2 : 1);
  const [outlet, setOutlet] = useState(outlets[0]?.name ?? 'Main Outlet');
  const [reasonId, setReasonId] = useState('');
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const live = products.find((x) => x.id === product.id) ?? product;
  const current = availableOf(live, products);
  const enabled = reasons.filter((r) => r.enabled);
  const reason = reasons.find((r) => r.id === reasonId);
  const signed = reason ? (reason.type === 'Negative' ? -Math.abs(qty) : Math.abs(qty)) : 0;
  const next = Math.max(0, current + signed);
  const who = users.find((u) => u.id === currentUserId)?.name ?? '';

  const submit = () => {
    if (!reason) return setError('Choose an adjustment reason.');
    if (qty <= 0) return setError('Enter the quantity to adjust by.');
    if (reason.type === 'Negative' && qty > current) return setError(`Only ${current} in stock — you can’t remove ${qty}.`);
    addAdjustment({ productId: live.id, productName: live.name, outlet, reasonId: reason.id, reason: reason.name, quantity: signed, costMinor: live.supplierPriceMinor ?? 0, note: note.trim(), user: who });
    onClose();
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Adjust Inventory</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="reg-open-body">
          <p className="reg-open-text"><b>{live.name}</b>{live.sku ? ` · ${live.sku}` : ''}</p>
          {step === 1 ? (
            <>
              <label className="reg-open-field">
                <span>Outlet</span>
                <select value={outlet} onChange={(e) => setOutlet(e.target.value)}>
                  {outlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </label>
              <button className="pm-complete" onClick={() => setStep(2)}>Next</button>
            </>
          ) : (
            <>
              {error && <div className="pe-error" role="alert">{error}</div>}
              <label className="reg-open-field">
                <span>Adjustment Reason</span>
                <select value={reasonId} onChange={(e) => { setReasonId(e.target.value); setError(''); }}>
                  <option value="">Select a reason</option>
                  <optgroup label="Add inventory">
                    {enabled.filter((r) => r.type === 'Positive').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                  <optgroup label="Remove inventory">
                    {enabled.filter((r) => r.type === 'Negative').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="reg-open-field">
                <span>Adjustment Quantity</span>
                <IntInput className="" int={qty} onChange={(n) => { setQty(Math.abs(n ?? 0)); setError(''); }} placeholder="0" />
              </label>
              <label className="reg-open-field">
                <span>Note <span className="pe-hint">(Optional)</span></span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. found in the back room" />
              </label>
              <div className="prp-preview">
                <span>{outlet} · Current inventory <b>{current}</b></span>
                <span>New inventory <b>{reason ? next : current}</b>{reason && qty > 0 ? ` (${signed > 0 ? '+' : ''}${signed})` : ''}</span>
              </div>
              <div className="pe-actions">
                {outlets.length > 1 && <button className="btn-s" onClick={() => setStep(1)}>Back</button>}
                <button className="pm-complete" onClick={submit}>Adjust Inventory</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every stock change for a product: sales, returns, deliveries, adjustments and counts. */
export function MovementsModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const sales = useCart((s) => s.sales);
  const transactions = useInventory((s) => s.transactions);
  const counts = useInventory((s) => s.counts);
  const adjustments = useInventoryAdjustments((s) => s.adjustments);
  const outlets = useSetup((s) => s.outlets);
  const products = useProducts((s) => s.products);
  const live = products.find((x) => x.id === product.id) ?? product;
  const rows = useMemo(
    () => movementsFor(product.id, { sales, transactions, adjustments, counts }, outlets[0]?.name ?? 'Main Outlet'),
    [product.id, sales, transactions, adjustments, counts, outlets],
  );
  const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm prp-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pm-head">
          <h2>Inventory movements · {live.name}</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="reg-open-body">
          <p className="reg-open-text">Stock on hand now: <b>{availableOf(live, products)}</b></p>
          {rows.length === 0 ? (
            <div className="pe-empty">No inventory movements yet. Sales, deliveries, adjustments and counts will show here.</div>
          ) : (
            <div className="prp-scroll">
              <table className="pe-table prp-table">
                <thead><tr><th>Date</th><th>Movement</th><th>From</th><th>To</th><th>User</th><th className="r">Quantity</th></tr></thead>
                <tbody>
                  {rows.map((m, i) => (
                    <tr key={i}>
                      <td>{when(m.at)}</td>
                      <td>{m.movement}{m.reference ? <span className="pe-muted"> · {m.reference}</span> : null}</td>
                      <td>{m.from || '—'}</td>
                      <td>{m.to || '—'}</td>
                      <td>{m.user || '—'}</td>
                      <td className={`r ${m.quantity > 0 ? 'prp-pos' : m.quantity < 0 ? 'prp-neg' : ''}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
