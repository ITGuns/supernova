import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../lib/format';
import { categoryLabel, sortedCategories, useCatalogMeta } from '../store/catalogMetaStore';
import { useCustomers } from '../store/customerStore';
import { useProducts } from '../store/productStore';
import {
  DEFAULT_SCHEDULE,
  promoPrice,
  usePromotions,
  type Promotion,
  type PromotionKind,
  type PromotionSchedule,
  type PromotionScope,
  type PromotionTarget,
} from '../store/promotionStore';
import { useSetup } from '../store/setupStore';
import { Switch } from './controls';
import { Section } from './FormLayout';
import { MoneyInput, NumInput } from './NumInput';
import '../styles/product-editor.css';

// "New promotion" — the same sections as Lightspeed: General, Outlets,
// Schedule promotion (one-time / recurring), Type of promotion (Basic:
// discount % or $ on all or specific products), Target promotion (everyone,
// a customer group or a promo code) and Promotions combination.

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (ms: number | null) => {
  if (ms === null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string): number | null => (s ? new Date(s).getTime() : null);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Draft = Omit<Promotion, 'id' | 'createdAt'>;

export function PromotionEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const promotions = usePromotions((s) => s.promotions);
  const addPromotion = usePromotions((s) => s.addPromotion);
  const updatePromotion = usePromotions((s) => s.updatePromotion);
  const deletePromotion = usePromotions((s) => s.deletePromotion);
  const categories = useCatalogMeta((s) => s.categories);
  const products = useProducts((s) => s.products);
  const groups = useCustomers((s) => s.groups);
  const outlets = useSetup((s) => s.outlets);

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
    target: existing?.target ?? 'everyone',
    customerGroups: existing?.customerGroups ?? [],
    promoCode: existing?.promoCode ?? '',
    outlets: existing?.outlets ?? [],
    schedule: existing?.schedule ?? { ...DEFAULT_SCHEDULE },
    earnLoyalty: existing?.earnLoyalty ?? true,
  }));
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };
  const setSchedule = (patch: Partial<PromotionSchedule>) => set({ schedule: { ...draft.schedule, ...patch } });

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
    if (draft.target === 'group' && draft.customerGroups.length === 0) return setError('Choose at least one customer group.');
    if (draft.target === 'code' && !draft.promoCode.trim()) return setError('Enter the promo code customers will use.');
    if (draft.schedule.kind === 'recurring' && draft.schedule.days.length === 0) return setError('Choose the days the promotion repeats on.');
    const body: Draft = { ...draft, name, description: draft.description.trim(), promoCode: draft.promoCode.trim().toUpperCase().replace(/\s+/g, '') };
    if (existing) updatePromotion(existing.id, body);
    else addPromotion(body);
    back();
  };

  const remove = () => {
    if (existing) deletePromotion(existing.id);
    back();
  };

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const example = products[0];
  const asPromotion: Promotion = { ...draft, id: existing?.id ?? '', createdAt: existing?.createdAt ?? 0 };
  const exampleText = example && (draft.value > 0 || draft.kind === 'fixed') ? `Example: ${example.name} at ${fmt(example.priceMinor)} would sell for ${fmt(promoPrice(asPromotion, example.priceMinor))}.` : '';

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to promotions">‹</button>
          <h1 className="page-title">{isNew ? 'New promotion' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>Set special offers and discounts for your customers.</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="General" hint="Name the promotion">
          <div className="pe-grid2">
            <div>
              <label className="pe-field">
                <span className="pe-label">Promotion name</span>
                <input className="pe-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
              </label>
              <label className="pe-field">
                <span className="pe-label">Promotion description</span>
                <textarea className="pe-input pe-textarea pe-note" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Provide a short description to explain this promotion" />
              </label>
              <div className="pe-hint">The name and description are shown to employees and customers to explain the promotion.</div>
            </div>
            <div className="pe-promo-preview">
              <div className="pe-caps">Preview</div>
              <b>{draft.name || 'Promotion name'}</b>
              <span>{draft.description || 'Provide a short description to explain this promotion'}</span>
            </div>
          </div>
        </Section>

        <Section title="Outlets" hint="Choose which outlets run this promotion. Outlets added later are included when all outlets are selected.">
          <label className="pe-check">
            <input type="checkbox" checked={draft.outlets.length === 0} onChange={() => set({ outlets: [] })} />
            <span>All outlets</span>
          </label>
          {outlets.map((o) => (
            <label key={o.id} className="pe-check">
              <input type="checkbox" checked={draft.outlets.length === 0 || draft.outlets.includes(o.name)} onChange={() => set({ outlets: draft.outlets.length === 0 ? outlets.map((x) => x.name).filter((n) => n !== o.name) : toggleIn(draft.outlets, o.name) })} />
              <span>{o.name}</span>
            </label>
          ))}
        </Section>

        <Section title="Schedule promotion" hint="Choose when the promotion happens">
          <div className="pe-cards two">
            <button type="button" className={`pe-card ${draft.schedule.kind === 'once' ? 'active' : ''}`} onClick={() => setSchedule({ kind: 'once' })}>
              <b>One-time promotion</b>
              <span>This promotion happens over a set period of time.</span>
            </button>
            <button type="button" className={`pe-card ${draft.schedule.kind === 'recurring' ? 'active' : ''}`} onClick={() => setSchedule({ kind: 'recurring' })}>
              <b>Recurring promotion</b>
              <span>This promotion repeats weekly.</span>
            </button>
          </div>
          <div className="pe-grid2">
            <label className="pe-field">
              <span className="pe-label">Date <span className="pe-hint">Start date and time (leave blank to start now)</span></span>
              <input className="pe-input" type="datetime-local" value={toLocalInput(draft.startAt)} onChange={(e) => set({ startAt: fromLocalInput(e.target.value) })} />
            </label>
            <label className="pe-field">
              <span className="pe-label">End <span className="pe-hint">(Optional) Leave blank to run until you turn it off</span></span>
              <input className="pe-input" type="datetime-local" value={toLocalInput(draft.endAt)} onChange={(e) => set({ endAt: fromLocalInput(e.target.value) })} />
            </label>
          </div>
          {draft.schedule.kind === 'recurring' && (
            <div className="pe-recurring">
              <div className="pe-label">Repeats on</div>
              <div className="pe-days">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" className={`pe-day ${draft.schedule.days.includes(i) ? 'active' : ''}`} onClick={() => setSchedule({ days: toggleIn(draft.schedule.days.map(String), String(i)).map(Number) })}>{d}</button>
                ))}
              </div>
              <label className="pe-switchrow">
                <Switch on={draft.schedule.allDay} onClick={() => setSchedule({ allDay: !draft.schedule.allDay })} />
                <span>All day</span>
              </label>
              {!draft.schedule.allDay && (
                <div className="pe-inline">
                  <input className="pe-input" type="time" value={draft.schedule.from} onChange={(e) => setSchedule({ from: e.target.value })} />
                  <span>to</span>
                  <input className="pe-input" type="time" value={draft.schedule.to} onChange={(e) => setSchedule({ to: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <label className="pe-switchrow pe-gap">
            <Switch on={draft.active} onClick={() => set({ active: !draft.active })} />
            <span>{draft.active ? 'Promotion is on' : 'Promotion is off'}</span>
          </label>
        </Section>

        <Section title="Type of promotion" hint="Choose a type of promotion to run">
          <div className="pe-cards two">
            <button type="button" className="pe-card active">
              <b>Basic</b>
              <span>Offer customers a discount.</span>
            </button>
            <button type="button" className="pe-card" disabled title="Advanced promotions (buy X get Y, spend thresholds) aren't available yet">
              <b>Advanced</b>
              <span>Offer customers a discount or gift based on what they buy or how much they spend.</span>
            </button>
          </div>
          <div className="pe-label">Get</div>
          <div className="pe-inline pe-gap">
            <span className="pe-seg" role="group" aria-label="Discount type">
              {(
                [
                  ['percent', '%'],
                  ['amount', '$'],
                  ['fixed', 'Fixed price'],
                ] as [PromotionKind, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" className={draft.kind === k ? 'active' : ''} onClick={() => set({ kind: k, value: 0 })}>{label}</button>
              ))}
            </span>
            {draft.kind === 'percent' ? (
              <span className="pe-money"><NumInput className="pe-input pe-cost" value={(draft.value / 100).toFixed(2).replace(/\.?0+$/, '')} onCommit={(t) => set({ value: Math.max(0, Math.round((parseFloat(t) || 0) * 100)) })} /><span>% Discount</span></span>
            ) : (
              <span className="pe-money"><span>$</span><MoneyInput className="pe-input pe-cost" minor={draft.value} onChange={(v) => set({ value: v })} /><span>{draft.kind === 'amount' ? 'Discount' : 'Sale price'}</span></span>
            )}
          </div>
          {exampleText && <div className="pe-hint">{exampleText}</div>}
          <div className="pe-label pe-gap">Product</div>
          <div className="pe-cards">
            {(
              [
                ['all', 'All', 'Every product in the catalog.'],
                ['categories', 'Specific categories', 'Products in the categories you choose, including sub-categories.'],
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
                  <input type="checkbox" checked={draft.targetIds.includes(c.id)} onChange={() => set({ targetIds: toggleIn(draft.targetIds, c.id) })} />
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
                          <td className="r">{draft.value > 0 || draft.kind === 'fixed' ? fmt(promoPrice(asPromotion, p.priceMinor)) : '—'}</td>
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

        <Section title="Target promotion" hint="Allow all customers to receive this promotion or target specific groups">
          <div className="pe-cards two">
            <button type="button" className={`pe-card ${draft.target === 'everyone' ? 'active' : ''}`} onClick={() => set({ target: 'everyone' })}>
              <b>Available to everyone</b>
              <span>All customers can receive this promotion.</span>
            </button>
            <button type="button" className={`pe-card ${draft.target !== 'everyone' ? 'active' : ''}`} onClick={() => set({ target: draft.target === 'everyone' ? 'group' : draft.target })}>
              <b>Exclusive to some</b>
              <span>Only customers within a customer group or with a promo code can redeem this promotion.</span>
            </button>
          </div>
          {draft.target !== 'everyone' && (
            <div className="pe-grid2">
              <div>
                <div className="pe-label">Redeem with</div>
                <span className="pe-seg" role="group" aria-label="Exclusive to">
                  {(
                    [
                      ['group', 'Customer group'],
                      ['code', 'Promo code'],
                    ] as [PromotionTarget, string][]
                  ).map(([k, label]) => (
                    <button key={k} type="button" className={draft.target === k ? 'active' : ''} onClick={() => set({ target: k })}>{label}</button>
                  ))}
                </span>
              </div>
              {draft.target === 'group' ? (
                <div>
                  <div className="pe-label">Customer groups</div>
                  {groups.map((g) => (
                    <label key={g} className="pe-check">
                      <input type="checkbox" checked={draft.customerGroups.includes(g)} onChange={() => set({ customerGroups: toggleIn(draft.customerGroups, g) })} />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <label className="pe-field">
                  <span className="pe-label">Promo code <span className="pe-hint">Not case-sensitive, no spaces</span></span>
                  <input className="pe-input" value={draft.promoCode} onChange={(e) => set({ promoCode: e.target.value.toUpperCase().replace(/\s+/g, '') })} placeholder="e.g. SUMMER10" />
                </label>
              )}
            </div>
          )}
        </Section>

        <Section title="Promotions combination" hint="Choose whether to combine this promotion with Loyalty rewards and online discount coupons">
          <label className="pe-switchrow">
            <Switch on={draft.earnLoyalty} onClick={() => set({ earnLoyalty: !draft.earnLoyalty })} />
            <span>Customers can earn Loyalty rewards with this promotion</span>
          </label>
        </Section>

        <div className="pe-foot">
          {existing ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>Delete “{existing.name}”? This removes it from your records permanently.</span>
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
