import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
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
  const regStatus = useRegisterSession((s) => s.status);

  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart = todayStart - ((new Date(now).getDay() + 6) % 7) * 86_400_000; // Monday
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

  const sum = (from: number) => sales.filter((s) => s.at >= from).reduce((a, s) => a + s.totalMinor, 0);

  let cash = 0;
  let card = 0;
  for (const s of sales)
    for (const t of s.tenders) {
      if (t.method === 'CASH') cash += t.amountMinor;
      else card += t.amountMinor;
    }
  const changeGiven = sales.reduce((a, s) => a + s.changeMinor, 0);
  const netMovements = movements.reduce((a, m) => a + (m.type === 'ADD' ? m.amountMinor : -m.amountMinor), 0);
  const till = openingFloat + netMovements + sales.filter((s) => s.tenders.some((t) => t.method === 'CASH')).reduce(
    (a, s) => a + s.tenders.filter((t) => t.method === 'CASH').reduce((x, t) => x + t.amountMinor, 0) - s.changeMinor,
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
          <div className="finc-row">
            <span>Cash</span>
            <span className="r">{fmt(Math.max(0, cash - changeGiven))}</span>
          </div>
          <div className="finc-row">
            <span>Card</span>
            <span className="r">{fmt(card)}</span>
          </div>
          <div className="finc-row">
            <span>Total</span>
            <span className="r">{fmt(Math.max(0, cash - changeGiven) + card)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
