import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type CustomerRow } from '../data/customers';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';

const NAV: ContextItem[] = [
  { key: 'customers', label: 'Customers' },
  { key: 'groups', label: 'Groups' },
];

const DETAIL_TABS = ['Details', 'Store credit', 'Loyalty', 'Account', 'Notes'];

export function CustomersPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('customers');
  const [list, setList] = useState<CustomerRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('Details');
  const [q, setQ] = useState('');

  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const startEdit = (c: CustomerRow) => {
    setEditingCustId(c.id);
    setEditFirst(c.firstName);
    setEditLast(c.lastName);
    setEditCode(c.code);
    setEditGroup(c.group);
    setEditEmail(c.email || '');
    setEditPhone(c.phone || '');
  };

  const saveCustEdit = () => {
    if (!editingCustId) return;
    setList((prev) =>
      prev.map((c) => {
        if (c.id === editingCustId) {
          return {
            ...c,
            firstName: editFirst,
            lastName: editLast,
            code: editCode,
            group: editGroup,
            email: editEmail,
            phone: editPhone,
          };
        }
        return c;
      })
    );
    setEditingCustId(null);
  };

  const printCustomer = (c: CustomerRow) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Customer Profile - ${c.firstName} ${c.lastName}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1e293b;
            }
            .header {
              border-bottom: 2px solid #4b3df5;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              margin: 0;
            }
            .group {
              display: inline-block;
              background: #f1f5f9;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 14px;
              margin-top: 8px;
            }
            .grid {
              display: grid;
              grid-template-columns: 150px 1fr;
              gap: 16px;
              font-size: 16px;
              margin-bottom: 32px;
            }
            .label {
              font-weight: 600;
              color: #64748b;
            }
            .balances {
              border-top: 1px solid #e2e8f0;
              padding-top: 24px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 24px;
            }
            .balance-card {
              background: #f8fafc;
              padding: 16px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              text-align: center;
            }
            .balance-val {
              font-size: 20px;
              font-weight: bold;
              color: #4b3df5;
              margin-top: 8px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${c.firstName} ${c.lastName}</h1>
            <div class="group">${c.group}</div>
          </div>
          <div class="grid">
            <div class="label">Customer Code</div>
            <div>${c.code}</div>
            <div class="label">Email Address</div>
            <div>${c.email || '—'}</div>
            <div class="label">Phone Number</div>
            <div>${c.phone || '—'}</div>
          </div>
          <div class="balances">
            <div class="balance-card">
              <div class="label">Store Credit</div>
              <div class="balance-val">$${(c.storeCreditMinor / 100).toFixed(2)}</div>
            </div>
            <div class="balance-card">
              <div class="label">Loyalty points</div>
              <div class="balance-val">$${(c.loyaltyMinor / 100).toFixed(2)}</div>
            </div>
            <div class="balance-card">
              <div class="label">Account Balance</div>
              <div class="balance-val">$${(c.accountMinor / 100).toFixed(2)}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = list.filter(
    (c) =>
      q.trim() === '' ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q.toLowerCase()) ||
      c.code.toLowerCase().includes(q.toLowerCase()),
  );

  const addCustomer = () => {
    const n = list.length + 1;
    setList((l) => [
      ...l,
      {
        id: `c${l.length}-${n}`,
        firstName: 'New',
        lastName: `Customer ${n}`,
        code: `new-${n}`,
        group: 'All Customers',
        email: `new${n}@example.com`,
        phone: '+1 555 0000',
        storeCreditMinor: 0,
        loyaltyMinor: 0,
        accountMinor: 0,
      },
    ]);
  };

  const deleteCustomer = (id: string) => {
    setList((l) => l.filter((c) => c.id !== id));
    setExpanded(null);
  };

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'groups' ? (
            <>
              <h1 className="page-title">Groups</h1>
              <div className="atable">
                <div className="athead grp">
                  <span>Name</span>
                  <span className="r">Number of customers</span>
                </div>
                {['All Customers', 'VIP', 'Wholesale'].map((g) => (
                  <div key={g} className="arow grp">
                    <span>{g}</span>
                    <span className="r">{list.filter((c) => c.group === g).length}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">Customers</h1>
              <div className="subbar-row">
                <span>
                  Manage customers and their account balances or organize them by demographics and
                  spending habits. <span className="rlink">Need help? ↗</span>
                </span>
                <div className="page-actions">
                  <button className="btn-s">Import customers</button>
                  <button className="btn-p" onClick={addCustomer}>
                    Add customer
                  </button>
                </div>
              </div>

              <div className="filter-row">
                <div className="f-field">
                  <label>Search for customers</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Enter name, customer code or contact details"
                  />
                </div>
                <div className="f-field">
                  <label>Customer group</label>
                  <div className="f-select">All</div>
                </div>
                <span className="rlink filt-more">More filters</span>
                <button className="btn-p f-search">Search</button>
              </div>

              <div className="cust-toolbar">
                <span>
                  Showing {filtered.length} customer{filtered.length === 1 ? '' : 's'}
                </span>
                <span className="rlink">⤓ Export list</span>
              </div>

              <div className="atable">
                <div className="athead cust2">
                  <span className="c">
                    <span className="acheck" />
                  </span>
                  <span>Customer</span>
                  <span>Location</span>
                  <span className="r">Store credit</span>
                  <span className="r">Loyalty</span>
                  <span className="r">Account</span>
                  <span />
                </div>
                {filtered.map((c) => (
                  <div key={c.id}>
                    <div className="arow cust2" onClick={() => setExpanded((e) => (e === c.id ? null : c.id))}>
                      <span className="c" onClick={(e) => e.stopPropagation()}>
                        <span className="acheck" />
                      </span>
                      <span className="cust-name">
                        <span className="cust-av">
                          {c.firstName.charAt(0)}
                          {c.lastName.charAt(0)}
                        </span>
                        <span>
                          <b>
                            {c.firstName} {c.lastName}
                          </b>{' '}
                          <span className="cust-grp">{c.group}</span>
                          <br />
                          <span className="cust-code">{c.code}</span>
                        </span>
                      </span>
                      <span>–</span>
                      <span className="r">{fmt(c.storeCreditMinor)}</span>
                      <span className="r">{fmt(c.loyaltyMinor)}</span>
                      <span className="r">{fmt(c.accountMinor)}</span>
                      <span
                        className="c out-edit"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(c);
                        }}
                      >
                        ✎
                      </span>
                    </div>
                    {expanded === c.id && (
                      <div className="cust-expand">
                        <div className="sh-tabs small">
                          {DETAIL_TABS.map((t) => (
                            <button
                              key={t}
                              className={`sh-tab ${detailTab === t ? 'active' : ''}`}
                              onClick={() => setDetailTab(t)}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="cust-detail">
                          <div className="cust-profile">
                            {detailTab === 'Details' && (
                              <>
                                <div className="cust-p-h">PROFILE</div>
                                <div className="cust-p-row">
                                  <span>Code</span>
                                  <b>{c.code}</b>
                                </div>
                                <div className="cust-p-row">
                                  <span>Email</span>
                                  <b>{c.email}</b>
                                </div>
                                <div className="cust-p-row">
                                  <span>Phone</span>
                                  <b>{c.phone}</b>
                                </div>
                              </>
                            )}
                            {detailTab === 'Store credit' && (
                              <div className="cust-p-row">
                                <span>Balance</span>
                                <b>{fmt(c.storeCreditMinor)}</b>
                              </div>
                            )}
                            {detailTab === 'Loyalty' && (
                              <div className="cust-p-row">
                                <span>Points</span>
                                <b>{fmt(c.loyaltyMinor)}</b>
                              </div>
                            )}
                            {detailTab === 'Account' && (
                              <div className="cust-p-row">
                                <span>Balance</span>
                                <b>{fmt(c.accountMinor)}</b>
                              </div>
                            )}
                            {detailTab === 'Notes' && (
                              <div className="cust-p-row">
                                <span>Notes</span>
                                <b>—</b>
                              </div>
                            )}
                          </div>
                          <div className="cust-actions">
                            <button className="btn-p" onClick={() => startEdit(c)}>
                              ✎ Edit customer
                            </button>
                            <button className="btn-s" onClick={() => printCustomer(c)}>
                              Print customer
                            </button>
                            <button
                              className="btn-s"
                              onClick={() => navigate('/sell/sales-history', { state: { customerName: `${c.firstName} ${c.lastName}` } })}
                            >
                              View sales
                            </button>
                            <button className="btn-s danger" onClick={() => deleteCustomer(c.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {editingCustId !== null && (
        <div className="pm-overlay" onClick={() => setEditingCustId(null)}>
          <div className="pm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pm-head">
              <h2>Edit customer profile</h2>
              <button className="pm-close" onClick={() => setEditingCustId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    First name
                  </label>
                  <input
                    className="set-input"
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="First Name"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="set-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                    Last name
                  </label>
                  <input
                    className="set-input"
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Last Name"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Customer code
                </label>
                <input
                  className="set-input"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="e.g. vip-12"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Customer group
                </label>
                <select
                  className="set-select"
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '40px' }}
                >
                  <option value="All Customers">All Customers</option>
                  <option value="VIP">VIP</option>
                  <option value="Wholesale">Wholesale</option>
                </select>
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Email address
                </label>
                <input
                  className="set-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="set-field" style={{ maxWidth: '100%' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'block' }}>
                  Phone number
                </label>
                <input
                  className="set-input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +1 555 0100"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button className="btn-s" onClick={() => setEditingCustId(null)} type="button">
                  Cancel
                </button>
                <button className="btn-p" onClick={saveCustEdit} disabled={!editFirst.trim() || !editLast.trim()} type="button">
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
