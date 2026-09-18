import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { saleCost, saleRevenue, useCart, type CompletedSale } from '../store/cartStore';
import { availableOf, useProducts } from '../store/productStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';
import { useCustomers } from '../store/customerStore';
import { useSettings } from '../store/settingsStore';
import { useFulfillments } from '../store/fulfillmentStore';
import { countBucket, useInventory } from '../store/inventoryStore';
import { isCurrentService, useServices } from '../store/serviceStore';
import { ClipboardGraphic, InventoryGraphic, PartnerLogo, PaymentsGraphic } from './illustrations';
import { SalesChart } from './SalesChart';
import '../styles/reporting.css';

const DAY_MS = 86_400_000;
// Chart buckets: one per hour, 7AM through 9PM.
const CHART_HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const CHART_TIMES = CHART_HOURS.map((h) => {
  const ap = h >= 12 ? 'PM' : 'AM';
  const disp = h % 12 || 12;
  return `${disp}:00${ap}`;
});

const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Dollars per chart hour for the day starting at dayStart, using `amount` of each sale. */
const hourly = (sales: CompletedSale[], dayStart: number, amount: (s: CompletedSale) => number): number[] => {
  const buckets = CHART_HOURS.map(() => 0);
  for (const s of sales) {
    if (s.status === 'Returned') continue;
    if (s.at < dayStart || s.at >= dayStart + DAY_MS) continue;
    const h = new Date(s.at).getHours();
    const idx = Math.min(Math.max(h - CHART_HOURS[0]!, 0), buckets.length - 1);
    buckets[idx] = (buckets[idx] ?? 0) + amount(s) / 100;
  }
  return buckets;
};

/** Round y-axis ticks (5 ticks incl. zero) that cover max. */
const niceTicks = (max: number): number[] => {
  if (max <= 0) return [0, 20, 40, 60, 80];
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max) ?? pow * 10;
  return [0, 1, 2, 3, 4].map((i) => i * step);
};

