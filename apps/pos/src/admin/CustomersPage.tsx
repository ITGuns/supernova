import { useRef, useState } from 'react';
import { EMPTY_CUSTOMER_ADDRESS, EMPTY_CUSTOMER_DETAILS, type CustomerAddress, type CustomerDetails } from '../data/customers';
import { normaliseDetails } from '../store/customerStore';
import { useCustomFields } from '../store/customFieldStore';
import { useSetup } from '../store/setupStore';
import { useCart } from '../store/cartStore';
import { CASH, methodOf } from '../lib/tenders';
import { MoneyInput } from './NumInput';
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
  const [newGroup, setNewGroup] = useState<string | null>(null);
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
  const [editDetails, setEditDetails] = useState<CustomerDetails>(() => normaliseDetails(null));
  const [editLimit, setEditLimit] = useState<number | null>(null);
  const [editLoyalty, setEditLoyalty] = useState(true);
  const [modalTab, setModalTab] = useState<'Contact information' | 'Addresses' | 'Additional information' | 'Customer settings'>('Contact information');
  const [pendingQ, setPendingQ] = useState('');
  const [pendingGroup, setPendingGroup] = useState('all');
  const [moreFilters, setMoreFilters] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'credit' | 'account' | 'loyalty'>('all');
  const customFields = useCustomFields((s) => s.fields).filter((f) => f.application === 'Customers');
  const completeSale = useCart((s) => s.completeSale);
  const [balanceAction, setBalanceAction] = useState<{ id: string; kind: 'credit' | 'loyalty' | 'account'; amount: number; note: string; method: string } | null>(null);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const applyBalance = () => {
    if (!balanceAction || balanceAction.amount === 0) return;
    const c = customers.find((x) => x.id === balanceAction.id);
    if (!c) return;
    if (balanceAction.kind === 'credit') updateCust(c.id, { storeCreditMinor: Math.max(0, c.storeCreditMinor + balanceAction.amount) });
    else if (balanceAction.kind === 'loyalty') updateCust(c.id, { loyaltyMinor: Math.max(0, c.loyaltyMinor + balanceAction.amount) });
    else {
      // An account payment is money taken at the register: it clears the balance and shows in takings.
      const paid = Math.min(c.accountMinor, Math.abs(balanceAction.amount));
      if (paid > 0) {
        useCart.setState({ customerName: `${c.firstName} ${c.lastName}`.trim(), orderNote: balanceAction.note || 'On-account payment' });
        completeSale({ totalMinor: paid, taxMinor: 0, discountMinor: 0, tenders: [{ id: `t-${Date.now()}`, method: balanceAction.method, amountMinor: paid }], changeMinor: 0, lines: [{ name: 'On-account payment', quantity: 1, unitPriceMinor: paid, costMinor: 0 }], status: 'Completed' });
        updateCust(c.id, { accountMinor: c.accountMinor - paid });
      }
    }
    setNotice(`${c.firstName} ${c.lastName}: ${balanceAction.kind === 'credit' ? 'store credit' : balanceAction.kind === 'loyalty' ? 'loyalty' : 'account'} updated`);
    setBalanceAction(null);
  };
  const onAccountEnabled = useSetup((s) => s.onAccountEnabled);
  const groupCreated = useCustomers((s) => s.groupCreated);
  const isNewCust = editingCustId === 'new';
  const setAddr = (which: 'physical' | 'postal', patch: Partial<CustomerAddress>) =>
    setEditDetails((d) => ({ ...d, [which]: { ...d[which], ...patch } }));

  const startEdit = (c: CustomerRow) => {
    setEditingCustId(c.id);
    setEditFirst(c.firstName);
    setEditLast(c.lastName);
    setEditCode(c.code);
    setEditGroup(c.group);
    setEditEmail(c.email || '');
    setEditPhone(c.phone || '');
    setEditDetails(normaliseDetails(c.details));
    setEditLimit(c.onAccountLimitMinor ?? null);
    setEditLoyalty(c.loyaltyEnabled !== false);
    setModalTab('Contact information');
  };

  const startAdd = () => {
    setEditingCustId('new');
    setEditFirst('');
    setEditLast('');
    setEditCode('');
    setEditGroup(groups[0] ?? 'All Customers');
    setEditEmail('');
    setEditPhone('');
    setEditDetails(normaliseDetails(null));
    setEditLimit(null);
    setEditLoyalty(true);
    setModalTab('Contact information');
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
        onAccountLimitMinor: editLimit,
        loyaltyEnabled: editLoyalty,
        details: editDetails.postalSameAsPhysical ? { ...editDetails, postal: { ...EMPTY_CUSTOMER_ADDRESS } } : editDetails,
      });
    } else {
      updateCust(editingCustId, {
        firstName: editFirst,
        lastName: editLast,
        code: editCode,
        group: editGroup,
        email: editEmail,
        phone: editPhone,
        onAccountLimitMinor: editLimit,
        loyaltyEnabled: editLoyalty,
        details: editDetails.postalSameAsPhysical ? { ...editDetails, postal: { ...EMPTY_CUSTOMER_ADDRESS } } : editDetails,
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
      (groupFilter === 'all' || c.group === groupFilter) &&
      (balanceFilter === 'all' || (balanceFilter === 'credit' ? c.storeCreditMinor > 0 : balanceFilter === 'loyalty' ? c.loyaltyMinor > 0 : c.accountMinor > 0)),
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
              <div className="subbar-row">
                <span>
                  Group customers for reporting purposes and to apply targeted promotions or special offers. <span className="rlink">Need help?</span>
                </span>
                <button className="btn-p" onClick={() => setNewGroup((v) => (v === null ? '' : v))}>Add customer group</button>
              </div>
              {newGroup !== null && (
                <div className="add-bar">
                  <input
                    className="set-input"
                    value={newGroup}
                    autoFocus
                    onChange={(e) => setNewGroup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newGroup.trim()) {
                        addGroup(newGroup.trim());
                        setNewGroup(null);
                      }
                      if (e.key === 'Escape') setNewGroup(null);
                    }}
                    placeholder="Group name"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-p"
                    disabled={!newGroup.trim()}
                    onClick={() => {
                      addGroup(newGroup.trim());
                      setNewGroup(null);
                    }}
                  >
                    Add group
                  </button>
                  <button className="btn-s" onClick={() => setNewGroup(null)}>Cancel</button>
                </div>
              )}
              <div className="atable">
                <div className="athead grp4">
                  <span>Name</span>
                  <span>Date created</span>
                  <span className="r">Number of customers</span>
                  <span />
                </div>
                {groups.filter((g) => g !== 'All Customers').length === 0 && (
                  <div className="ct-empty">You haven’t added any customer groups.</div>
                )}
                {groups.map((g) => (
                  <div key={g} className="arow grp4">
                    <span>{g}</span>
                    <span className="ct-muted">{g === 'All Customers' ? 'With store' : groupCreated[g] ? new Date(groupCreated[g]!).toLocaleDateString() : '—'}</span>
                    <span className="r">{g === 'All Customers' ? customers.length : customers.filter((c) => c.group === g).length}</span>
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

              <div className="sc-filter-card">
                <div className="sc-frow">
                  <div className="f-field">
                    <label>Search for customers</label>
                    <input
                      value={pendingQ}
                      onChange={(e) => setPendingQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setQ(pendingQ);
                          setGroupFilter(pendingGroup);
                        }
                      }}
                      placeholder="Enter name, customer code or contact details"
                    />
                  </div>
                  <div className="f-field">
                    <label>Customer group</label>
                    <select
                      className="set-select"
                      value={pendingGroup}
                      onChange={(e) => setPendingGroup(e.target.value)}
                      style={{ height: '38px', minWidth: '180px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}
                    >
                      <option value="all">All groups</option>
                      {groups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  {moreFilters && (
                    <div className="f-field">
                      <label>Balance</label>
                      <select
                        className="set-select"
                        value={balanceFilter}
                        onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
                        style={{ height: '38px', minWidth: '180px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' }}
                      >
                        <option value="all">Any balance</option>
                        <option value="credit">Has store credit</option>
                        <option value="loyalty">Has loyalty balance</option>
                        <option value="account">Owes on account</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="sc-factions split">
                  <span className="sc-links">
                    <span
                      className="rlink"
                      onClick={() => {
                        setPendingQ('');
                        setPendingGroup('all');
                        setQ('');
                        setGroupFilter('all');
                        setBalanceFilter('all');
                      }}
                    >
                      Clear filters
                    </span>
                    <span className="rlink" onClick={() => setMoreFilters((m) => !m)}>{moreFilters ? 'Less filters' : 'More filters'}</span>
                  </span>
                  <button
                    className="btn-p"
                    onClick={() => {
                      setQ(pendingQ);
                      setGroupFilter(pendingGroup);
                    }}
                  >
                    Search
                  </button>
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

              {customers.length === 0 && (
                <div className="astate">
                  <div>Create customer profiles to keep track of sales history and contact information.</div>
                  <button className="btn-p" onClick={startAdd}>Add customer</button>
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
                                {c.details?.company && (
                                  <div className="cust-p-row"><span>Company</span><b>{c.details.company}</b></div>
                                )}
                                {c.details?.physical.street1 && (
                                  <div className="cust-p-row"><span>Address</span><b>{[c.details.physical.street1, c.details.physical.city, c.details.physical.state, c.details.physical.zip].filter(Boolean).join(', ')}</b></div>
                                )}
                                {c.createdAt && (
                                  <div className="cust-p-row"><span>Customer since</span><b>{new Date(c.createdAt).toLocaleDateString()}</b></div>
                                )}
                              </>
                            )}
                            {detailTab === 'Store credit' && (
                              <>
                                <div className="cust-p-row">
                                  <span>Balance</span>
                                  <b>{fmt(c.storeCreditMinor)}</b>
                                </div>
                                <div className="cust-p-actions">
                                  <button className="btn-s" onClick={() => setBalanceAction({ id: c.id, kind: 'credit', amount: 0, note: '', method: CASH })}>Issue store credit</button>
                                  <span className="cust-p-hint">Store credit is spent on the Pay screen.</span>
                                </div>
                              </>
                            )}
                            {detailTab === 'Loyalty' && (
                              <>
                                <div className="cust-p-row">
                                  <span>Balance</span>
                                  <b>{fmt(c.loyaltyMinor)}</b>
                                </div>
                                <div className="cust-p-actions">
                                  <button className="btn-s" onClick={() => setBalanceAction({ id: c.id, kind: 'loyalty', amount: 0, note: '', method: CASH })}>Adjust Loyalty</button>
                                </div>
                              </>
                            )}
                            {detailTab === 'Account' && (
                              <>
                                <div className="cust-p-row">
                                  <span>Balance owing</span>
                                  <b>{fmt(c.accountMinor)}</b>
                                </div>
                                <div className="cust-p-row">
                                  <span>Limit</span>
                                  <b>{c.onAccountLimitMinor ? fmt(c.onAccountLimitMinor) : 'Store default'}</b>
                                </div>
                                <div className="cust-p-actions">
                                  <button className="btn-s" disabled={c.accountMinor <= 0} onClick={() => setBalanceAction({ id: c.id, kind: 'account', amount: -c.accountMinor, note: '', method: CASH })}>Receive payment</button>
                                </div>
                              </>
                            )}
                            {detailTab === 'Notes' && (
                              <div className="cust-p-row">
                                <span>Notes</span>
                                <b>{c.details?.notes || '—'}</b>
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

      {balanceAction && (
        <div className="pm-overlay" onClick={() => setBalanceAction(null)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>{balanceAction.kind === 'credit' ? 'Issue store credit' : balanceAction.kind === 'loyalty' ? 'Adjust Loyalty' : 'Receive on-account payment'}</h2>
              <button className="pm-close" onClick={() => setBalanceAction(null)} aria-label="Close">×</button>
            </div>
            <form className="reg-open-body" onSubmit={(e) => { e.preventDefault(); applyBalance(); }}>
              <label className="reg-open-field">
                <span>{balanceAction.kind === 'account' ? 'Amount received' : 'Amount (use a negative amount to take balance away)'}</span>
                <span className="cm-money"><span>$</span><MoneyInput className="" minor={Math.abs(balanceAction.amount)} onChange={(v) => setBalanceAction({ ...balanceAction, amount: balanceAction.kind === 'account' ? -v : balanceAction.amount < 0 ? -v : v })} autoFocus /></span>
                {balanceAction.kind !== 'account' && (
                  <label className="cm-field cm-check" style={{ marginTop: 6 }}>
                    <input type="checkbox" checked={balanceAction.amount < 0} onChange={(e) => setBalanceAction({ ...balanceAction, amount: e.target.checked ? -Math.abs(balanceAction.amount || 0) : Math.abs(balanceAction.amount || 0) })} />
                    <span>Deduct instead of add</span>
                  </label>
                )}
              </label>
              {balanceAction.kind === 'account' && (
                <label className="reg-open-field">
                  <span>Paid by</span>
                  <select value={balanceAction.method} onChange={(e) => setBalanceAction({ ...balanceAction, method: e.target.value })}>
                    <option value={CASH}>Cash</option>
                    {paymentTypes.filter((t) => methodOf(t) !== CASH).map((t) => <option key={t.id} value={methodOf(t)}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <label className="reg-open-field">
                <span>Note <span className="pe-hint">(Optional)</span></span>
                <input value={balanceAction.note} onChange={(e) => setBalanceAction({ ...balanceAction, note: e.target.value })} placeholder="e.g. Goodwill for late delivery" />
              </label>
              <button className="pm-complete" type="submit" disabled={balanceAction.amount === 0}>{balanceAction.kind === 'account' ? 'Record payment' : 'Apply'}</button>
            </form>
          </div>
        </div>
      )}
      {editingCustId !== null && (
        <div className="pm-overlay" onClick={() => setEditingCustId(null)}>
          <div className="pm cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-head">
              <h2>{isNewCust ? 'Add customer' : 'Edit customer profile'}</h2>
              <button className="pm-close" onClick={() => setEditingCustId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sh-tabs small cm-tabs">
              {(['Contact information', 'Addresses', 'Additional information', 'Customer settings'] as const).map((t) => (
                <button key={t} className={`sh-tab ${modalTab === t ? 'active' : ''}`} onClick={() => setModalTab(t)} type="button">{t}</button>
              ))}
            </div>
            <div className="cm-body">
              {modalTab === 'Contact information' && (
                <div className="cm-grid">
                  <label className="cm-field"><span>First name</span><input className="set-input" value={editFirst} autoFocus onChange={(e) => setEditFirst(e.target.value)} placeholder="First name" /></label>
                  <label className="cm-field"><span>Last name</span><input className="set-input" value={editLast} onChange={(e) => setEditLast(e.target.value)} placeholder="Last name" /></label>
                  <label className="cm-field"><span>Email</span><input className="set-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="name@domain.com" /></label>
                  <label className="cm-field"><span>Phone</span><input className="set-input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+1 555 0100" /></label>
                  <label className="cm-field"><span>Company</span><input className="set-input" value={editDetails.company} onChange={(e) => setEditDetails({ ...editDetails, company: e.target.value })} /></label>
                  <label className="cm-field"><span>Customer code</span><input className="set-input" value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder={isNewCust ? 'Leave blank to generate' : 'e.g. vip-12'} /></label>
                  <label className="cm-field">
                    <span>Customer group</span>
                    <select className="set-select" value={editGroup} onChange={(e) => setEditGroup(e.target.value)}>
                      {!groups.includes(editGroup) && editGroup && <option value={editGroup}>{editGroup}</option>}
                      {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                  <label className="cm-field cm-check">
                    <input type="checkbox" checked={editDetails.emailMarketing} onChange={(e) => setEditDetails({ ...editDetails, emailMarketing: e.target.checked })} />
                    <span>Customer has opted in to marketing emails</span>
                  </label>
                </div>
              )}
              {modalTab === 'Addresses' && (
                <>
                  <div className="cm-sub">PHYSICAL ADDRESS</div>
                    <div className="cm-grid">
                      <label className="cm-field"><span>Street</span><input className="set-input" value={editDetails.physical.street1} onChange={(e) => setAddr('physical', { street1: e.target.value })} /></label>
                      <label className="cm-field"><span>Street 2</span><input className="set-input" value={editDetails.physical.street2} onChange={(e) => setAddr('physical', { street2: e.target.value })} /></label>
                      <label className="cm-field"><span>Suburb</span><input className="set-input" value={editDetails.physical.suburb} onChange={(e) => setAddr('physical', { suburb: e.target.value })} /></label>
                      <label className="cm-field"><span>City</span><input className="set-input" value={editDetails.physical.city} onChange={(e) => setAddr('physical', { city: e.target.value })} /></label>
                      <label className="cm-field"><span>State</span><input className="set-input" value={editDetails.physical.state} onChange={(e) => setAddr('physical', { state: e.target.value })} /></label>
                      <label className="cm-field"><span>ZIP code</span><input className="set-input" value={editDetails.physical.zip} onChange={(e) => setAddr('physical', { zip: e.target.value })} /></label>
                      <label className="cm-field"><span>Country</span><input className="set-input" value={editDetails.physical.country} onChange={(e) => setAddr('physical', { country: e.target.value })} placeholder="United States" /></label>
                    </div>
                  <label className="cm-field cm-check">
                    <input type="checkbox" checked={editDetails.postalSameAsPhysical} onChange={(e) => setEditDetails({ ...editDetails, postalSameAsPhysical: e.target.checked })} />
                    <span>Postal address is the same as the physical address</span>
                  </label>
                  {!editDetails.postalSameAsPhysical && (
                    <>
                      <div className="cm-sub">POSTAL ADDRESS</div>
                    <div className="cm-grid">
                      <label className="cm-field"><span>Street</span><input className="set-input" value={editDetails.postal.street1} onChange={(e) => setAddr('postal', { street1: e.target.value })} /></label>
                      <label className="cm-field"><span>Street 2</span><input className="set-input" value={editDetails.postal.street2} onChange={(e) => setAddr('postal', { street2: e.target.value })} /></label>
                      <label className="cm-field"><span>Suburb</span><input className="set-input" value={editDetails.postal.suburb} onChange={(e) => setAddr('postal', { suburb: e.target.value })} /></label>
                      <label className="cm-field"><span>City</span><input className="set-input" value={editDetails.postal.city} onChange={(e) => setAddr('postal', { city: e.target.value })} /></label>
                      <label className="cm-field"><span>State</span><input className="set-input" value={editDetails.postal.state} onChange={(e) => setAddr('postal', { state: e.target.value })} /></label>
                      <label className="cm-field"><span>ZIP code</span><input className="set-input" value={editDetails.postal.zip} onChange={(e) => setAddr('postal', { zip: e.target.value })} /></label>
                      <label className="cm-field"><span>Country</span><input className="set-input" value={editDetails.postal.country} onChange={(e) => setAddr('postal', { country: e.target.value })} placeholder="United States" /></label>
                    </div>
                    </>
                  )}
                </>
              )}
              {modalTab === 'Additional information' && (
                <div className="cm-grid">
                  <label className="cm-field"><span>Date of birth</span><input className="set-input" type="date" value={editDetails.dateOfBirth} onChange={(e) => setEditDetails({ ...editDetails, dateOfBirth: e.target.value })} /></label>
                  <label className="cm-field">
                    <span>Gender</span>
                    <select className="set-select" value={editDetails.gender} onChange={(e) => setEditDetails({ ...editDetails, gender: e.target.value })}>
                      <option value="">Not specified</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option>
                    </select>
                  </label>
                  <label className="cm-field"><span>Website</span><input className="set-input" value={editDetails.website} onChange={(e) => setEditDetails({ ...editDetails, website: e.target.value })} placeholder="https://" /></label>
                  <label className="cm-field"><span>Twitter</span><input className="set-input" value={editDetails.twitter} onChange={(e) => setEditDetails({ ...editDetails, twitter: e.target.value })} placeholder="@handle" /></label>
                  {customFields.map((f) => (
                    <label key={f.id} className="cm-field">
                      <span>{f.name}</span>
                      {f.type === 'Checkbox' ? (
                        <input type="checkbox" checked={editDetails.customFields[f.id] === 'yes'} onChange={(e) => setEditDetails({ ...editDetails, customFields: { ...editDetails.customFields, [f.id]: e.target.checked ? 'yes' : '' } })} />
                      ) : f.type === 'Dropdown' ? (
                        <select className="set-select" value={editDetails.customFields[f.id] ?? ''} onChange={(e) => setEditDetails({ ...editDetails, customFields: { ...editDetails.customFields, [f.id]: e.target.value } })}>
                          <option value="">—</option>
                          {f.options.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="set-input" type={f.type === 'Date' ? 'date' : f.type === 'Number' ? 'number' : 'text'} value={editDetails.customFields[f.id] ?? ''} onChange={(e) => setEditDetails({ ...editDetails, customFields: { ...editDetails.customFields, [f.id]: e.target.value } })} />
                      )}
                    </label>
                  ))}
                  <label className="cm-field cm-wide"><span>Notes</span><textarea className="set-input cm-notes" value={editDetails.notes} onChange={(e) => setEditDetails({ ...editDetails, notes: e.target.value })} placeholder="Notes about this customer (not shown to them)" /></label>
                </div>
              )}
              {modalTab === 'Customer settings' && (
                <div className="cm-grid">
                  <label className="cm-field cm-check cm-wide">
                    <input type="checkbox" checked={editLoyalty} onChange={(e) => setEditLoyalty(e.target.checked)} />
                    <span>Customer earns Loyalty on purchases</span>
                  </label>
                  <label className="cm-field cm-check cm-wide">
                    <input type="checkbox" checked={editDetails.taxExempt} onChange={(e) => setEditDetails({ ...editDetails, taxExempt: e.target.checked })} />
                    <span>Tax exempt — sales to this customer don’t charge sales tax</span>
                  </label>
                  <label className="cm-field">
                    <span>On-account limit{onAccountEnabled ? '' : ' (on-account sales are turned off in Setup)'}</span>
                    <span className="cm-money"><span>$</span><MoneyInput className="set-input" minor={editLimit ?? 0} onChange={(v) => setEditLimit(v > 0 ? v : null)} placeholder="Store default" /></span>
                    <span className="cm-hint">Leave at 0 to use the store’s default limit.</span>
                  </label>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', margin: '18px 0 12px' }}>
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
