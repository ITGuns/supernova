import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadCsv, parseCsv } from '../lib/csv';
import { DEFAULT_CATEGORY_ID, useCatalogMeta } from '../store/catalogMetaStore';
import { useProducts, type Product } from '../store/productStore';
import '../styles/product-editor.css';

// Catalog → Products → Import: Lightspeed's three steps — 1. Upload file,
// 2. Map columns, 3. Import. Columns are matched to Nova fields by header
// name and can be changed before anything is written.

type FieldKey = 'name' | 'sku' | 'price' | 'cost' | 'category' | 'brand' | 'supplier' | 'supplierCode' | 'description' | 'tags' | 'available' | 'active';

const FIELDS: { key: FieldKey; label: string; required?: boolean; aliases: string[] }[] = [
  { key: 'name', label: 'Product name', required: true, aliases: ['name', 'product', 'product name', 'title', 'product_name'] },
  { key: 'sku', label: 'SKU', aliases: ['sku', 'sku code', 'code', 'barcode', 'handle'] },
  { key: 'price', label: 'Retail price', required: true, aliases: ['price', 'retail price', 'retail_price', 'retail', 'sell price'] },
  { key: 'cost', label: 'Supply price', aliases: ['cost', 'supply price', 'supply_price', 'supplier price', 'cost price'] },
  { key: 'category', label: 'Product category', aliases: ['category', 'product category', 'product_category', 'type'] },
  { key: 'brand', label: 'Brand', aliases: ['brand', 'brand name', 'brand_name'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'supplier name', 'supplier_name', 'vendor'] },
  { key: 'supplierCode', label: 'Supplier code', aliases: ['supplier code', 'supplier_code', 'vendor code'] },
  { key: 'description', label: 'Description', aliases: ['description', 'desc'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag'] },
  { key: 'available', label: 'Inventory (stock on hand)', aliases: ['available', 'inventory', 'stock', 'quantity', 'qty', 'stock on hand', 'inventory_main outlet'] },
  { key: 'active', label: 'Active', aliases: ['active', 'status', 'enabled'] },
];

const TEMPLATE: string[][] = [
  ['name', 'sku', 'retail price', 'supply price', 'category', 'brand', 'supplier', 'supplier code', 'description', 'tags', 'inventory', 'active'],
  ['Example T-shirt', 'TS-001', '25.00', '9.50', 'Apparel', 'Nova', 'House', 'H-TS-001', 'Soft cotton tee', 'summer,cotton', '10', 'yes'],
];

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

export function ImportProductsPage() {
  const nav = useNavigate();
  const categories = useCatalogMeta((s) => s.categories);
  const brands = useCatalogMeta((s) => s.brands);
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const addEntity = useCatalogMeta((s) => s.addEntity);
  const products = useProducts((s) => s.products);
  const addProduct = useProducts((s) => s.addProduct);
  const updateProduct = useProducts((s) => s.updateProduct);

  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [updateExisting, setUpdateExisting] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(typeof reader.result === 'string' ? reader.result : '');
      if (parsed.length < 2) return setError('That file has no product rows. It needs a header row and at least one product.');
      const head = (parsed[0] ?? []).map((h) => h.trim().toLowerCase());
      const auto: Partial<Record<FieldKey, number>> = {};
      for (const f of FIELDS) {
        const idx = head.findIndex((h) => f.aliases.includes(h));
        if (idx >= 0) auto[f.key] = idx;
      }
      setRows(parsed);
      setMapping(auto);
      setFileName(file.name);
      setError('');
      setStep(2);
    };
    reader.readAsText(file);
  };

  const col = (r: string[], key: FieldKey): string => {
    const i = mapping[key];
    return i === undefined ? '' : (r[i] ?? '').trim();
  };
  const money = (s: string) => {
    const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };

  // What the import will do, row by row, so step 3 can show it before writing.
  const plan = body.map((r, i) => {
    const name = col(r, 'name');
    const price = money(col(r, 'price'));
    const sku = col(r, 'sku');
    const existing = sku ? products.find((p) => p.sku.toLowerCase() === sku.toLowerCase()) : undefined;
    const problem = !name ? 'Missing product name' : price === null ? 'Missing or invalid retail price' : '';
    return { i, name, sku, price, existing, problem };
  });
  const valid = plan.filter((p) => !p.problem);
  const toUpdate = valid.filter((p) => p.existing && updateExisting).length;
  const toCreate = valid.filter((p) => !p.existing || !updateExisting).length;

  const runImport = () => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const ensure = (kind: 'categories' | 'brands' | 'suppliers', name: string): string => {
      const list = kind === 'categories' ? categories : kind === 'brands' ? brands : suppliers;
      const hit = list.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (hit) return hit.id;
      return addEntity(kind, name).id;
    };
    body.forEach((r, idx) => {
      const p = plan[idx];
      if (!p || p.problem || p.price === null) {
        skipped++;
        return;
      }
      const rawCat = col(r, 'category');
      const categoryId = rawCat ? ensure('categories', rawCat) : categories[0]?.id ?? DEFAULT_CATEGORY_ID;
      const rawBrand = col(r, 'brand');
      const brand = rawBrand ? (ensure('brands', rawBrand), rawBrand) : brands[0]?.name ?? '';
      const rawSup = col(r, 'supplier');
      const supplier = rawSup ? (ensure('suppliers', rawSup), rawSup) : suppliers[0]?.name ?? '';
      const cost = money(col(r, 'cost'));
      const availableText = col(r, 'available');
      const available = availableText ? Math.max(0, parseInt(availableText, 10) || 0) : undefined;
      const activeText = col(r, 'active').toLowerCase();
      const enabled = activeText ? !/^(no|false|0|inactive|off)$/.test(activeText) : true;
      const tags = col(r, 'tags').split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
      const supplierCode = col(r, 'supplierCode');
      const patch: Partial<Product> = {
        name: p.name,
        priceMinor: p.price,
        categoryId,
        brand,
        supplier,
        enabled,
        ...(cost !== null ? { supplierPriceMinor: cost } : {}),
        ...(available !== undefined ? { available } : {}),
        ...(col(r, 'description') ? { description: col(r, 'description') } : {}),
        ...(tags.length ? { tags } : {}),
        ...(supplierCode ? { suppliers: [{ supplier, code: supplierCode, priceMinor: cost ?? 0 }] } : {}),
      };
      if (p.existing && updateExisting) {
        updateProduct(p.existing.id, patch);
        updated++;
      } else {
        const id = uid();
        addProduct({
          id,
          productId: id,
          name: p.name,
          sku: p.sku || `IMP-${String(Date.now()).slice(-5)}-${idx + 1}`,
          emoji: '📦',
          categoryId,
          priceMinor: p.price,
          taxGroupId: 'standard',
          enabled,
          created: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          variants: 0,
          available: available ?? 0,
          brand,
          supplier,
          ...patch,
        });
        created++;
      }
    });
    setResult({ created, updated, skipped });
  };

  const back = () => nav('/catalog');

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to products">‹</button>
          <h1 className="page-title">Import products</h1>
        </div>
        <div className="pe-subbar">
          <span>Add or update many products at once from a CSV spreadsheet. <span className="rlink" onClick={() => downloadCsv('nova-product-import-template.csv', TEMPLATE)}>Download the template</span></span>
          <span className="pe-actions"><button className="btn-s" onClick={back}>Cancel</button></span>
        </div>

        <ol className="imp-steps">
          {(['Upload file', 'Map columns', 'Import'] as const).map((label, i) => (
            <li key={label} className={`imp-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
              <span className="imp-num">{step > i + 1 ? '✓' : i + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        {error && <div className="pe-error" role="alert">{error}</div>}

        {step === 1 && (
          <section className="pe-section">
            <div className="pe-section-head"><h2>1. Upload file</h2><p>Use a CSV file with one product per row and a header row naming each column.</p></div>
            <div
              className={`imp-drop ${dragging ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <div className="imp-drop-icon">📄</div>
              <b>Drag and drop your CSV here</b>
              <span>or click to choose a file</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <div className="pe-hint">Recognised columns: name, sku, retail price, supply price, category, brand, supplier, supplier code, description, tags, inventory, active. Prices are in dollars.</div>
          </section>
        )}

        {step === 2 && (
          <section className="pe-section">
            <div className="pe-section-head"><h2>2. Map columns</h2><p>{fileName} · {body.length} row{body.length === 1 ? '' : 's'}. Match each Nova field to a column in your file.</p></div>
            <table className="pe-table imp-map">
              <thead><tr><th>Nova field</th><th>Column in your file</th><th>Example from row 1</th></tr></thead>
              <tbody>
                {FIELDS.map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}{f.required && <span className="imp-req"> Required</span>}</td>
                    <td>
                      <select className="pe-input" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                        <option value="">— Don’t import —</option>
                        {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </select>
                    </td>
                    <td className="pe-muted">{mapping[f.key] === undefined ? '' : body[0]?.[mapping[f.key]!] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="pe-check">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              <span>Update existing products when the SKU matches (otherwise every row creates a new product)</span>
            </label>
            <div className="pe-actions">
              <button className="btn-s" onClick={() => setStep(1)}>Back</button>
              <button className="btn-p" onClick={() => { if (mapping.name === undefined || mapping.price === undefined) setError('Map the product name and retail price columns to continue.'); else { setError(''); setStep(3); } }}>Next</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="pe-section">
            <div className="pe-section-head"><h2>3. Import</h2><p>{result ? 'Done.' : 'Review what will happen, then import.'}</p></div>
            {result ? (
              <>
                <div className="gc-stats">
                  <div className="gc-stat"><span>Created</span><b>{result.created}</b></div>
                  <div className="gc-stat"><span>Updated</span><b>{result.updated}</b></div>
                  <div className="gc-stat"><span>Skipped</span><b>{result.skipped}</b></div>
                </div>
                <div className="pe-actions"><button className="btn-p" onClick={back}>View products</button></div>
              </>
            ) : (
              <>
                <div className="gc-stats">
                  <div className="gc-stat"><span>Products to create</span><b>{toCreate}</b></div>
                  <div className="gc-stat"><span>Products to update</span><b>{toUpdate}</b></div>
                  <div className="gc-stat"><span>Rows with problems</span><b>{plan.length - valid.length}</b></div>
                </div>
                <div className="prp-scroll">
                  <table className="pe-table imp-map">
                    <thead><tr><th>Row</th><th>Product</th><th>SKU</th><th className="r">Retail price</th><th>Action</th></tr></thead>
                    <tbody>
                      {plan.slice(0, 200).map((p) => (
                        <tr key={p.i} className={p.problem ? 'imp-bad' : ''}>
                          <td>{p.i + 2}</td>
                          <td>{p.name || <span className="pe-muted">(blank)</span>}</td>
                          <td className="pe-muted">{p.sku || '—'}</td>
                          <td className="r">{p.price === null ? '—' : `$${(p.price / 100).toFixed(2)}`}</td>
                          <td>{p.problem ? <span className="imp-req">{p.problem}</span> : p.existing && updateExisting ? `Update ${p.existing.name}` : 'Create'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {plan.length > 200 && <div className="pe-hint">Showing the first 200 of {plan.length} rows.</div>}
                </div>
                <div className="pe-actions">
                  <button className="btn-s" onClick={() => setStep(2)}>Back</button>
                  <button className="btn-p" disabled={valid.length === 0} onClick={runImport}>Import {valid.length} product{valid.length === 1 ? '' : 's'}</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
