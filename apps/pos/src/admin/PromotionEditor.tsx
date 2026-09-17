import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../lib/format';
import { categoryLabel, sortedCategories, useCatalogMeta } from '../store/catalogMetaStore';
import { useProducts } from '../store/productStore';
import { promoPrice, usePromotions, type Promotion, type PromotionKind, type PromotionScope } from '../store/promotionStore';
import { Switch } from './controls';
import { Field, Section } from './FormLayout';
import { MoneyInput, NumInput } from './NumInput';
import '../styles/product-editor.css';

// Full-page promotion editor: an automatic discount on matching products
// while the promotion runs. Applied at the register when a product is added.

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (ms: number | null) => {
  if (ms === null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string): number | null => (s ? new Date(s).getTime() : null);

interface Draft {
  name: string;
  description: string;
  kind: PromotionKind;
  value: number;
  appliesTo: PromotionScope;
  targetIds: string[];
  startAt: number | null;
  endAt: number | null;
  active: boolean;
}

export function PromotionEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const promotions = usePromotions((s) => s.promotions);
  const addPromotion = usePromotions((s) => s.addPromotion);
  const updatePromotion = usePromotions((s) => s.updatePromotion);
  const deletePromotion = usePromotions((s) => s.deletePromotion);
  const categories = useCatalogMeta((s) => s.categories);
  const products = useProducts((s) => s.products);

  const existing = id ? promotions.find((p) => p.id === id) : undefined;
  const isNew = !existing;

  const [draft, setDraft] = useState<Draft>(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    kind: existing?.kind ?? 'percent',
    value: existing?.value ?? 0,
    appliesTo: existing?.appliesTo ?? 'all',
    targetIds: existing?.targetIds ?? [],
    startAt: existing?.startAt ?? null,
    endAt: existing?.endAt ?? null,
    active: existing?.active ?? true,
  }));
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => !draft.targetIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, 8);
  }, [search, products, draft.targetIds]);

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Promotion not found</h1>
          <button className="btn-s" onClick={() => nav('/catalog', { state: { tab: 'promotions' } })}>Back to promotions</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/catalog', { state: { tab: 'promotions' } });

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the promotion a name.');
    if (draft.kind !== 'fixed' && draft.value <= 0) return setError(draft.kind === 'percent' ? 'Enter the percentage off.' : 'Enter the amount off.');
    if (draft.kind === 'percent' && draft.value > 10000) return setError('The percentage off can’t be more than 100%.');
    if (draft.appliesTo !== 'all' && draft.targetIds.length === 0) return setError(draft.appliesTo === 'categories' ? 'Choose at least one category.' : 'Add at least one product.');
    if (draft.startAt !== null && draft.endAt !== null && draft.endAt < draft.startAt) return setError('The end date is before the start date.');
    const body: Omit<Promotion, 'id' | 'createdAt'> = { ...draft, name, description: draft.description.trim() };
    if (existing) updatePromotion(existing.id, body);
    else addPromotion(body);
    back();
  };

  const remove = () => {
    if (existing) deletePromotion(existing.id);
    back();
  };

  const toggleCategory = (cid: string) =>
    set({ targetIds: draft.targetIds.includes(cid) ? draft.targetIds.filter((x) => x !== cid) : [...draft.targetIds, cid] });

  const example = products[0];
  const exampleText =
    example && draft.value > 0
      ? `Example: ${example.name} at ${fmt(example.priceMinor)} would sell for ${fmt(promoPrice({ ...draft, id: '', createdAt: 0 }, example.priceMinor))}.`
      : '';

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to promotions">‹</button>
          <h1 className="page-title">{isNew ? 'Add promotion' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Create a promotion to discount products automatically at the register.' : 'Edit this promotion.'}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="General" hint="How the promotion is named on the register and on receipts.">
          <div className="pe-grid2">
            <Field label="Promotion name"><input className="pe-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. Summer sale" /></Field>
            <Field label="Description" hint="(Optional)" wide>
              <textarea className="pe-input pe-textarea pe-note" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Schedule" hint="Leave the dates blank to run the promotion until you turn it off.">
          <div className="pe-grid2">
            <Field label="Start date and time" hint="(Optional)">
              <input className="pe-input" type="datetime-local" value={toLocalInput(draft.startAt)} onChange={(e) => set({ startAt: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="End date and time" hint="(Optional)">
              <input className="pe-input" type="datetime-local" value={toLocalInput(draft.endAt)} onChange={(e) => set({ endAt: fromLocalInput(e.target.value) })} />
            </Field>
          </div>
          <label className="pe-switchrow">
            <Switch on={draft.active} onClick={() => set({ active: !draft.active })} />
            <span>{draft.active ? 'Promotion is on' : 'Promotion is off'}</span>
          </label>
        </Section>

        <Section title="Discount" hint="What the customer saves on each matching product.">
          <div className="pe-cards">
            {(
              [
                ['percent', 'Percentage off', 'Take a percentage off the retail price.'],
                ['amount', 'Amount off', 'Take a fixed amount off the retail price.'],
                ['fixed', 'Fixed price', 'Sell matching products at a set price.'],
              ] as [PromotionKind, string, string][]
            ).map(([k, title, text]) => (
              <button key={k} type="button" className={`pe-card ${draft.kind === k ? 'active' : ''}`} onClick={() => set({ kind: k, value: 0 })}>
                <b>{title}</b>
                <span>{text}</span>
              </button>
            ))}
          </div>
          <div className="pe-grid2">
            {draft.kind === 'percent' ? (
              <Field label="Percentage off">
                <span className="pe-money">
                  <NumInput value={(draft.value / 100).toFixed(2).replace(/\.?0+$/, '')} onCommit={(t) => set({ value: Math.max(0, Math.round((parseFloat(t) || 0) * 100)) })} />
                  <span>%</span>
                </span>
              </Field>
            ) : (
              <Field label={draft.kind === 'amount' ? 'Amount off' : 'Sale price'}>
                <span className="pe-money"><span>$</span><MoneyInput minor={draft.value} onChange={(v) => set({ value: v })} /></span>
              </Field>
            )}
          </div>
          {exampleText && <div className="pe-hint">{exampleText}</div>}
        </Section>

        <Section title="Applies to" hint="Which products get the discount.">
          <div className="pe-cards">
            {(
              [
                ['all', 'All products', 'Every product in the catalog.'],
                ['categories', 'Categories', 'Products in the categories you choose, including their sub-categories.'],
                ['products', 'Specific products', 'Only the products you add.'],
              ] as [PromotionScope, string, string][]
            ).map(([k, title, text]) => (
              <button key={k} type="button" className={`pe-card ${draft.appliesTo === k ? 'active' : ''}`} onClick={() => set({ appliesTo: k, targetIds: [] })}>
                <b>{title}</b>
                <span>{text}</span>
              </button>
            ))}
          </div>
          {draft.appliesTo === 'categories' && (
            <div className="pe-checklist">
              {sortedCategories(categories).map((c) => (
                <label key={c.id} className="pe-check">
                  <input type="checkbox" checked={draft.targetIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                  <span>{categoryLabel(categories, c.id)}</span>
                </label>
              ))}
              {categories.length === 0 && <div className="pe-empty">No categories yet.</div>}
            </div>
          )}
          {draft.appliesTo === 'products' && (
            <>
              <div className="pe-searchwrap">
                <input className="pe-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products to add" />
                {hits.length > 0 && (
                  <div className="pe-catalog-hits pe-hits">
                    {hits.map((p) => (
                      <button key={p.id} type="button" className="pe-catalog-hit" onClick={() => { set({ targetIds: [...draft.targetIds, p.id] }); setSearch(''); }}>
                        <span>{p.name}</span>
                        <span className="pe-muted">{p.sku} · {fmt(p.priceMinor)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {draft.targetIds.length ? (
                <table className="pe-table pe-lines">
                  <thead><tr><th>Product</th><th>SKU</th><th className="r">Retail price</th><th className="r">Promotion price</th><th /></tr></thead>
                  <tbody>
                    {draft.targetIds.map((pid) => {
                      const p = products.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <tr key={pid}>
                          <td>{p.name}</td>
                          <td className="pe-muted">{p.sku}</td>
                          <td className="r">{fmt(p.priceMinor)}</td>
                          <td className="r">{draft.value > 0 || draft.kind === 'fixed' ? fmt(promoPrice({ ...draft, id: '', createdAt: 0 }, p.priceMinor)) : '—'}</td>
                          <td className="r"><button type="button" className="pe-x" onClick={() => set({ targetIds: draft.targetIds.filter((x) => x !== pid) })} aria-label={`Remove ${p.name}`}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="pe-empty">Search above to add products to this promotion.</div>
              )}
            </>
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
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete promotion</button>
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
