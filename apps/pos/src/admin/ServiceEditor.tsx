import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart, type CartLine } from '../store/cartStore';
import { useCustomers } from '../store/customerStore';
import { useProducts } from '../store/productStore';
import { useServices, type Service, type ServiceItem } from '../store/serviceStore';
import { useCustomFields } from '../store/customFieldStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';
import { Field, Section } from './FormLayout';
import { IntInput, MoneyInput } from './NumInput';
import '../styles/product-editor.css';

// Create service (from the register's More actions or Services → Create
// service) and the service detail page: customer, the item being worked
// on, who's doing it and when, status, notes, and the products / charges
// that go on the sale when the job is done.

const uid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `l-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
const toLocalInput = (ms: number | null) => {
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Draft {
  customerName: string;
  item: ServiceItem;
  assignedUser: string;
  location: string;
  description: string;
  durationMin: number;
  scheduledAt: number | null;
  status: string;
  lines: CartLine[];
  customFields: Record<string, string>;
}

export function ServiceEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const preset = (useLocation().state as { customerName?: string; lines?: CartLine[] } | null) ?? null;
  const services = useServices((s) => s.services);
  const statuses = useServices((s) => s.statuses);
  const addService = useServices((s) => s.addService);
  const updateService = useServices((s) => s.updateService);
  const addNote = useServices((s) => s.addNote);
  const deleteService = useServices((s) => s.deleteService);
  const addStatus = useServices((s) => s.addStatus);
  const customers = useCustomers((s) => s.customers);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const outlets = useSetup((s) => s.outlets);
  const products = useProducts((s) => s.products);
  const loadLines = useCart((s) => s.loadLines);

  const existing = id ? services.find((s) => s.id === id) : undefined;
  const isNew = !existing;
  const me = users.find((u) => u.id === currentUserId)?.name ?? '';

  const [draft, setDraft] = useState<Draft>(() => ({
    customerName: existing?.customerName ?? preset?.customerName ?? '',
    item: existing?.item ?? { name: '', serial: '', description: '', condition: '' },
    assignedUser: existing?.assignedUser ?? me,
    location: existing?.location ?? outlets[0]?.name ?? 'Main Outlet',
    description: existing?.description ?? '',
    durationMin: existing?.durationMin ?? 60,
    scheduledAt: existing?.scheduledAt ?? null,
    status: existing?.status ?? 'New',
    lines: existing?.lines ?? preset?.lines ?? [],
    customFields: { ...(existing?.customFields ?? {}) },
  }));
  const serviceFields = useCustomFields((s) => s.fields).filter((f) => f.application === 'Services');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chargeName, setChargeName] = useState('');
  const [chargeMinor, setChargeMinor] = useState(0);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError('');
  };
  const setItem = (patch: Partial<ServiceItem>) => set({ item: { ...draft.item, ...patch } });

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.enabled && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, 8);
  }, [search, products]);

  const addProductLine = (pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    const at = draft.lines.findIndex((l) => l.variantId === p.id);
    if (at >= 0) set({ lines: draft.lines.map((l, i) => (i === at ? { ...l, quantity: l.quantity + 1 } : l)) });
    else set({ lines: [...draft.lines, { lineId: uid(), variantId: p.id, name: p.name, unitPriceMinor: p.priceMinor, quantity: 1, taxGroupId: p.taxGroupId }] });
    setSearch('');
  };
  const addCharge = () => {
    if (!chargeName.trim() || chargeMinor <= 0) return;
    set({ lines: [...draft.lines, { lineId: uid(), variantId: `svc-${uid()}`, name: chargeName.trim(), unitPriceMinor: chargeMinor, quantity: 1, taxGroupId: 'standard', custom: true }] });
    setChargeName('');
    setChargeMinor(0);
  };
  const total = draft.lines.reduce((a, l) => a + l.unitPriceMinor * l.quantity, 0);

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">Service not found</h1>
          <button className="btn-s" onClick={() => nav('/services')}>Back to services</button>
        </div>
      </main>
    );
  }

  const back = () => nav('/services');
  const validate = () => {
    if (!draft.item.name.trim() && !draft.description.trim()) {
      setError('Describe the item or the work to be done.');
      return false;
    }
    return true;
  };
  const persist = (): Service => {
    const body = { ...draft, item: { ...draft.item, name: draft.item.name.trim() }, description: draft.description.trim(), saleOrderNumber: existing?.saleOrderNumber ?? '' };
    if (existing) {
      updateService(existing.id, body);
      return { ...existing, ...body };
    }
    return addService(body);
  };
  const save = () => {
    if (!validate()) return;
    persist();
    back();
  };
  // Put the service's products and charges on the register to take payment.
  const addToSale = () => {
    if (!validate()) return;
    const saved = persist();
    loadLines(saved.lines, { customerName: saved.customerName, note: `Service ${saved.number}${saved.item.name ? ` · ${saved.item.name}` : ''}` });
    updateService(saved.id, { status: 'Completed', completedAt: Date.now() });
    nav('/sell');
  };
  const cancelService = () => {
    if (existing) updateService(existing.id, { status: 'Cancelled', completedAt: Date.now() });
    back();
  };

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to services">‹</button>
          <h1 className="page-title">{isNew ? 'Create service' : existing!.number}</h1>
          {existing && <span className={`tx-badge ${existing.status === 'Completed' ? 'received' : existing.status === 'Cancelled' ? 'cancelled' : 'open'}`}>{existing.status}</span>}
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Book a repair, fitting or other job for a customer.' : `Created ${new Date(existing!.createdAt).toLocaleString()}${existing!.saleOrderNumber ? ` · Sale ${existing!.saleOrderNumber}` : ''}`}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-s" onClick={save}>Save</button>
            <button className="btn-p" onClick={addToSale} disabled={draft.lines.length === 0} title={draft.lines.length ? 'Load the products and charges onto the register' : 'Add products or charges first'}>Add to sale</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="Customer" hint="Who the service is for. Their details print on the service ticket.">
          <div className="pe-grid2">
            <Field label="Customer">
              <input className="pe-input" list="svc-customers" value={draft.customerName} autoFocus={isNew} onChange={(e) => set({ customerName: e.target.value })} placeholder="Search for a customer or type a name" />
              <datalist id="svc-customers">
                {customers.map((c) => <option key={c.id} value={`${c.firstName} ${c.lastName}`.trim()} />)}
              </datalist>
            </Field>
          </div>
        </Section>

        <Section title="Service item" hint="What's being worked on.">
          <div className="pe-grid2">
            <Field label="Item"><input className="pe-input" value={draft.item.name} onChange={(e) => setItem({ name: e.target.value })} placeholder="e.g. Trek Marlin 5 mountain bike" /></Field>
            <Field label="Serial number" hint="(Optional)"><input className="pe-input" value={draft.item.serial} onChange={(e) => setItem({ serial: e.target.value })} /></Field>
            <Field label="Condition on arrival" hint="(Optional)"><input className="pe-input" value={draft.item.condition} onChange={(e) => setItem({ condition: e.target.value })} placeholder="e.g. Scratched frame, flat rear tyre" /></Field>
            <Field label="Item notes" hint="(Optional)"><input className="pe-input" value={draft.item.description} onChange={(e) => setItem({ description: e.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Service details" hint="Who does the work, where and when.">
          <div className="pe-grid2">
            <Field label="Assigned user">
              <select className="pe-input" value={draft.assignedUser} onChange={(e) => set({ assignedUser: e.target.value })}>
                <option value="">Unassigned</option>
                {users.filter((u) => u.enabled).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <select className="pe-input" value={draft.location} onChange={(e) => set({ location: e.target.value })}>
                {outlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                {!outlets.some((o) => o.name === draft.location) && draft.location && <option value={draft.location}>{draft.location}</option>}
              </select>
            </Field>
            <Field label="Scheduled" hint="(Optional)">
              <input className="pe-input" type="datetime-local" value={toLocalInput(draft.scheduledAt)} onChange={(e) => set({ scheduledAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
            </Field>
            <Field label="Duration (minutes)">
              <IntInput className="pe-input" int={draft.durationMin} onChange={(n) => set({ durationMin: n ?? 0 })} />
            </Field>
            <Field label="Status">
              <span className="pe-inline">
                <select className="pe-input" value={draft.status} onChange={(e) => set({ status: e.target.value })}>
                  {statuses.map((st) => <option key={st.id}>{st.name}</option>)}
                </select>
                <input className="pe-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} placeholder="New status name" style={{ maxWidth: 180 }} />
                <button type="button" className="btn-s" disabled={!newStatus.trim()} onClick={() => { addStatus(newStatus.trim()); set({ status: newStatus.trim() }); setNewStatus(''); }}>Add status</button>
              </span>
            </Field>
            <Field label="Description of work" wide>
              <textarea className="pe-input pe-textarea" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What needs to be done" />
            </Field>
          </div>
        </Section>

        {serviceFields.length > 0 && (
          <Section title="Custom fields" hint="Extra details your store captures on services (Setup → Workflows → Custom fields).">
            <div className="pe-grid2">
              {serviceFields.map((f) => (
                <Field key={f.id} label={f.name}>
                  {f.type === 'Checkbox' ? (
                    <label className="pe-check"><input type="checkbox" checked={draft.customFields[f.id] === 'yes'} onChange={(e) => set({ customFields: { ...draft.customFields, [f.id]: e.target.checked ? 'yes' : '' } })} /><span>Yes</span></label>
                  ) : f.type === 'Dropdown' ? (
                    <select className="pe-input" value={draft.customFields[f.id] ?? ''} onChange={(e) => set({ customFields: { ...draft.customFields, [f.id]: e.target.value } })}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="pe-input" type={f.type === 'Date' ? 'date' : f.type === 'Number' ? 'number' : 'text'} value={draft.customFields[f.id] ?? ''} onChange={(e) => set({ customFields: { ...draft.customFields, [f.id]: e.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          </Section>
        )}

        <Section title="Products and charges" hint="Parts used and labour to charge for. These go onto the sale when you choose Add to sale.">
          <div className="pe-searchwrap">
            <input className="pe-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or scan to add a product" />
            {hits.length > 0 && (
              <div className="pe-catalog-hits pe-hits">
                {hits.map((p) => (
                  <button key={p.id} type="button" className="pe-catalog-hit" onClick={() => addProductLine(p.id)}>
                    <span>{p.name}</span>
                    <span className="pe-muted">{p.sku} · {fmt(p.priceMinor)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pe-inline pe-gap">
            <input className="pe-input" value={chargeName} onChange={(e) => setChargeName(e.target.value)} placeholder="Labour or other charge" style={{ maxWidth: 260 }} />
            <span className="pe-money"><span>$</span><MoneyInput className="pe-input pe-cost" minor={chargeMinor} onChange={setChargeMinor} /></span>
            <button type="button" className="btn-s" onClick={addCharge} disabled={!chargeName.trim() || chargeMinor <= 0}>Add charge</button>
          </div>
          {draft.lines.length ? (
            <table className="pe-table pe-lines">
              <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th><th /></tr></thead>
              <tbody>
                {draft.lines.map((l) => (
                  <tr key={l.lineId}>
                    <td>{l.name}{l.custom ? <span className="pe-muted"> · charge</span> : null}</td>
                    <td className="r"><IntInput className="pe-input pe-qty" int={l.quantity} onChange={(n) => set({ lines: draft.lines.map((x) => (x.lineId === l.lineId ? { ...x, quantity: Math.max(1, n ?? 1) } : x)) })} /></td>
                    <td className="r">{fmt(l.unitPriceMinor)}</td>
                    <td className="r">{fmt(l.unitPriceMinor * l.quantity)}</td>
                    <td className="r"><button type="button" className="pe-x" onClick={() => set({ lines: draft.lines.filter((x) => x.lineId !== l.lineId) })} aria-label="Remove">×</button></td>
                  </tr>
                ))}
                <tr><td colSpan={3} className="r"><b>Total</b></td><td className="r"><b>{fmt(total)}</b></td><td /></tr>
              </tbody>
            </table>
          ) : (
            <div className="pe-empty">No products or charges yet.</div>
          )}
        </Section>

        {existing && (
          <Section title="Notes" hint="Keep the history of the job. Notes marked visible to the customer print on their service ticket.">
            {existing.notes.length === 0 && <div className="pe-empty">No notes yet.</div>}
            {existing.notes.map((n) => (
              <div key={n.id} className="svc-note">
                <div className="svc-note-meta">{n.by || 'Staff'} · {new Date(n.at).toLocaleString()}{n.visibleToCustomer ? ' · Visible to customer' : ''}</div>
                <div>{n.text}</div>
              </div>
            ))}
            <div className="pe-inline pe-gap">
              <input className="pe-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { addNote(existing.id, note.trim(), me, noteVisible); setNote(''); } }} />
              <label className="pe-check" style={{ margin: 0 }}><input type="checkbox" checked={noteVisible} onChange={(e) => setNoteVisible(e.target.checked)} /><span>Visible to customer</span></label>
              <button type="button" className="btn-s" disabled={!note.trim()} onClick={() => { addNote(existing.id, note.trim(), me, noteVisible); setNote(''); }}>Add note</button>
            </div>
          </Section>
        )}

        <div className="pe-foot">
          {existing ? (
            <span className="pe-inline">
              {existing.status !== 'Cancelled' && existing.status !== 'Completed' && <button className="btn-s" onClick={cancelService}>Cancel service</button>}
              {confirmDelete ? (
                <span className="pe-inline">
                  <span>Delete {existing.number}? This can’t be undone.</span>
                  <button className="btn-danger" onClick={() => { deleteService(existing.id); back(); }}>Delete</button>
                  <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
                </span>
              ) : (
                <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete service</button>
              )}
            </span>
          ) : (
            <span />
          )}
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-s" onClick={save}>Save</button>
            <button className="btn-p" onClick={addToSale} disabled={draft.lines.length === 0}>Add to sale</button>
          </span>
        </div>
      </div>
    </main>
  );
}
