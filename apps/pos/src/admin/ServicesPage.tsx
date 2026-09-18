import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCurrentService, useServices } from '../store/serviceStore';
import { useUsers } from '../store/userStore';
import '../styles/catalog.css';
import { CatBox } from './illustrations';

// Services: repairs and jobs booked for customers, moved through statuses
// until they're rung up as a sale.

const selStyle = { height: '38px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' } as const;

export function ServicesPage() {
  const navigate = useNavigate();
  const services = useServices((s) => s.services);
  const statuses = useServices((s) => s.statuses);
  const setStatus = useServices((s) => s.setStatus);
  const addStatus = useServices((s) => s.addStatus);
  const renameStatus = useServices((s) => s.renameStatus);
  const deleteStatus = useServices((s) => s.deleteStatus);
  const [manage, setManage] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const users = useUsers((s) => s.users);
  const [tab, setTab] = useState<'current' | 'all'>('current');
  const [status, setStatusFilter] = useState('All current services');
  const [customer, setCustomer] = useState('');
  const [user, setUser] = useState('all');
  const [text, setText] = useState('');
  const [more, setMore] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ status: 'All current services', customer: '', user: 'all', text: '', from: '', to: '' });

  const rows = services
    .filter((s) => (tab === 'current' ? isCurrentService(s) : true))
    .filter((s) => applied.status === 'All current services' || applied.status === 'All services' || s.status === applied.status)
    .filter((s) => applied.customer.trim() === '' || s.customerName.toLowerCase().includes(applied.customer.trim().toLowerCase()))
    .filter((s) => applied.user === 'all' || s.assignedUser === applied.user)
    .filter((s) => {
      const t = applied.text.trim().toLowerCase();
      return t === '' || s.number.toLowerCase().includes(t) || s.saleOrderNumber.toLowerCase().includes(t) || s.item.name.toLowerCase().includes(t) || s.description.toLowerCase().includes(t) || s.notes.some((n) => n.text.toLowerCase().includes(t));
    })
    .filter((s) => (!applied.from || (s.scheduledAt ?? 0) >= new Date(`${applied.from}T00:00:00`).getTime()) && (!applied.to || (s.scheduledAt ?? Infinity) <= new Date(`${applied.to}T23:59:59`).getTime()))
    .sort((a, b) => (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt));

  const when = (t: number | null) => (t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not scheduled');
  const chip = (s: string) => (s === 'Completed' ? 'received' : s === 'Cancelled' ? 'cancelled' : s === 'New' ? 'open' : 'sent');

  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">Services</h1>
        <div className="sh-tabs">
          <button className={`sh-tab ${tab === 'current' ? 'active' : ''}`} onClick={() => { setTab('current'); setStatusFilter('All current services'); setApplied({ ...applied, status: 'All current services' }); }}>
            Current ({services.filter(isCurrentService).length})
          </button>
          <button className={`sh-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => { setTab('all'); setStatusFilter('All services'); setApplied({ ...applied, status: 'All services' }); }}>
            All
          </button>
        </div>
        <div className="subbar-row">
          <span>
            View, change statuses and add notes to your services. <span className="rlink">Need help?</span>
          </span>
          <span className="pe-inline">
            <span className="rlink" onClick={() => setManage((m) => !m)}>{manage ? 'Done' : 'Manage statuses'}</span>
            <button className="btn-p" onClick={() => navigate('/services/new')}>Create service</button>
          </span>
        </div>
        {manage && (
          <div className="svc-manage">
            <div className="pe-caps">Service statuses</div>
            {statuses.map((st) => (
              <div key={st.id} className="svc-status-row">
                {renaming?.id === st.id ? (
                  <input className="set-input" value={renaming.name} autoFocus onChange={(e) => setRenaming({ id: st.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && renaming.name.trim()) { renameStatus(st.id, renaming.name.trim()); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); }} onBlur={() => { if (renaming.name.trim()) renameStatus(st.id, renaming.name.trim()); setRenaming(null); }} />
                ) : (
                  <span>{st.name}{st.system && <span className="ct-muted"> · built in</span>}</span>
                )}
                {!st.system && (
                  <span className="row-actions">
                    <span className="rlink" onClick={() => setRenaming({ id: st.id, name: st.name })}>Rename</span>
                    <span className="rlink" onClick={() => deleteStatus(st.id)}>Delete</span>
                  </span>
                )}
              </div>
            ))}
            <div className="add-bar">
              <input className="set-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} placeholder="New status name" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter' && newStatus.trim()) { addStatus(newStatus.trim()); setNewStatus(''); } }} />
              <button className="btn-p" disabled={!newStatus.trim()} onClick={() => { addStatus(newStatus.trim()); setNewStatus(''); }}>Add status</button>
            </div>
          </div>
        )}

        <div className="sc-filter-card">
          <div className="sc-frow">
            <div className="f-field">
              <label>Status</label>
              <select className="set-select" value={status} onChange={(e) => setStatusFilter(e.target.value)} style={selStyle}>
                <option>{tab === 'current' ? 'All current services' : 'All services'}</option>
                {statuses.filter((s) => tab === 'all' || (s.name !== 'Completed' && s.name !== 'Cancelled')).map((s) => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="f-field">
              <label>Customer</label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Search for customers" />
            </div>
            <div className="f-field">
              <label>User</label>
              <select className="set-select" value={user} onChange={(e) => setUser(e.target.value)} style={selStyle}>
                <option value="all">All users</option>
                {users.filter((u) => u.enabled).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="f-field">
              <label>Receipt or note</label>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setApplied({ status, customer, user, text, from, to })} placeholder="Enter receipt number, item or note" />
            </div>
          </div>
          {more && (
            <div className="sc-frow">
              <div className="f-field"><label>Scheduled from</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="f-field"><label>Scheduled to</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
          )}
          <div className="sc-factions split">
            <span className="sc-links">
              <span className="rlink" onClick={() => { setStatusFilter(tab === 'current' ? 'All current services' : 'All services'); setCustomer(''); setUser('all'); setText(''); setFrom(''); setTo(''); setApplied({ status: tab === 'current' ? 'All current services' : 'All services', customer: '', user: 'all', text: '', from: '', to: '' }); }}>Clear filters</span>
              <span className="rlink" onClick={() => setMore((m) => !m)}>{more ? 'Less filters' : 'More filters'}</span>
            </span>
            <button className="btn-p" onClick={() => setApplied({ status, customer, user, text, from, to })}>Search</button>
          </div>
        </div>

        <div className="inv-count">Displaying {rows.length} service{rows.length === 1 ? '' : 's'}</div>
        {rows.length ? (
          <div className="atable">
            <div className="inv-thead svc4">
              <span className="s">Sale receipt</span>
              <span className="s">Date scheduled</span>
              <span className="s">Assigned to</span>
              <span className="s">Status</span>
            </div>
            {rows.map((s) => (
              <div key={s.id} className="inv-row svc4">
                <span>
                  <span className="rlink strong" onClick={() => navigate(`/services/${s.id}`)}>{s.number}{s.saleOrderNumber ? ` · Sale ${s.saleOrderNumber}` : ''}</span>
                  <br />
                  <span className="cnt-meta">{s.customerName || 'No customer'}{s.item.name ? ` · ${s.item.name}` : ''}{s.notes.length ? ` · ${s.notes.length} note${s.notes.length === 1 ? '' : 's'}` : ''}</span>
                </span>
                <span>{when(s.scheduledAt)}</span>
                <span>{s.assignedUser || '—'}</span>
                <span>
                  <select className="set-select svc-status" value={s.status} onChange={(e) => setStatus(s.id, e.target.value)} style={selStyle}>
                    {statuses.map((st) => <option key={st.id}>{st.name}</option>)}
                  </select>{' '}
                  <span className={`tx-badge ${chip(s.status)}`}>{s.status}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="astate">
            <CatBox />
            <div>{services.length === 0 ? 'No services yet. Create a service to book a repair or job for a customer.' : 'No services found. Try a different search or update your filters.'}</div>
            {services.length === 0 && <button className="btn-p" onClick={() => navigate('/services/new')}>Create service</button>}
          </div>
        )}
      </div>
    </main>
  );
}
