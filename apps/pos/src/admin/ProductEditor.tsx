import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../lib/format';
import { categoryLabel, sortedCategories, useCatalogMeta } from '../store/catalogMetaStore';
import { tagKey, useProductTags } from '../store/tagStore';
import {
  EMPTY_SHIPPING,
  availableOf,
  useProducts,
  type Product,
  type ProductRef,
  type ProductShipping,
  type ProductSupplier,
  type ReplenishMethod,
  type SkuCode,
  type SkuCodeType,
} from '../store/productStore';
import { useSettings } from '../store/settingsStore';
import { useSetup } from '../store/setupStore';
import { Field, Section } from './FormLayout';
import '../styles/product-editor.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (minor: number) => (minor / 100).toFixed(2);
const toMinor = (s: string) => Math.max(0, Math.round((parseFloat(s) || 0) * 100));
const pct = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(2) : '0.00');

const SKU_TYPES: { value: SkuCodeType; label: string }[] = [
  { value: 'auto', label: 'Auto-generated' },
  { value: 'custom', label: 'Custom' },
  { value: 'upc', label: 'UPC' },
  { value: 'ean', label: 'EAN' },
  { value: 'manufacturer', label: 'Manufacturer' },
];

/** Next number in the store's SKU-#### sequence. */
const nextSkuNumber = (products: Product[]): number =>
  products.reduce((max, p) => {
    for (const s of [p.sku, ...(p.skuCodes ?? []).map((c) => c.code)]) {
      const n = parseInt(s.replace(/^SKU-/i, ''), 10);
      if (/^SKU-\d+$/i.test(s) && n > max) max = n;
    }
    return max;
  }, 1000) + 1;

/** Cartesian product of attribute value lists → one combination per variant. */
const combinations = (attrs: { name: string; values: string[] }[]): { name: string; value: string }[][] => {
  const live = attrs.filter((a) => a.name.trim() && a.values.length);
  if (!live.length) return [];
  return live.reduce<{ name: string; value: string }[][]>(
    (acc, a) => acc.flatMap((combo) => a.values.map((v) => [...combo, { name: a.name.trim(), value: v }])),
    [[]],
  );
};

// The editable draft — a Product plus editor-only variant scaffolding.
interface Draft {
  name: string;
  brand: string;
  description: string;
  tags: string[];
  categoryId: string;
  sellOnPos: boolean;
  images: string[];
  productType: Product['productType'];
  attributes: { name: string; values: string[] }[];
  /** Per generated variant overrides: key = joined values. */
  variantRows: Record<string, { sku: string; priceMinor: number; available: number }>;
  components: ProductRef[];
  skuCodes: SkuCode[];
  suppliers: ProductSupplier[];
  taxId: string;
  supplierPriceMinor: number;
  priceMinor: number;
  trackInventory: boolean;
  replenishMethod: ReplenishMethod;
  available: number;
  minQty: string;
  maxQty: string;
  reorderPoint: string;
  reorderQty: string;
  location: string;
  comesFrom: ProductRef[];
  breaksInto: ProductRef[];
  shipping: ProductShipping;
  enabled: boolean;
}

const blankDraft = (products: Product[], categoryId: string, brand: string, supplier: string, taxId: string): Draft => ({
  name: '',
  brand,
  description: '',
  tags: [],
  categoryId,
  sellOnPos: true,
  images: [],
  productType: 'standard',
  attributes: [{ name: '', values: [] }],
  variantRows: {},
  components: [],
  skuCodes: [{ type: 'auto', code: `SKU-${nextSkuNumber(products)}` }],
  suppliers: [{ supplier, code: '', priceMinor: 0 }],
  taxId,
  supplierPriceMinor: 0,
  priceMinor: 0,
  trackInventory: true,
  replenishMethod: 'minmax',
  available: 0,
  minQty: '',
  maxQty: '',
  reorderPoint: '',
  reorderQty: '',
  location: '',
  comesFrom: [],
  breaksInto: [],
  shipping: { ...EMPTY_SHIPPING },
  enabled: true,
});

