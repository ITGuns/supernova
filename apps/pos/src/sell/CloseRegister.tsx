import { useMemo, useState } from 'react';
import { fmt } from '../lib/format';
import { isCash, methodOf } from '../lib/tenders';
import { useCart } from '../store/cartStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';
import '../styles/sell.css';

const DENOMS = [1, 5, 10, 25, 100, 200, 500, 1000, 2000, 5000, 10000];

export function CloseRegister() {
  const sales = useCart((s) => s.sales);
  const status = useRegisterSession((s) => s.status);
  const openedAt = useRegisterSession((s) => s.openedAt);
  const openingFloatMinor = useRegisterSession((s) => s.openingFloatMinor);
  const closureSeq = useRegisterSession((s) => s.closureSeq);
  const movements = useRegisterSession((s) => s.movements);
  const closures = useRegisterSession((s) => s.closures);
  const openRegister = useRegisterSession((s) => s.openRegister);
  const closeRegister = useRegisterSession((s) => s.closeRegister);
  const outlet = useSetup((s) => s.outlets)[0];
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const loyaltyEnabled = useSetup((s) => s.loyaltyEnabled);
  const storeCreditEnabled = useSetup((s) => s.storeCreditEnabled);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const userName = users.find((u) => u.id === currentUserId)?.name ?? 'Staff';

  const [qty, setQty] = useState<Record<number, number>>({});
  const [custom, setCustom] = useState('');
  // Lightspeed offers two ways to count the till: one total, or per denomination.
  const [countMode, setCountMode] = useState<'total' | 'denomination'>('denomination');
  const [cashTotalText, setCashTotalText] = useState('');
  // Keyed by payment-row key (see `rows`) plus the two cash fields.
  const [counted, setCounted] = useState<Record<string, string>>({ closingFloat: '', cashToBank: '' });
  const [closeNote, setCloseNote] = useState('');
  const [openFloat, setOpenFloat] = useState('');

  const cashCounted =
    countMode === 'total'
      ? Math.round(parseFloat(cashTotalText || '0') * 100)
      : DENOMS.reduce((sum, d) => sum + d * (qty[d] ?? 0), 0) + Math.round(parseFloat(custom || '0') * 100);

  const movementNet = movements.reduce((sum, m) => sum + (m.type === 'ADD' ? m.amountMinor : -m.amountMinor), 0);

  const { cashReceived, cashRefunded, expectedByMethod } = useMemo(() => {
    let cash = 0;
    let refunded = 0;
    // Expected takings per non-cash payment type (card, Venmo, …), net of refunds.
    const byMethod = new Map<string, number>();
    const add = (m: string, v: number) => byMethod.set(m, (byMethod.get(m) ?? 0) + v);
    const inSession = (t: number) => openedAt == null || t >= openedAt;
    for (const s of sales) {
      if (s.training) continue;
      // Refunds leave the drawer in the session they were issued, even when
      // the original sale belongs to an earlier session.
      if (s.refundedAt != null && inSession(s.refundedAt)) {
        for (const t of s.refundTenders ?? []) {
          if (isCash(t.method)) refunded += t.amountMinor;
          else add(t.method, -t.amountMinor);
        }
      }
      if (!inSession(s.at)) continue;
      cash -= s.changeMinor;
      for (const t of s.tenders) {
        if (isCash(t.method)) cash += t.amountMinor;
        else add(t.method, t.amountMinor);
      }
    }
    return { cashReceived: cash, cashRefunded: refunded, expectedByMethod: byMethod };
  }, [sales, openedAt]);
  const cashExpected = openingFloatMinor + movementNet + cashReceived - cashRefunded;

  const num = (s: string | undefined) => Math.round(parseFloat(s || '0') * 100);
  // One reconciliation row per non-cash way of getting paid: the built-in card
  // tender (with its expected total from this session's sales), any payment
  // types configured in Setup, and loyalty / store credit when enabled.
  const rows = [
    ...paymentTypes
      .filter((t) => !isCash(methodOf(t)))
      .map((t) => ({ key: methodOf(t), label: t.name, expected: expectedByMethod.get(methodOf(t)) ?? 0, editable: true })),
    ...(loyaltyEnabled ? [{ key: 'loyalty', label: 'Loyalty', expected: 0, editable: false }] : []),
    ...(storeCreditEnabled ? [{ key: 'storeCredit', label: 'Store credit', expected: 0, editable: false }] : []),
  ].map((r) => ({ ...r, counted: num(counted[r.key]) }));
  const totalExpected = cashExpected + rows.reduce((s, r) => s + r.expected, 0);
  const totalCounted = cashCounted + rows.reduce((s, r) => s + r.counted, 0);
  const diffCls = (d: number) => (d === 0 ? '' : d < 0 ? 'neg' : 'pos');
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const doClose = () => {
    closeRegister({
      countedMinor: totalCounted,
      expectedMinor: totalExpected,
      nextFloatMinor: num(counted.closingFloat),
      note: closeNote,
      by: userName,
    });
    // Start the next closure with an empty count sheet.
    setQty({});
    setCustom('');
    setCashTotalText('');
    setCounted({ closingFloat: '', cashToBank: '' });
    setCloseNote('');
  };

  if (status === 'closed') {
    const last = closures[0];
    return (
      <main className="sell-page">
        <h1 className="sell-title">Open register</h1>
        <div className="sell-subbar">
          Register closed{last ? ` — closure #${last.number} by ${last.by} at ${new Date(last.closedAt).toLocaleString()}` : ''}. Set an opening float to start selling.
        </div>
        <div className="csm-form">
          <div className="csm-form-h">Open register</div>
          <div className="csm-form-row">
            <div className="csm-fg">
              <label>Opening float ($)</label>
              <input type="number" min="0" step="0.01" value={openFloat} autoFocus onChange={(e) => setOpenFloat(e.target.value)} placeholder={(openingFloatMinor / 100).toFixed(2)} />
            </div>
          </div>
          <div className="csm-form-actions">
            <button className="btn-primary" onClick={() => openRegister(openFloat === '' ? openingFloatMinor : num(openFloat))}>Open register</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sell-page">
      <h1 className="sell-title">Close register</h1>
      <div className="sell-subbar">Close your register to finalize payments and sales for the day.</div>

      <div className="cr2-row">
        <div className="cr2-side"><div className="cr-h">Register details</div></div>
        <div className="cr2-main">
          <div className="cr2-details">
            <div><span>Outlet</span><b>{outlet?.name ?? 'Main Outlet'}</b></div>
            <div><span>Register</span><b>{outlet?.registers[0] ?? 'Main Register'}</b></div>
            <div><span>Closure #</span><b>{closureSeq}</b></div>
            <div><span>Opening time</span><b>{openedAt ? time(openedAt) : 'Today'}</b></div>
          </div>
        </div>
      </div>

      <div className="cr2-row">
        <div className="cr2-side"><div className="cr-h">Count cash</div><div className="set-desc">Enter the amount from the till.</div></div>
        <div className="cr2-main">
          <div className="cr-modes" role="group" aria-label="Count method">
            <button type="button" className={`cr-mode ${countMode === 'total' ? 'active' : ''}`} onClick={() => setCountMode('total')}>Enter cash total only</button>
            <button type="button" className={`cr-mode ${countMode === 'denomination' ? 'active' : ''}`} onClick={() => setCountMode('denomination')}>Count cash by denomination</button>
          </div>
          {countMode === 'total' && (
            <div className="cr-count-row cr-total-only">
              <span>Cash total</span>
              <span className="c" />
              <span className="r"><input className="cr-custom" type="number" step="0.01" min="0" value={cashTotalText} onChange={(e) => setCashTotalText(e.target.value)} placeholder="0.00" autoFocus /></span>
            </div>
          )}
          {countMode === 'denomination' && <div className="cr-count-head"><span>Denomination</span><span className="c">Quantity</span><span className="r">Amount</span></div>}
          {countMode === 'denomination' && DENOMS.map((d) => (
            <div key={d} className="cr-count-row">
              <span>{fmt(d)}</span>
              <span className="c">
                <input type="number" min="0" value={qty[d] ?? ''} onChange={(e) => { const n = parseInt(e.target.value, 10); setQty((q) => ({ ...q, [d]: Number.isFinite(n) && n > 0 ? n : 0 })); }} />
              </span>
              <span className="r">{fmt(d * (qty[d] ?? 0))}</span>
            </div>
          ))}
          {countMode === 'denomination' && (
            <div className="cr-count-row">
              <span>Custom amount</span>
              <span className="c">—</span>
              <span className="r"><input className="cr-custom" type="number" step="0.01" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0.00" /></span>
            </div>
          )}
          <div className="cr-count-total"><span>CASH TOTAL</span><span className="c" /><span className="r">{fmt(cashCounted)}</span></div>
        </div>
      </div>

      <div className="cr2-row">
        <div className="cr2-side"><div className="cr-h">Payments summary</div><div className="set-desc">Balance your register by entering the amount counted from the till and other payment terminals into the empty fields here.</div></div>
        <div className="cr2-main">
          <div className="cr-pay-head"><span>Payment types</span><span className="r">Expected ($)</span><span className="r">Counted ($)</span><span className="r">Differences ($)</span></div>

          <div className="cr-pay-row">
            <span><b>Cash</b><br /><span className="cr-sub">View cash payments, floats and movements</span></span>
            <span className="r">{fmt(cashExpected)}</span>
            <span className="r">{fmt(cashCounted)}</span>
            <span className={`r ${diffCls(cashCounted - cashExpected)}`}>{fmt(cashCounted - cashExpected)}</span>
          </div>
          <div className="cr-cashmove">
            <div className="cr-cm-head"><span>Time</span><span>User</span><span className="r">Amount ($)</span><span>Reason</span></div>
            {movements.length === 0 ? (
              <div className="cr-cm-empty">No cash movements recorded.</div>
            ) : (
              movements.map((m) => (
                <div key={m.id} className="cr-cm-row">
                  <span>{time(m.at)}</span>
                  <span>{m.by}</span>
                  <span className="r">{m.type === 'REMOVE' ? `-${fmt(m.amountMinor)}` : fmt(m.amountMinor)}</span>
                  <span>{m.note || (m.type === 'ADD' ? 'Cash in' : 'Cash out')}</span>
                </div>
              ))
            )}
            <div className="cr-cm-sub"><span>Opening float</span><span className="r">{fmt(openingFloatMinor)}</span></div>
            <div className="cr-cm-sub"><span>Cash movements (net)</span><span className="r">{movementNet < 0 ? `-${fmt(-movementNet)}` : fmt(movementNet)}</span></div>
            <div className="cr-cm-sub"><span>Cash payments received</span><span className="r">{fmt(cashReceived)}</span></div>
            {cashRefunded > 0 && (
              <div className="cr-cm-sub"><span>Cash refunds</span><span className="r">-{fmt(cashRefunded)}</span></div>
            )}
            <div className="cr-cm-sub"><span>Closing float</span><span className="r"><input type="number" step="0.01" value={counted.closingFloat} onChange={(e) => setCounted((c) => ({ ...c, closingFloat: e.target.value }))} placeholder="0.00" /></span></div>
            <div className="cr-cm-sub"><span>Cash to bank</span><span className="r"><input type="number" step="0.01" value={counted.cashToBank} onChange={(e) => setCounted((c) => ({ ...c, cashToBank: e.target.value }))} placeholder="0.00" /></span></div>
          </div>

          {rows.map((r) => {
            const editable = r.editable;
            const diff = r.counted - r.expected;
            return (
              <div key={r.key} className="cr-pay-row">
                <span>{r.label}</span>
                <span className="r">{fmt(r.expected)}</span>
                <span className="r">
                  {editable ? (
                    <input type="number" step="0.01" value={counted[r.key] ?? ''} onChange={(e) => setCounted((c) => ({ ...c, [r.key]: e.target.value }))} placeholder="0.00" />
                  ) : (
                    fmt(r.counted)
                  )}
                </span>
                <span className={`r ${r.expected === 0 && r.counted === 0 ? 'muted' : diffCls(diff)}`}>{r.expected === 0 && r.counted === 0 ? '-' : fmt(diff)}</span>
              </div>
            );
          })}

          <div className="cr-pay-row totals">
            <span>Totals</span>
            <span className="r">{fmt(totalExpected)}</span>
            <span className="r">{fmt(totalCounted)}</span>
            <span className={`r ${diffCls(totalCounted - totalExpected)}`}>{fmt(totalCounted - totalExpected)}</span>
          </div>
        </div>
      </div>

      <div className="cr2-row">
        <div className="cr2-side"><div className="cr-h">Closing summary</div></div>
        <div className="cr2-main">
          <div className="cr2-note">
            <label>Note</label>
            <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Type to add a register closure note" />
          </div>
          <button className="btn-primary cr-close" onClick={doClose}>Close register</button>
        </div>
      </div>
    </main>
  );
}
