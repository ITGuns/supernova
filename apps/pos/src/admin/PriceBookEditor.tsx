import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { downloadCsv, parseCsv } from '../lib/csv';
import { fmt } from '../lib/format';
import { useCustomers } from '../store/customerStore';
import { usePriceBooks, type PriceBook, type PriceBookEntry } from '../store/priceBookStore';
import { useProducts } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { Field, Section } from './FormLayout';
import { IntInput, MoneyInput, NumInput } from './NumInput';
import '../styles/product-editor.css';

// Products › Price books › New price book. Special prices for a customer
// group (and optionally one outlet or a date range), set per product as a
// markup on cost, a discount off retail, or a straight price — or loaded
// from a CSV file. The register uses it whenever a customer in that group
// is attached to the sale.

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

const pct1 = (n: number) => (Math.round(n * 10) / 10).toString();

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
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkMode, setBulkMode] = useState<'markup' | 'discount'>('discount');
  const [bulkPct, setBulkPct] = useState('');
  const [page, setPage] = useState(0);
  const PAGE = 25;

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };
  const patchEntry = (productId: string, patch: Partial<PriceBookEntry>) =>
    set({ entries: draft.entries.map((e) => (e.productId === productId ? { ...e, ...patch } : e)) });
  const addEntry = (productId: string, priceMinor: number) => {
    if (draft.entries.some((e) => e.productId === productId)) return;
    set({ entries: [...draft.entries, { productId, priceMinor, minUnits: null, maxUnits: null }] });
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
    if (draft.startAt !== null && draft.endAt !== null && draft.endAt < draft.startAt) return setError('The valid-to date is before the valid-from date.');
    const body: Omit<PriceBook, 'id' | 'createdAt'> = { ...draft, name };
    if (existing) updatePriceBook(existing.id, body);
    else addPriceBook(body);
    back();
  };

  const remove = () => {
    if (existing) deletePriceBook(existing.id);
    back();
  };

  const duplicate = () => {
    if (!existing) return;
    const copy = addPriceBook({ ...draft, name: `${draft.name} (copy)` });
    nav(`/catalog/price-books/${copy.id}`);
  };

  const exportBook = () => {
    downloadCsv(`${(draft.name || 'price-book').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, [
      ['sku', 'product', 'retail price', 'price book price', 'markup %', 'discount %', 'min units', 'max units'],
      ...draft.entries.map((e) => {
        const p = products.find((x) => x.id === e.productId);
        const cost = p?.supplierPriceMinor ?? 0;
        return [
          p?.sku ?? '',
          p?.name ?? e.productId,
          p ? (p.priceMinor / 100).toFixed(2) : '',
          (e.priceMinor / 100).toFixed(2),
          cost > 0 ? pct1(((e.priceMinor - cost) / cost) * 100) : '',
          p && p.priceMinor > 0 ? pct1(((p.priceMinor - e.priceMinor) / p.priceMinor) * 100) : '',
          e.minUnits == null ? '' : String(e.minUnits),
          e.maxUnits == null ? '' : String(e.maxUnits),
        ];
      }),
    ]);
  };

  // CSV columns: sku (or product name) plus one of price / markup % / discount %.
  const loadFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(typeof reader.result === 'string' ? reader.result : '');
      const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
      const iSku = idx('sku', 'sku code', 'code');
      const iName = idx('product', 'name', 'product name');
      const iPrice = idx('price', 'price book price', 'new price', 'sell price');
      const iMarkup = idx('markup', 'markup %', 'markup%');
      const iDisc = idx('discount', 'discount %', 'discount%');
      const iMin = idx('min units', 'min', 'min_units');
      const iMax = idx('max units', 'max', 'max_units');
      let added = 0;
      let missed = 0;
      const next = [...draft.entries];
      for (const r of rows.slice(1)) {
        const sku = iSku >= 0 ? (r[iSku] ?? '').trim().toLowerCase() : '';
        const name = iName >= 0 ? (r[iName] ?? '').trim().toLowerCase() : '';
        const p = products.find((x) => (sku && x.sku.toLowerCase() === sku) || (name && x.name.toLowerCase() === name));
        if (!p) {
          missed++;
          continue;
        }
        const num = (i: number) => (i >= 0 ? parseFloat((r[i] ?? '').replace(/[^0-9.-]/g, '')) : NaN);
        let price = p.priceMinor;
        if (Number.isFinite(num(iPrice))) price = Math.round(num(iPrice) * 100);
        else if (Number.isFinite(num(iMarkup)) && (p.supplierPriceMinor ?? 0) > 0) price = Math.round((p.supplierPriceMinor ?? 0) * (1 + num(iMarkup) / 100));
        else if (Number.isFinite(num(iDisc))) price = Math.round(p.priceMinor * (1 - num(iDisc) / 100));
        const entry: PriceBookEntry = {
          productId: p.id,
          priceMinor: Math.max(0, price),
          minUnits: Number.isFinite(num(iMin)) ? Math.max(0, Math.round(num(iMin))) : null,
          maxUnits: Number.isFinite(num(iMax)) ? Math.max(0, Math.round(num(iMax))) : null,
        };
        const at = next.findIndex((e) => e.productId === p.id);
        if (at >= 0) next[at] = entry;
        else next.push(entry);
        added++;
      }
      set({ entries: next });
      setNotice(`${added} product${added === 1 ? '' : 's'} loaded from ${file.name}${missed ? ` · ${missed} row${missed === 1 ? '' : 's'} didn’t match a product` : ''}.`);
    };
    reader.readAsText(file);
  };

  const pageEntries = draft.entries.slice(page * PAGE, page * PAGE + PAGE);
  const applyBulk = () => {
    const pct = parseFloat(bulkPct);
    if (!Number.isFinite(pct)) return;
    const ids = new Set(pageEntries.map((e) => e.productId));
    set({
      entries: draft.entries.map((e) => {
        if (!ids.has(e.productId)) return e;
        const p = products.find((x) => x.id === e.productId);
        if (!p) return e;
        const cost = p.supplierPriceMinor ?? 0;
        const price = bulkMode === 'markup' ? (cost > 0 ? Math.round(cost * (1 + pct / 100)) : e.priceMinor) : Math.round(p.priceMinor * (1 - pct / 100));
        return { ...e, priceMinor: Math.max(0, price) };
      }),
    });
  };

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-crumbs">
          <span className="rlink" onClick={() => nav('/catalog')}>Products</span> › <span className="rlink" onClick={back}>Price books</span> › <span>{isNew ? 'New price book' : existing!.name}</span>
        </div>
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to price books">‹</button>
          <h1 className="page-title">{isNew ? 'New price book' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>Set different prices for a customer group, outlet or period. <span className="rlink">Need help?</span></span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save Price Book</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}
        {notice && <div className="pe-notice" role="status">{notice} <span className="rlink" onClick={() => setNotice('')}>Dismiss</span></div>}

        <Section title="Details" hint="Name the price book and choose who it applies to. Leave the dates blank for a permanent price book.">
          <div className="pe-grid2">
            <Field label="Name"><input className="pe-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. Members" /></Field>
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

        <Section title="Price book file" hint="Load prices from a CSV with a sku column and a price, markup % or discount % column. Rows for products already in the book replace their price.">
          <div className="pe-inline">
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn-s" onClick={() => fileRef.current?.click()}>Choose CSV file</button>
            <span className="rlink" onClick={() => downloadCsv('price-book-template.csv', [['sku', 'price', 'markup %', 'discount %', 'min units', 'max units'], ['TS-001', '22.50', '', '', '', '']])}>Download template</span>
          </div>
        </Section>

        <Section title="Products" hint="Search or scan to add a product, then set its price as a markup on supply price, a discount off retail, or a fixed price.">
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
              <button type="button" className="pe-add" onClick={() => set({ entries: [...draft.entries, ...products.filter((p) => !draft.entries.some((e) => e.productId === p.id)).map((p) => ({ productId: p.id, priceMinor: p.priceMinor, minUnits: null, maxUnits: null }))] })}>
                + Add all products
              </button>
            )}
          </div>
          {draft.entries.length ? (
            <>
              <div className="pb-bulk">
                <span>Change all on page:</span>
                <span className="pe-seg" role="group" aria-label="Bulk change">
                  <button type="button" className={bulkMode === 'markup' ? 'active' : ''} onClick={() => setBulkMode('markup')}>Markup %</button>
                  <button type="button" className={bulkMode === 'discount' ? 'active' : ''} onClick={() => setBulkMode('discount')}>Discount %</button>
                </span>
                <NumInput className="pe-input pe-cost" value={bulkPct} onCommit={setBulkPct} placeholder="0" />
                <button type="button" className="btn-s" onClick={applyBulk}>Apply</button>
              </div>
              <table className="pe-table pe-lines pb-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="r">Supply price</th>
                    <th className="r">Retail price</th>
                    <th className="r">Markup %</th>
                    <th className="r">Discount %</th>
                    <th className="r">Price book price</th>
                    <th className="r">Min units</th>
                    <th className="r">Max units</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map((e) => {
                    const p = products.find((x) => x.id === e.productId);
                    const cost = p?.supplierPriceMinor ?? 0;
                    const markup = cost > 0 ? ((e.priceMinor - cost) / cost) * 100 : null;
                    const discount = p && p.priceMinor > 0 ? ((p.priceMinor - e.priceMinor) / p.priceMinor) * 100 : null;
                    return (
                      <tr key={e.productId}>
                        <td>{p?.name ?? e.productId}<br /><span className="pe-muted">{p?.sku ?? ''}</span></td>
                        <td className="r">{cost > 0 ? fmt(cost) : '—'}</td>
                        <td className="r">{p ? fmt(p.priceMinor) : '—'}</td>
                        <td className="r">
                          <NumInput className="pe-input pe-pct" value={markup === null ? '' : pct1(markup)} disabled={cost === 0} placeholder="—" onCommit={(t) => { const n = parseFloat(t); if (Number.isFinite(n) && cost > 0) patchEntry(e.productId, { priceMinor: Math.max(0, Math.round(cost * (1 + n / 100))) }); }} />
                        </td>
                        <td className="r">
                          <NumInput className="pe-input pe-pct" value={discount === null ? '' : pct1(discount)} disabled={!p} placeholder="—" onCommit={(t) => { const n = parseFloat(t); if (Number.isFinite(n) && p) patchEntry(e.productId, { priceMinor: Math.max(0, Math.round(p.priceMinor * (1 - n / 100))) }); }} />
                        </td>
                        <td className="r"><span className="pe-money"><span>$</span><MoneyInput className="pe-input pe-cost" minor={e.priceMinor} onChange={(v) => patchEntry(e.productId, { priceMinor: v })} /></span></td>
                        <td className="r"><IntInput className="pe-input pe-pct" int={e.minUnits ?? null} allowBlank placeholder="—" onChange={(n) => patchEntry(e.productId, { minUnits: n })} /></td>
                        <td className="r"><IntInput className="pe-input pe-pct" int={e.maxUnits ?? null} allowBlank placeholder="—" onChange={(n) => patchEntry(e.productId, { maxUnits: n })} /></td>
                        <td className="r"><button type="button" className="pe-x" onClick={() => set({ entries: draft.entries.filter((x) => x.productId !== e.productId) })} aria-label="Remove">×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {draft.entries.length > PAGE && (
                <div className="pb-pager">
                  <button type="button" className="btn-s" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <span>Page {page + 1} of {Math.ceil(draft.entries.length / PAGE)}</span>
                  <button type="button" className="btn-s" disabled={(page + 1) * PAGE >= draft.entries.length} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              )}
            </>
          ) : (
            <div className="pe-empty">No products yet. Search above, add all products, or load a CSV file.</div>
          )}
        </Section>

        <div className="pe-foot">
          <span className="pe-inline">
            {existing && <button className="btn-s" onClick={duplicate}>Duplicate</button>}
            {draft.entries.length > 0 && <button className="btn-s" onClick={exportBook}>Export</button>}
            {existing &&
              (confirmDelete ? (
                <span className="pe-inline">
                  <span>Delete “{existing.name}”? Customers in {existing.customerGroup} go back to retail prices.</span>
                  <button className="btn-danger" onClick={remove}>Delete Price Book</button>
                  <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
                </span>
              ) : (
                <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete Price Book</button>
              ))}
          </span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save Price Book</button>
          </span>
        </div>
      </div>
    </main>
  );
}
