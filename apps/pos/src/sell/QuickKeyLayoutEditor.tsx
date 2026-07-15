import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Switch } from '../admin/controls';
import { fmt } from '../lib/format';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { type Product, useProducts } from '../store/productStore';
import { QK_COLORS, QK_SLOTS, type QuickKey, useRegister } from '../store/registerStore';

/** Placeholder art for a product with no uploaded image. */
function Thumb({ image }: { image?: string }) {
  if (image) return <img className="qkl-thumb-img" src={image} alt="" />;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15l4.5-4.5 4 4L15 11l6 6" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </svg>
  );
}

function KeyTile({ k, product }: { k: QuickKey; product?: Product }) {
  return (
    <>
      {k.color && <span className="qkl-key-stripe" style={{ background: k.color }} />}
      {k.showImage && product?.image && <img className="qkl-key-img" src={product.image} alt="" />}
      <span className="qkl-key-label">{k.label}</span>
    </>
  );
}

export function QuickKeyLayoutEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();

  const layout = useRegister((s) => s.layouts.find((l) => l.id === id));
  const updateLayout = useRegister((s) => s.updateLayout);
  const addKey = useRegister((s) => s.addKey);
  const updateKey = useRegister((s) => s.updateKey);
  const deleteKey = useRegister((s) => s.deleteKey);
  const moveKey = useRegister((s) => s.moveKey);

  const products = useProducts((s) => s.products);
  const addProduct = useProducts((s) => s.addProduct);
  const categories = useCatalogMeta((s) => s.categories);
  const brands = useCatalogMeta((s) => s.brands);
  const suppliers = useCatalogMeta((s) => s.suppliers);

  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);

  // Draft state for the Edit quick key modal — committed on Save.
  const [editing, setEditing] = useState<QuickKey | null>(null);
  const [dLabel, setDLabel] = useState('');
  const [dColor, setDColor] = useState('');
  const [dImage, setDImage] = useState(false);

  if (!layout) return <Navigate to="/sell/settings" replace />;

  const q = query.trim().toLowerCase();
  // Focusing the box lists every product; typing narrows it.
  const matches = products
    .filter((p) => p.enabled)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .slice(0, 20);

  const place = (p: { id: string; name: string }) => {
    addKey(layout.id, p);
    setQuery('');
    setPickerOpen(false);
  };

  const createAndPlace = () => {
    const name = query.trim();
    if (!name) return;
    const pid = `p-${Date.now()}`;
    const prod: Product = {
      id: pid,
      productId: pid,
      name,
      sku: `SKU-${1000 + products.length + 1}`,
      emoji: '📦',
      categoryId: categories[0]?.id ?? 'retail',
      priceMinor: 0,
      taxGroupId: 'standard',
      enabled: true,
      created: 'Today',
      variants: 0,
      available: 0,
      brand: brands[0]?.name ?? 'Nova',
      supplier: suppliers[0]?.name ?? 'House',
    };
    addProduct(prod);
    place(prod);
  };

  // Close the picker only when focus leaves the whole search block, so clicking
  // a result still registers.
  const closePickerOnBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPickerOpen(false);
  };

  const openKey = (k: QuickKey) => {
    setEditing(k);
    setDLabel(k.label);
    setDColor(k.color);
    setDImage(k.showImage);
  };

  const saveKey = () => {
    if (!editing) return;
    updateKey(layout.id, editing.id, { label: dLabel, color: dColor, showImage: dImage });
    setEditing(null);
  };

  const removeKey = () => {
    if (!editing) return;
    deleteKey(layout.id, editing.id);
    setEditing(null);
  };

  const drop = (slot: number) => {
    if (dragId) moveKey(layout.id, dragId, slot);
    setDragId(null);
    setOverSlot(null);
  };

  const editingProduct = editing ? products.find((p) => p.id === editing.productId) : undefined;

  return (
    <main className="sell-page">
      <h1 className="sell-title">{layout.name.trim() || 'Untitled layout'}</h1>
      <div className="sell-subbar qkl-subbar">
        <span>Rename, reposition and recolor keys, or organize your products into folders.</span>
        <button className="btn-primary" onClick={() => nav('/sell/settings')}>
          Done
        </button>
      </div>

      <div className="rs-section">
        <div className="rs-side">
          <div className="cr-h">General</div>
        </div>
        <div className="rs-main">
          <label className="qkl-label" htmlFor="qkl-name">
            Layout name
          </label>
          <input
            id="qkl-name"
            className="qkl-input"
            value={layout.name}
            onChange={(e) => updateLayout(layout.id, { name: e.target.value })}
          />

          <div className="qkl-label qkl-label-sp">Quick key behavior</div>
          <label className="qkl-check">
            <input
              type="checkbox"
              checked={layout.keepFolderOpen}
              onChange={(e) => updateLayout(layout.id, { keepFolderOpen: e.target.checked })}
            />
            <span>Leave selected folder open until end of the sale</span>
          </label>
        </div>
      </div>

      <div className="rs-divider" />

      <div className="rs-section">
        <div className="rs-side">
          <div className="cr-h">Add products</div>
          <div className="rs-desc">
            Search for products to add to your quick key layout. Drag and drop to rearrange.
          </div>
        </div>
        <div className="rs-main">
          <label className="qkl-label" htmlFor="qkl-search">
            Search for products
          </label>
          <div className="qkl-search-wrap" onBlur={closePickerOnBlur}>
            <span className="qkl-search-ic" aria-hidden="true">
              ⌕
            </span>
            <input
              id="qkl-search"
              className="qkl-input qkl-search"
              placeholder="Start typing or scanning"
              value={query}
              onFocus={() => setPickerOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setPickerOpen(true);
              }}
            />
            {pickerOpen && (
              <div className="qkl-results">
                <div className="qkl-results-list">
                  {matches.map((p) => (
                    // Select on mousedown: it fires before the input's blur closes the
                    // picker, so the choice always registers regardless of focus quirks.
                    <button
                      key={p.id}
                      className="qkl-result"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        place(p);
                      }}
                    >
                      <span className="qkl-thumb">
                        <Thumb image={p.image} />
                      </span>
                      <span className="qkl-result-txt">
                        <span className="qkl-result-name">{p.name}</span>
                        <span className="qkl-result-sku">{p.sku}</span>
                      </span>
                      <span className="qkl-result-price">{fmt(p.priceMinor)}</span>
                    </button>
                  ))}
                  {matches.length === 0 && (
                    <div className="qkl-noresult">
                      {q
                        ? `No products match “${query}”.`
                        : 'No products yet. Type a name to create one.'}
                    </div>
                  )}
                </div>
                {q && (
                  <button
                    className="qkl-addnew"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      createAndPlace();
                    }}
                  >
                    ✛ Add “{query}” as a new product.
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="qkl-grid">
            {Array.from({ length: QK_SLOTS }, (_, slot) => {
              const k = layout.keys.find((x) => x.slot === slot);
              const product = k ? products.find((p) => p.id === k.productId) : undefined;
              return (
                <div
                  key={slot}
                  className={`qkl-slot ${k ? 'filled' : ''} ${overSlot === slot ? 'over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverSlot(slot);
                  }}
                  onDragLeave={() => setOverSlot((s) => (s === slot ? null : s))}
                  onDrop={() => drop(slot)}
                >
                  {k && (
                    <button
                      className="qkl-key"
                      draggable
                      onDragStart={() => setDragId(k.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverSlot(null);
                      }}
                      onClick={() => openKey(k)}
                      title={`Edit ${k.label}`}
                    >
                      <KeyTile k={k} product={product} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editing && (
        <div className="pm-overlay" onClick={() => setEditing(null)}>
          <div className="pm qkl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-head">
              <h2>Edit quick key</h2>
              <button className="pm-close" onClick={() => setEditing(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="qkl-modal-body">
              <div className="qkl-preview-row">
                <div className="qkl-preview">
                  <span className="qkl-preview-bar" style={dColor ? { background: dColor } : undefined} />
                  <div className="qkl-preview-key">
                    {dImage && editingProduct?.image && (
                      <img className="qkl-key-img" src={editingProduct.image} alt="" />
                    )}
                    <span className="qkl-key-label">{dLabel}</span>
                  </div>
                </div>
                <div className="qkl-preview-meta">
                  <div className="qkl-preview-name">{editingProduct?.name ?? editing.label}</div>
                  <div className="qkl-preview-sku">{editingProduct?.sku ?? '—'}</div>
                </div>
              </div>

              <div className="qkl-field">
                <label className="qkl-label" htmlFor="qkl-key-label">
                  Quick key label
                </label>
                <input
                  id="qkl-key-label"
                  className="qkl-input"
                  value={dLabel}
                  onChange={(e) => setDLabel(e.target.value)}
                />
              </div>

              <div className="qkl-field">
                <div className="qkl-label">Quick key label</div>
                <div className="qkl-swatches">
                  {QK_COLORS.map((c) => (
                    <button
                      key={c || 'default'}
                      className={`qkl-swatch ${dColor === c ? 'sel' : ''}`}
                      style={{ background: c || 'var(--qkl-default-key)' }}
                      onClick={() => setDColor(c)}
                      aria-label={c ? `Colour ${c}` : 'No colour'}
                    />
                  ))}
                </div>
              </div>

              <div className="qkl-showimg">
                <Switch on={dImage} onClick={() => setDImage((v) => !v)} />
                <span>Show image</span>
              </div>

              <div className="qkl-modal-foot">
                <button className="qkl-delete" onClick={removeKey}>
                  🗑 Delete quick key
                </button>
                <button className="btn-primary" onClick={saveKey}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
