import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { methodOf, tenderLabel } from '../lib/tenders';
import { useCart } from '../store/cartStore';
import { useSetup } from '../store/setupStore';
import { useRegisterSession } from '../store/registerSessionStore';
import '../styles/reporting.css';

const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function FinancePage() {
  const sales = useCart((s) => s.sales).filter((s) => !s.training);
  const movements = useRegisterSession((s) => s.movements);
  const openingFloat = useRegisterSession((s) => s.openingFloatMinor);
  const openedAt = useRegisterSession((s) => s.openedAt);
  const regStatus = useRegisterSession((s) => s.status);
  const paymentTypes = useSetup((s) => s.paymentTypes);

  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart = todayStart - ((new Date(now).getDay() + 6) % 7) * 86_400_000; // Monday
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

  // Gross sales exclude returns; tender totals below stay as collected because
  // this register has no refund tender, so the cash physically remains in the till.
  const sum = (from: number) =>
    sales.filter((s) => s.status !== 'Returned' && s.at >= from).reduce((a, s) => a + s.totalMinor, 0);

  // Collected and refunded per payment type, all time. Cash is net of change.
  const collected = new Map<string, number>();
  const refunded = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const s of sales) {
    for (const t of s.tenders) bump(collected, t.method, t.amountMinor);
    bump(collected, 'CASH', -s.changeMinor);
    for (const t of s.refundTenders ?? []) bump(refunded, t.method, t.amountMinor);
  }
  const methods = [
    ...paymentTypes.map(methodOf),
    ...[...collected.keys()].filter((m) => !paymentTypes.some((t) => methodOf(t) === m)),
  ];
  const totalCollected = [...collected.values()].reduce((a, v) => a + v, 0);
  const totalRefunded = [...refunded.values()].reduce((a, v) => a + v, 0);
  const netMovements = movements.reduce((a, m) => a + (m.type === 'ADD' ? m.amountMinor : -m.amountMinor), 0);
  // Cash in the drawer right now: this session's float, movements, cash
  // taken (net of change) and cash handed back as refunds. Earlier sessions
  // were banked at their closure, so only this session's activity counts.
  const inSession = (t: number) => openedAt == null || t >= openedAt;
  const till =
    openingFloat +
    netMovements +
    sales.filter((s) => inSession(s.at)).reduce(
      (a, s) => a + s.tenders.filter((t) => t.method === 'CASH').reduce((x, t) => x + t.amountMinor, 0) - s.changeMinor,
      0,
    ) -
    sales.filter((s) => s.refundedAt != null && inSession(s.refundedAt)).reduce(
      (a, s) => a + (s.refundTenders ?? []).filter((t) => t.method === 'CASH').reduce((x, t) => x + t.amountMinor, 0),
      0,
    );

  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">Finance</h1>
        <div className="page-subbar">
          <span className="page-subbar-text">
            A snapshot of your money — see <Link className="rlink" to="/reporting">Reporting</Link> for full reports.
          </span>
        </div>

        <div className="fin-cards">
          <div className="fin-card">
            <div className="fin-card-l">Gross sales today</div>
            <div className="fin-card-v">{fmt(sum(todayStart))}</div>
            <div className="fin-card-s">{sales.filter((s) => s.at >= todayStart).length} sales</div>
          </div>
          <div className="fin-card">
            <div className="fin-card-l">This week</div>
            <div className="fin-card-v">{fmt(sum(weekStart))}</div>
            <div className="fin-card-s">Since Monday</div>
          </div>
          <div className="fin-card">
            <div className="fin-card-l">This month</div>
            <div className="fin-card-v">{fmt(sum(monthStart))}</div>
            <div className="fin-card-s">Calendar month to date</div>
          </div>
          <div className="fin-card">
            <div className="fin-card-l">Cash in register</div>
            <div className="fin-card-v">{fmt(Math.max(0, till))}</div>
            <div className="fin-card-s">Register is {regStatus === 'open' ? 'open' : 'closed'}</div>
          </div>
        </div>

        <div className="finc-table">
          <div className="finc-head">
            <span>Payment type</span>
            <span className="r">Collected (all time)</span>
          </div>
          {methods.map((m) => (
            <div key={m} className="finc-row">
              <span>{tenderLabel(m, paymentTypes)}</span>
              <span className="r">{fmt(Math.max(0, collected.get(m) ?? 0))}</span>
            </div>
          ))}
          {totalRefunded > 0 && (
            <div className="finc-row">
              <span>Refunded ({methods.filter((m) => (refunded.get(m) ?? 0) > 0).map((m) => `${tenderLabel(m, paymentTypes).toLowerCase()} ${fmt(refunded.get(m) ?? 0)}`).join(' · ')})</span>
              <span className="r">−{fmt(totalRefunded)}</span>
            </div>
          )}
          <div className="finc-row">
            <span>Net collected</span>
            <span className="r">{fmt(Math.max(0, totalCollected - totalRefunded))}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
