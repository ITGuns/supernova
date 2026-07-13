import { useState } from 'react';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useProducts, type Product } from '../store/productStore';
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

// Fresh account — brands, suppliers and adjustment reasons start empty.
const INIT_BRANDS: { name: string; products: number }[] = [];
const INIT_SUPPLIERS: { name: string; description: string; markup: string; products: number }[] = [];
const ADJUSTMENTS: { name: string; type: string }[] = [];

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
  const [active, setActive] = useState('products');
  const [q, setQ] = useState('');
  const products = useProducts((s) => s.products);
  const addP = useProducts((s) => s.addProduct);
  const updP = useProducts((s) => s.updateProduct);
  const delP = useProducts((s) => s.deleteProduct);
  const togP = useProducts((s) => s.toggleActive);
  const [onbImport, setOnbImport] = useState(true);
  const [onbSell, setOnbSell] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Categories, Brands, Suppliers dynamic lists
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([]);
  const [brandsList, setBrandsList] = useState(INIT_BRANDS);
  const [suppliersList, setSuppliersList] = useState(INIT_SUPPLIERS);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');

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
    extra?: string;
    desc?: string;
    isNew?: boolean;
  } | null>(null);

  const [supAsc, setSupAsc] = useState(true);

  // Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done'>('idle');

  const label = NAV.find((n) => n.key === active)?.label ?? 'Catalog';

  const rows = products.filter(
    (p) =>
      (q.trim() === '' ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.sku.toLowerCase().includes(q.toLowerCase())) &&
      (selectedCategory === 'all' || p.categoryId === selectedCategory) &&
      (selectedBrand === 'all' || p.brand === selectedBrand) &&
      (selectedSupplier === 'all' || p.supplier === selectedSupplier)
  );

  const toggleActive = (id: string) => togP(id);

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
      categoryId: 'retail',
      priceMinor: 1000,
      taxGroupId: 'standard',
      enabled: true,
      created: 'Today',
      variants: 0,
      available: 10,
      brand: 'Nova',
      supplier: 'House',
    };
    addP(newProd);
    startEditProd(newProd);
  };

  const saveEntityEdit = () => {
    if (!editingEntity) return;
    const { type, id, name, extra, isNew } = editingEntity;

    if (type === 'category') {
      if (isNew) {
        setCategoriesList((prev) => [...prev, { id, name }]);
      } else {
        setCategoriesList((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      }
    } else if (type === 'brand') {
      if (isNew) {
        setBrandsList((prev) => [...prev, { name, products: 0 }]);
      } else {
        setBrandsList((prev) => prev.map((b) => (b.name === id ? { ...b, name } : b)));
      }
    } else if (type === 'supplier') {
      const desc = editingEntity.desc || '';
      if (isNew) {
        setSuppliersList((prev) => [...prev, { name, description: desc, markup: extra || '0%', products: 0 }]);
      } else {
        setSuppliersList((prev) => prev.map((s) => (s.name === id ? { ...s, name, description: desc, markup: extra || '0%' } : s)));
      }
    }
    setEditingEntity(null);
  };

  const deleteEntity = (type: 'category' | 'brand' | 'supplier', key: string) => {
    if (type === 'category') {
      setCategoriesList((prev) => prev.filter((c) => c.id !== key));
    } else if (type === 'brand') {
      setBrandsList((prev) => prev.filter((b) => b.name !== key));
    } else if (type === 'supplier') {
      setSuppliersList((prev) => prev.filter((s) => s.name !== key));
    }
    setEditingEntity(null);
  };

  const triggerImport = () => {
    setShowImportModal(true);
    setImportStatus('idle');
  };

  const executeImport = () => {
    setImportStatus('importing');
    setTimeout(() => {
      addP({
        id: 'p-imp2', productId: 'p-imp2', name: 'Imported Columbia Supremo Beans', sku: 'IMP-COF-02', emoji: '🫘',
        categoryId: 'coffee', priceMinor: 1800, taxGroupId: 'standard', enabled: true, created: 'Imported today',
        variants: 0, available: 50, brand: 'Sunrise', supplier: 'Fresh Foods Co.',
      });
      addP({
        id: 'p-imp1', productId: 'p-imp1', name: 'Imported Flat White Arabica', sku: 'IMP-COF-01', emoji: '☕',
        categoryId: 'coffee', priceMinor: 450, taxGroupId: 'standard', enabled: true, created: 'Imported today',
        variants: 0, available: 200, brand: 'Roast Co.', supplier: 'Roast Collective',
      });
      setImportStatus('done');
    }, 1500);
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
                  onClick={() => setEditingEntity({ type: 'brand', id: `brand-${Date.now()}`, name: '', isNew: true })}
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
                {brandsList.map((b) => (
                  <div key={b.name} className="arow brand">
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
                          setEditingEntity({ type: 'brand', id: b.name, name: b.name });
                        }}
                      >
                        ✎
                      </span>
                      <span
                        className="ic"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEntity('brand', b.name);
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
                  onClick={() => setEditingEntity({ type: 'supplier', id: `sup-${Date.now()}`, name: '', extra: '0%', desc: '', isNew: true })}
                >
                  Add supplier
                </button>
              </div>
              <div className="ctable">
                <div className="cthead sup2">
                  <span className="cth-s" onClick={() => setSupAsc((v) => !v)}>
                    <span className="cth-label">Supplier</span>
                    <SortIcon dir={supAsc ? 'asc' : 'desc'} />
                  </span>
                  <span>Description</span>
                  <span>Default markup</span>
                  <span>Number of products</span>
                  <span />
                </div>
                {[...suppliersList]
                  .sort((a, b) => (supAsc ? 1 : -1) * a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map((s) => (
                    <div key={s.name} className="ctrow sup2">
                      <span
                        className="rlink"
                        onClick={() => {
                          setSelectedSupplier(s.name);
                          setActive('products');
                        }}
                      >
                        {s.name}
                      </span>
                      <span className="ct-muted">{s.description}</span>
                      <span>{s.markup}</span>
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
                            setEditingEntity({ type: 'supplier', id: s.name, name: s.name, extra: s.markup, desc: s.description });
                          }}
                        >
                          ✎
                        </span>
                        <span
                          className="ic-del"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntity('supplier', s.name);
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
                  onClick={() => setEditingEntity({ type: 'category', id: `cat-${Date.now()}`, name: '', isNew: true })}
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
                {categoriesList.map((c) => (
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
                <button className="btn-p">Add reason</button>
              </div>
              <div className="atable">
                <div className="athead adj">
                  <span>Name</span>
                  <span>Adjustment type</span>
                  <span className="c">Enabled</span>
                </div>
                {ADJUSTMENTS.map((a) => (
                  <div key={a.name} className="arow adj">
                    <span>{a.name}</span>
                    <span>{a.type}</span>
                    <span className="c ok-check">✓</span>
                  </div>
                ))}
              </div>
            </>
          ) : active === 'giftcards' ? (
            <>
              <div className="gc-hero">
                <h2>Sell gift cards to boost revenue</h2>
                <p>Bring in new customers and increase revenue with flexible and brandable gift cards</p>
                <button className="btn-p gc-hero-btn">Get started</button>
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
                      {categoriesList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Tags</label>
                    <input placeholder="Enter tags" />
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
                      {suppliersList.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
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
                      {brandsList.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f-field">
                    <label>Status</label>
                    <div className="f-select sel">Active</div>
                  </div>
                </div>
                <div className="sc-factions">
                  <span
                    className="rlink"
                    onClick={() => {
                      setQ('');
                      setSelectedCategory('all');
                      setSelectedBrand('all');
                      setSelectedSupplier('all');
                    }}
                  >
                    Clear filters
                  </span>
                  <button className="btn-p">Search</button>
                </div>
              </div>

              <div className="disp-row">
                <span>
                  Displaying {rows.length} active product{rows.length === 1 ? '' : 's'}
                  {q.trim() && ` containing “${q}”`}
                </span>
                <span className="rlink">⤓ Export list…</span>
              </div>

              <div className="atable">
                <div className="athead prod2">
                  <span className="c">
                    <span className="acheck" />
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
                        <span className="acheck" />
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
                    {categoriesList.map((c) => (
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
                    {brandsList.map((b) => (
                      <option key={b.name} value={b.name}>{b.name}</option>
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
                    {suppliersList.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
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
                <>
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
                  <div className="set-field">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                      Default Markup
                    </label>
                    <input
                      className="set-input"
                      value={editingEntity.extra || ''}
                      onChange={(e) => setEditingEntity({ ...editingEntity, extra: e.target.value })}
                      placeholder="e.g. 15%"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
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
                    Select a CSV or XLSX spreadsheet containing your product details to quickly populate your catalog.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                    <button className="btn-s" onClick={() => setShowImportModal(false)}>
                      Cancel
                    </button>
                    <button className="btn-p" onClick={executeImport}>
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
                  <div style={{ fontSize: '48px' }}>✅</div>
                  <h3>Import complete!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0' }}>
                    Spreadsheet successfully parsed. 2 new coffee products have been added to your catalog.
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