const draftFrom = (p: Product): Draft => ({
  name: p.name,
  brand: p.brand,
  description: p.description ?? '',
  tags: p.tags ?? [],
  categoryId: p.categoryId,
  sellOnPos: p.sellOnPos ?? true,
  images: p.images?.length ? p.images : p.image ? [p.image] : [],
  productType: p.productType ?? 'standard',
  attributes: (p.attributes ?? []).map((a) => ({ name: a.name, values: [a.value] })),
  variantRows: {},
  components: p.components ?? [],
  skuCodes: p.skuCodes?.length ? p.skuCodes : [{ type: 'custom', code: p.sku }],
  suppliers: p.suppliers?.length ? p.suppliers : [{ supplier: p.supplier, code: '', priceMinor: p.supplierPriceMinor ?? 0 }],
  taxId: p.taxId ?? '',
  supplierPriceMinor: p.supplierPriceMinor ?? 0,
  priceMinor: p.priceMinor,
  trackInventory: p.trackInventory ?? true,
  replenishMethod: p.replenishMethod ?? 'minmax',
  available: p.available,
  minQty: p.minQty == null ? '' : String(p.minQty),
  maxQty: p.maxQty == null ? '' : String(p.maxQty),
  reorderPoint: p.reorderPoint == null ? '' : String(p.reorderPoint),
  reorderQty: p.reorderQty == null ? '' : String(p.reorderQty),
  location: p.location ?? '',
  comesFrom: p.comesFrom ?? [],
  breaksInto: p.breaksInto ?? [],
  shipping: { ...EMPTY_SHIPPING, ...(p.shipping ?? {}) },
  enabled: p.enabled,
});

const intOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, parseInt(s, 10) || 0));

// ── Small building blocks ────────────────────────────────────────────────────

function ProductPicker({
  products,
  exclude,
  value,
  onChange,
}: {
  products: Product[];
  exclude: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select className="pe-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a product</option>
      {products
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.sku}
          </option>
        ))}
    </select>
  );
}

function RefList({
  rows,
  products,
  exclude,
  onChange,
  addLabel,
}: {
  rows: ProductRef[];
  products: Product[];
  exclude: string;
  onChange: (rows: ProductRef[]) => void;
  addLabel: string;
}) {
  return (
    <div className="pe-reflist">
      {rows.map((r, i) => (
        <div key={i} className="pe-refrow">
          <ProductPicker products={products} exclude={exclude} value={r.productId} onChange={(id) => onChange(rows.map((x, j) => (j === i ? { ...x, productId: id } : x)))} />
          <input
            className="pe-input pe-qty"
            type="number"
            min={1}
            value={r.quantity}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) } : x)))}
          />
          <button type="button" className="pe-x" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="rlink pe-add" onClick={() => onChange([...rows, { productId: '', quantity: 1 }])}>
        ＋ {addLabel}
      </button>
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

