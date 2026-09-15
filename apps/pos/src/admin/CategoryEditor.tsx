import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_CATEGORY_ID,
  categoryDescendantIds,
  categoryPath,
  useCatalogMeta,
  type MetaEntity,
} from '../store/catalogMetaStore';
import { useProducts } from '../store/productStore';
import { Section } from './FormLayout';
import '../styles/product-editor.css';

// Full-page "Add product category" / edit page: one category made of up to
// three levels (e.g. Clothing › Men's › Shirts). Each level is its own
// category row linked to the one above it, so products can sit at any level
// and reports can filter by any of them.

const MAX_LEVELS = 3;

export function CategoryEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const categories = useCatalogMeta((s) => s.categories);
  const addEntity = useCatalogMeta((s) => s.addEntity);
  const updateEntity = useCatalogMeta((s) => s.updateEntity);
  const deleteEntity = useCatalogMeta((s) => s.deleteEntity);
  const products = useProducts((s) => s.products);
  const updateProduct = useProducts((s) => s.updateProduct);

  const existing = id ? categories.find((c) => c.id === id) : undefined;
  const isNew = !existing;
  // Editing "Shirts" shows the chain above it too, so every level can be renamed.
  const [chain] = useState<MetaEntity[]>(() => (existing ? categoryPath(categories, existing.id) : []));

  const [levels, setLevels] = useState<string[]>(() => (chain.length ? chain.map((c) => c.name) : ['']));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Category not found</h1>
          <button className="btn-s" onClick={() => nav('/catalog', { state: { tab: 'categories' } })}>Back to categories</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/catalog', { state: { tab: 'categories' } });
  const setLevel = (i: number, v: string) => {
    setLevels((ls) => ls.map((x, xi) => (xi === i ? v : x)));
    setError('');
  };
  const addLevel = () => setLevels((ls) => (ls.length < MAX_LEVELS ? [...ls, ''] : ls));
  const removeLevel = (i: number) => setLevels((ls) => ls.slice(0, i));

  const nameTaken = (name: string, parentId: string | undefined, exceptId?: string) =>
    categories.find(
      (c) => c.id !== exceptId && (c.parentId ?? '') === (parentId ?? '') && c.name.trim().toLowerCase() === name.toLowerCase(),
    );

  const save = () => {
    setTouched(true);
    const names = levels.map((l) => l.trim());
    if (!names[0]) return;
    // A blank deeper level is simply dropped; a filled one below a blank isn't possible.
    const filled: string[] = [];
    for (const n of names) {
      if (!n) break;
      filled.push(n);
    }
    if (filled.length < names.filter(Boolean).length) {
      setError('Fill in each level in order, from Level 1 down.');
      return;
    }

    // Walk the levels: reuse a category that already exists at that level
    // (or rename the one being edited), create the rest.
    let parentId: string | undefined;
    for (const [i, name] of filled.entries()) {
      const own = chain[i]; // the row this level is editing, if any
      if (own) {
        const clash = nameTaken(name, parentId, own.id);
        if (clash) {
          setError(`A Level ${i + 1} category called “${clash.name}” already exists here.`);
          return;
        }
        if (own.name !== name) updateEntity('categories', own.id, { name });
        parentId = own.id;
      } else {
        const found = nameTaken(name, parentId);
        if (found) {
          if (i === filled.length - 1 && isNew) {
            setError(`“${found.name}” already exists as a Level ${i + 1} category.`);
            return;
          }
          parentId = found.id;
        } else {
          parentId = addEntity('categories', name, undefined, undefined, parentId).id;
        }
      }
    }
    back();
  };

  const affected = existing ? products.filter((p) => categoryDescendantIds(categories, existing.id).has(p.categoryId)) : [];

  const remove = () => {
    if (!existing) return;
    const gone = categoryDescendantIds(categories, existing.id);
    // Products in a deleted category move to the first remaining top-level one.
    const fallback = categories.find((c) => !gone.has(c.id) && !c.parentId)?.id ?? DEFAULT_CATEGORY_ID;
    affected.forEach((p) => updateProduct(p.id, { categoryId: fallback }));
    deleteEntity('categories', existing.id);
    back();
  };

  const showRequired = touched && !(levels[0] ?? '').trim();

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to product categories">‹</button>
          <h1 className="page-title">{isNew ? 'Add product category' : 'Edit product category'}</h1>
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Add a new product category.' : 'Edit this product category.'}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section
          title="Category levels"
          hint="Create up to three levels of categories. These levels will help filter sale and inventory reports."
        >
          <div className="pe-caps">Category information</div>
          <div className="pe-levels">
            {levels.map((value, i) => (
              <div key={i} className={`pe-level ${i > 0 ? 'nested' : ''}`}>
                <label className="pe-field">
                  <span className="pe-label">Level {i + 1}</span>
                  <input
                    className={`pe-input ${i === 0 && showRequired ? 'invalid' : ''}`}
                    value={value}
                    onChange={(e) => setLevel(i, e.target.value)}
                    onBlur={() => i === 0 && setTouched(true)}
                    placeholder={i === 0 ? 'e.g. Clothing' : i === 1 ? "e.g. Men's" : 'e.g. Shirts'}
                    autoFocus={i === levels.length - 1}
                  />
                  {i === 0 && showRequired && <span className="pe-fielderr">Category name is required</span>}
                </label>
                {i > 0 && i === levels.length - 1 && !chain[i] && (
                  <button type="button" className="pe-x" onClick={() => removeLevel(i)} aria-label={`Remove level ${i + 1}`}>×</button>
                )}
              </div>
            ))}
            {levels.length < MAX_LEVELS && (
              <button type="button" className="pe-add" onClick={addLevel}>+ Level {levels.length + 1}</button>
            )}
          </div>
        </Section>

        <div className="pe-foot">
          {existing ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>
                  Delete “{existing.name}”
                  {categoryDescendantIds(categories, existing.id).size > 1 ? ' and the levels under it' : ''}?
                  {affected.length > 0 ? ` ${affected.length} product${affected.length === 1 ? '' : 's'} will move to your first top-level category.` : ''}
                </span>
                <button className="btn-danger" onClick={remove}>Delete</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete category</button>
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