const pctChange = (cur: number, prev: number): string | null => {
  if (prev <= 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return 'No change';
  return `${pct < 0 ? '▼' : '▲'} ${Math.abs(pct)}%`;
};

const REPORT_GROUPS = [
  {
    h: 'Product reports',
    links: [
      'Popular products',
      'Product sales by type',
      'Product sales by outlet',
      'Product sales by supplier',
      'Product sales by category',
    ],
  },
  {
    h: 'Sales reports',
    links: [
      'Sales totals by period',
      'Sales totals by day',
      'Sales by tag',
      'Sales totals by month',
      'Sales activity by hour',
    ],
  },
  {
    h: 'Inventory reports',
    links: ['Stock levels', 'Stock on hand', 'Low stock', 'Product performance'],
  },
  { h: 'Register reports', links: ['Register closures'] },
  { h: 'Other reports', links: ['Gift card', 'Store credit'] },
];

const PERIODS = ['Today', 'This week', 'This month'] as const;
type Period = (typeof PERIODS)[number];

export function HomePage() {
  // "Set up your store" checklist — each step is done when the store has the data.
  const CHECKLIST_KEY = 'nova-home-checklist-dismissed';
  const [checklistOpen, setChecklistOpen] = useState(() => {
    try {
      return localStorage.getItem(CHECKLIST_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const dismissChecklist = () => {
    setChecklistOpen(false);
    try {
      localStorage.setItem(CHECKLIST_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  const customersCount = useCustomers((s) => s.customers.length);
  const taxes = useSettings((s) => s.taxes);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const fulfillments = useFulfillments((s) => s.fulfillments);
  const counts = useInventory((s) => s.counts);
  const services = useServices((s) => s.services);
  const navigate = useNavigate();
  const allSales = useCart((s) => s.sales);
  const products = useProducts((s) => s.products);
  // Training-mode sales are practice runs: they never count as revenue.
  const sales = useMemo(() => allSales.filter((s) => !s.training), [allSales]);
  const salesTargetMinor = useSetup((s) => s.salesTargetMinor);
  const setSetup = useSetup((s) => s.set);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);

  const [period, setPeriod] = useState<Period>('Today');
  const [topTab, setTopTab] = useState<'qty' | 'rev'>('qty');
  const [showMore, setShowMore] = useState(false);
  const [shiftlyOpen, setShiftlyOpen] = useState(true);
  const [optimizeOpen, setOptimizeOpen] = useState(true);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const firstName =
    users.find((u) => u.id === currentUserId)?.name.split(' ')[0] ?? 'there';

  // ----- Period window (and the equivalent previous window for comparisons) -----
  const now = Date.now();
  const todayStart = startOfDay(now);
  const { periodStart, prevStart, compLabel } = useMemo(() => {
    const d = new Date(now);
    if (period === 'Today')
      return { periodStart: todayStart, prevStart: todayStart - DAY_MS, compLabel: 'yesterday' };
    if (period === 'This week') {
      const weekStart = todayStart - ((d.getDay() + 6) % 7) * DAY_MS; // Monday
      return { periodStart: weekStart, prevStart: weekStart - 7 * DAY_MS, compLabel: 'last week' };
    }
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const prevMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    return { periodStart: monthStart, prevStart: prevMonthStart, compLabel: 'last month' };
  }, [period, now, todayStart]);

  // Returned sales carry no revenue; the caller still sees them via returnsCount.
  // Revenue is what was charged (tax included, as on the receipt); gross
  // profit is revenue excluding tax minus the supplier cost of the goods sold.
  const stats = (all: CompletedSale[]) => {
    const list = all.filter((x) => x.status !== 'Returned');
    const revenue = list.reduce((s, x) => s + x.totalMinor, 0);
    const cost = list.reduce((s, x) => s + saleCost(x, products), 0);
    const tax = list.reduce((s, x) => s + (x.taxMinor ?? 0), 0);
    const profit = list.reduce((s, x) => s + saleRevenue(x), 0) - cost;
    const count = list.length;
    const items = list.reduce((s, x) => s + x.lines.reduce((a, l) => a + l.quantity, 0), 0);
    return {
      revenue,
      cost,
      tax,
      profit,
      count,
      items,
      avgSale: count ? Math.round(revenue / count) : 0,
      avgItems: count ? items / count : 0,
    };
  };

  const periodSales = useMemo(
    () => sales.filter((s) => s.at >= periodStart),
    [sales, periodStart],
  );
  const prevSales = useMemo(
    () => sales.filter((s) => s.at >= prevStart && s.at < periodStart),
    [sales, prevStart, periodStart],
  );
  const cur = stats(periodSales);
  const prev = stats(prevSales);

  const returnsCount = periodSales.filter((s) => s.status === 'Returned').length;
  const taxCollected = cur.tax;

  // ----- Real hourly buckets: today vs yesterday -----
  const todayBuckets = useMemo(() => hourly(sales, todayStart, (s) => s.totalMinor), [sales, todayStart]);
  const yesterdayBuckets = useMemo(
    () => hourly(sales, todayStart - DAY_MS, (s) => s.totalMinor),
    [sales, todayStart],
  );
  const salesTicks = niceTicks(Math.max(...todayBuckets, ...yesterdayBuckets));
  const profitOf = (s: CompletedSale) => saleRevenue(s) - saleCost(s, products);
  const grossToday = useMemo(() => hourly(sales, todayStart, profitOf), [sales, todayStart, products]);
  const grossComp = useMemo(() => hourly(sales, todayStart - DAY_MS, profitOf), [sales, todayStart, products]);
  const grossTicks = niceTicks(Math.max(...grossToday, ...grossComp));

  // ----- Sales target (today's revenue vs configured target) -----
  const todaySales = useMemo(() => sales.filter((s) => s.at >= todayStart), [sales, todayStart]);
  const today = stats(todaySales);
  const cumToday = todayBuckets.reduce<number[]>((acc, v, i) => {
    acc.push((i === 0 ? 0 : (acc[i - 1] ?? 0)) + v);
    return acc;
  }, []);
  const targetLine = CHART_HOURS.map(() => salesTargetMinor / 100);
  const targetTicks = niceTicks(Math.max(salesTargetMinor / 100, ...cumToday));
  const targetPct = salesTargetMinor > 0 ? Math.round((today.revenue / salesTargetMinor) * 100) : 0;
  const saveTarget = () => {
    const dollars = parseFloat(targetInput);
    if (!Number.isNaN(dollars) && dollars >= 0) {
      setSetup({ salesTargetMinor: Math.round(dollars * 100) });
      setEditingTarget(false);
    }
  };

  // ----- Top products for the selected period -----
  const topMap = new Map<string, { qty: number; rev: number }>();
  for (const sale of periodSales)
    for (const l of sale.lines) {
      const t = topMap.get(l.name) ?? { qty: 0, rev: 0 };
      topMap.set(l.name, { qty: t.qty + l.quantity, rev: t.rev + l.unitPriceMinor * l.quantity });
    }
  const top = [...topMap.entries()]
    .sort((a, b) => (topTab === 'qty' ? b[1].qty - a[1].qty : b[1].rev - a[1].rev))
    .slice(0, 5);

  const avgSaleChange = pctChange(cur.avgSale, prev.avgSale);
  const avgItemsChange = pctChange(cur.avgItems, prev.avgItems);
  const grossChange = pctChange(cur.profit, prev.profit);
  const periodLabel =
    period === 'Today' ? 'Today’s sales' : `${period}’s sales`;

  const checklist: { title: string; text: string; done: boolean; to: string; state?: Record<string, string> }[] = [
    { title: 'Add your products', text: 'Build your catalog by hand or import a spreadsheet.', done: products.length > 0, to: '/catalog' },
    { title: 'Set up sales tax', text: 'Add the tax rates you charge.', done: taxes.some((t) => t.rateBps > 0), to: '/setup', state: { tab: 'taxes' } },
    { title: 'Choose payment types', text: 'Cash and card are ready; add Venmo, checks or gift vouchers.', done: paymentTypes.length > 2, to: '/setup', state: { tab: 'payments' } },
    { title: 'Add your team', text: 'Create a user for each person who sells.', done: users.length > 2, to: '/setup', state: { tab: 'users' } },
    { title: 'Add a customer', text: 'Keep track of sales history and contact details.', done: customersCount > 0, to: '/customers' },
    { title: 'Make your first sale', text: 'Open the register and ring up a sale.', done: sales.some((s) => !s.training), to: '/sell' },
  ];
  const lowStock = products.filter((p) => p.enabled && p.trackInventory !== false && (p.replenishMethod === 'reorder' ? p.reorderPoint != null && availableOf(p, products) <= p.reorderPoint : p.minQty != null && availableOf(p, products) <= p.minQty)).length;
  const openSales = sales.filter((s) => s.status === 'Layaway' || s.status === 'On account').length;
  const openFulfillments = fulfillments.filter((f) => f.status === 'Open').length;
  const countsDue = counts.filter((c) => countBucket(c) === 'due').length;
  const openServices = services.filter(isCurrentService).length;
  const todos: { title: string; text: string; count: number; to: string; state?: Record<string, string> }[] = [
    ...(openFulfillments ? [{ title: 'Orders to fulfill', text: 'Pack, pickup and delivery orders waiting.', count: openFulfillments, to: '/inventory', state: { tab: 'fulfillments' } }] : []),
    ...(openSales ? [{ title: 'Sales with a balance owing', text: 'Layaway and on-account sales to continue.', count: openSales, to: '/sell/sales-history' }] : []),
    ...(lowStock ? [{ title: 'Products to reorder', text: 'At or below their reorder point.', count: lowStock, to: '/inventory' }] : []),
    ...(countsDue ? [{ title: 'Inventory counts due', text: 'Counts scheduled and ready to start.', count: countsDue, to: '/inventory', state: { tab: 'counts' } }] : []),
    ...(openServices ? [{ title: 'Services in progress', text: 'Jobs booked for customers.', count: openServices, to: '/services' }] : []),
  ];

  return (
    <main className="admin-main">
      <div className="home2-top">
        <h1 className="home2-greeting">Hi {firstName}, here’s what’s happening in this store</h1>
        <div className="seg">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`seg-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="home2-sales">
        <div className="hs2-left">
          <div className="hs2-label">{periodLabel}</div>
          <div className="hs2-value">{fmt(cur.revenue)}</div>
          <div className="hs2-sub">
            {cur.count} sale{cur.count === 1 ? '' : 's'} · All outlets
          </div>
        </div>
        <div className="hs2-chart">
          <div className="hs2-chart-h">All outlets — today vs yesterday</div>
          <SalesChart today={todayBuckets} comp={yesterdayBuckets} times={CHART_TIMES} yTicks={salesTicks} />
        </div>
        <div className="hs2-metrics">
          <div className="hs2-metric">
            <div className="hs2-m-l">Average sale value</div>
            <div className="hs2-m-v">{fmt(cur.avgSale)}</div>
            <div className="hs2-m-c">{avgSaleChange ? `${avgSaleChange} vs ${compLabel}` : `vs ${compLabel}`}</div>
          </div>
          <div className="hs2-metric">
            <div className="hs2-m-l">Average items per sale</div>
            <div className="hs2-m-v">{cur.avgItems.toFixed(1)}</div>
            <div className="hs2-m-c">{avgItemsChange ? `${avgItemsChange} vs ${compLabel}` : `vs ${compLabel}`}</div>
          </div>
        </div>
      </div>

      <div className="home2-body">
        {checklistOpen && (
          <div className="home-checklist">
            <div className="home-sec-h">
              SET UP YOUR STORE <span className="sec-more rlink" onClick={dismissChecklist}>Dismiss</span>
            </div>
            <div className="hc-cards">
              {checklist.map((c) => (
                <button key={c.title} className={`hc-card ${c.done ? 'done' : ''}`} onClick={() => navigate(c.to, c.state ? { state: c.state } : undefined)}>
                  <span className="hc-check">{c.done ? '✓' : ''}</span>
                  <span className="hc-body">
                    <b>{c.title}</b>
                    <span>{c.text}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="hc-progress">{checklist.filter((c) => c.done).length} of {checklist.length} done</div>
          </div>
        )}
        {/* Row A — Things to know / Things to do */}
        <div className="home-grid">
          <div className="home-col">
            <div className="home-sec-h">
              THINGS TO KNOW{' '}
              <span className="sec-more rlink" onClick={() => setShowMore((v) => !v)}>
                {showMore ? '− Hide Retail metrics' : '+ Show more Retail metrics'}
              </span>
            </div>
            {showMore && (
              <div className="home-extra">
                <div>
                  <div className="hs2-m-l">Items sold</div>
                  <div className="hs2-m-v">{cur.items}</div>
                  <div className="hs2-m-c">{period.toLowerCase()}</div>
                </div>
                <div>
                  <div className="hs2-m-l">Returns</div>
                  <div className="hs2-m-v">{returnsCount}</div>
                  <div className="hs2-m-c">{period.toLowerCase()}</div>
                </div>
                <div>
                  <div className="hs2-m-l">Tax collected (est.)</div>
                  <div className="hs2-m-v">{fmt(taxCollected)}</div>
                  <div className="hs2-m-c">8.25% of revenue</div>
                </div>
              </div>
            )}
            <div className="promo-card">
              <PaymentsGraphic />
              <div>
                <div className="promo-title">Apply for Nova Payments to process card payments</div>
                <div className="promo-text">
                  Get everything you need to process sales and get paid, all in one place.
                </div>
                <button className="btn-p" onClick={() => navigate('/setup')}>Apply now</button>
              </div>
            </div>
          </div>
          <div className="home-col narrow">
            <div className="home-sec-h">THINGS TO DO</div>
            {todos.length === 0 ? (
              <div className="todo-empty">
                <ClipboardGraphic />
                <div>There’s nothing on your to-do list</div>
              </div>
            ) : (
              <div className="todo-list">
                {todos.map((t) => (
                  <button key={t.title} className="todo-item" onClick={() => navigate(t.to, t.state ? { state: t.state } : undefined)}>
                    <span className="todo-count">{t.count}</span>
                    <span className="todo-body"><b>{t.title}</b><span>{t.text}</span></span>
                    <span className="todo-chev">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row B — Sales target */}
        <div className="target-card">
          <div className="target-left">
            <div className="target-top">
              <div>
                <div className="target-label">Your sales target</div>
                {salesTargetMinor > 0 ? (
                  <>
                    <div className="hs2-value">{fmt(today.revenue)}</div>
                    <div className="hs2-sub">
                      of {fmt(salesTargetMinor)} target today · {targetPct}%
                    </div>
                  </>
                ) : (
                  <div className="hs2-value">{fmt(0)}</div>
                )}
              </div>
              {editingTarget ? (
                <div className="target-form">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Target in $"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                    autoFocus
                  />
                  <button className="btn-p" onClick={saveTarget}>Save</button>
                  <button className="btn-s" onClick={() => setEditingTarget(false)}>Cancel</button>
                </div>
              ) : (
                <span
                  className="rlink"
                  onClick={() => {
                    setTargetInput(salesTargetMinor > 0 ? (salesTargetMinor / 100).toFixed(2) : '');
                    setEditingTarget(true);
                  }}
                >
                  {salesTargetMinor > 0 ? 'Edit sales target' : 'Set a sales target'}
                </span>
              )}
            </div>
            <div className="target-metrics">
              <div>
                <div className="hs2-m-l">Average sale value</div>
                <div className="hs2-m-v">{today.count ? fmt(today.avgSale) : '–'}</div>
              </div>
              <div>
                <div className="hs2-m-l">Average items per sale</div>
                <div className="hs2-m-v">{today.count ? today.avgItems.toFixed(1) : '–'}</div>
              </div>
            </div>
          </div>
          <div className="target-chart">
            <SalesChart
              today={cumToday}
              comp={salesTargetMinor > 0 ? targetLine : CHART_HOURS.map(() => 0)}
              times={CHART_TIMES}
              yTicks={targetTicks}
              height={200}
            />
          </div>
        </div>

        {/* Row C — Partner promo / Gross profit */}
        <div className="home-rowc">
          {shiftlyOpen ? (
            <div className="partner-card">
              <PartnerLogo />
              <div className="partner-body">
                <div className="partner-title">Simplify your team management with Shiftly</div>
                <div className="partner-text">
                  Unlock the everything app for hourly teams and conquer team management, scheduling and
                  payroll with ease — now offering exclusive pricing for Nova customers.
                </div>
                <div className="partner-actions">
                  <span className="rlink" onClick={() => navigate('/setup')}>Learn more</span>
                  <span className="ic-link" onClick={() => setShiftlyOpen(false)}>Not now</span>
                </div>
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="gross-card">
            <div className="home-card-h">GROSS PROFIT</div>
            <div className="hs2-value">{fmt(cur.profit)}</div>
            <div className="hs2-sub">
              {grossChange ? `${grossChange} vs ${compLabel}` : `no sales ${compLabel}`}
            </div>
            <div className="gross-chart">
              <SalesChart today={grossToday} comp={grossComp} times={CHART_TIMES} yTicks={grossTicks} height={200} />
            </div>
            <span className="rlink" onClick={() => navigate('/reporting')}>View report</span>
          </div>
        </div>

        {/* Row D — Optimize inventory / Top products */}
        <div className="home-rowd">
          {optimizeOpen ? (
            <div className="optimize-card">
              <InventoryGraphic />
              <div className="optimize-title">Optimize your inventory</div>
              <div className="optimize-actions">
                <span className="rlink" onClick={() => navigate('/inventory')}>Go to Stock control</span>
                <span className="ic-link" onClick={() => setOptimizeOpen(false)}>Not now</span>
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="home-card">
            <div className="home-card-h">TOP PRODUCTS SOLD</div>
            <div className="sh-tabs small">
              <button
                className={`sh-tab ${topTab === 'qty' ? 'active' : ''}`}
                onClick={() => setTopTab('qty')}
              >
                By quantity
              </button>
              <button
                className={`sh-tab ${topTab === 'rev' ? 'active' : ''}`}
                onClick={() => setTopTab('rev')}
              >
                By revenue
              </button>
            </div>
            {top.length === 0 ? (
              <div className="home-empty">Complete a sale on the register to see top products.</div>
            ) : (
              <>
                {top.map(([name, v]) => (
                  <div key={name} className="tp-row">
                    <span className="tp-thumb">📦</span>
                    <span className="tp-name">{name}</span>
                    <span className="tp-qty">{topTab === 'qty' ? v.qty : fmt(v.rev)}</span>
                  </div>
                ))}
                <span className="rlink tp-view" onClick={() => navigate('/reporting')}>View report</span>
              </>
            )}
          </div>
        </div>

        {/* Row E — Report links */}
        <div className="report-links">
          {REPORT_GROUPS.map((g) => (
            <div key={g.h} className="rl-group">
              <div className="rl-h">{g.h}</div>
              {g.links.map((l) => (
                <Link key={l} className="rl-link" to="/reporting">
                  {l}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
