import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useSetup } from '../store/setupStore';
import { useCart } from '../store/cartStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { initials, useUsers, type AppUser } from '../store/userStore';
import { Switch } from './controls';
import { MoneyInput } from './NumInput';


/** A user's sales target for one period, saved when the field is left. */
function Target({ minor, onChange }: { minor: number; onChange: (minor: number) => void }) {
  return (
    <span className="tgt">
      <span className="tgt-cur">$</span>
      <MoneyInput
        className="tgt-input"
        minor={minor}
        onChange={onChange}
        style={{ width: '70px', border: '1px solid var(--line)', borderRadius: '4px', padding: '2px 4px', background: 'var(--panel)', color: 'var(--text)', textAlign: 'right' }}
      />
    </span>
  );
}

// What each role can do. Roles are fixed (as in Lightspeed); users are
// assigned one in the edit user modal.
const ROLES: { name: string; match: RegExp; description: string }[] = [
  { name: 'Account owner', match: /owner/i, description: 'Full access to everything, including billing and account settings.' },
  { name: 'Admin', match: /admin/i, description: 'Full access to selling, catalog, inventory, customers, reporting and setup.' },
  { name: 'Manager', match: /manager/i, description: 'Sells, manages the register, catalog, inventory and customers, and views reports.' },
  { name: 'Cashier', match: /cashier/i, description: 'Sells and takes payments on the register.' },
];
const PERMISSIONS: { label: string; roles: string[] }[] = [
  { label: 'Sell and take payments', roles: ['Account owner', 'Admin', 'Manager', 'Cashier'] },
  { label: 'Park and retrieve sales, create quotes', roles: ['Account owner', 'Admin', 'Manager', 'Cashier'] },
  { label: 'Process returns and refunds', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Apply discounts and promo codes', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Open and close the register', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Cash management', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Manage catalog, stock and inventory counts', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Manage customers', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'View reports', roles: ['Account owner', 'Admin', 'Manager'] },
  { label: 'Change setup, users and security', roles: ['Account owner', 'Admin'] },
  { label: 'Billing and account', roles: ['Account owner'] },
];
const roleOf = (u: AppUser) => ROLES.find((r) => r.match.test(u.role))?.name ?? u.role;

export function UsersSettings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'users' | 'roles' | 'activity'>('users');
  const users = useUsers((s) => s.users);
  const outlets = useSetup((s) => s.outlets);
  const [userQ, setUserQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [outletFilter, setOutletFilter] = useState('all');
  const [applied, setApplied] = useState({ q: '', role: 'all', outlet: 'all' });
  const visibleUsers = users.filter(
    (u) =>
      (applied.q.trim() === '' || u.name.toLowerCase().includes(applied.q.trim().toLowerCase()) || u.email.toLowerCase().includes(applied.q.trim().toLowerCase())) &&
      (applied.role === 'all' || u.role.includes(applied.role)) &&
      (applied.outlet === 'all' || !(u.details?.outlets?.length) || u.details.outlets.includes(applied.outlet)),
  );
  const sales = useCart((s) => s.sales);
  const closures = useRegisterSession((s) => s.closures);
  const movements = useRegisterSession((s) => s.movements);
  const [activityUser, setActivityUser] = useState('All');

  // Everything a user did that the store records: sales, returns, register
  // closures and cash movements, newest first.
  const activity = (() => {
    const rows: { at: number; user: string; what: string; amount?: number }[] = [];
    for (const s of sales) {
      rows.push({ at: s.at, user: s.soldBy ?? 'Staff', what: `${s.training ? 'Training sale' : 'Completed sale'} ${s.orderNumber}`, amount: s.totalMinor });
      if (s.refundedAt) rows.push({ at: s.refundedAt, user: s.soldBy ?? 'Staff', what: `Returned sale ${s.orderNumber}`, amount: -s.totalMinor });
    }
    for (const c of closures) {
      rows.push({ at: c.closedAt, user: c.by, what: `Closed register (closure #${c.number}${c.varianceMinor ? `, variance ${fmt(c.varianceMinor)}` : ''})` });
      for (const m of c.movements) rows.push({ at: m.at, user: m.by, what: `${m.type === 'ADD' ? 'Added cash' : 'Removed cash'}${m.note ? ` · ${m.note}` : ''}`, amount: m.type === 'ADD' ? m.amountMinor : -m.amountMinor });
    }
    for (const m of movements) rows.push({ at: m.at, user: m.by, what: `${m.type === 'ADD' ? 'Added cash' : 'Removed cash'}${m.note ? ` · ${m.note}` : ''}`, amount: m.type === 'ADD' ? m.amountMinor : -m.amountMinor });
    return rows.filter((r) => activityUser === 'All' || r.user === activityUser).sort((a, b) => b.at - a.at).slice(0, 100);
  })();
  const updU = useUsers((s) => s.updateUser);
  const togU = useUsers((s) => s.toggleUser);


  const toggle = (id: string) => togU(id);

  const addUser = () => navigate('/setup/users/new');


  return (
    <>
      <h1 className="page-title">Users</h1>
      <div className="sh-tabs">
        <button className={`sh-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Users
        </button>
        <button className={`sh-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          Roles
        </button>
        <button className={`sh-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
          Activity
        </button>
      </div>

      {tab === 'roles' ? (
        <>
          <div className="subbar-row">
            <span>What each role can do. Assign a role to a user from the Users tab.</span>
          </div>
          <div className="atable">
            <div className="athead roles">
              <span>Role</span>
              <span>Description</span>
              <span className="r">Users</span>
            </div>
            {ROLES.map((r) => (
              <div key={r.name} className="arow roles">
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span className="cust-code">{r.description}</span>
                <span className="r">{users.filter((u) => roleOf(u) === r.name).length}</span>
              </div>
            ))}
          </div>
          <div className="atable" style={{ marginTop: 18 }}>
            <div className="athead perms">
              <span>Permission</span>
              {ROLES.map((r) => <span key={r.name} className="c">{r.name}</span>)}
            </div>
            {PERMISSIONS.map((p) => (
              <div key={p.label} className="arow perms">
                <span>{p.label}</span>
                {ROLES.map((r) => (
                  <span key={r.name} className="c">{p.roles.includes(r.name) ? <span className="ok-check">✓</span> : <span className="cust-code">—</span>}</span>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : tab === 'activity' ? (
        <>
          <div className="subbar-row">
            <span>Sales, returns, register closures and cash movements, by user.</span>
          </div>
          <div className="filter-row">
            <div className="f-field">
              <label>User</label>
              <select className="set-select" value={activityUser} onChange={(e) => setActivityUser(e.target.value)} style={{ height: 38, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 8px' }}>
                <option value="All">All users</option>
                {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="atable">
            <div className="athead act">
              <span>Time</span>
              <span>User</span>
              <span>Activity</span>
              <span className="r">Amount</span>
            </div>
            {activity.length === 0 && <div className="ct-empty">No activity recorded yet.</div>}
            {activity.map((a, i) => (
              <div key={`${a.at}-${i}`} className="arow act">
                <span className="cust-code">{new Date(a.at).toLocaleString()}</span>
                <span>{a.user}</span>
                <span>{a.what}</span>
                <span className="r">{a.amount === undefined ? '' : a.amount < 0 ? `−${fmt(-a.amount)}` : fmt(a.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="subbar-row">
            <span>
              Manage users and their sales targets. <span className="rlink">Need help? ↗</span>
            </span>
            <button className="btn-p" onClick={addUser}>
              Add user
            </button>
          </div>
          <div className="filter-row">
            <div className="f-field">
              <label>Search for users</label>
              <input value={userQ} onChange={(e) => setUserQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setApplied({ q: userQ, role: roleFilter, outlet: outletFilter })} placeholder="Enter a name or email address" />
            </div>
            <div className="f-field">
              <label>Role</label>
              <select className="set-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ height: '38px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}>
                <option value="all">All roles</option>
                <option>Admin</option><option>Manager</option><option>Cashier</option>
              </select>
            </div>
            <div className="f-field">
              <label>Outlet</label>
              <select className="set-select" value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} style={{ height: '38px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}>
                <option value="all">All outlets</option>
                {outlets.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </div>
            <button className="btn-p f-search" onClick={() => setApplied({ q: userQ, role: roleFilter, outlet: outletFilter })}>Search</button>
          </div>
          <div className="atable scroll-x">
            <div className="athead usr2">
              <span>User</span>
              <span>Role</span>
              <span>Outlet</span>
              <span className="r">Daily target</span>
              <span className="r">Weekly target</span>
              <span className="r">Monthly target</span>
              <span>Last active</span>
              <span className="c">Enabled</span>
            </div>
            {visibleUsers.map((u) => (
              <div key={u.id} className="arow usr2">
                <span className="cust-name">
                  <span className="cust-av" style={{ background: u.av, overflow: 'hidden' }}>
                    {u.details?.picture ? <img src={u.details.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(u.name)}
                  </span>
                  <span>
                    <span
                      className="rlink"
                      onClick={() => navigate(`/setup/users/${u.id}`)}
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                    >
                      {u.name}
                    </span>
                    <br />
                    <span className="cust-code">{u.email}</span>
                  </span>
                </span>
                <span>{u.role}</span>
                <span>{u.details?.outlets?.length ? u.details.outlets.join(', ') : 'All outlets'}</span>
                <span className="r">
                  <Target minor={u.targetDailyMinor ?? 0} onChange={(v) => updU(u.id, { targetDailyMinor: v })} />
                </span>
                <span className="r">
                  <Target minor={u.targetWeeklyMinor ?? 0} onChange={(v) => updU(u.id, { targetWeeklyMinor: v })} />
                </span>
                <span className="r">
                  <Target minor={u.targetMonthlyMinor ?? 0} onChange={(v) => updU(u.id, { targetMonthlyMinor: v })} />
                </span>
                <span>{u.last}</span>
                <span className="c">
                  {u.owner ? (
                    <span className="owner-check">✓</span>
                  ) : (
                    <Switch on={u.enabled} onClick={() => toggle(u.id)} />
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

    </>
  );
}