export function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const products = useProducts((s) => s.products);
  const addProduct = useProducts((s) => s.addProduct);
  const updateProduct = useProducts((s) => s.updateProduct);
  const deleteProduct = useProducts((s) => s.deleteProduct);
  const categories = useCatalogMeta((s) => s.categories);
  const brands = useCatalogMeta((s) => s.brands);
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const addEntity = useCatalogMeta((s) => s.addEntity);
  const knownTags = useProductTags((s) => s.tags);
  const ensureTags = useProductTags((s) => s.ensureTags);
  const taxes = useSettings((s) => s.taxes);
  const defaultTaxLabel = useSettings((s) => s.defaultTaxLabel);
  const outlets = useSetup((s) => s.outlets);

  const existing = id ? products.find((p) => p.id === id) : undefined;
  const isNew = !existing;
  const defaultTaxId = taxes.find((t) => t.label === defaultTaxLabel)?.id ?? taxes[0]?.id ?? '';

  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? draftFrom(existing)
      : blankDraft(products, categories[0]?.id ?? 'general', brands[0]?.name ?? '', suppliers[0]?.name ?? '', defaultTaxId),
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const [tab, setTab] = useState<'general' | 'shipping'>('general');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const commitTag = () => {
    const typed = tagInput.trim().replace(/,$/, '').trim();
    if (!typed) return;
    const known = knownTags.find((t) => tagKey(t.name) === tagKey(typed));
    const t = known ? known.name : typed;
    if (!draft.tags.some((x) => tagKey(x) === tagKey(t))) set({ tags: [...draft.tags, t] });
    setTagInput('');
  };
  const [newBrand, setNewBrand] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Product not found</h1>
          <button className="btn-s" onClick={() => nav('/catalog')}>Back to products</button>
        </div>
      </main>
    );
  }

  // ── Derived: price math ────────────────────────────────────────────────
  const tax = taxes.find((t) => t.id === draft.taxId);
  const taxRate = (tax?.rateBps ?? 0) / 10000;
  const cost = draft.supplierPriceMinor;
  const retailEx = draft.priceMinor;
  const markup = cost > 0 ? retailEx / cost - 1 : 0;
  const margin = retailEx > 0 ? (retailEx - cost) / retailEx : 0;
  const taxMinor = Math.round(retailEx * taxRate);
  const retailInc = retailEx + taxMinor;

  const setMarkup = (s: string) => set({ priceMinor: Math.round(cost * (1 + (parseFloat(s) || 0) / 100)) });
  const setMargin = (s: string) => {
    const m = Math.min(0.9999, (parseFloat(s) || 0) / 100);
    set({ priceMinor: Math.round(cost / (1 - m)) });
  };
  const setRetailInc = (s: string) => set({ priceMinor: Math.round(toMinor(s) / (1 + taxRate)) });

  // A supplier's default markup (Catalog → Suppliers) fills in the retail
  // price the first time a cost is known, so products aren't priced from zero.
  const markupFrom = (supplierName: string, costMinor: number, retailMinor: number): Partial<Draft> => {
    const bps = suppliers.find((x) => x.name === supplierName)?.details?.defaultMarkupBps ?? 0;
    return retailMinor === 0 && costMinor > 0 && bps > 0 ? { priceMinor: Math.round(costMinor * (1 + bps / 10000)) } : {};
  };

  // ── Derived: variants ──────────────────────────────────────────────────
  const combos = useMemo(() => combinations(draft.attributes), [draft.attributes]);
  const variantKey = (combo: { value: string }[]) => combo.map((c) => c.value).join(' / ');
  const variantRow = (combo: { value: string }[], i: number) =>
    draft.variantRows[variantKey(combo)] ?? {
      sku: `SKU-${nextSkuNumber(products) + i}`,
      priceMinor: draft.priceMinor,
      available: draft.available,
    };

  // ── Derived: catalog search (start from an existing product) ───────────
  const catalogHits = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 6);
  }, [catalogQuery, products]);
  const prefillFrom = (p: Product) => {
    const d = draftFrom(p);
    set({ ...d, name: p.name, skuCodes: [{ type: 'auto', code: `SKU-${nextSkuNumber(products)}` }], available: 0, images: [] });
    setCatalogQuery('');
  };

  // ── Images ─────────────────────────────────────────────────────────────
  const onPickImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setDraft((d) => ({ ...d, images: [...d.images, reader.result as string] }));
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const primarySku = draft.skuCodes[0]?.code.trim() || `SKU-${nextSkuNumber(products)}`;
  const base = (): Omit<Product, 'id' | 'productId' | 'sku' | 'name' | 'attributes' | 'available' | 'priceMinor' | 'variants'> => ({
    categoryId: draft.categoryId,
    taxGroupId: 'standard',
    emoji: '📦',
    enabled: draft.enabled,
    created: existing?.created ?? 'Today',
    brand: draft.brand,
    supplier: draft.suppliers[0]?.supplier ?? '',
    image: draft.images[0],
    images: draft.images,
    description: draft.description.trim(),
    tags: draft.tags,
    sellOnPos: draft.sellOnPos,
    productType: draft.productType,
    skuCodes: draft.skuCodes.filter((c) => c.code.trim()),
    suppliers: draft.suppliers.filter((s) => s.supplier),
    taxId: draft.taxId,
    supplierPriceMinor: draft.supplierPriceMinor,
    trackInventory: draft.trackInventory,
    replenishMethod: draft.replenishMethod,
    minQty: intOrNull(draft.minQty),
    maxQty: intOrNull(draft.maxQty),
    reorderPoint: intOrNull(draft.reorderPoint),
    reorderQty: intOrNull(draft.reorderQty),
    location: draft.location.trim(),
    components: draft.productType === 'composite' ? draft.components.filter((c) => c.productId) : [],
    comesFrom: draft.comesFrom.filter((c) => c.productId),
    breaksInto: draft.breaksInto.filter((c) => c.productId),
    shipping: draft.shipping,
  });

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Give the product a name.');
      return;
    }
    if (draft.productType === 'composite' && !draft.components.some((c) => c.productId)) {
      setError('A composite product needs at least one component.');
      return;
    }
    const common = base();
    ensureTags(draft.tags);

    if (existing) {
      updateProduct(existing.id, {
        ...common,
        name,
        sku: primarySku,
        priceMinor: draft.priceMinor,
        available: draft.available,
        attributes: existing.attributes,
      });
      nav('/catalog');
      return;
    }

    if (draft.productType === 'variant' && combos.length) {
      // One sellable product per combination, sharing a productId so the
      // catalog can show them as a family.
      const familyId = `p-${Date.now()}`;
      combos.forEach((combo, i) => {
        const row = variantRow(combo, i);
        addProduct({
          ...common,
          id: `${familyId}-${i + 1}`,
          productId: familyId,
          name: `${name} / ${variantKey(combo)}`,
          sku: row.sku.trim() || `SKU-${nextSkuNumber(products) + i}`,
          priceMinor: row.priceMinor,
          available: row.available,
          attributes: combo,
          variants: combos.length,
        });
      });
      nav('/catalog');
      return;
    }

    const pid = `p-${Date.now()}`;
    addProduct({
      ...common,
      id: pid,
      productId: pid,
      name,
      sku: primarySku,
      priceMinor: draft.priceMinor,
      available: draft.productType === 'composite' ? 0 : draft.available,
      attributes: [],
      variants: 0,
    });
    nav('/catalog');
  };

  const remove = () => {
    if (existing) deleteProduct(existing.id);
    nav('/catalog');
  };

  const compositeAvailable =
    draft.productType === 'composite'
      ? availableOf({ ...(existing ?? ({} as Product)), productType: 'composite', components: draft.components, available: 0 } as Product, products)
      : null;

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={() => nav('/catalog')} aria-label="Back to products">‹</button>
          <h1 className="page-title">{isNew ? 'New product' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>Add, view and edit your products all in one place. <span className="rlink">Need help?</span></span>
          <span className="pe-actions">
            <button className="btn-s" onClick={() => nav('/catalog')}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <div className="pe-tabs">
          <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>General</button>
          <button className={tab === 'shipping' ? 'active' : ''} onClick={() => setTab('shipping')}>Shipping and delivery</button>
        </div>

        {tab === 'shipping' ? (
          <Section title="Shipping and delivery" hint="Used for shipping quotes and packing slips on online and delivery orders.">
            <div className="pe-grid4">
              <Field label="Weight (g)"><input className="pe-input" type="number" min={0} value={draft.shipping.weightG || ''} onChange={(e) => set({ shipping: { ...draft.shipping, weightG: parseFloat(e.target.value) || 0 } })} placeholder="0" /></Field>
              <Field label="Length (cm)"><input className="pe-input" type="number" min={0} value={draft.shipping.lengthCm || ''} onChange={(e) => set({ shipping: { ...draft.shipping, lengthCm: parseFloat(e.target.value) || 0 } })} placeholder="0" /></Field>
              <Field label="Width (cm)"><input className="pe-input" type="number" min={0} value={draft.shipping.widthCm || ''} onChange={(e) => set({ shipping: { ...draft.shipping, widthCm: parseFloat(e.target.value) || 0 } })} placeholder="0" /></Field>
              <Field label="Height (cm)"><input className="pe-input" type="number" min={0} value={draft.shipping.heightCm || ''} onChange={(e) => set({ shipping: { ...draft.shipping, heightCm: parseFloat(e.target.value) || 0 } })} placeholder="0" /></Field>
            </div>
            <Field label="Delivery notes" wide>
              <textarea className="pe-input pe-textarea" value={draft.shipping.notes} onChange={(e) => set({ shipping: { ...draft.shipping, notes: e.target.value } })} placeholder="Fragile, keep upright, requires signature…" />
            </Field>
          </Section>
        ) : (
          <>
            {isNew && (
              <div className="pe-catalog">
                <div className="pe-catalog-ic">◎</div>
                <div className="pe-catalog-body">
                  <b>Search your catalog to start from an existing product</b>, so you can add similar items without re-entering every detail.
                  <div className="pe-catalog-sub">For the most accurate results, try a product name or SKU.</div>
                  <label className="pe-label">Search the catalog</label>
                  <input className="pe-input" value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Enter a product name, SKU or code" />
                  {catalogHits.length > 0 && (
                    <div className="pe-catalog-hits">
                      {catalogHits.map((p) => (
                        <button type="button" key={p.id} className="pe-catalog-hit" onClick={() => prefillFrom(p)}>
                          <span>{p.name}</span>
                          <span className="prod-sku">{p.sku} · {fmt(p.priceMinor)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Section title="General information" hint="General information about this product.">
              <div className="pe-grid2">
                <Field label="Name">
                  <input className="pe-input" value={draft.name} onChange={(e) => { set({ name: e.target.value }); setError(''); }} placeholder="Enter a product name" autoFocus />
                </Field>
                <Field label="Brand">
                  {newBrand === null ? (
                    <select className="pe-input" value={draft.brand} onChange={(e) => (e.target.value === '__new' ? setNewBrand('') : set({ brand: e.target.value }))}>
                      {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                      <option value="__new">＋ Add a new brand…</option>
                    </select>
                  ) : (
                    <span className="pe-inline">
                      <input className="pe-input" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Brand name" autoFocus />
                      <button type="button" className="btn-p" onClick={() => { const n = newBrand.trim(); if (n) { addEntity('brands', n); set({ brand: n }); } setNewBrand(null); }}>Add</button>
                      <button type="button" className="btn-s" onClick={() => setNewBrand(null)}>Cancel</button>
                    </span>
                  )}
                </Field>
              </div>
              <Field label="Description" wide>
                <textarea className="pe-input pe-textarea" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the product for staff and online shoppers" />
              </Field>
              <Field label="Tags" hint="Describe the product using keywords for easy filtering" wide>
                <div className="pe-tags">
                  {draft.tags.map((t) => (
                    <span key={t} className="pe-tag">
                      {t}
                      <button type="button" onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`}>×</button>
                    </span>
                  ))}
                  <input
                    className="pe-input pe-taginput"
                    value={tagInput}
                    placeholder="Enter a tag name"
                    list="pe-tag-options"
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                        e.preventDefault();
                        commitTag();
                      }
                    }}
                    onBlur={commitTag}
                  />
                  <datalist id="pe-tag-options">
                    {knownTags
                      .filter((t) => !draft.tags.some((x) => tagKey(x) === tagKey(t.name)))
                      .map((t) => <option key={t.id} value={t.name} />)}
                  </datalist>
                </div>
              </Field>
              <Field label="Product category" hint="Use category levels to filter your sales and inventory reports" wide>
                <select className="pe-input" value={draft.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  {sortedCategories(categories).map((c) => <option key={c.id} value={c.id}>{categoryLabel(categories, c.id)}</option>)}
                </select>
              </Field>
              <label className="pe-check">
                <input type="checkbox" checked={draft.sellOnPos} onChange={(e) => set({ sellOnPos: e.target.checked, enabled: e.target.checked })} />
                <span><b>Sell on point-of-sale</b><br /><span className="pe-hint">Make this product active and available for sale in-store.</span></span>
              </label>
              <div className="pe-label">Upload images <span className="pe-hint">Drag to rearrange, drop an image outside the upload area to delete.</span></div>
              <div
                className="pe-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                  files.forEach((f) => {
                    const r = new FileReader();
                    r.onload = () => typeof r.result === 'string' && setDraft((d) => ({ ...d, images: [...d.images, r.result as string] }));
                    r.readAsDataURL(f);
                  });
                }}
              >
                {draft.images.length === 0 ? (
                  <div className="pe-drop-empty">
                    <div className="pe-drop-icons"><span>🖼️ Drag images here to upload</span><span>↔️ Drag and drop to reorder</span><span>🗑️ Drag outside to delete</span></div>
                  </div>
                ) : (
                  <div className="pe-images">
                    {draft.images.map((src, i) => (
                      <div key={i} className={`pe-img ${i === 0 ? 'primary' : ''}`}>
                        <img src={src} alt="" />
                        {i === 0 && <span className="pe-img-badge">Primary</span>}
                        <span className="pe-img-tools">
                          {i > 0 && <button type="button" onClick={() => { const imgs = [...draft.images]; [imgs[i - 1], imgs[i]] = [imgs[i]!, imgs[i - 1]!]; set({ images: imgs }); }} aria-label="Move earlier">‹</button>}
                          <button type="button" onClick={() => set({ images: draft.images.filter((_, j) => j !== i) })} aria-label="Remove image">×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pe-drop-foot">
                  <span>Drag images here or <button type="button" className="rlink" onClick={() => fileRef.current?.click()}>browse</button> to upload</span>
                  <button type="button" className="btn-p" onClick={() => fileRef.current?.click()}>Choose images</button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
                </div>
              </div>
            </Section>

            <Section title="Product type" hint="Choose the product type to ensure accurate inventory and reporting.">
              <div className="pe-cards">
                {([
                  ['standard', 'Standard product', 'This product is a single SKU with its own inventory.'],
                  ['variant', 'Variant product', 'A group of similar products with different attributes like size or colour. Each variant is a single SKU with its own inventory.'],
                  ['composite', 'Composite product', 'Made up of specified quantities of one or more products. A composite is a single SKU that uses the inventory of the products within it.'],
                ] as const).map(([value, title, body]) => (
                  <button
                    type="button"
                    key={value}
                    className={`pe-card ${draft.productType === value ? 'active' : ''}`}
                    disabled={!isNew && existing?.productType !== value}
                    onClick={() => set({ productType: value })}
                  >
                    <b>{title}</b>
                    <span>{body}</span>
                  </button>
                ))}
              </div>
              {!isNew && <div className="pe-hint">The product type is fixed once a product exists.</div>}

              {draft.productType === 'variant' && isNew && (
                <div className="pe-sub">
                  <div className="pe-label">Attributes <span className="pe-hint">e.g. Size: S, M, L — separate values with commas</span></div>
                  {draft.attributes.map((a, i) => (
                    <div key={i} className="pe-attrrow">
                      <input className="pe-input" placeholder="Attribute (e.g. Size)" value={a.name} onChange={(e) => set({ attributes: draft.attributes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <input
                        className="pe-input"
                        placeholder="Values (e.g. S, M, L)"
                        defaultValue={a.values.join(', ')}
                        onBlur={(e) => set({ attributes: draft.attributes.map((x, j) => (j === i ? { ...x, values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) } : x)) })}
                      />
                      <button type="button" className="pe-x" onClick={() => set({ attributes: draft.attributes.filter((_, j) => j !== i) })} aria-label="Remove attribute">×</button>
                    </div>
                  ))}
                  <button type="button" className="rlink pe-add" onClick={() => set({ attributes: [...draft.attributes, { name: '', values: [] }] })}>＋ Add another attribute</button>
                  {combos.length > 0 && (
                    <table className="pe-table">
                      <thead><tr><th>Variant</th><th>SKU code</th><th>Retail price</th><th>Available</th></tr></thead>
                      <tbody>
                        {combos.map((combo, i) => {
                          const key = variantKey(combo);
                          const row = variantRow(combo, i);
                          const put = (patch: Partial<typeof row>) => set({ variantRows: { ...draft.variantRows, [key]: { ...row, ...patch } } });
                          return (
                            <tr key={key}>
                              <td>{draft.name || 'Product'} / {key}</td>
                              <td><input className="pe-input" value={row.sku} onChange={(e) => put({ sku: e.target.value })} /></td>
                              <td><input className="pe-input" type="number" step="0.01" min={0} value={money(row.priceMinor)} onChange={(e) => put({ priceMinor: toMinor(e.target.value) })} /></td>
                              <td><input className="pe-input" type="number" min={0} value={row.available} onChange={(e) => put({ available: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {draft.productType === 'variant' && !isNew && existing?.attributes?.length ? (
                <div className="pe-sub pe-tags">{existing.attributes.map((a) => <span key={a.name} className="pe-tag">{a.name}: {a.value}</span>)}</div>
              ) : null}

              {draft.productType === 'composite' && (
                <div className="pe-sub">
                  <div className="pe-label">Components <span className="pe-hint">what one unit of this product is made of</span></div>
                  <RefList rows={draft.components} products={products} exclude={existing?.id ?? ''} onChange={(rows) => set({ components: rows })} addLabel="Add a component" />
                  {compositeAvailable !== null && draft.components.some((c) => c.productId) && (
                    <div className="pe-hint">Sellable now from component stock: <b>{compositeAvailable}</b></div>
                  )}
                </div>
              )}
            </Section>

            <Section title="SKU codes" hint="Enter SKU codes to identify this product in your inventory.">
              <div className="pe-grid2">
                <div>
                  <div className="pe-label">SKU codes</div>
                  {draft.skuCodes.map((c, i) => (
                    <div key={i} className="pe-skurow">
                      <select className="pe-input" value={c.type} onChange={(e) => set({ skuCodes: draft.skuCodes.map((x, j) => (j === i ? { ...x, type: e.target.value as SkuCodeType } : x)) })}>
                        {SKU_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input className="pe-input" value={c.code} onChange={(e) => set({ skuCodes: draft.skuCodes.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })} placeholder="Code" />
                      {i > 0 && <button type="button" className="pe-x" onClick={() => set({ skuCodes: draft.skuCodes.filter((_, j) => j !== i) })} aria-label="Remove code">×</button>}
                    </div>
                  ))}
                  <button type="button" className="rlink pe-add" onClick={() => set({ skuCodes: [...draft.skuCodes, { type: 'custom', code: '' }] })}>＋ Add another code</button>
                </div>
                <div>
                  <div className="pe-label">Preview</div>
                  <div className="pe-preview">
                    <span className="pe-preview-img">{draft.images[0] ? <img src={draft.images[0]} alt="" /> : '📦'}</span>
                    <span>
                      <b>{draft.name || 'Product name'}</b>
                      <br />
                      <span className="prod-sku">{primarySku}</span>
                    </span>
                  </div>
                  <div className="pe-hint">The first SKU code is shown to staff and customers to help identify the product. When you have multiple codes, all of them are scannable.</div>
                </div>
              </div>
            </Section>

            <Section title="Supplier information" hint="Add suppliers to this product to track supplier codes and supplier prices.">
              <div className="pe-suphead"><span>Supplier</span><span>Supplier code</span><span>Supplier price</span><span /></div>
              {draft.suppliers.map((s, i) => (
                <div key={i} className="pe-suprow">
                  <select className="pe-input" value={s.supplier} onChange={(e) => set({ suppliers: draft.suppliers.map((x, j) => (j === i ? { ...x, supplier: e.target.value } : x)), ...(i === 0 ? markupFrom(e.target.value, draft.supplierPriceMinor, draft.priceMinor) : {}) })}>
                    <option value="">Choose a supplier</option>
                    {suppliers.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <input className="pe-input" value={s.code} onChange={(e) => set({ suppliers: draft.suppliers.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })} placeholder="Enter supplier code" />
                  <span className="pe-money">
                    <span>$</span>
                    <input
                      className="pe-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={money(s.priceMinor)}
                      onChange={(e) => {
                        const priceMinor = toMinor(e.target.value);
                        const next = draft.suppliers.map((x, j) => (j === i ? { ...x, priceMinor } : x));
                        // The first supplier's price is the cost used for markup and margin.
                        set({ suppliers: next, ...(i === 0 ? { supplierPriceMinor: priceMinor, ...markupFrom(s.supplier, priceMinor, draft.priceMinor) } : {}) });
                      }}
                    />
                  </span>
                  {i > 0 ? <button type="button" className="pe-x" onClick={() => set({ suppliers: draft.suppliers.filter((_, j) => j !== i) })} aria-label="Remove supplier">×</button> : <span />}
                </div>
              ))}
              <button type="button" className="rlink pe-add" onClick={() => set({ suppliers: [...draft.suppliers, { supplier: '', code: '', priceMinor: 0 }] })}>＋ Add another supplier</button>
            </Section>

            <Section title="Tax">
              <Field label="Tax">
                <select className="pe-input" value={draft.taxId} onChange={(e) => set({ taxId: e.target.value })}>
                  {taxes.map((t) => <option key={t.id} value={t.id}>{t.label}{t.label === defaultTaxLabel ? ' — default' : ''}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="Price">
              <table className="pe-table pe-price">
                <thead>
                  <tr><th>Price point</th><th>Supplier price</th><th>Latest landed cost</th><th>Markup</th><th>Margin</th><th>Tax</th><th>Retail price<br /><span className="pe-hint">excluding tax</span></th><th>Retail price<br /><span className="pe-hint">including tax</span></th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>General Price Book (All Products)</td>
                    <td><span className="pe-money"><span>$</span><input className="pe-input" type="number" step="0.01" min={0} value={money(cost)} onChange={(e) => { const v = toMinor(e.target.value); set({ supplierPriceMinor: v, suppliers: draft.suppliers.map((s, j) => (j === 0 ? { ...s, priceMinor: v } : s)), ...markupFrom(draft.suppliers[0]?.supplier ?? '', v, draft.priceMinor) }); }} /></span></td>
                    <td className="pe-muted">–</td>
                    <td><span className="pe-money"><input className="pe-input" type="number" step="0.01" value={pct(markup)} disabled={cost === 0} onChange={(e) => setMarkup(e.target.value)} /><span>%</span></span></td>
                    <td><span className="pe-money"><input className="pe-input" type="number" step="0.01" value={pct(margin)} disabled={cost === 0} onChange={(e) => setMargin(e.target.value)} /><span>%</span></span></td>
                    <td className="pe-muted">{fmt(taxMinor)}</td>
                    <td><span className="pe-money"><span>$</span><input className="pe-input" type="number" step="0.01" min={0} value={money(retailEx)} onChange={(e) => set({ priceMinor: toMinor(e.target.value) })} /></span></td>
                    <td><span className="pe-money"><span>$</span><input className="pe-input" type="number" step="0.01" min={0} value={money(retailInc)} onChange={(e) => setRetailInc(e.target.value)} /></span></td>
                  </tr>
                </tbody>
              </table>
              {cost === 0 && <div className="pe-hint">Enter a supplier price to use markup and margin.</div>}
            </Section>

            <Section title="Inventory levels" hint="Set inventory levels to monitor stock, manage replenishment and get insights on this product's performance.">
              <label className="pe-check">
                <input type="checkbox" checked={draft.trackInventory} onChange={(e) => set({ trackInventory: e.target.checked })} />
                <span><b>Track inventory for this product</b><br /><span className="pe-hint">Manage sales, transfers and returns recorded against this product's inventory.</span></span>
              </label>
              {draft.trackInventory && (
                <>
                  <div className="pe-label">Replenish method <span className="pe-hint">Select a method to replenish this product</span></div>
                  <div className="pe-cards two">
                    <button type="button" className={`pe-card ${draft.replenishMethod === 'minmax' ? 'active' : ''}`} onClick={() => set({ replenishMethod: 'minmax' })}>
                      <b>Min and max quantity</b>
                      <span>Min is the inventory level that signals it's time to replenish. Max is the level reached once the stock is refilled — the reorder quantity is calculated to reach it.</span>
                    </button>
                    <button type="button" className={`pe-card ${draft.replenishMethod === 'reorder' ? 'active' : ''}`} onClick={() => set({ replenishMethod: 'reorder' })}>
                      <b>Reorder point and reorder quantity</b>
                      <span>Reorder point is when stock drops to the minimum level. Reorder quantity is the set number of items to be ordered.</span>
                    </button>
                  </div>
                  <table className="pe-table">
                    <thead>
                      <tr>
                        <th>Outlet</th>
                        <th>Available to sell</th>
                        <th>{draft.replenishMethod === 'minmax' ? 'Min quantity' : 'Reorder point'}</th>
                        <th>{draft.replenishMethod === 'minmax' ? 'Max quantity' : 'Reorder quantity'}</th>
                        <th>Product location</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{outlets[0]?.name ?? 'Main Outlet'}</td>
                        <td>
                          {draft.productType === 'composite' ? (
                            <span className="pe-muted">{compositeAvailable ?? 0} (from components)</span>
                          ) : (
                            <input className="pe-input" type="number" min={0} value={draft.available} onChange={(e) => set({ available: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                          )}
                        </td>
                        {draft.replenishMethod === 'minmax' ? (
                          <>
                            <td><input className="pe-input" type="number" min={0} value={draft.minQty} onChange={(e) => set({ minQty: e.target.value })} placeholder="—" /></td>
                            <td><input className="pe-input" type="number" min={0} value={draft.maxQty} onChange={(e) => set({ maxQty: e.target.value })} placeholder="—" /></td>
                          </>
                        ) : (
                          <>
                            <td><input className="pe-input" type="number" min={0} value={draft.reorderPoint} onChange={(e) => set({ reorderPoint: e.target.value })} placeholder="—" /></td>
                            <td><input className="pe-input" type="number" min={0} value={draft.reorderQty} onChange={(e) => set({ reorderQty: e.target.value })} placeholder="—" /></td>
                          </>
                        )}
                        <td><input className="pe-input" value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Enter a location" /></td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </Section>

            <Section title="Packaging" hint="Set up packaging relationships by linking this product to other SKUs. This helps you manage inventory levels across products with different packaging.">
              <div className="pe-label">The product that this product comes from</div>
              <RefList rows={draft.comesFrom} products={products} exclude={existing?.id ?? ''} onChange={(rows) => set({ comesFrom: rows })} addLabel="Add a product relationship" />
              <div className="pe-label pe-gap">The product that this product breaks into <span className="pe-hint">Products can only break into one other product</span></div>
              <RefList rows={draft.breaksInto.slice(0, 1)} products={products} exclude={existing?.id ?? ''} onChange={(rows) => set({ breaksInto: rows.slice(0, 1) })} addLabel="Add a product relationship" />
            </Section>
          </>
        )}

        <div className="pe-foot">
          {existing ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>Delete “{existing.name}” permanently?</span>
                <button className="btn-danger" onClick={remove}>Delete</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete product</button>
            )
          ) : (
            <span />
          )}
          <span className="pe-actions">
            <button className="btn-s" onClick={() => nav('/catalog')}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
      </div>
    </main>
  );
}
