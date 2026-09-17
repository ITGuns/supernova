import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EMPTY_ADDRESS,
  EMPTY_SUPPLIER_DETAILS,
  useCatalogMeta,
  type Address,
  type SupplierDetails,
} from '../store/catalogMetaStore';
import { useProducts } from '../store/productStore';
import { Field, Section } from './FormLayout';
import { NumInput } from './NumInput';
import '../styles/product-editor.css';

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'Germany', 'France',
  'Netherlands', 'Belgium', 'Spain', 'Italy', 'Portugal', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Poland', 'Mexico', 'Brazil', 'Argentina', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Philippines',
  'India', 'United Arab Emirates', 'South Africa', 'Other',
];

interface Draft {
  name: string;
  description: string;
  details: SupplierDetails;
}

function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const put = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <div className="pe-grid2">
      <Field label="Street"><input className="pe-input" value={value.street1} onChange={(e) => put({ street1: e.target.value })} /></Field>
      <Field label="Street"><input className="pe-input" value={value.street2} onChange={(e) => put({ street2: e.target.value })} /></Field>
      <Field label="Suburb"><input className="pe-input" value={value.suburb} onChange={(e) => put({ suburb: e.target.value })} /></Field>
      <Field label="City"><input className="pe-input" value={value.city} onChange={(e) => put({ city: e.target.value })} /></Field>
      <Field label="State"><input className="pe-input" value={value.state} onChange={(e) => put({ state: e.target.value })} /></Field>
      <Field label="ZIP code"><input className="pe-input" value={value.zip} onChange={(e) => put({ zip: e.target.value })} /></Field>
      <Field label="Country">
        <select className="pe-input" value={value.country} onChange={(e) => put({ country: e.target.value })}>
          <option value="">Select a country</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function SupplierEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const suppliers = useCatalogMeta((s) => s.suppliers);
  const addEntity = useCatalogMeta((s) => s.addEntity);
  const updateEntity = useCatalogMeta((s) => s.updateEntity);
  const deleteEntity = useCatalogMeta((s) => s.deleteEntity);
  const products = useProducts((s) => s.products);
  const updateProduct = useProducts((s) => s.updateProduct);

  const existing = id ? suppliers.find((s) => s.id === id) : undefined;
  const isNew = !existing;

  const [draft, setDraft] = useState<Draft>(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    details: {
      ...EMPTY_SUPPLIER_DETAILS,
      ...(existing?.details ?? {}),
      contact: { ...EMPTY_SUPPLIER_DETAILS.contact, ...(existing?.details?.contact ?? {}) },
      physical: { ...EMPTY_ADDRESS, ...(existing?.details?.physical ?? {}) },
      mailing: { ...EMPTY_ADDRESS, ...(existing?.details?.mailing ?? {}) },
    },
  }));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setDetails = (patch: Partial<SupplierDetails>) => setDraft((d) => ({ ...d, details: { ...d.details, ...patch } }));
  const setContact = (patch: Partial<SupplierDetails['contact']>) =>
    setDraft((d) => ({ ...d, details: { ...d.details, contact: { ...d.details.contact, ...patch } } }));

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Supplier not found</h1>
          <button className="btn-s" onClick={() => nav('/catalog', { state: { tab: 'suppliers' } })}>Back to suppliers</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/catalog', { state: { tab: 'suppliers' } });

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Enter a supplier name.');
      return;
    }
    const clash = suppliers.find((s) => s.id !== existing?.id && s.name.trim().toLowerCase() === name.toLowerCase());
    if (clash) {
      setError(`A supplier called “${clash.name}” already exists.`);
      return;
    }
    const description = draft.description.trim();
    const details: SupplierDetails = {
      ...draft.details,
      // A mailing address that mirrors the store's needn't be stored twice.
      mailing: draft.details.mailingSameAsStore ? { ...EMPTY_ADDRESS } : draft.details.mailing,
    };
    if (existing) {
      updateEntity('suppliers', existing.id, { name, description, details });
      // Products reference their supplier by name; follow a rename.
      if (existing.name !== name) {
        products.filter((p) => p.supplier === existing.name).forEach((p) => updateProduct(p.id, { supplier: name }));
      }
    } else {
      addEntity('suppliers', name, description || undefined, details);
    }
    back();
  };

  const remove = () => {
    if (existing) deleteEntity('suppliers', existing.id);
    back();
  };

  const markupPct = draft.details.defaultMarkupBps / 100;
  const productCount = existing ? products.filter((p) => p.supplier === existing.name).length : 0;

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to suppliers">‹</button>
          <h1 className="page-title">{isNew ? 'Add supplier' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Add a new supplier' : 'Edit supplier'}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save}>Save</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section
          title="Details"
          hint="This is how your supplier is identified and described in Nova Retail. You can also choose to set a default markup, which makes setting up products easier."
        >
          <div className="pe-grid2">
            <Field label="Supplier name">
              <input className="pe-input" value={draft.name} onChange={(e) => { set({ name: e.target.value }); setError(''); }} autoFocus />
            </Field>
            <Field label="Default markup">
              <span className="pe-money pe-suffix">
                <NumInput
                  value={markupPct === 0 ? '0' : String(markupPct)}
                  onCommit={(t) => setDetails({ defaultMarkupBps: Math.max(0, Math.round((parseFloat(t) || 0) * 100)) })}
                />
                <span>%</span>
              </span>
            </Field>
            <Field label="Description" wide>
              <textarea className="pe-input pe-textarea" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Contact info" hint="The official name and contact details for your supplier">
          <div className="pe-grid2">
            <Field label="First name"><input className="pe-input" value={draft.details.contact.firstName} onChange={(e) => setContact({ firstName: e.target.value })} /></Field>
            <Field label="Last name"><input className="pe-input" value={draft.details.contact.lastName} onChange={(e) => setContact({ lastName: e.target.value })} /></Field>
            <Field label="Company"><input className="pe-input" value={draft.details.contact.company} onChange={(e) => setContact({ company: e.target.value })} /></Field>
            <Field label="Email"><input className="pe-input" type="email" placeholder="name@domain.com" value={draft.details.contact.email} onChange={(e) => setContact({ email: e.target.value })} /></Field>
            <Field label="Phone"><input className="pe-input" type="tel" value={draft.details.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} /></Field>
            <Field label="Mobile"><input className="pe-input" type="tel" value={draft.details.contact.mobile} onChange={(e) => setContact({ mobile: e.target.value })} /></Field>
            <Field label="Fax"><input className="pe-input" type="tel" value={draft.details.contact.fax} onChange={(e) => setContact({ fax: e.target.value })} /></Field>
            <Field label="Website"><input className="pe-input" type="url" value={draft.details.contact.website} onChange={(e) => setContact({ website: e.target.value })} /></Field>
            <Field label="Twitter"><input className="pe-input" value={draft.details.contact.twitter} onChange={(e) => setContact({ twitter: e.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Addresses">
          <h3 className="pe-subhead">Physical address</h3>
          <AddressFields value={draft.details.physical} onChange={(physical) => setDetails({ physical })} />
          <label className="pe-check">
            <input
              type="checkbox"
              checked={draft.details.mailingSameAsStore}
              onChange={(e) => setDetails({ mailingSameAsStore: e.target.checked })}
            />
            <span>Mailing address same as store address</span>
          </label>
          {!draft.details.mailingSameAsStore && (
            <>
              <h3 className="pe-subhead">Mailing address</h3>
              <AddressFields value={draft.details.mailing} onChange={(mailing) => setDetails({ mailing })} />
            </>
          )}
        </Section>

        <div className="pe-foot">
          {existing ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>
                  Delete “{existing.name}”?{productCount > 0 ? ` ${productCount} product${productCount === 1 ? '' : 's'} still list it as supplier.` : ''}
                </span>
                <button className="btn-danger" onClick={remove}>Delete</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete supplier</button>
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
