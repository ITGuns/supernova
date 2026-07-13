import { useState } from 'react';
import { initials, useUsers } from '../store/userStore';
import { Switch } from './controls';

const AVS = ['#5b8fd6', '#3fae6b', '#e6a817', '#e0483f', '#7c3aed'];

function Target() {
  return (
    <span className="tgt">
      <span className="tgt-cur">$</span>
      <input className="tgt-input" defaultValue="0.00" style={{ width: '60px', border: '1px solid var(--line)', borderRadius: '4px', padding: '2px 4px', background: 'var(--panel)', color: 'var(--text)' }} />
    </span>
  );
}

export function UsersSettings() {
  const [tab, setTab] = useState<'users' | 'roles' | 'activity'>('users');
  const users = useUsers((s) => s.users);
  const addU = useUsers((s) => s.addUser);
  const updU = useUsers((s) => s.updateUser);
  const delU = useUsers((s) => s.deleteUser);
  const togU = useUsers((s) => s.toggleUser);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const toggle = (id: string) => togU(id);

  const addUser = () => {
    const n = users.length + 1;
    addU({ name: `New User ${n}`, email: `new${n}@nova.local`, role: 'Cashier', password: 'nova1234', last: 'just now', enabled: true, av: AVS[n % AVS.length]! });
  };

  const saveUserEdit = () => {
    if (!editingId) return;
    updU(editingId, { name: editName, email: editEmail, role: editRole, password: editPassword });
    setEditingId(null);
  };

  const deleteUser = () => {
    if (!editingId) return;
    delU(editingId);
    setEditingId(null);
  };

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

      {tab !== 'users' ? (
        <div className="placeholder-card">
          <div className="placeholder-icon">👥</div>
          <div className="placeholder-title">{tab === 'roles' ? 'Roles' : 'Activity'}</div>
          <div className="placeholder-hint">This tab is being built to match X-Series.</div>
        </div>
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
              <input placeholder="Enter a name or email address" />
            </div>
            <div className="f-field">
              <label>Role</label>
              <div className="f-select">All roles</div>
            </div>
            <div className="f-field">
              <label>Outlet</label>
              <div className="f-select">All outlets</div>
            </div>
            <button className="btn-p f-search">Search</button>
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
            {users.map((u) => (
              <div key={u.id} className="arow usr2">
                <span className="cust-name">
                  <span className="cust-av" style={{ background: u.av }}>
                    {initials(u.name)}
                  </span>
                  <span>
                    <span
                      className="rlink"
                      onClick={() => {
                        setEditingId(u.id);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditRole(u.role);
                        setEditPassword(u.password);
                      }}
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                    >
                      {u.name}
                    </span>
                    <br />
                    <span className="cust-code">{u.email}</span>
                  </span>
                </span>
                <span>{u.role}</span>
                <span>All outlets</span>
                <span className="r">
                  <Target />
                </span>
                <span className="r">
                  <Target />
                </span>
                <span className="r">
                  <Target />
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

      {editingId !== null && (
        <div className="pm-overlay" onClick={() => setEditingId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="pm-head">
              <h2>Edit user settings</h2>
              <button className="pm-close" onClick={() => setEditingId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Full name
                </label>
                <input
                  className="set-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Alex Kim"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Email address
                </label>
                <input
                  className="set-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. alex@nova.local"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Role
                </label>
                <select
                  className="set-select"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Account owner, Admin">Account owner, Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                </select>
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Password
                </label>
                <input
                  className="set-input"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Set a login password"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Used to log in and to switch users.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={deleteUser}
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
                  Delete user
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-s" onClick={() => setEditingId(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-p" onClick={saveUserEdit} disabled={!editName.trim()} type="button">
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
