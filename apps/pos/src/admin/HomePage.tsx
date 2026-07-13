import { useState } from 'react';
import { STORE } from '../data/catalog';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { ClipboardGraphic, InventoryGraphic, PartnerLogo, PaymentsGraphic } from './illustrations';
import { SalesChart } from './SalesChart';

const TODAY = [0, 540, 560, 250, 300, 540, 430, 250, 470, 300, 30];
const COMP = [40, 260, 320, 260, 210, 320, 340, 260, 160, 2000, 360];
const GROSS_TODAY = [30, 420, 450, 200, 260, 430, 380, 220, 260, 120, 30];
const GROSS_COMP = [60, 300, 340, 260, 220, 320, 300, 240, 1400, 400, 200];
const GROSS_TICKS = [0, 500, 1000, 1500];
const TARGET_TIMES = ['2:00AM', '3:00AM', '6:00AM', '9:00AM', '12:00PM', '3:00PM', '6:00PM', '9:00PM'];
const TARGET_ZERO = [0, 0, 0, 0, 0, 0, 0, 0];
const TARGET_TICKS = [0, 20, 40, 60, 80];

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

export function HomePage() {
  const sales = useCart((s) => s.sales);
  const [period, setPeriod] = useState('Today');

  const revenue = sales.reduce((s, x) => s + x.totalMinor, 0);
  const count = sales.length;
  const itemsTotal = sales.reduce((s, x) => s + x.lines.reduce((a, l) => a + l.quantity, 0), 0);
  const avgSale = count ? Math.round(revenue / count) : 0;
  const avgItems = count ? (itemsTotal / count).toFixed(1) : '0.0';

  const topMap = new Map<string, number>();
  for (const sale of sales)
    for (const l of sale.lines) topMap.set(l.name, (topMap.get(l.name) ?? 0) + l.quantity);
  const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <main className="admin-main">
      <div className="home2-top">
        <h1 className="home2-greeting">Hi {STORE.cashier}, here’s what’s happening in this store</h1>
        <div className="seg">
          {['Today', 'This week', 'This month'].map((p) => (
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
          <div className="hs2-label">Today’s sales</div>
          <div className="hs2-value">{fmt(revenue)}</div>
          <div className="hs2-sub">
            {count} sale{count === 1 ? '' : 's'} · All outlets
          </div>
        </div>
        <div className="hs2-chart">
          <div className="hs2-chart-h">All outlets</div>
          <SalesChart today={TODAY} comp={COMP} />
        </div>
        <div className="hs2-metrics">
          <div className="hs2-metric">
            <div className="hs2-m-l">Average sale value</div>
            <div className="hs2-m-v">{fmt(avgSale)}</div>
            <div className="hs2-m-c">vs last week</div>
          </div>
          <div className="hs2-metric">
            <div className="hs2-m-l">Average items per sale</div>
            <div className="hs2-m-v">{avgItems}</div>
            <div className="hs2-m-c">vs last week</div>
          </div>
        </div>
      </div>

      <div className="home2-body">
        {/* Row A — Things to know / Things to do */}
        <div className="home-grid">
          <div className="home-col">
            <div className="home-sec-h">
              THINGS TO KNOW <span className="sec-more">+ Show more Retail metrics</span>
            </div>
            <div className="promo-card">
              <PaymentsGraphic />
              <div>
                <div className="promo-title">Apply for Nova Payments to process card payments</div>
                <div className="promo-text">
                  Get everything you need to process sales and get paid, all in one place.
                </div>
                <button className="btn-p">Apply now</button>
              </div>
            </div>
          </div>
          <div className="home-col narrow">
            <div className="home-sec-h">THINGS TO DO</div>
            <div className="todo-empty">
              <ClipboardGraphic />
              <div>There’s nothing on your to-do list</div>
            </div>
          </div>
        </div>

        {/* Row B — Sales target */}
        <div className="target-card">
          <div className="target-left">
            <div className="target-top">
              <div>
                <div className="target-label">Your sales target</div>
                <div className="hs2-value">{fmt(0)}</div>
              </div>
              <span className="rlink">Set a sales target</span>
            </div>
            <div className="target-metrics">
              <div>
                <div className="hs2-m-l">Average sale value</div>
                <div className="hs2-m-v">–</div>
              </div>
              <div>
                <div className="hs2-m-l">Average items per sale</div>
                <div className="hs2-m-v">–</div>
              </div>
            </div>
          </div>
          <div className="target-chart">
            <SalesChart
              today={TARGET_ZERO}
              comp={TARGET_ZERO}
              times={TARGET_TIMES}
              yTicks={TARGET_TICKS}
              height={200}
            />
          </div>
        </div>

        {/* Row C — Partner promo / Gross profit */}
        <div className="home-rowc">
          <div className="partner-card">
            <PartnerLogo />
            <div className="partner-body">
              <div className="partner-title">Simplify your team management with Shiftly</div>
              <div className="partner-text">
                Unlock the everything app for hourly teams and conquer team management, scheduling and
                payroll with ease — now offering exclusive pricing for Nova customers.
              </div>
              <div className="partner-actions">
                <span className="rlink">Learn more</span>
                <span className="ic-link">Not now</span>
              </div>
            </div>
          </div>
          <div className="gross-card">
            <div className="home-card-h">GROSS PROFIT</div>
            <div className="hs2-value">{fmt(Math.round(revenue * 0.6))}</div>
            <div className="hs2-sub">less than this time last week</div>
            <div className="gross-chart">
              <SalesChart today={GROSS_TODAY} comp={GROSS_COMP} yTicks={GROSS_TICKS} height={200} />
            </div>
            <span className="rlink">View report</span>
          </div>
        </div>

        {/* Row D — Optimize inventory / Top products */}
        <div className="home-rowd">
          <div className="optimize-card">
            <InventoryGraphic />
            <div className="optimize-title">Optimize your inventory</div>
            <div className="optimize-actions">
              <span className="rlink">Go to Stock control</span>
              <span className="ic-link">Not now</span>
            </div>
          </div>
          <div className="home-card">
            <div className="home-card-h">TOP PRODUCTS SOLD</div>
            <div className="sh-tabs small">
              <button className="sh-tab active">By quantity</button>
              <button className="sh-tab">By revenue</button>
            </div>
            {top.length === 0 ? (
              <div className="home-empty">Complete a sale on the register to see top products.</div>
            ) : (
              <>
                {top.map(([name, qty]) => (
                  <div key={name} className="tp-row">
                    <span className="tp-thumb">📦</span>
                    <span className="tp-name">{name}</span>
                    <span className="tp-qty">{qty}</span>
                  </div>
                ))}
                <span className="rlink tp-view">View report</span>
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
                <a key={l} className="rl-link">
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
