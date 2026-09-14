import { useState } from 'react';
import { type CatalogItem } from '../data/catalog';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { useProducts } from '../store/productStore';
import { useRegister } from '../store/registerStore';

// Folder / stripe colours, assigned to categories in the order they're listed
// in Catalog so every store gets a consistent palette without configuration.
const PALETTE = ['#e6a817', '#a855f7', '#2dd4bf', '#e0483f', '#3fae6b', '#5b8fd6', '#ef6f3c', '#e13ec9'];
const NEUTRAL = '#5E5E5D';

export function QuickKeys({ query }: { query: string }) {
  const addItem = useCart((s) => s.addItem);
  const allProducts = useProducts((s) => s.products);
  const categories = useCatalogMeta((s) => s.categories);
  const CATALOG = allProducts.filter((p) => p.enabled);
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const colorOf = (categoryId: string) => {
    const i = categories.findIndex((c) => c.id === categoryId);
    return i >= 0 ? PALETTE[i % PALETTE.length]! : NEUTRAL;
  };

  // A layout built in Settings → Quick keys takes over the grid.
  const quickKeysEnabled = useRegister((s) => s.quickKeysEnabled);
  const layout = useRegister((s) => s.layouts.find((l) => l.id === s.currentLayoutId));
  const layoutKeys = quickKeysEnabled ? (layout?.keys ?? []) : [];

  const tile = (it: CatalogItem & { image?: string }) => (
    <button key={it.id} className="qk-tile" onClick={() => addItem(it)}>
      <span className="qk-stripe" style={{ background: colorOf(it.categoryId) }} />
      {it.image && <img src={it.image} alt="" className="qk-tile-img" />}
      <span className="qk-tile-name">{it.name}</span>
      <span className="qk-tile-price">{fmt(it.priceMinor)}</span>
    </button>
  );

  if (q) {
    const matches = CATALOG.filter(
      (it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q),
    );
    return (
      <div className="qk-grid">
        {matches.map(tile)}
        {matches.length === 0 && <div className="qk-empty">No products match “{query}”.</div>}
      </div>
    );
  }

  if (layoutKeys.length > 0) {
    const placed = [...layoutKeys].sort((a, b) => a.slot - b.slot);
    return (
      <div className="qk-grid">
        {placed.map((k) => {
          const p = CATALOG.find((x) => x.id === k.productId);
          if (!p) return null;
          return (
            <button key={k.id} className="qk-tile" onClick={() => addItem(p)}>
              <span className="qk-stripe" style={{ background: k.color || colorOf(p.categoryId) }} />
              {k.showImage && p.image && <img src={p.image} alt="" className="qk-tile-img" />}
              <span className="qk-tile-name">{k.label}</span>
              <span className="qk-tile-price">{fmt(p.priceMinor)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (open) {
    const cat = categories.find((c) => c.id === open);
    const items = CATALOG.filter((c) => c.categoryId === open);
    return (
      <div className="qk-wrap">
        <div className="qk-folder-head" style={{ background: colorOf(open) }}>
          <span>{cat?.name}</span>
          <button onClick={() => setOpen(null)} aria-label="Back">
            ×
          </button>
        </div>
        <div className="qk-grid">{items.map(tile)}</div>
      </div>
    );
  }

  if (CATALOG.length === 0) {
    return (
      <div className="qk-grid">
        <div className="qk-empty">No products yet. Add products in Catalog to build your quick keys.</div>
      </div>
    );
  }

  // Folders only for categories that hold more than one product; a lone
  // product is quicker to reach as a plain tile.
  const folders = categories.filter((c) => CATALOG.filter((it) => it.categoryId === c.id).length > 1);
  return (
    <div className="qk-grid">
      {folders.map((c) => {
        const count = CATALOG.filter((it) => it.categoryId === c.id).length;
        return (
          <button key={c.id} className="qk-folder" style={{ background: colorOf(c.id) }} onClick={() => setOpen(c.id)}>
            <span className="qk-folder-name">{c.name}</span>
            <span className="qk-folder-count">{count}</span>
          </button>
        );
      })}
      {CATALOG.map(tile)}
    </div>
  );
}
