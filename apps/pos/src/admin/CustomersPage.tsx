import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type CustomerRow } from '../data/customers';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useCustomers } from '../store/customerStore';
import '../styles/catalog.css';

const NAV: ContextItem[] = [
  { key: 'customers', label: 'Customers' },
  { key: 'groups', label: 'Groups' },
];

const DETAIL_TABS = ['Details', 'Store credit', 'Loyalty', 'Account', 'Notes'];

/** Minimal CSV parser: handles quoted fields, escaped quotes and CR/LF rows. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) out.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) out.push(row);
  return out;
}

/** Build a CSV string and trigger a browser download. */
function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('customers');
  const customers = useCustomers((s) => s.customers);
  const groups = useCustomers((s) => s.groups);
  const addCust = useCustomers((s) => s.addCustomer);
  const updateCust = useCustomers((s) => s.updateCustomer);
  const deleteCust = useCustomers((s) => s.deleteCustomer);
  const addGroup = useCustomers((s) => s.addGroup);
  const deleteGroup = useCustomers((s) => s.deleteGroup);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('Details');
  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Edit / create customer modal — editingCustId is 'new' while creating.
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const isNewCust = editingCustId === 'new';

  const startEdit = (c: CustomerRow) => {
    setEditingCustId(c.id);
    setEditFirst(c.firstName);
    setEditLast(c.lastName);
    setEditCode(c.code);
    setEditGroup(c.group);
    setEditEmail(c.email || '');
    setEditPhone(c.phone || '');
  };

  const startAdd = () => {
    setEditingCustId('new');
    setEditFirst('');
    setEditLast('');
    setEditCode('');
    setEditGroup(groups[0] ?? 'All Customers');
    setEditEmail('');
    setEditPhone('');
  };

  const saveCustEdit = () => {
    if (!editingCustId) return;
    if (isNewCust) {
      addCust({
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
        code: editCode.trim() || `${editFirst.trim().toLowerCase() || 'cust'}-${String(Date.now()).slice(-4)}`,
        group: editGroup || groups[0] || 'All Customers',
        email: editEmail.trim(),
        phone: editPhone.trim(),
        storeCreditMinor: 0,
        loyaltyMinor: 0,
        accountMinor: 0,
      });
    } else {
      updateCust(editingCustId, {
        firstName: editFirst,
        lastName: editLast,
        code: editCode,
        group: editGroup,
        email: editEmail,
        phone: editPhone,
      });
    }
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

  const filtered = customers.filter(
    (c) =>
      (q.trim() === '' ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q.toLowerCase()) ||
        c.code.toLowerCase().includes(q.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(q.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(q.toLowerCase())) &&
      (groupFilter === 'all' || c.group === groupFilter),
  );

  const deleteCustomer = (id: string) => {
    deleteCust(id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setExpanded(null);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map((c) => c.id));
  const bulkDelete = () => {
    selectedIds.forEach((id) => deleteCust(id));
    setSelectedIds([]);
    setExpanded(null);
  };

  const exportCustomers = () => {
    downloadCsv('customers.csv', [
      ['firstName', 'lastName', 'code', 'group', 'email', 'phone', 'storeCredit', 'loyalty', 'account'],
      ...filtered.map((c) => [
        c.firstName,
        c.lastName,
        c.code,
        c.group,
        c.email || '',
        c.phone || '',
        (c.storeCreditMinor / 100).toFixed(2),
        (c.loyaltyMinor / 100).toFixed(2),
        (c.accountMinor / 100).toFixed(2),
      ]),
    ]);
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseCsv(text);
      let count = 0;
      if (parsed.length > 1) {
        const header = (parsed[0] ?? []).map((h) => h.trim().toLowerCase());
        const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
        const iFirst = col('firstname', 'first name', 'first_name', 'first');
        const iLast = col('lastname', 'last name', 'last_name', 'last');
        const iEmail = col('email', 'email address', 'email_address');
        const iPhone = col('phone', 'phone number', 'phone_number', 'mobile');
        const iGroup = col('group', 'customer group');
        parsed.slice(1).forEach((r, idx) => {
          const firstName = iFirst >= 0 ? (r[iFirst] ?? '').trim() : '';
          const lastName = iLast >= 0 ? (r[iLast] ?? '').trim() : '';
          if (!firstName && !lastName) return; // skip invalid rows
          const rawGroup = iGroup >= 0 ? (r[iGroup] ?? '').trim() : '';
          addCust({
            firstName,
            lastName,
            code: `${(firstName || lastName).toLowerCase()}-${String(Date.now() + idx).slice(-4)}`,
            group: groups.includes(rawGroup) ? rawGroup : 'All Customers',
            email: iEmail >= 0 ? (r[iEmail] ?? '').trim() : '',
            phone: iPhone >= 0 ? (r[iPhone] ?? '').trim() : '',
            storeCreditMinor: 0,
            loyaltyMinor: 0,
            accountMinor: 0,
          });
          count++;
        });
      }
      setNotice(`Imported ${count} customer${count === 1 ? '' : 's'}`);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'groups' ? (
            <>
              <h1 className="page-title">Groups</h1>
              <div className="add-bar">
                <input
                  className="set-input"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="New group name"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn-p"
                  disabled={!newGroup.trim()}
                  onClick={() => {
                    addGroup(newGroup.trim());
                    setNewGroup('');
                  }}
                >
                  Add group
                </button>
              </div>
              <div className="atable">
                <div className="athead grp3">
                  <span>Name</span>
                  <span className="r">Number of customers</span>
                  <span />
                </div>
                {groups.map((g) => (
                  <div key={g} className="arow grp3">
                    <span>{g}</span>
                    <span className="r">{customers.filter((c) => c.group === g).length}</span>
                    <span className="row-actions">
                      {g !== 'All Customers' && (
                        <span className="ic" style={{ cursor: 'pointer' }} onClick={() => deleteGroup(g)}>
                          🗑
                        </span>
                      )}
                    </span>
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
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleImportFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button className="btn-s" onClick={() => importFileRef.current?.click()}>
                    Import customers
                  </button>
                  <button className="btn-p" onClick={startAdd}>
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
                  <select
                    className="set-select"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    style={{ height: '38px', minWidth: '180px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}
                  >
                    <option value="all">All</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cust-toolbar">
                <span>
                  Showing {filtered.length} customer{filtered.length === 1 ? '' : 's'}
                  {notice ? ` · ${notice}` : ''}
                </span>
                <span className="rlink" onClick={exportCustomers}>⤓ Export list</span>
              </div>

              {selectedIds.length > 0 && (
                <div className="bulk-bar">
                  <span className="bulk-count">
                    {selectedIds.length} selected
                  </span>
                  <button className="btn-s danger" onClick={bulkDelete}>
                    Delete
                  </button>
                  <span className="rlink" onClick={() => setSelectedIds([])}>
                    Clear
                  </span>
                </div>
              )}

              <div className="atable">
                <div className="athead cust2">
                  <span className="c">
                    <span className={`acheck sel ${allSelected ? 'on' : ''}`} onClick={toggleSelectAll} />
                  </span>
                  <span>Customer</span>
                  <span>Group</span>
                  <span className="r">Store credit</span>
                  <span className="r">Loyalty</span>
                  <span className="r">Account</span>
                  <span />
                </div>
                {filtered.map((c) => (
                  <div key={c.id}>
                    <div className="arow cust2" onClick={() => setExpanded((e) => (e === c.id ? null : c.id))}>
                      <span className="c" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`acheck sel ${selectedIds.includes(c.id) ? 'on' : ''}`}
                          onClick={() => toggleSelect(c.id)}
                        />
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
                      <span>{c.group || '—'}</span>
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
              <h2>{isNewCust ? 'Add customer' : 'Edit customer profile'}</h2>
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
                  placeholder={isNewCust ? 'Leave blank to generate' : 'e.g. vip-12'}
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
                  {!groups.includes(editGroup) && editGroup && <option value={editGroup}>{editGroup}</option>}
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
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
                  {isNewCust ? 'Add customer' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
