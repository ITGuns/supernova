import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { downloadCsv } from '../lib/csv';
import { fmt } from '../lib/format';
import { useInventory } from '../store/inventoryStore';
import { ProductRowPanel } from './ProductRowPanel';
import { newGiftCardNumber, useGiftCards } from '../store/giftCardStore';
import { MoneyInput } from './NumInput';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useAdjustmentReasons, type AdjustmentType } from '../store/adjustmentReasonsStore';
import { DEFAULT_CATEGORY_ID, categoryDescendantIds, categoryLabel, sortedCategories, useCatalogMeta } from '../store/catalogMetaStore';
import { tagKey, useProductTags } from '../store/tagStore';
import { useSetup } from '../store/setupStore';
import { promoLabel, promotionStatus, usePromotions } from '../store/promotionStore';
import { priceBookActive, usePriceBooks } from '../store/priceBookStore';
import { availableOf, useProducts, type Product } from '../store/productStore';
import '../styles/catalog.css';
import { Switch } from './controls';
import { CatalogTShirt, CustomizeCard, GiftCardArt, RevenueChart, Rocket } from './illustrations';

const NAV: ContextItem[] = [
  { key: 'products', label: 'Products' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'pricebooks', label: 'Price books' },
  { key: 'brands', label: 'Brands' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'tags', label: 'Product tags' },
  { key: 'categories', label: 'Product categories' },
  { key: 'adjustment', label: 'Adjustment reasons' },
  { key: 'giftcards', label: 'Gift cards' },
];

const ENTITY_KIND: Record<'category' | 'brand' | 'supplier', 'categories' | 'brands' | 'suppliers'> = {
  category: 'categories',
  brand: 'brands',
  supplier: 'suppliers',
};

function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg className="sortglyph" width="13" height="14" viewBox="0 0 13 14" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.1" fill="none" transform={dir === 'desc' ? 'translate(0,14) scale(1,-1)' : undefined}>
        <path d="M3 1.5 V11" />
        <path d="M1 9 L3 11.5 L5 9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="7" y="6" fontSize="5.2" fill="currentColor">A</text>
      <text x="7" y="12.5" fontSize="5.2" fill="currentColor">Z</text>
    </svg>
  );
}

