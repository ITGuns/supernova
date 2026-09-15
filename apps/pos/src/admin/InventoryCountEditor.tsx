import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryLabel, sortedCategories, useCatalogMeta } from '../store/catalogMetaStore';
import { countLinesFor, productInCount, useInventory, type CountFilter, type CountType } from '../store/inventoryStore';
import { useProducts } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { useProductTags } from '../store/tagStore';
import { Switch } from './controls';
import { Field, Section } from './FormLayout';
import '../styles/product-editor.css';

// Full-page "Add inventory count": schedule a full or partial count, then
// save it for later or start counting straight away.

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Now, rounded up to the next quarter hour — the default start time. */
const nextQuarter = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return d;
};

const startAtOf = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`).getTime();

/** "Main Outlet - Sep 15, 2026, 9:00 PM" */
export const countNameFor = (outlet: string, startAt: number) =>
  `${outlet} - ${new Date(startAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

const FILTER_LABEL: Record<CountFilter['kind'], string> = {
  supplier: 'Supplier',
  brand: 'Brand',
  category: 'Category',
  tag: 'Tag',
  sku: 'SKU',
};

export function InventoryCountEditor() {
  const nav = useNavigate();
  const addCount = useInventory((s) => s.addCount);
  const products = useProducts((s) => s.products);
  const categories = useCatalogMeta((s) => s.categories);
  const brands = useCatalogMeta((s) => s.brands);
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const tags = useProductTags((s) => s.tags);
  const outlets = useSetup((s) => s.outlets);
  const outletNames = outlets.map((o) => o.name);

  const [date, setDate] = useState(() => isoDate(nextQuarter()));
  const [time, setTime] = useState(() => isoTime(nextQuarter()));
  const [outlet, setOutlet] = useState(outletNames[0] ?? 'Main Outlet');
  const [nameEdited, setNameEdited] = useState(false);
  const [customName, setCustomName] = useState('');
  const [countType, setCountType] = useState<CountType>('partial');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filters, setFilters] = useState<CountFilter[]>([]);
  const [filterQ, setFilterQ] = useState('');
  const [error, setError] = useState('');

  const startAt = startAtOf(date, time);
  const autoName = countNameFor(outlet, Number.isFinite(startAt) ? startAt : Date.now());
  const name = nameEdited ? customName : autoName;

  const spec = { countType, includeInactive, filters };
  const matched = useMemo(() => products.filter((p) => productInCount(p, spec, categories)), [products, countType, includeInactive, filters, categories]);
  const inactiveCount = products.filter((p) => !p.enabled).length;

  // Filter suggestions: every supplier / brand / category / tag / SKU that
  // matches the typed text and isn't already a chip.
  const suggestions = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return [];
    const has = (f: CountFilter) => filters.some((x) => x.kind === f.kind && x.value.toLowerCase() === f.value.toLowerCase());
    const out: CountFilter[] = [];
    const push = (f: CountFilter) => {
      if (!has(f) && f.label.toLowerCase().includes(q)) out.push(f);
    };
    suppliers.forEach((s) => push({ kind: 'supplier', value: s.name, label: s.name }));
    brands.forEach((b) => push({ kind: 'brand', value: b.name, label: b.name }));
    sortedCategories(categories).forEach((c) => push({ kind: 'category', value: c.id, label: categoryLabel(categories, c.id) }));
    tags.forEach((t) => push({ kind: 'tag', value: t.name, label: t.name }));
    const skus = new Set<string>();
    products.forEach((p) => [p.sku, ...(p.skuCodes ?? []).map((c) => c.code)].forEach((s) => s && skus.add(s)));
    [...skus].forEach((s) => push({ kind: 'sku', value: s, label: s }));
    return out.slice(0, 10);
  }, [filterQ, filters, suppliers, brands, categories, tags, products]);

  const addFilter = (f: CountFilter) => {
    setFilters((fs) => [...fs, f]);
    setFilterQ('');
    setError('');
  };
  const removeFilter = (i: number) => setFilters((fs) => fs.filter((_, fi) => fi !== i));

  const back = () => nav('/inventory', { state: { tab: 'counts' } });

  const build = () => {
    if (!name.trim()) {
      setError('Give the count a name.');
      return null;
    }
    if (!Number.isFinite(startAt)) {
      setError('Choose a start date and time.');
      return null;
    }
    if (countType === 'partial' && !filters.length) {
      setError('Add at least one filter, or choose a full count.');
      return null;
    }
    return { name: name.trim(), outlet, startAt, countType, includeInactive, filters, completedAt: null };
  };

  const saveAndExit = () => {
    const c = build();
    if (!c) return;
    addCount({ ...c, status: 'Planned', lines: [] });
    back();
  };

  const startNow = () => {
    const c = build();
    if (!c) return;
    const created = addCount({ ...c, startAt: Math.min(c.startAt, Date.now()), status: 'In progress', lines: countLinesFor(products, c, categories) });
    nav(`/inventory/counts/${created.id}`);
  };

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to inventory counts">‹</button>
          <h1 className="page-title">Add inventory count</h1>
        </div>
        <div className="pe-subbar">
          <span>Schedule a full or partial inventory count to maintain accurate inventory levels.</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={saveAndExit}>Save and exit</button>
            <button className="btn-p" onClick={startNow}>Start count</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="General" hint="Choose when the count starts, which outlet it's for and what to call it.">
          <div className="pe-grid2">
            <Field label="Start date">
              <input className="pe-input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(''); }} />
            </Field>
            <Field label="Start time">
              <input className="pe-input" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(''); }} />
            </Field>
            <Field label="Outlet">
              <select className="pe-input" value={outlet} onChange={(e) => setOutlet(e.target.value)}>
                {outletNames.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Count name">
              <input
                className="pe-input"
                value={name}
                onChange={(e) => {
                  setNameEdited(true);
                  setCustomName(e.target.value);
                  setError('');
                }}
              />
            </Field>
          </div>
        </Section>

        <Section title="Choose products to count" hint="Count a filtered set of products, or everything at this outlet.">
          <div className="pe-cards two">
            <button type="button" className={`pe-card ${countType === 'partial' ? 'active' : ''}`} onClick={() => setCountType('partial')}>
              <b>Partial count</b>
              <span>Count products by supplier, brand, category, tag or SKU.</span>
            </button>
            <button type="button" className={`pe-card ${countType === 'full' ? 'active' : ''}`} onClick={() => setCountType('full')}>
              <b>Full count</b>
              <span>Count every product at this outlet.</span>
            </button>
          </div>

          <div className="pe-countinfo">
            <span>
              <b>{matched.length}</b> product{matched.length === 1 ? '' : 's'} will be counted
              {includeInactive ? ', including inactive products' : ', excluding inactive products'}
            </span>
            <label className="pe-switchrow">
              <span>Include inactive products.{inactiveCount ? ` (${inactiveCount})` : ''}</span>
              <Switch on={includeInactive} onClick={() => setIncludeInactive((v) => !v)} />
            </label>
          </div>

          {countType === 'partial' && (
            <>
              <div className="pe-searchwrap">
                <input
                  className="pe-input"
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && suggestions[0]) {
                      e.preventDefault();
                      addFilter(suggestions[0]);
                    }
                  }}
                  placeholder="Search for suppliers, brands, categories, tags or SKUs…"
                />
                {suggestions.length > 0 && (
                  <div className="pe-catalog-hits pe-hits">
                    {suggestions.map((f) => (
                      <button key={`${f.kind}:${f.value}`} type="button" className="pe-catalog-hit" onClick={() => addFilter(f)}>
                        <span>{f.label}</span>
                        <span className="pe-muted">{FILTER_LABEL[f.kind]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {filters.length ? (
                <div className="pe-tags pe-gap">
                  {filters.map((f, i) => (
                    <span key={`${f.kind}:${f.value}`} className="pe-tag">
                      <span className="pe-muted">{FILTER_LABEL[f.kind]}:</span> {f.label}
                      <button type="button" onClick={() => removeFilter(i)} aria-label={`Remove ${f.label}`}>×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="pe-empty">Use filters to include products in this count</div>
              )}
            </>
          )}
        </Section>

        <div className="pe-foot">
          <span />
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-s" onClick={saveAndExit}>Save and exit</button>
            <button className="btn-p" onClick={startNow}>Start count</button>
          </span>
        </div>
      </div>
    </main>
  );
}
