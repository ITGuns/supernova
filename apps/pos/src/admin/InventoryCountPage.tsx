import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { countBucket, countLinesFor, useInventory, type CountLine } from '../store/inventoryStore';
import { useProducts, type Product } from '../store/productStore';
import { Section } from './FormLayout';
import '../styles/product-editor.css';

// The counting screen for one inventory count: scan or search products, enter
// counted quantities, then complete the count to set stock on hand.

export function InventoryCountPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const counts = useInventory((s) => s.counts);
  const updateCount = useInventory((s) => s.updateCount);
  const deleteCount = useInventory((s) => s.deleteCount);
  const startCount = useInventory((s) => s.startCount);
  const completeCount = useInventory((s) => s.completeCount);
  const products = useProducts((s) => s.products);
  const categories = useCatalogMeta((s) => s.categories);

  const count = counts.find((c) => c.id === id);
  const [lines, setLines] = useState<CountLine[]>(() => count?.lines.map((l) => ({ ...l })) ?? []);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | 'delete' | null>(null);
  const [error, setError] = useState('');

  // Pick up lines written by the store (e.g. when the count is started here).
  useEffect(() => {
    if (count && !dirty) setLines(count.lines.map((l) => ({ ...l })));
  }, [count, dirty]);

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !count) return [];
    const pool = count.countType === 'full' ? products : products.filter((p) => lines.some((l) => l.productId === p.id));
    return pool
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.skuCodes ?? []).some((c) => c.code.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [search, products, lines, count]);

  if (!count) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Inventory count not found</h1>
          <button className="btn-s" onClick={() => nav('/inventory', { state: { tab: 'counts' } })}>Back to inventory counts</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/inventory', { state: { tab: 'counts' } });
  const inProgress = count.status === 'In progress';
  const bucket = countBucket(count);

  const setCounted = (productId: string, value: string) => {
    const n = value === '' ? null : Math.max(0, Math.floor(Number(value) || 0));
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, counted: n } : l)));
    setDirty(true);
    setError('');
  };

  /** Scanning a product counts one more of it (adding it to a partial count if needed). */
  const tally = (p: Product) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id);
      if (i >= 0) return ls.map((l, li) => (li === i ? { ...l, counted: (l.counted ?? 0) + 1 } : l));
      return [...ls, { productId: p.id, name: p.name, sku: p.sku, expected: p.available, counted: 1 }];
    });
    setDirty(true);
    setSearch('');
  };

  const onSearchKey = (key: string) => {
    if (key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    const exact = products.find((p) => p.sku.toLowerCase() === q || (p.skuCodes ?? []).some((c) => c.code.toLowerCase() === q));
    const only = hits.length === 1 ? hits[0] : undefined;
    if (exact) tally(exact);
    else if (only) tally(only);
  };

  const saveProgress = () => {
    updateCount(count.id, { lines });
    setDirty(false);
  };

  const start = () => {
    startCount(count.id, countLinesFor(products, count, categories));
    setDirty(false);
  };

  const complete = () => {
    if (!lines.some((l) => l.counted !== null)) {
      setError('Enter a counted quantity for at least one product before completing the count.');
      setConfirm(null);
      return;
    }
    updateCount(count.id, { lines });
    completeCount(count.id);
    setDirty(false);
    back();
  };

  const cancel = () => {
    updateCount(count.id, { lines, status: 'Cancelled' });
    back();
  };

  const remove = () => {
    deleteCount(count.id);
    back();
  };

  const countedLines = lines.filter((l) => l.counted !== null);
  const diffTotal = countedLines.reduce((s, l) => s + ((l.counted ?? 0) - l.expected), 0);
  const when = new Date(count.startAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const statusText =
    count.status === 'Completed'
      ? `Completed ${count.completedAt ? new Date(count.completedAt).toLocaleString() : ''}`.trim()
      : count.status === 'Cancelled'
      ? 'Cancelled'
      : inProgress
      ? `In progress — ${countedLines.length} of ${lines.length} products counted`
      : bucket === 'upcoming'
      ? `Scheduled for ${when}`
      : `Due — scheduled for ${when}`;

  const actions = (
    <span className="pe-actions">
      {count.status === 'Planned' && (
        <>
          <button className="btn-s" onClick={() => setConfirm('cancel')}>Cancel count</button>
          <button className="btn-p" onClick={start}>Start count</button>
        </>
      )}
      {inProgress && (
        <>
          <button className="btn-s" onClick={() => setConfirm('cancel')}>Cancel count</button>
          <button className="btn-s" onClick={saveProgress} disabled={!dirty}>Save</button>
          <button className="btn-p" onClick={() => setConfirm('complete')}>Complete count</button>
        </>
      )}
      {!inProgress && count.status !== 'Planned' && <button className="btn-s" onClick={back}>Back</button>}
    </span>
  );

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to inventory counts">‹</button>
          <h1 className="page-title">{count.name}</h1>
          <span className={`tx-badge ${count.status === 'Completed' ? 'received' : inProgress ? 'open' : count.status === 'Cancelled' ? 'cancelled' : 'planned'}`}>
            {count.status === 'Planned' ? (bucket === 'upcoming' ? 'Upcoming' : 'Due') : count.status}
          </span>
        </div>
        <div className="pe-subbar">
          <span>{statusText}</span>
          {actions}
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}
        {confirm && (
          <div className="pe-confirm" role="alertdialog">
            <span>
              {confirm === 'complete'
                ? `Complete this count? Stock on hand will be set to the counted quantity for ${countedLines.length} product${countedLines.length === 1 ? '' : 's'}${diffTotal ? ` (net change ${diffTotal > 0 ? '+' : ''}${diffTotal} units)` : ''}. Products without a counted quantity keep their current stock.`
                : confirm === 'cancel'
                ? 'Cancel this count? No stock levels will change.'
                : 'Delete this count? This can’t be undone.'}
            </span>
            <span className="pe-actions">
              <button className="btn-s" onClick={() => setConfirm(null)}>Not now</button>
              <button className={confirm === 'complete' ? 'btn-p' : 'btn-danger'} onClick={confirm === 'complete' ? complete : confirm === 'cancel' ? cancel : remove}>
                {confirm === 'complete' ? 'Complete count' : confirm === 'cancel' ? 'Cancel count' : 'Delete'}
              </button>
            </span>
          </div>
        )}

        <Section
          title="Count details"
          hint={count.countType === 'full' ? 'A full count of every product at this outlet.' : 'A partial count of the products matching the filters below.'}
        >
          <div className="pe-grid2">
            <div className="pe-field"><span className="pe-label">Outlet</span><span>{count.outlet}</span></div>
            <div className="pe-field"><span className="pe-label">Scheduled start</span><span>{when}</span></div>
            <div className="pe-field"><span className="pe-label">Type</span><span>{count.countType === 'full' ? 'Full count' : 'Partial count'}</span></div>
            <div className="pe-field"><span className="pe-label">Inactive products</span><span>{count.includeInactive ? 'Included' : 'Excluded'}</span></div>
          </div>
          {count.countType === 'partial' && count.filters.length > 0 && (
            <div className="pe-tags">
              {count.filters.map((f) => (
                <span key={`${f.kind}:${f.value}`} className="pe-tag"><span className="pe-muted">{f.kind}:</span> {f.label}</span>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Products"
          hint={inProgress ? 'Scan or search to count a product, or type the counted quantity next to it. Uncounted products keep their current stock on hand.' : 'The products in this count.'}
        >
          {inProgress && (
            <div className="pe-searchwrap">
              <input
                className="pe-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => onSearchKey(e.key)}
                placeholder="Search or scan to count a product"
                autoFocus
              />
              {hits.length > 0 && (
                <div className="pe-catalog-hits pe-hits">
                  {hits.map((p) => (
                    <button key={p.id} type="button" className="pe-catalog-hit" onClick={() => tally(p)}>
                      <span>{p.name}</span>
                      <span className="pe-muted">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {count.status === 'Planned' ? (
            <div className="pe-empty">Products are snapshotted with their stock on hand when the count starts.</div>
          ) : lines.length ? (
            <table className="pe-table pe-lines">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="r">Expected</th>
                  <th className="r">Counted</th>
                  <th className="r">Difference</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const diff = l.counted === null ? null : l.counted - l.expected;
                  return (
                    <tr key={l.productId}>
                      <td>{l.name}</td>
                      <td className="pe-muted">{l.sku}</td>
                      <td className="r">{l.expected}</td>
                      <td className="r">
                        {inProgress ? (
                          <input className="pe-input pe-qty" type="number" min={0} value={l.counted ?? ''} placeholder="—" onChange={(e) => setCounted(l.productId, e.target.value)} />
                        ) : (
                          l.counted ?? '—'
                        )}
                      </td>
                      <td className={`r ${diff === null ? 'pe-muted' : diff < 0 ? 'pe-neg' : diff > 0 ? 'pe-pos' : ''}`}>
                        {diff === null ? 'Not counted' : diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="pe-empty">No products in this count.</div>
          )}
        </Section>

        <div className="pe-foot">
          {count.status !== 'Completed' ? (
            <button className="rlink pe-danger" onClick={() => setConfirm('delete')}>Delete count</button>
          ) : (
            <span />
          )}
          {actions}
        </div>
      </div>
    </main>
  );
}
