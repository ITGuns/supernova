import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useAdjustmentReasons } from '../store/adjustmentReasonsStore';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { useProducts, type Product } from '../store/productStore';
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

/** Minimal CSV parser: handles quoted fields, escaped quotes and CR/LF rows. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) out.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) out.push(row);
  return out;
}

/** Build a CSV string and trigger a browser download. */
function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const location = useLocation();
  const initialQ = (location.state as { q?: string } | null)?.q ?? '';
  const [active, setActive] = useState('products');
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
  const deleteReason = useAdjustmentReasons((s) => s.deleteReason);
  const [showAddReason, setShowAddReason] = useState(false);
  const [reasonName, setReasonName] = useState('');
  const [reasonType, setReasonType] = useState('Decrease stock');

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [tagQ, setTagQ] = useState('');

  // Row selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Edit Product Modal states
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editEmoji, setEditEmoji] = useState('📦');
  const [editImage, setEditImage] = useState<string | undefined>(undefined);
  const [editPrice, setEditPrice] = useState('0.00');
  const [editAvailable, setEditAvailable] = useState(0);
  const [editBrand, setEditBrand] = useState('Nova');
  const [editSupplier, setEditSupplier] = useState('House');
  const [editCategoryId, setEditCategoryId] = useState('retail');

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done'>('idle');
  const [importedCount, setImportedCount] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  const label = NAV.find((n) => n.key === active)?.label ?? 'Catalog';

  const tagTokens = tagQ.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const rows = products.filter((p) => {
    const hay = `${p.name} ${p.sku}`.toLowerCase();
    return (
      (q.trim() === '' ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.sku.toLowerCase().includes(q.toLowerCase())) &&
      tagTokens.every((t) => hay.includes(t)) &&
      (selectedCategory === 'all' || p.categoryId === selectedCategory) &&
      (selectedBrand === 'all' || p.brand === selectedBrand) &&
      (selectedSupplier === 'all' || p.supplier === selectedSupplier) &&
      (selectedStatus === 'all' || (selectedStatus === 'active') === p.enabled)
    );
  });

  const toggleActive = (id: string) => togP(id);

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

  const startEditProd = (p: Product) => {
    setEditingProdId(p.id);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditEmoji(p.emoji);
    setEditImage(p.image);
    setEditPrice((p.priceMinor / 100).toFixed(2));
    setEditAvailable(p.available);
    setEditBrand(p.brand);
    setEditSupplier(p.supplier);
    setEditCategoryId(p.categoryId);
  };

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditImage(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const saveProductEdit = () => {
    if (!editingProdId) return;
    updP(editingProdId, {
      name: editName,
      sku: editSku,
      emoji: editEmoji,
      image: editImage,
      priceMinor: Math.round(parseFloat(editPrice || '0') * 100),
      available: Number(editAvailable),
      brand: editBrand,
      supplier: editSupplier,
      categoryId: editCategoryId,
    });
    setEditingProdId(null);
  };

  const deleteProduct = (id: string) => {
    delP(id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setEditingProdId(null);
  };

  const addProduct = () => {
    const nextNum = products.length + 1;
    const id = `p-${Date.now()}`;
    const newProd: Product = {
      id,
      productId: id,
      name: `New Product ${nextNum}`,
      sku: `SKU-${1000 + nextNum}`,
      emoji: '📦',
      categoryId: categories[0]?.id ?? 'retail',
      priceMinor: 1000,
      taxGroupId: 'standard',
      enabled: true,
      created: 'Today',
      variants: 0,
      available: 10,
      brand: brands[0]?.name ?? 'Nova',
      supplier: suppliers[0]?.name ?? 'House',
    };
    addP(newProd);
    startEditProd(newProd);
  };

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

  const submitAddReason = () => {
    if (!reasonName.trim()) return;
    addReason(reasonName.trim(), reasonType);
    setReasonName('');
    setShowAddReason(false);
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

  const triggerImport = () => {
    setShowImportModal(true);
    setImportStatus('idle');
    setImportedCount(0);
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    setImportStatus('importing');
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseCsv(text);
      let count = 0;
      if (parsed.length > 1) {
        const header = (parsed[0] ?? []).map((h) => h.trim().toLowerCase());
        const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
        const iName = col('name', 'product', 'product name', 'title');
        const iPrice = col('price', 'retail price', 'retail_price');
        const iSku = col('sku', 'sku code', 'code');
        const iCat = col('category', 'product category');
        parsed.slice(1).forEach((r, idx) => {
          const name = iName >= 0 ? (r[iName] ?? '').trim() : '';
          const price = iPrice >= 0 ? parseFloat((r[iPrice] ?? '').replace(/[^0-9.-]/g, '')) : NaN;
          if (!name || !Number.isFinite(price) || price < 0) return; // skip invalid rows
          const rawCat = iCat >= 0 ? (r[iCat] ?? '').trim() : '';
          const matchedCat = categories.find(
            (c) => c.name.toLowerCase() === rawCat.toLowerCase() || c.id === rawCat,
          );
          const id = `p-imp-${Date.now()}-${idx}`;
          addP({
            id,
            productId: id,
            name,
            sku: (iSku >= 0 && (r[iSku] ?? '').trim()) || `IMP-${1000 + idx}`,
            emoji: '📦',
            categoryId: matchedCat?.id ?? categories[0]?.id ?? 'retail',
            priceMinor: Math.round(price * 100),
            taxGroupId: 'standard',
            enabled: true,
            created: 'Imported today',
            variants: 0,
            available: 0,
            brand: brands[0]?.name ?? 'Nova',
            supplier: suppliers[0]?.name ?? 'House',
          });
          count++;
        });
      }
      setImportedCount(count);
      setImportStatus('done');
    };
    reader.readAsText(file);
  };

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'brands' ? (
            <>
              <div className="page-head">
                <h1 className="page-title">Brands</h1>
                <button
                  className="btn-p"
                  onClick={() => setEditingEntity({ type: 'brand', id: '', name: '', isNew: true })}
                >
                  Add brand
                </button>
              </div>
              <div className="page-subbar">A list of all of your brands.</div>
              <div className="atable">
                <div className="athead brand">
                  <span>Name</span>
                  <span className="r">Number of products</span>
                  <span />
                </div>
                {brands.map((b) => (
                  <div key={b.id} className="arow brand">
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
                          setEditingEntity({ type: 'brand', id: b.id, name: b.name });
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
                  onClick={() => setEditingEntity({ type: 'supplier', id: '', name: '', desc: '', isNew: true })}
                >
                  Add supplier
                </button>
              </div>
              <div className="ctable">
                <div className="cthead sup3">
                  <span className="cth-s" onClick={() => setSupAsc((v) => !v)}>
                    <span className="cth-label">Supplier</span>
                    <SortIcon dir={supAsc ? 'asc' : 'desc'} />
                  </span>
                  <span>Description</span>
                  <span>Number of products</span>
                  <span />
                </div>
                {[...suppliers]
                  .sort((a, b) => (supAsc ? 1 : -1) * a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((s) => (
                    <div key={s.id} className="ctrow sup3">
                      <span
                        className="rlink"
                        onClick={() => {
                          setSelectedSupplier(s.name);
                          setActive('products');
                        }}
                      >
                        {s.name}
                      </span>
                      <span className="ct-muted">{s.description || '—'}</span>
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
                            setEditingEntity({ type: 'supplier', id: s.id, name: s.name, desc: s.description });
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
          ) : active === 'categories' ? (
            <>
              <div className="page-head">
                <h1 className="page-title">Product categories</h1>
                <button
                  className="btn-p"
                  onClick={() => setEditingEntity({ type: 'category', id: '', name: '', isNew: true })}
                >
                  Add category
                </button>
              </div>
              <div className="page-subbar">A list of all of your product categories.</div>
              <div className="atable">
                <div className="athead pcat">
                  <span>Name</span>
                  <span className="r">Number of products</span>
                  <span />
                </div>
                {categories.map((c) => (
                  <div key={c.id} className="arow pcat">
                    <span
                      className="rlink"
                      onClick={() => {
                        setSelectedCategory(c.id);
                        setActive('products');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {c.name}
                    </span>
                    <span className="r">{products.filter((p) => p.categoryId === c.id).length}</span>
                    <span className="row-actions">
                      <span
                        className="rlink"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedCategory(c.id);
                          setActive('products');
                        }}
                      >
                        View products
                      </span>
                      <span
                        className="ic"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntity({ type: 'category', id: c.id, name: c.name });
                        }}
                      >
                        ✎
                      </span>
                      <span
                        className="ic"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEntity('category', c.id);
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
              <div className="page-head">
                <span className="page-subbar" style={{ flex: 1, marginBottom: 0 }}>
                  Use adjustment reasons to track your inventory movements.
                </span>
                <button className="btn-p" onClick={() => setShowAddReason((v) => !v)}>
                  Add reason
                </button>
              </div>
              {showAddReason && (
                <div className="add-bar">
                  <input
                    className="set-input"
                    value={reasonName}
                    onChange={(e) => setReasonName(e.target.value)}
                    placeholder="Reason name, e.g. Damaged"
                    style={{ flex: 1 }}
                  />
                  <select
                    className="set-select"
                    value={reasonType}
                    onChange={(e) => setReasonType(e.target.value)}
                    style={{ height: '40px' }}
                  >
                    <option value="Decrease stock">Decrease stock</option>
                    <option value="Increase stock">Increase stock</option>
                  </select>
                  <button className="btn-p" onClick={submitAddReason} disabled={!reasonName.trim()}>
                    Save reason
                  </button>
                </div>
              )}
              <div className="atable">
                <div className="athead adj4">
                  <span>Name</span>
                  <span>Adjustment type</span>
                  <span className="c">Enabled</span>
                  <span />
                </div>
                {reasons.map((a) => (
                  <div key={a.id} className="arow adj4">
                    <span>{a.name}</span>
                    <span>{a.type}</span>
                    <span className="c ok-check">✓</span>
                    <span className="row-actions">
                      <span className="ic" style={{ cursor: 'pointer' }} onClick={() => deleteReason(a.id)}>
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
                <button
                  className="btn-p gc-hero-btn"
                  onClick={() => {
                    setQ('Gift Card');
                    setActive('products');
                  }}
                >
                  Get started
                </button>
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
          ) : active !== 'products' ? (
            <>
              <h1 className="page-title">{label}</h1>
              <div className="placeholder-card">
                <div className="placeholder-icon">🧩</div>
                <div className="placeholder-title">{label}</div>
                <div className="placeholder-hint">This catalog area is being built.</div>
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
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
                  </div>
                  <div className="f-field">
                    <label>Product category</label>
                    <select
                      className="set-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Tags</label>
                    <input value={tagQ} onChange={(e) => setTagQ(e.target.value)} placeholder="Enter tags" />
                  </div>
                </div>
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Supplier</label>
                    <select
                      className="set-select"
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
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
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All brands</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Status</label>
                    <select
                      className="set-select"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'active' | 'inactive')}
                      style={{ height: '40px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 8px' }}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="sc-factions">
                  <span
                    className="rlink"
                    onClick={() => {
                      setQ('');
                      setTagQ('');
                      setSelectedCategory('all');
                      setSelectedBrand('all');
                      setSelectedSupplier('all');
                      setSelectedStatus('all');
                    }}
                  >
                    Clear filters
                  </span>
                </div>
              </div>

              <div className="disp-row">
                <span>
                  Displaying {rows.length} product{rows.length === 1 ? '' : 's'}
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
                <div className="athead prod2">
                  <span className="c">
                    <span className={`acheck sel ${allSelected ? 'on' : ''}`} onClick={toggleSelectAll} />
                  </span>
                  <span />
                  <span>Product</span>
                  <span>Brand</span>
                  <span>Supplier</span>
                  <span className="r">Available to sell</span>
                  <span className="r">Retail price</span>
                  <span className="c">Active</span>
                  <span>Created</span>
                  <span />
                </div>
                {rows.map((p) => (
                  <div key={p.id}>
                    <div className="arow prod2" onClick={() => p.variants > 0 && setExpanded((e) => (e === p.id ? null : p.id))}>
                      <span className="c" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`acheck sel ${selectedIds.includes(p.id) ? 'on' : ''}`}
                          onClick={() => toggleSelect(p.id)}
                        />
                      </span>
                      <span className="c">
                        {p.variants > 0 && <span className={`pchev ${expanded === p.id ? 'open' : ''}`}>›</span>}
                      </span>
                      <span className="prod2-name">
                        <span className="pthumb">
                          {p.image ? <img src={p.image} alt={p.name} className="pthumb-img" /> : p.emoji}
                        </span>
                        <span>
                          <span className="rlink" onClick={(e) => { e.stopPropagation(); startEditProd(p); }}>
                            {p.name}
                          </span>
                          <br />
                          <span className="prod-sku">{p.variants > 0 ? `${p.variants} variants` : p.sku}</span>
                        </span>
                      </span>
                      <span className="rlink">{p.brand}</span>
                      <span className="rlink">{p.supplier}</span>
                      <span className="r">{p.available}</span>
                      <span className="r">{fmt(p.priceMinor)}</span>
                      <span className="c" onClick={(e) => e.stopPropagation()}>
                        <Switch on={p.enabled} onClick={() => toggleActive(p.id)} />
                      </span>
                      <span className="prod-created">{p.created}</span>
                      <span
                        className="c prod-pencil"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditProd(p);
                        }}
                      >
                        ✎
                      </span>
                    </div>
                    {expanded === p.id && p.variants > 0 && (
                      <div className="prod-variants">
                        {Array.from({ length: p.variants }).map((_, vi) => (
                          <div key={vi} className="pvar-row">
                            <span>
                              {p.name} · Variant {vi + 1}
                            </span>
                            <span className="r">{fmt(p.priceMinor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {editingProdId !== null && (
        <div className="pm-overlay" onClick={() => setEditingProdId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pm-head">
              <h2>Edit Product Profile</h2>
              <button className="pm-close" onClick={() => setEditingProdId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ width: '84px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Image
                  </label>
                  <label className="prod-img-drop" title="Upload product image">
                    {editImage ? (
                      <img src={editImage} alt="Product" className="prod-img-preview" />
                    ) : (
                      <span className="prod-img-emoji">{editEmoji}</span>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPickImage(e.target.files?.[0])} />
                    <span className="prod-img-plus">+</span>
                  </label>
                  {editImage && (
                    <button type="button" className="prod-img-remove" onClick={() => setEditImage(undefined)}>Remove</button>
                  )}
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Product name
                  </label>
                  <input
                    className="set-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Product Name"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    SKU code
                  </label>
                  <input
                    className="set-input"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    placeholder="e.g. COF-LAT"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Category
                  </label>
                  <select
                    className="set-select"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                  >
                    {!categories.some((c) => c.id === editCategoryId) && (
                      <option value={editCategoryId}>{editCategoryId}</option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Brand
                  </label>
                  <select
                    className="set-select"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                  >
                    {!brands.some((b) => b.name === editBrand) && <option value={editBrand}>{editBrand}</option>}
                    {brands.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Supplier
                  </label>
                  <select
                    className="set-select"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                  >
                    {!suppliers.some((s) => s.name === editSupplier) && (
                      <option value={editSupplier}>{editSupplier}</option>
                    )}
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Retail price
                  </label>
                  <input
                    className="set-input"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Available stock
                  </label>
                  <input
                    className="set-input"
                    type="number"
                    value={editAvailable}
                    onChange={(e) => setEditAvailable(Number(e.target.value))}
                    placeholder="0"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => deleteProduct(editingProdId)}
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
                  Delete Product
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingProdId(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-p" onClick={saveProductEdit} disabled={!editName.trim()} type="button">
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

              {editingEntity.type === 'supplier' && (
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

      {showImportModal && (
        <div className="pm-overlay" onClick={() => setShowImportModal(false)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="pm-head">
              <h2>Import Products</h2>
              <button className="pm-close" onClick={() => setShowImportModal(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}>
              {importStatus === 'idle' ? (
                <>
                  <div style={{ fontSize: '48px' }}>📁</div>
                  <h3>Upload product spreadsheet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0' }}>
                    Select a CSV spreadsheet with a header row like name,price,sku,category (price in dollars) to
                    quickly populate your catalog.
                  </p>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleImportFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                    <button className="btn-s" onClick={() => setShowImportModal(false)}>
                      Cancel
                    </button>
                    <button className="btn-p" onClick={() => importFileRef.current?.click()}>
                      Select spreadsheet
                    </button>
                  </div>
                </>
              ) : importStatus === 'importing' ? (
                <>
                  <div className="sh-empty-icon" style={{ animation: 'spin 1.5s infinite linear' }}>
                    ⏳
                  </div>
                  <h3>Importing catalog...</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0' }}>
                    Please wait while Nova imports your products. This should only take a moment.
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '48px' }}>{importedCount > 0 ? '✅' : '⚠️'}</div>
                  <h3>{importedCount > 0 ? 'Import complete!' : 'Nothing imported'}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0' }}>
                    {importedCount > 0
                      ? `Imported ${importedCount} product${importedCount === 1 ? '' : 's'} from your spreadsheet.`
                      : 'No valid rows found. Make sure the CSV has a header row with name and price columns.'}
                  </p>
                  <button
                    className="btn-p"
                    style={{ marginTop: '12px', alignSelf: 'center' }}
                    onClick={() => setShowImportModal(false)}
                  >
                    View Catalog
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
