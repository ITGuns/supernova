import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCustomers } from '../store/customerStore';
import { usePriceBooks, type PriceBook, type PriceBookEntry } from '../store/priceBookStore';
import { useProducts } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { Field, Section } from './FormLayout';
import { MoneyInput } from './NumInput';
import '../styles/product-editor.css';

// Full-page price book editor: special prices for a customer group (and
// optionally an outlet or date range). Used by the register when a customer
// in that group is attached to the sale.

const isoDate = (ms: number | null) => (ms === null ? '' : new Date(ms).toISOString().slice(0, 10));
const fromDate = (s: string, endOfDay = false): number | null =>
  s ? new Date(`${s}T${endOfDay ? '23:59:59' : '00:00:00'}`).getTime() : null;

interface Draft {
  name: string;
  customerGroup: string;
  outlet: string;
  startAt: number | null;
  endAt: number | null;
  entries: PriceBookEntry[];
}

export function PriceBookEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const priceBooks = usePriceBooks((s) => s.priceBooks);
  const addPriceBook = usePriceBooks((s) => s.addPriceBook);
  const updatePriceBook = usePriceBooks((s) => s.updatePriceBook);
  const deletePriceBook = usePriceBooks((s) => s.deletePriceBook);
  const groups = useCustomers((s) => s.groups);
  const outlets = useSetup((s) => s.outlets);
  const products = useProducts((s) => s.products);

  const existing = id ? priceBooks.find((b) => b.id === id) : undefined;
  const isNew = !existing;

  const [draft, setDraft] = useState<Draft>(() => ({
    name: existing?.name ?? '',
    customerGroup: existing?.customerGroup ?? 'All Customers',
    outlet: existing?.outlet ?? '',
    startAt: existing?.startAt ?? null,
    endAt: existing?.endAt ?? null,
    entries: existing?.entries.map((e) => ({ ...e })) ?? [],
  }));
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };
  const setEntry = (productId: string, priceMinor: number) =>
    set({ entries: draft.entries.map((e) => (e.productId === productId ? { ...e, priceMinor } : e)) });
  const addEntry = (productId: string, priceMinor: number) => {
    if (draft.entries.some((e) => e.productId === productId)) return;
    set({ entries: [...draft.entries, { productId, priceMinor }] });
    setSearch('');
  };

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => !draft.entries.some((e) => e.productId === p.id) && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, 8);
  }, [search, products, draft.entries]);

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Price book not found</h1>
          <button className="btn-s" onClick={() => nav('/catalog', { state: { tab: 'pricebooks' } })}>Back to price books</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/catalog', { state: { tab: 'pricebooks' } });

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the price book a name.');
    if (priceBooks.some((b) => b.id !== existing?.id && b.name.trim().toLowerCase() === name.toLowerCase())) return setError(`A price book called “${name}” already exists.`);
    if (draft.startAt !== null && draft.endAt !== null && draft.endAt < draft.startAt) return setError('The end date is before the start date.');
    const body: Omit<PriceBook, 'id' | 'createdAt'> = { ...draft, name };
    if (existing) updatePriceBook(existing.id, body);
    else addPriceBook(body);
    back();
  };

  const remove = () => {
    if (existing) deletePriceBook(existing.id);
    back();
  };

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to price books">‹</button>
          <h1 className="page-title">{isNew ? 'Add price book' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Set special prices for a customer group or outlet.' : 'Edit this price book.'}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="General" hint="Who gets these prices, where, and for how long. Leave the dates blank for a permanent price book.">
          <div className="pe-grid2">
            <Field label="Price book name"><input className="pe-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. Members" /></Field>
            <Field label="Customer group">
              <select className="pe-input" value={draft.customerGroup} onChange={(e) => set({ customerGroup: e.target.value })}>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Outlet">
              <select className="pe-input" value={draft.outlet} onChange={(e) => set({ outlet: e.target.value })}>
                <option value="">All outlets</option>
                {outlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </Field>
            <div />
            <Field label="Valid from" hint="(Optional)"><input className="pe-input" type="date" value={isoDate(draft.startAt)} onChange={(e) => set({ startAt: fromDate(e.target.value) })} /></Field>
            <Field label="Valid to" hint="(Optional)"><input className="pe-input" type="date" value={isoDate(draft.endAt)} onChange={(e) => set({ endAt: fromDate(e.target.value, true) })} /></Field>
          </div>
        </Section>

        <Section title="Products" hint="Search or scan to add a product, then set its price in this book.">
          <div className="pe-searchwrap">
            <input className="pe-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or scan to add a product" />
            {hits.length > 0 && (
              <div className="pe-catalog-hits pe-hits">
                {hits.map((p) => (
                  <button key={p.id} type="button" className="pe-catalog-hit" onClick={() => addEntry(p.id, p.priceMinor)}>
                    <span>{p.name}</span>
                    <span className="pe-muted">{p.sku} · {fmt(p.priceMinor)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pe-rowhead">
            <span className="pe-subhead">{draft.entries.length} product{draft.entries.length === 1 ? '' : 's'} in this price book</span>
            {products.some((p) => !draft.entries.some((e) => e.productId === p.id)) && (
              <button type="button" className="pe-add" onClick={() => set({ entries: [...draft.entries, ...products.filter((p) => !draft.entries.some((e) => e.productId === p.id)).map((p) => ({ productId: p.id, priceMinor: p.priceMinor }))] })}>
                + Add all products
              </button>
            )}
          </div>
          {draft.entries.length ? (
            <table className="pe-table pe-lines">
              <thead><tr><th>Product</th><th>SKU</th><th className="r">Retail price</th><th className="r">Price book price</th><th /></tr></thead>
              <tbody>
                {draft.entries.map((e) => {
                  const p = products.find((x) => x.id === e.productId);
                  return (
                    <tr key={e.productId}>
                      <td>{p?.name ?? e.productId}</td>
                      <td className="pe-muted">{p?.sku ?? ''}</td>
                      <td className="r">{p ? fmt(p.priceMinor) : '—'}</td>
                      <td className="r"><span className="pe-money"><span>$</span><MoneyInput className="pe-input pe-cost" minor={e.priceMinor} onChange={(v) => setEntry(e.productId, v)} /></span></td>
                      <td className="r"><button type="button" className="pe-x" onClick={() => set({ entries: draft.entries.filter((x) => x.productId !== e.productId) })} aria-label="Remove">×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="pe-empty">No products yet. Search above or add all products.</div>
          )}
        </Section>

        <div className="pe-foot">
          {existing ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>Delete “{existing.name}”?</span>
                <button className="btn-danger" onClick={remove}>Delete</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete price book</button>
            )
          ) : (
            <span />
          )}
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
      </div>
    </main>
  );
}
