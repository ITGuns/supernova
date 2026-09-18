import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hashPassword } from '../lib/password';
import { useSetup } from '../store/setupStore';
import { EMPTY_USER_DETAILS, initials, useUsers, type AppUser, type UserDetails } from '../store/userStore';
import { useCustomFields } from '../store/customFieldStore';
import { Field, Section } from './FormLayout';
import '../styles/product-editor.css';

// Setup › Users › Add user — the same sections as Lightspeed: User details,
// Outlets, Role, Security and ID, Switch users faster.

const AVS = ['#4b3df5', '#7c3aed', '#0e9f6e', '#e3a008', '#e02424', '#1c64f2'];
const ROLES: { name: string; description: string }[] = [
  { name: 'Admin', description: 'Full access to every page, setting and report.' },
  { name: 'Manager', description: 'Runs the store day to day: sells, manages products, inventory, customers and reporting. Can’t change billing or security.' },
  { name: 'Cashier', description: 'Sells at the register and looks up products and customers. No access to setup or reports.' },
];

export function UserEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const users = useUsers((s) => s.users);
  const addUser = useUsers((s) => s.addUser);
  const updateUser = useUsers((s) => s.updateUser);
  const deleteUser = useUsers((s) => s.deleteUser);
  const outlets = useSetup((s) => s.outlets);
  const userFields = useCustomFields((s) => s.fields).filter((f) => f.application === 'Users');
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = id ? users.find((u) => u.id === id) : undefined;
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [role, setRole] = useState(existing?.role ?? 'Cashier');
  const [details, setDetails] = useState<UserDetails>({ ...EMPTY_USER_DETAILS, ...(existing?.details ?? {}) });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const setD = (patch: Partial<UserDetails>) => setDetails((d) => ({ ...d, ...patch }));
  const back = () => nav('/setup', { state: { tab: 'users' } });

  if (id && !existing) {
    return (
      <main className="admin-main">
        <div className="admin-page pe">
          <h1 className="page-title">User not found</h1>
          <button className="btn-s" onClick={back}>Back to users</button>
        </div>
      </main>
    );
  }

  const save = async () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n) return setError('Enter a display name.');
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setError('Enter a valid email address.');
    if (users.some((u) => u.id !== existing?.id && u.email.toLowerCase() === e)) return setError('Another user already uses that email address.');
    if (details.username.trim() && users.some((u) => u.id !== existing?.id && (u.details?.username ?? '').toLowerCase() === details.username.trim().toLowerCase())) return setError('That username is already taken.');
    if (isNew && password.length < 6) return setError('Choose a password of at least 6 characters.');
    if (password && password !== confirm) return setError('The passwords don’t match.');
    if (details.pin && !/^\d{4}$/.test(details.pin)) return setError('The PIN must be exactly 4 digits.');
    setSaving(true);
    const body: Partial<AppUser> = { name: n, email: e, role, details: { ...details, username: details.username.trim(), barcode: details.barcode.trim() } };
    if (password) body.password = await hashPassword(password);
    if (existing) {
      updateUser(existing.id, body);
    } else {
      addUser({ name: n, email: e, role, password: body.password ?? '', enabled: true, av: AVS[users.length % AVS.length]!, last: 'never', details: body.details });
    }
    setSaving(false);
    back();
  };

  const remove = () => {
    if (existing) deleteUser(existing.id);
    back();
  };

  const loadPicture = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setD({ picture: typeof reader.result === 'string' ? reader.result : '' });
    reader.readAsDataURL(file);
  };

  return (
    <main className="admin-main">
      <div className="admin-page pe">
        <div className="pe-crumbs">
          <span className="rlink" onClick={() => nav('/setup')}>Setup</span> › <span className="rlink" onClick={back}>Users</span> › <span>{isNew ? 'Add user' : existing!.name}</span>
        </div>
        <div className="pe-head">
          <button className="pe-back" onClick={back} aria-label="Back to users">‹</button>
          <h1 className="page-title">{isNew ? 'Add user' : existing!.name}</h1>
        </div>
        <div className="pe-subbar">
          <span>{isNew ? 'Add a user and choose what they can do in your store.' : 'Edit this user’s profile, outlets, role and security.'}</span>
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save} disabled={saving}>{isNew ? 'Add user' : 'Save'}</button>
          </span>
        </div>
        {error && <div className="pe-error" role="alert">{error}</div>}

        <Section title="User details" hint="How this user appears on receipts, reports and the register.">
          <div className="pe-grid2">
            <Field label="Username" hint="Used to sign in. Leave blank to sign in with the email address.">
              <input className="pe-input" value={details.username} autoFocus onChange={(e) => { setD({ username: e.target.value.replace(/\s+/g, '') }); setError(''); }} placeholder="e.g. jsmith" />
            </Field>
            <Field label="Display name">
              <input className="pe-input" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. Jordan Smith" />
            </Field>
            <Field label="Email">
              <input className="pe-input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="name@domain.com" />
            </Field>
            <Field label="Profile picture">
              <span className="pe-inline">
                <span className="cust-av ue-av" style={{ background: existing?.av ?? AVS[users.length % AVS.length] }}>
                  {details.picture ? <img src={details.picture} alt="" className="ue-av-img" /> : initials(name || '?')}
                </span>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { loadPicture(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn-s" onClick={() => fileRef.current?.click()}>Upload picture</button>
                {details.picture && <button type="button" className="btn-s" onClick={() => setD({ picture: '' })}>Remove</button>}
              </span>
            </Field>
          </div>
        </Section>

        <Section title="Outlets" hint="Choose where this user can sell. Outlets added later are included when all outlets are selected.">
          <label className="pe-check">
            <input type="checkbox" checked={details.outlets.length === 0} onChange={() => setD({ outlets: [] })} />
            <span>All outlets</span>
          </label>
          {outlets.map((o) => (
            <label key={o.id} className="pe-check">
              <input
                type="checkbox"
                checked={details.outlets.length === 0 || details.outlets.includes(o.name)}
                onChange={() =>
                  setD({
                    outlets:
                      details.outlets.length === 0
                        ? outlets.map((x) => x.name).filter((n) => n !== o.name)
                        : details.outlets.includes(o.name)
                        ? details.outlets.filter((n) => n !== o.name)
                        : [...details.outlets, o.name],
                  })
                }
              />
              <span>{o.name}</span>
            </label>
          ))}
        </Section>

        <Section title="Role" hint="Roles decide which pages and actions the user can use.">
          <div className="pe-cards">
            {ROLES.map((r) => (
              <button key={r.name} type="button" className={`pe-card ${role === r.name || (r.name === 'Admin' && role.includes('Admin')) ? 'active' : ''}`} disabled={!!existing?.owner} onClick={() => setRole(r.name)}>
                <b>{r.name}</b>
                <span>{r.description}</span>
              </button>
            ))}
          </div>
          {existing?.owner && <div className="pe-hint">The account owner is always an Admin.</div>}
        </Section>

        <Section title="Security and ID" hint={isNew ? 'Set the password the user signs in with.' : 'Leave the password blank to keep the current one.'}>
          <div className="pe-grid2">
            <Field label={isNew ? 'Password' : 'New password'}>
              <input className="pe-input" type="password" value={password} autoComplete="new-password" onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="At least 6 characters" />
            </Field>
            <Field label="Confirm password">
              <input className="pe-input" type="password" value={confirm} autoComplete="new-password" onChange={(e) => { setConfirm(e.target.value); setError(''); }} />
            </Field>
          </div>
        </Section>

        {userFields.length > 0 && (
          <Section title="Custom fields" hint="Extra details your store keeps on users (Setup → Workflows → Custom fields).">
            <div className="pe-grid2">
              {userFields.map((f) => (
                <Field key={f.id} label={f.name}>
                  {f.type === 'Checkbox' ? (
                    <label className="pe-check"><input type="checkbox" checked={details.customFields[f.id] === 'yes'} onChange={(e) => setD({ customFields: { ...details.customFields, [f.id]: e.target.checked ? 'yes' : '' } })} /><span>Yes</span></label>
                  ) : f.type === 'Dropdown' ? (
                    <select className="pe-input" value={details.customFields[f.id] ?? ''} onChange={(e) => setD({ customFields: { ...details.customFields, [f.id]: e.target.value } })}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="pe-input" type={f.type === 'Date' ? 'date' : f.type === 'Number' ? 'number' : 'text'} value={details.customFields[f.id] ?? ''} onChange={(e) => setD({ customFields: { ...details.customFields, [f.id]: e.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          </Section>
        )}

        <Section title="Switch users faster" hint="A PIN or a barcode on the user’s ID card lets them switch to their account at the register without typing a password (see Setup → Security).">
          <div className="pe-grid2">
            <Field label="PIN" hint="4 digits">
              <input className="pe-input" inputMode="numeric" maxLength={4} value={details.pin} onChange={(e) => { setD({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) }); setError(''); }} placeholder="••••" />
            </Field>
            <Field label="Barcode" hint="Scan the user’s ID card, or type its number">
              <input className="pe-input" value={details.barcode} onChange={(e) => setD({ barcode: e.target.value })} placeholder="e.g. 0012345" />
            </Field>
          </div>
        </Section>

        <div className="pe-foot">
          {existing && !existing.owner ? (
            confirmDelete ? (
              <span className="pe-inline">
                <span>Delete {existing.name}? Their sales stay in reporting.</span>
                <button className="btn-danger" onClick={remove}>Delete user</button>
                <button className="btn-s" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="rlink pe-danger" onClick={() => setConfirmDelete(true)}>Delete user</button>
            )
          ) : (
            <span />
          )}
          <span className="pe-actions">
            <button className="btn-s" onClick={back}>Cancel</button>
            <button className="btn-p" onClick={save} disabled={saving}>{isNew ? 'Add user' : 'Save'}</button>
          </span>
        </div>
      </div>
    </main>
  );
}