export function CatalogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialQ = (location.state as { q?: string } | null)?.q ?? '';
  const initialTab = (location.state as { tab?: string } | null)?.tab ?? 'products';
  const [active, setActive] = useState(initialTab);
  const [q, setQ] = useState(initialQ);
  // A later TopBar search while already on /catalog updates state, not the initializer.
  useEffect(() => {
    if (initialQ) {
      setQ(initialQ);
      setActive('products');
    }
  }, [initialQ, location.key]);
  const products = useProducts((s) => s.products);
  const addP = useProducts((s) => s.addProduct);
  const updP = useProducts((s) => s.updateProduct);
  const delP = useProducts((s) => s.deleteProduct);
  const togP = useProducts((s) => s.toggleActive);
  const [onbImport, setOnbImport] = useState(true);
  const [onbSell, setOnbSell] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Categories, Brands, Suppliers — persisted catalog metadata
  const categories = useCatalogMeta((s) => s.categories);
  const brands = useCatalogMeta((s) => s.brands);
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const addEntity = useCatalogMeta((s) => s.addEntity);
  const updateEntity = useCatalogMeta((s) => s.updateEntity);
  const removeEntity = useCatalogMeta((s) => s.deleteEntity);

  // Adjustment reasons — persisted
  const reasons = useAdjustmentReasons((s) => s.reasons);
  const addReason = useAdjustmentReasons((s) => s.addReason);
  const updateReason = useAdjustmentReasons((s) => s.updateReason);
  const deleteReason = useAdjustmentReasons((s) => s.deleteReason);
  const [reasonModal, setReasonModal] = useState<{ id: string; name: string; type: AdjustmentType; enabled: boolean } | null>(null);

  const promotions = usePromotions((s) => s.promotions);
  const updatePromotion = usePromotions((s) => s.updatePromotion);
  const deletePromotion = usePromotions((s) => s.deletePromotion);
  const priceBooks = usePriceBooks((s) => s.priceBooks);
  const outlets = useSetup((s) => s.outlets);
  const [promoTab, setPromoTab] = useState<'Current and upcoming' | 'Past' | 'All'>('Current and upcoming');
  const [promoQ, setPromoQ] = useState('');
  const [promoDate, setPromoDate] = useState('');
  const [promoOutlet, setPromoOutlet] = useState('all');
  const [promoExpanded, setPromoExpanded] = useState<string | null>(null);
  const visiblePromotions = promotions.filter((p) => {
    const status = promotionStatus(p);
    if (promoTab === 'Current and upcoming' && (status === 'Expired')) return false;
    if (promoTab === 'Past' && status !== 'Expired') return false;
    if (promoQ.trim() && !p.name.toLowerCase().includes(promoQ.trim().toLowerCase())) return false;
    if (promoOutlet !== 'all' && p.outlets.length && !p.outlets.includes(promoOutlet)) return false;
    if (promoDate) {
      const t = new Date(`${promoDate}T12:00:00`).getTime();
      if ((p.startAt !== null && p.startAt > t + 86400000) || (p.endAt !== null && p.endAt < t)) return false;
    }
    return true;
  });

  // Product tags — persisted; every tag a product carries has a row of its own too
  const tags = useProductTags((s) => s.tags);
  const addTag = useProductTags((s) => s.addTag);
  const renameTag = useProductTags((s) => s.renameTag);
  const deleteTag = useProductTags((s) => s.deleteTag);
  const ensureTags = useProductTags((s) => s.ensureTags);
  useEffect(() => {
    ensureTags(products.flatMap((p) => p.tags ?? []));
  }, [products, ensureTags]);
  const [tagModal, setTagModal] = useState<{ id: string; name: string } | null>(null);
  const [tagError, setTagError] = useState('');
  const [tagAsc, setTagAsc] = useState(true);
  const [catAsc, setCatAsc] = useState(true);
  const tagCount = (name: string) => products.filter((p) => (p.tags ?? []).some((t) => tagKey(t) === tagKey(name))).length;
  const catCount = (id: string) => {
    const ids = categoryDescendantIds(categories, id);
    return products.filter((p) => ids.has(p.categoryId)).length;
  };

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [tagQ, setTagQ] = useState('');

  // Row selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Unified editing entity modal state (categories, brands, suppliers)
  const [editingEntity, setEditingEntity] = useState<{
    type: 'category' | 'brand' | 'supplier';
    id: string;
    name: string;
    desc?: string;
    isNew?: boolean;
  } | null>(null);

  const [supAsc, setSupAsc] = useState(true);

  // Import Modal state
  const transactions = useInventory((s) => s.transactions);
  const giftCards = useGiftCards((s) => s.cards);
  const issueGiftCard = useGiftCards((s) => s.issue);
  const cancelGiftCard = useGiftCards((s) => s.cancel);
  const [gcNumber, setGcNumber] = useState('');
  const [gcAmount, setGcAmount] = useState(2500);
  const [gcOpen, setGcOpen] = useState(false);
  const [poQ, setPoQ] = useState('');
  // Lightspeed applies the product filters when you press Search (or Enter);
  // `pending` holds what's typed, the individual states hold what's applied.
  const [pending, setPending] = useState({ q: initialQ, tagQ: '', category: 'all', brand: 'all', supplier: 'all', status: 'active' as 'all' | 'active' | 'inactive', po: '' });

  const label = NAV.find((n) => n.key === active)?.label ?? 'Catalog';
  useEffect(() => {
    setPending({ q, tagQ, category: selectedCategory, brand: selectedBrand, supplier: selectedSupplier, status: selectedStatus, po: poQ });
  }, [q, tagQ, selectedCategory, selectedBrand, selectedSupplier, selectedStatus, poQ]);
  const applyFilters = () => {
    setQ(pending.q);
    setTagQ(pending.tagQ);
    setSelectedCategory(pending.category);
    setSelectedBrand(pending.brand);
    setSelectedSupplier(pending.supplier);
    setSelectedStatus(pending.status);
    setPoQ(pending.po);
  };
  // Products that appear on a purchase order whose number matches.
  const poProductIds = useMemo(() => {
    const needle = poQ.trim().toLowerCase();
    if (!needle) return null;
    const ids = new Set<string>();
    transactions.filter((t) => t.kind === 'order' && t.number.toLowerCase().includes(needle)).forEach((t) => t.lines.forEach((l) => ids.add(l.productId)));
    return ids;
  }, [poQ, transactions]);

  // "Tags" filter: comma-separated tag names the product must all carry.
  const tagTokens = tagQ.split(',').map((t) => tagKey(t)).filter(Boolean);
  // A category filter includes the levels nested under it.
  const categoryIds = selectedCategory === 'all' ? null : categoryDescendantIds(categories, selectedCategory);
  const rows = products.filter((p) => {
    const ptags = (p.tags ?? []).map(tagKey);
    return (
      (q.trim() === '' ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.sku.toLowerCase().includes(q.toLowerCase())) &&
      tagTokens.every((t) => ptags.some((pt) => pt === t || pt.includes(t))) &&
      (categoryIds === null || categoryIds.has(p.categoryId)) &&
      (selectedBrand === 'all' || p.brand === selectedBrand) &&
      (selectedSupplier === 'all' || p.supplier === selectedSupplier) &&
      (selectedStatus === 'all' || (selectedStatus === 'active') === p.enabled) &&
      (poProductIds === null || poProductIds.has(p.id))
    );
  });

  const toggleActive = (id: string) => togP(id);

  // Variants of one product share a productId; the list shows them as a
  // single family row that expands to the individual variants.
  const families = useMemo(() => {
    const byFamily = new Map<string, Product[]>();
    for (const p of rows) {
      const key = p.variants > 0 ? p.productId : p.id;
      byFamily.set(key, [...(byFamily.get(key) ?? []), p]);
    }
    return [...byFamily.entries()].map(([key, members]) => ({ key, members, lead: members[0]! }));
  }, [rows]);
  /** "QA Tee / M" → "QA Tee": the family name is what the variants share. */
  const familyName = (members: Product[]) => {
    const lead = members[0]?.name ?? '';
    const idx = lead.lastIndexOf(' / ');
    return members.length > 1 && idx > 0 ? lead.slice(0, idx) : lead;
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : rows.map((r) => r.id));
  const bulkDeactivate = () => {
    selectedIds.forEach((id) => updP(id, { enabled: false }));
    setSelectedIds([]);
  };
  const bulkDelete = () => {
    selectedIds.forEach((id) => delP(id));
    setSelectedIds([]);
  };

  const startEditProd = (p: Product) => navigate(`/catalog/products/${p.id}`);

  const deleteProduct = (id: string) => {
    delP(id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const addProduct = () => navigate('/catalog/products/new');

  const saveEntityEdit = () => {
    if (!editingEntity) return;
    const { type, id, name, desc, isNew } = editingEntity;
    const kind = ENTITY_KIND[type];
    if (isNew) {
      addEntity(kind, name.trim(), desc?.trim() || undefined);
    } else {
      updateEntity(kind, id, { name: name.trim(), description: desc?.trim() || undefined });
    }
    setEditingEntity(null);
  };

  const deleteEntity = (type: 'category' | 'brand' | 'supplier', id: string) => {
    removeEntity(ENTITY_KIND[type], id);
    setEditingEntity(null);
  };

  const saveReason = () => {
    if (!reasonModal || !reasonModal.name.trim()) return;
    if (reasonModal.id) {
      updateReason(reasonModal.id, { name: reasonModal.name.trim(), type: reasonModal.type, enabled: reasonModal.enabled });
    } else {
      addReason(reasonModal.name.trim(), reasonModal.type);
    }
    setReasonModal(null);
  };

  const saveTag = () => {
    if (!tagModal) return;
    const name = tagModal.name.trim();
    if (!name) return;
    const ok = tagModal.id ? renameTag(tagModal.id, name) : addTag(name) !== null;
    if (!ok) {
      setTagError(`A tag called “${name}” already exists.`);
      return;
    }
    setTagModal(null);
    setTagError('');
  };

  const removeTag = (id: string) => {
    const tag = tags.find((t) => t.id === id);
    if (!tag) return;
    const n = tagCount(tag.name);
    if (n > 0 && !window.confirm(`Delete the tag “${tag.name}”? It will be removed from ${n} product${n === 1 ? '' : 's'}.`)) return;
    deleteTag(id);
  };

  const removeCategory = (id: string) => {
    if (!categories.some((c) => c.id === id)) return;
    const n = catCount(id);
    if (n > 0 && !window.confirm(`Delete “${categoryLabel(categories, id)}”? ${n} product${n === 1 ? '' : 's'} will move to your first top-level category.`)) return;
    const gone = categoryDescendantIds(categories, id);
    const fallback = categories.find((c) => !gone.has(c.id) && !c.parentId)?.id ?? DEFAULT_CATEGORY_ID;
    products.filter((p) => gone.has(p.categoryId)).forEach((p) => updP(p.id, { categoryId: fallback }));
    removeEntity('categories', id);
  };

  const viewTagProducts = (name: string) => {
    setTagQ(name);
    setActive('products');
  };

  const exportProducts = () => {
    const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
    downloadCsv('products.csv', [
      ['name', 'sku', 'category', 'brand', 'supplier', 'price', 'available', 'status'],
      ...rows.map((p) => [
        p.name,
        p.sku,
        catName(p.categoryId),
        p.brand,
        p.supplier,
        (p.priceMinor / 100).toFixed(2),
        String(p.available),
        p.enabled ? 'Active' : 'Inactive',
      ]),
    ]);
  };

  const triggerImport = () => navigate('/catalog/products/import');

  // Copy a product (or a whole variant family) with a new SKU, like Lightspeed's Duplicate.
  const duplicateProduct = (members: Product[]) => {
    const familyId = `p-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    members.forEach((m, i) => {
      const id = members.length > 1 ? `${familyId}-${i + 1}` : familyId;
      const idx = m.name.lastIndexOf(' / ');
      const name = members.length > 1 && idx > 0 ? `${m.name.slice(0, idx)} (copy)${m.name.slice(idx)}` : `${m.name} (copy)`;
      addP({ ...m, id, productId: members.length > 1 ? familyId : id, name, sku: `${m.sku}-COPY`, created: today, available: 0, image: m.image, skuCodes: [] });
    });
  };

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'brands' ? (
            <>
              <h1 className="page-title">Brands</h1>
              <div className="cat-band">
                <span>
                  A list of all of your brands. <span className="rlink">Need help?</span>
                </span>
                <button
                  className="btn-p"
                  onClick={() => setEditingEntity({ type: 'brand', id: '', name: '', desc: '', isNew: true })}
                >
                  Add brand
                </button>
              </div>
              <div className="atable">
                <div className="athead brand brand4">
                  <span>Name</span>
                  <span>Description</span>
                  <span className="r">Number of products</span>
                  <span />
                </div>
                {brands.length === 0 && <div className="ct-empty">You haven’t added any brands yet.</div>}
                {brands.map((b) => (
                  <div key={b.id} className="arow brand brand4">
                    <span
                      className="rlink"
                      onClick={() => {
                        setSelectedBrand(b.name);
                        setActive('products');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {b.name}
                    </span>
                    <span className="ct-muted">{b.description || '—'}</span>
                    <span className="r">{products.filter((p) => p.brand === b.name).length}</span>
                    <span className="row-actions">
                      <span
                        className="rlink"
                        onClick={() => {
                          setSelectedBrand(b.name);
                          setActive('products');
                        }}
                      >
                        View products
                      </span>
                      <span
                        className="ic"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntity({ type: 'brand', id: b.id, name: b.name, desc: b.description ?? '' });
                        }}
                      >
                        ✎
                      </span>
                      <span
                        className="ic"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEntity('brand', b.id);
                        }}
                      >
                        🗑
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : active === 'suppliers' ? (
            <>
              <h1 className="page-title">Suppliers</h1>
              <div className="cat-band">
                <span>
                  View and manage your suppliers. <span className="rlink">Need help?</span>
                </span>
                <button
                  className="btn-p"
                  onClick={() => navigate('/catalog/suppliers/new')}
                >
                  Add supplier
                </button>
              </div>
              <div className="ctable">
                <div className="cthead sup4">
                  <span className="cth-s" onClick={() => setSupAsc((v) => !v)}>
                    <span className="cth-label">Supplier</span>
                    <SortIcon dir={supAsc ? 'asc' : 'desc'} />
                  </span>
                  <span>Description</span>
                  <span>Default markup</span>
                  <span>Number of products</span>
                  <span />
                </div>
                {[...suppliers]
                  .sort((a, b) => (supAsc ? 1 : -1) * a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((s) => (
                    <div key={s.id} className="ctrow sup4">
                      <span className="rlink" onClick={() => navigate(`/catalog/suppliers/${s.id}`)}>
                        {s.name}
                      </span>
                      <span className="ct-muted">{s.description || '—'}</span>
                      <span>{(s.details?.defaultMarkupBps ?? 0) / 100}%</span>
                      <span>{products.filter((p) => p.supplier === s.name).length}</span>
                      <span className="ct-actions">
                        <span
                          className="rlink"
                          onClick={() => {
                            setSelectedSupplier(s.name);
                            setActive('products');
                          }}
                        >
                          View products
                        </span>
                        <span
                          className="ic-edit"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/catalog/suppliers/${s.id}`);
                          }}
                        >
                          ✎
                        </span>
                        <span
                          className="ic-del"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntity('supplier', s.id);
                          }}
                        >
                          🗑
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </>
          ) : active === 'tags' ? (
            <>
              <h1 className="page-title">Product tags</h1>
              <div className="cat-band">
                <span>
                  A list of all of your product tags. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => { setTagModal({ id: '', name: '' }); setTagError(''); }}>
                  Add tag
                </button>
              </div>
              <div className="ctable">
                <div className="cthead tag3">
                  <span className="cth-s" onClick={() => setTagAsc((v) => !v)}>
                    <span className="cth-label">Name</span>
                    <SortIcon dir={tagAsc ? 'asc' : 'desc'} />
                  </span>
                  <span>Number of products</span>
                  <span />
                </div>
                {tags.length === 0 && <div className="ct-empty">No product tags yet. Add a tag, or tag a product from its page.</div>}
                {[...tags]
                  .sort((a, b) => (tagAsc ? 1 : -1) * a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((t) => (
                    <div key={t.id} className="ctrow tag3">
                      <span className="rlink" onClick={() => { setTagModal({ id: t.id, name: t.name }); setTagError(''); }}>
                        {t.name}
                      </span>
                      <span>{tagCount(t.name)}</span>
                      <span className="ct-actions">
                        <span className="rlink" onClick={() => viewTagProducts(t.name)}>
                          View products
                        </span>
                        <span
                          className="ic-edit"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagModal({ id: t.id, name: t.name });
                            setTagError('');
                          }}
                        >
                          ✎
                        </span>
                        <span
                          className="ic-del"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTag(t.id);
                          }}
                        >
                          🗑
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </>
          ) : active === 'categories' ? (
            <>
              <h1 className="page-title">Product categories</h1>
              <div className="cat-band">
                <span>
                  A list of all of your product categories. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => navigate('/catalog/categories/new')}>
                  Add category
                </button>
              </div>
              <div className="ctable">
                <div className="cthead tag3">
                  <span className="cth-s" onClick={() => setCatAsc((v) => !v)}>
                    <span className="cth-label">Name</span>
                    <SortIcon dir={catAsc ? 'asc' : 'desc'} />
                  </span>
                  <span>Number of products</span>
                  <span />
                </div>
                {(catAsc ? sortedCategories(categories) : sortedCategories(categories).reverse()).map((c) => (
                  <div key={c.id} className="ctrow tag3">
                    <span className={`rlink ${c.parentId ? 'ct-nested' : ''}`} onClick={() => navigate(`/catalog/categories/${c.id}`)}>
                      {categoryLabel(categories, c.id)}
                    </span>
                    <span>{catCount(c.id)}</span>
                    <span className="ct-actions">
                      <span
                        className="rlink"
                        onClick={() => {
                          setSelectedCategory(c.id);
                          setActive('products');
                        }}
                      >
                        View products
                      </span>
                      <span
                        className="ic-edit"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/catalog/categories/${c.id}`);
                        }}
                      >
                        ✎
                      </span>
                      <span
                        className="ic-del"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCategory(c.id);
                        }}
                      >
                        🗑
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : active === 'adjustment' ? (
            <>
              <h1 className="page-title">Adjustment reasons</h1>
              <div className="cat-band">
                <span>Use adjustment reasons to track your inventory movements.</span>
                <button className="btn-p" onClick={() => setReasonModal({ id: '', name: '', type: 'Negative', enabled: true })}>
                  Add reason
                </button>
              </div>
              <div className="ctable">
                <div className="cthead adj4c">
                  <span>Name</span>
                  <span>Adjustment type</span>
                  <span className="c">Enabled</span>
                  <span />
                </div>
                {reasons.length === 0 && <div className="ct-empty">No adjustment reasons yet.</div>}
                {[...reasons]
                  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((a) => (
                    <div key={a.id} className={`ctrow adj4c ${a.enabled ? '' : 'ct-off'}`}>
                      <span className="rlink" onClick={() => setReasonModal({ id: a.id, name: a.name, type: a.type, enabled: a.enabled })}>
                        {a.name}
                      </span>
                      <span>{a.type}</span>
                      <span className="c">{a.enabled ? <span className="ok-check">✓</span> : <span className="ct-muted">—</span>}</span>
                      <span className="ct-actions">
                        <span
                          className="ic-edit"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReasonModal({ id: a.id, name: a.name, type: a.type, enabled: a.enabled });
                          }}
                        >
                          ✎
                        </span>
                        <span
                          className="ic-del"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReason(a.id);
                          }}
                        >
                          🗑
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </>
          ) : active === 'giftcards' ? (
            <>
              <div className="gc-hero">
                <h2>Sell gift cards to boost revenue</h2>
                <p>Bring in new customers and increase revenue with flexible and brandable gift cards</p>
                <button className="btn-p gc-hero-btn" onClick={() => { setGcOpen(true); setGcNumber(newGiftCardNumber(giftCards)); }}>
                  Add gift card
                </button>
              </div>
              <div className="page-subbar">Sell gift cards at the register from More actions → Sell gift card. Cards on file can be redeemed on the Pay screen.</div>
              {gcOpen && (
                <div className="add-bar">
                  <input className="set-input" value={gcNumber} onChange={(e) => setGcNumber(e.target.value)} placeholder="Card number" style={{ flex: 1 }} />
                  <span className="pe-money"><span>$</span><MoneyInput className="set-input" minor={gcAmount} onChange={setGcAmount} /></span>
                  <button className="btn-p" disabled={!gcNumber.trim() || gcAmount <= 0} onClick={() => { issueGiftCard(gcNumber.trim(), gcAmount); setGcOpen(false); }}>Activate card</button>
                  <button className="btn-s" onClick={() => setGcOpen(false)}>Cancel</button>
                </div>
              )}
              <div className="ctable">
                <div className="cthead gc6">
                  <span>Card number</span>
                  <span className="r">Issued</span>
                  <span className="r">Balance</span>
                  <span>Customer</span>
                  <span>Status</span>
                  <span>Sale</span>
                </div>
                {giftCards.length === 0 && <div className="ct-empty">No gift cards on file yet.</div>}
                {giftCards.map((c) => (
                  <div key={c.id} className="ctrow gc6">
                    <span>••••{c.number.slice(-4)} <span className="ct-muted">({c.number})</span></span>
                    <span className="r">{fmt(c.initialMinor)}</span>
                    <span className="r">{fmt(c.balanceMinor)}</span>
                    <span>{c.customerName || '—'}</span>
                    <span><span className={`tx-badge ${c.status === 'Active' ? 'received' : c.status === 'Redeemed' ? 'open' : 'cancelled'}`}>{c.status}</span>{c.status === 'Active' && <span className="rlink" style={{ marginLeft: 8 }} onClick={() => cancelGiftCard(c.id)}>Cancel</span>}</span>
                    <span className="ct-muted">{c.saleOrderNumber || `Issued ${new Date(c.createdAt).toLocaleDateString()}`}</span>
                  </div>
                ))}
              </div>
              <div className="gc-features">
                <div className="gc-feature">
                  <GiftCardArt />
                  <div className="gc-feat-h">Sell and track cards</div>
                  <div className="gc-feat-t">Sell gift cards to attract and engage new customers. Gift card reports let you track redemption and open balances.</div>
                </div>
                <div className="gc-feature">
                  <RevenueChart />
                  <div className="gc-feat-h">Boost your revenue</div>
                  <div className="gc-feat-t">Customers using gift cards tend to spend more, and are more likely to buy products at regular price, increasing your bottom line.</div>
                </div>
                <div className="gc-feature">
                  <CustomizeCard />
                  <div className="gc-feat-h">Customize your cards</div>
                  <div className="gc-feat-t">Gift cards are hassle free. Create your own gift cards by hand, design and print new ones from our preferred partner, or use your own vendor.</div>
                </div>
              </div>
            </>
          ) : active === 'promotions' ? (
            <>
              <h1 className="page-title">Promotions</h1>
              <div className="sh-tabs">
                {(['Current and upcoming', 'Past', 'All'] as const).map((t) => (
                  <button key={t} className={`sh-tab ${promoTab === t ? 'active' : ''}`} onClick={() => setPromoTab(t)}>{t}</button>
                ))}
              </div>
              <div className="cat-band">
                <span>
                  Create and manage current and upcoming promotions. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => navigate('/catalog/promotions/new')}>
                  Add promotion
                </button>
              </div>
              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Search for promotions</label>
                    <input value={promoQ} onChange={(e) => setPromoQ(e.target.value)} placeholder="Promotion name" />
                  </div>
                  <div className="f-field">
                    <label>Date</label>
                    <input type="date" value={promoDate} onChange={(e) => setPromoDate(e.target.value)} />
                  </div>
                  <div className="f-field">
                    <label>Outlet</label>
                    <select className="set-select" value={promoOutlet} onChange={(e) => setPromoOutlet(e.target.value)} style={{ height: '38px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}>
                      <option value="all">All outlets</option>
                      {outlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="inv-count">Displaying {visiblePromotions.length} promotion{visiblePromotions.length === 1 ? '' : 's'}</div>
              <div className="ctable">
                <div className="cthead promo5">
                  <span>Name</span>
                  <span>Discount</span>
                  <span>End date</span>
                  <span>Recurring</span>
                  <span>Status</span>
                </div>
                {visiblePromotions.length === 0 && <div className="ct-empty">{promoTab === 'Past' ? 'Past promotions will be displayed here.' : 'Current and future promotions will be displayed here.'}</div>}
                {visiblePromotions.map((p) => {
                  const status = promotionStatus(p);
                  return (
                    <div key={p.id}>
                      <div className="ctrow promo5" onClick={() => setPromoExpanded((e) => (e === p.id ? null : p.id))} style={{ cursor: 'pointer' }}>
                        <span className="rlink">{p.name}</span>
                        <span>{promoLabel(p)}{p.appliesTo === 'all' ? '' : p.appliesTo === 'categories' ? ` · ${p.targetIds.length} categor${p.targetIds.length === 1 ? 'y' : 'ies'}` : ` · ${p.targetIds.length} product${p.targetIds.length === 1 ? '' : 's'}`}</span>
                        <span className="ct-muted">{p.endAt ? new Date(p.endAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No end date'}</span>
                        <span>{p.schedule.kind === 'recurring' ? 'Yes' : 'No'}</span>
                        <span><span className={`tx-badge ${status === 'Active' ? 'received' : status === 'Scheduled' ? 'open' : status === 'Expired' ? 'cancelled' : ''}`}>{status}</span></span>
                      </div>
                      {promoExpanded === p.id && (
                        <div className="ct-expand">
                          <div className="ct-expand-info">
                            {p.description && <div>{p.description}</div>}
                            <div className="ct-muted">
                              {p.target === 'everyone' ? 'Available to everyone' : p.target === 'group' ? `Exclusive to ${p.customerGroups.join(', ') || 'customer groups'}` : `Promo code ${p.promoCode}`}
                              {' · '}{p.outlets.length ? p.outlets.join(', ') : 'All outlets'}
                              {' · '}{p.startAt ? `From ${new Date(p.startAt).toLocaleDateString()}` : 'Started'}
                            </div>
                          </div>
                          <div className="ct-expand-actions">
                            <button className="btn-s" onClick={() => navigate(`/catalog/promotions/${p.id}`)}>Edit</button>
                            <button className="btn-s" onClick={() => { setSelectedCategory('all'); setQ(''); setActive('products'); }}>View products</button>
                            {status === 'Active' && <button className="btn-s" onClick={() => updatePromotion(p.id, { endAt: Date.now() })}>End early</button>}
                            <button className="btn-s danger" onClick={() => deletePromotion(p.id)}>Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : active === 'pricebooks' ? (
            <>
              <h1 className="page-title">Price books</h1>
              <div className="cat-band">
                <span>
                  A list of all of your price books. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => navigate('/catalog/price-books/new')}>
                  Add price book
                </button>
              </div>
              <div className="pb-promo">
                <b>Manage all your prices in one place</b>
                <span>Now, you can use price books to manage both in-store and online prices. Set up pricing across channels right from your Nova Retail account.</span>
              </div>
              <div className="ctable">
                <div className="cthead pb6">
                  <span>Name</span>
                  <span>Customer groups</span>
                  <span>Channel</span>
                  <span>Valid from</span>
                  <span>Valid to</span>
                  <span>Created</span>
                </div>
                <div className="ctrow pb6">
                  <span className="rlink" onClick={() => setActive('products')}>General Price Book (All Products)</span>
                  <span>All customer groups</span>
                  <span>Online and 1 more</span>
                  <span className="ct-muted">—</span>
                  <span className="ct-muted">—</span>
                  <span className="ct-muted">With store</span>
                </div>
                {priceBooks.map((b) => (
                  <div key={b.id} className="ctrow pb6">
                    <span className="rlink" onClick={() => navigate(`/catalog/price-books/${b.id}`)}>
                      {b.name}
                      {!priceBookActive(b) && <span className="tx-badge cancelled"> Not active</span>}
                    </span>
                    <span>{b.customerGroup}</span>
                    <span>{b.outlet ? b.outlet : 'In-store & Online'}</span>
                    <span className="ct-muted">{b.startAt ? new Date(b.startAt).toLocaleDateString() : '—'}</span>
                    <span className="ct-muted">{b.endAt ? new Date(b.endAt).toLocaleDateString() : '—'}</span>
                    <span className="ct-muted">{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">Products</h1>
              <div className="subbar-row">
                <span>
                  Add, view and edit your products in one place. <span className="rlink">Need help?</span>
                </span>
                <div className="page-actions">
                  <button className="btn-s" onClick={triggerImport}>
                    Import
                  </button>
                  <button className="btn-p" onClick={addProduct}>
                    Add product
                  </button>
                </div>
              </div>

              {(onbImport || onbSell) && (
                <div className="onb-cards">
                  {onbImport && (
                    <div className="onb-card">
                      <CatalogTShirt />
                      <div>
                        <div className="onb-h">Build your catalog fast</div>
                        <div className="onb-t">
                          The fastest way to build your catalog foundation is to upload your product spreadsheet.
                        </div>
                        <div className="onb-actions">
                          <button className="btn-s" onClick={triggerImport}>
                            Start importing
                          </button>
                          <span className="rlink" onClick={() => setOnbImport(false)}>
                            Dismiss
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {onbSell && (
                    <div className="onb-card">
                      <Rocket />
                      <div>
                        <div className="onb-h">Start selling now</div>
                        <div className="onb-t">
                          Add your products with just the essential information so you’re ready to start selling in-store
                          as soon as possible. You’ll be able to come back later to finish building your catalog.
                        </div>
                        <div className="onb-actions">
                          <button className="btn-s" onClick={addProduct}>
                            Add products quickly
                          </button>
                          <span className="rlink" onClick={() => setOnbSell(false)}>
                            Dismiss
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Search for products</label>
                    <input value={pending.q} onChange={(e) => setPending({ ...pending, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="Enter name, SKU, handle or supplier code" />
                  </div>
                  <div className="f-field">
                    <label>Product category</label>
                    <select
                      className="set-select"
                      value={pending.category}
                      onChange={(e) => setPending({ ...pending, category: e.target.value })}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All categories</option>
                      {sortedCategories(categories).map((c) => (
                        <option key={c.id} value={c.id}>{categoryLabel(categories, c.id)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Tags</label>
                    <input value={pending.tagQ} onChange={(e) => setPending({ ...pending, tagQ: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="Enter tags" />
                  </div>
                </div>
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Supplier</label>
                    <select
                      className="set-select"
                      value={pending.supplier}
                      onChange={(e) => setPending({ ...pending, supplier: e.target.value })}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All suppliers</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Brand</label>
                    <select
                      className="set-select"
                      value={pending.brand}
                      onChange={(e) => setPending({ ...pending, brand: e.target.value })}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All brands</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Purchase order number</label>
                    <input value={pending.po} onChange={(e) => setPending({ ...pending, po: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="Enter purchase order number" />
                  </div>
                </div>
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Status</label>
                    <select
                      className="set-select"
                      value={pending.status}
                      onChange={(e) => setPending({ ...pending, status: e.target.value as 'all' | 'active' | 'inactive' })}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="sc-factions split">
                  <span
                    className="rlink"
                    onClick={() => {
                      setQ('');
                      setTagQ('');
                      setSelectedCategory('all');
                      setSelectedBrand('all');
                      setSelectedSupplier('all');
                      setSelectedStatus('all');
                      setPoQ('');
                    }}
                  >
                    Clear filters
                  </span>
                  <button className="btn-p" onClick={applyFilters}>Search</button>
                </div>
              </div>

              <div className="disp-row">
                <span>
                  Displaying {rows.length} {selectedStatus === 'active' ? 'active ' : selectedStatus === 'inactive' ? 'inactive ' : ''}product{rows.length === 1 ? '' : 's'}
                  {q.trim() && ` containing “${q}”`}
                </span>
                <span className="rlink" onClick={exportProducts}>⤓ Export list…</span>
              </div>

              {selectedIds.length > 0 && (
                <div className="bulk-bar">
                  <span className="bulk-count">
                    {selectedIds.length} selected
                  </span>
                  <button className="btn-s" onClick={bulkDeactivate}>
                    Deactivate
                  </button>
                  <button className="btn-s danger" onClick={bulkDelete}>
                    Delete
                  </button>
                  <span className="rlink" onClick={() => setSelectedIds([])}>
                    Clear
                  </span>
                </div>
              )}

              <div className="atable">
                <div className="athead prod2 prod3">
                  <span className="c">
                    <span className={`acheck sel ${allSelected ? 'on' : ''}`} onClick={toggleSelectAll} />
                  </span>
                  <span />
                  <span>Product</span>
                  <span>Brand</span>
                  <span>Supplier</span>
                  <span className="r">Available to sell</span>
                  <span className="r">Special order demand</span>
                  <span className="r">Retail price</span>
                  <span className="c">Active</span>
                  <span>Created</span>
                  <span />
                </div>
                {families.map(({ key, members, lead }) => {
                  const isFamily = members.length > 1;
                  const ids = members.map((m) => m.id);
                  const allSelected = ids.every((id) => selectedIds.includes(id));
                  const available = members.reduce((sum, m) => sum + availableOf(m, products), 0);
                  const prices = members.map((m) => m.priceMinor);
                  const priceLabel =
                    Math.min(...prices) === Math.max(...prices) ? fmt(lead.priceMinor) : `${fmt(Math.min(...prices))} – ${fmt(Math.max(...prices))}`;
                  const anyEnabled = members.some((m) => m.enabled);
                  return (
                    <div key={key}>
                      <div className="arow prod2 prod3" onClick={() => setExpanded((e) => (e === key ? null : key))} style={{ cursor: 'pointer' }}>
                        <span className="c" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`acheck sel ${allSelected ? 'on' : ''}`}
                            onClick={() =>
                              setSelectedIds((prev) => (allSelected ? prev.filter((x) => !ids.includes(x)) : [...prev, ...ids.filter((x) => !prev.includes(x))]))
                            }
                          />
                        </span>
                        <span className="c">
                          <span className={`pchev ${expanded === key ? 'open' : ''}`}>›</span>
                        </span>
                        <span className="prod2-name">
                          <span className="pthumb">
                            {lead.image ? <img src={lead.image} alt={lead.name} className="pthumb-img" /> : lead.emoji}
                          </span>
                          <span>
                            <span className="rlink" onClick={(e) => { e.stopPropagation(); startEditProd(lead); }}>
                              {familyName(members)}
                            </span>
                            <br />
                            <span className="prod-sku">{isFamily ? `${members.length} variants` : lead.sku}</span>
                          </span>
                        </span>
                        <span className="rlink">{lead.brand}</span>
                        <span className="rlink">{lead.supplier}</span>
                        <span className="r">{available}</span>
                        <span className="r">0</span>
                        <span className="r">{priceLabel}</span>
                        <span className="c" onClick={(e) => e.stopPropagation()}>
                          <Switch on={anyEnabled} onClick={() => members.forEach((m) => (m.enabled === anyEnabled ? toggleActive(m.id) : undefined))} />
                        </span>
                        <span className="prod-created">{lead.created}</span>
                        <span
                          className="c prod-pencil"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditProd(lead);
                          }}
                        >
                          ✎
                        </span>
                      </div>
                      {expanded === key && (
                        <ProductRowPanel
                          product={lead}
                          members={members}
                          onDetails={startEditProd}
                          onDuplicate={() => duplicateProduct(members)}
                          onDelete={() => {
                            members.forEach((m) => deleteProduct(m.id));
                            setExpanded(null);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {editingEntity !== null && (
        <div className="pm-overlay" onClick={() => setEditingEntity(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="pm-head">
              <h2>
                {editingEntity.isNew ? 'Add' : 'Edit'}{' '}
                {editingEntity.type === 'category'
                  ? 'Product Category'
                  : editingEntity.type === 'brand'
                  ? 'Brand'
                  : 'Supplier'}
              </h2>
              <button className="pm-close" onClick={() => setEditingEntity(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="set-field">
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Name
                </label>
                <input
                  className="set-input"
                  value={editingEntity.name}
                  onChange={(e) => setEditingEntity({ ...editingEntity, name: e.target.value })}
                  placeholder="Name"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {(editingEntity.type === 'supplier' || editingEntity.type === 'brand') && (
                <div className="set-field">
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Description
                  </label>
                  <input
                    className="set-input"
                    value={editingEntity.desc || ''}
                    onChange={(e) => setEditingEntity({ ...editingEntity, desc: e.target.value })}
                    placeholder="Optional"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                {!editingEntity.isNew ? (
                  <button
                    type="button"
                    onClick={() => deleteEntity(editingEntity.type, editingEntity.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e11d48',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      padding: '8px 0',
                      outline: 'none',
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <div />
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingEntity(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-p" onClick={saveEntityEdit} disabled={!editingEntity.name.trim()} type="button">
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tagModal !== null && (
        <div className="pm-overlay" onClick={() => setTagModal(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="pm-head">
              <h2>{tagModal.id ? 'Edit product tag' : 'Add product tag'}</h2>
              <button className="pm-close" onClick={() => setTagModal(null)} aria-label="Close">
                ×
              </button>
            </div>
            <form
              className="pm-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveTag();
              }}
            >
              <label className="pm-field">
                <span className="pm-label">Tag name</span>
                <input
                  className="set-input"
                  value={tagModal.name}
                  onChange={(e) => {
                    setTagModal({ ...tagModal, name: e.target.value });
                    setTagError('');
                  }}
                  placeholder="Enter a tag name"
                  autoFocus
                />
              </label>
              {tagError && <div className="pm-error" role="alert">{tagError}</div>}
              <div className="pm-foot">
                <span />
                <span className="page-actions">
                  <button className="btn-s" type="button" onClick={() => setTagModal(null)}>
                    Cancel
                  </button>
                  <button className="btn-p" type="submit" disabled={!tagModal.name.trim()}>
                    {tagModal.id ? 'Save' : 'Add tag'}
                  </button>
                </span>
              </div>
            </form>
          </div>
        </div>
      )}

      {reasonModal !== null && (
        <div className="pm-overlay" onClick={() => setReasonModal(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pm-head">
              <h2>{reasonModal.id ? 'Edit adjustment reason' : 'Add adjustment reason'}</h2>
              <button className="pm-close" onClick={() => setReasonModal(null)} aria-label="Close">
                ×
              </button>
            </div>
            <form
              className="pm-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveReason();
              }}
            >
              <div className="pm-field">
                <span className="pm-label">Adjustment type and name</span>
                <div className="pm-inputrow">
                  <span className="seg2" role="group" aria-label="Adjustment type">
                    <button
                      type="button"
                      className={reasonModal.type === 'Positive' ? 'active' : ''}
                      title="Positive — adds stock"
                      aria-pressed={reasonModal.type === 'Positive'}
                      onClick={() => setReasonModal({ ...reasonModal, type: 'Positive' })}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={reasonModal.type === 'Negative' ? 'active' : ''}
                      title="Negative — removes stock"
                      aria-pressed={reasonModal.type === 'Negative'}
                      onClick={() => setReasonModal({ ...reasonModal, type: 'Negative' })}
                    >
                      −
                    </button>
                  </span>
                  <input
                    className="set-input"
                    value={reasonModal.name}
                    onChange={(e) => setReasonModal({ ...reasonModal, name: e.target.value })}
                    placeholder="Enter reason name"
                    autoFocus
                  />
                </div>
                <span className="pm-hint">
                  {reasonModal.type === 'Positive' ? 'Positive: this reason adds stock on hand.' : 'Negative: this reason removes stock on hand.'}
                </span>
              </div>
              {reasonModal.id && (
                <label className="pm-switch">
                  <span>Enabled</span>
                  <Switch on={reasonModal.enabled} onClick={() => setReasonModal({ ...reasonModal, enabled: !reasonModal.enabled })} />
                </label>
              )}
              <div className="pm-foot">
                {reasonModal.id ? (
                  <button
                    type="button"
                    className="rlink pm-danger"
                    onClick={() => {
                      deleteReason(reasonModal.id);
                      setReasonModal(null);
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <span className="page-actions">
                  <button className="btn-s" type="button" onClick={() => setReasonModal(null)}>
                    Cancel
                  </button>
                  <button className="btn-p" type="submit" disabled={!reasonModal.name.trim()}>
                    {reasonModal.id ? 'Save' : 'Add reason'}
                  </button>
                </span>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
