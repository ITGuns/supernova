import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from '../data/catalog';
import { useCustomers } from '../store/customerStore';
import { useProducts } from '../store/productStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { initials, useUsers } from '../store/userStore';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { useCart } from '../store/cartStore';
import { KpiChart } from './KpiChart';
import { Sparkline } from './Sparkline';
import '../styles/reporting.css';

const NAV: ContextItem[] = [
  { key: 'dashboard', label: 'Retail dashboard' },
  { key: 'sales', label: 'Sales reports' },
  { key: 'inventory', label: 'Inventory reports' },
  { key: 'adjustment', label: 'Adjustment reports' },
  { key: 'cash', label: 'Cash movement reports' },
  { key: 'payment', label: 'Payment reports' },
  { key: 'register', label: 'Register closures' },
  { key: 'gift', label: 'Gift card reports' },
  { key: 'storecredit', label: 'Store credit reports' },
  { key: 'tax', label: 'Tax reports' },
  { key: 'user', label: 'User reports' },
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const kMoney = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));
const CATBYNAME = new Map(CATALOG.map((p) => [p.name, p]));

const DAY_MS = 86_400_000;
const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Round y-axis ticks (5 ticks incl. zero) that cover max. */
const niceTicks = (max: number): number[] => {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max) ?? pow * 10;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 100) / 100);
};

const fmtDate = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const fmtDateTime = (d: Date) => {
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h}:${m}${ap}`;
};

function SortGlyph({ dir = 'desc' }: { dir?: 'asc' | 'desc' }) {
  return (
    <svg className="sortglyph" width="12" height="13" viewBox="0 0 13 14" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.1" fill="none" transform={dir === 'desc' ? 'translate(0,14) scale(1,-1)' : undefined}>
        <path d="M3 1.5 V11" />
        <path d="M1 9 L3 11.5 L5 9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="7" y="6" fontSize="5.2" fill="currentColor">1</text>
      <text x="7" y="12.5" fontSize="5.2" fill="currentColor">9</text>
    </svg>
  );
}

const GRANS = ['Year', 'Quarter', 'Month', 'Week', 'Day', 'Hour'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parseRange = (rangeStr: string): { start: Date; end: Date } => {
  try {
    const parts = rangeStr.split(' to ');
    const parseDate = (s: string) => {
      const clean = s.trim();
      const match = clean.match(/^([A-Za-z]+)\s+(\d+),\s+(\d+)$/);
      if (!match) return new Date(2025, 6, 11);
      const [, mStr, dStr, yStr] = match;
      if (!mStr || !dStr || !yStr) return new Date(2025, 6, 11);
      const mIdx = MON.indexOf(mStr.substring(0, 3));
      return new Date(parseInt(yStr), mIdx >= 0 ? mIdx : 6, parseInt(dStr));
    };
    if (parts.length === 2) {
      const s = parseDate(parts[0] ?? '');
      const e = parseDate(parts[1] ?? '');
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const s = parseDate(rangeStr);
    const e = new Date(s);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  } catch (e) {
    return { start: new Date(2025, 6, 11), end: new Date(2025, 6, 11, 23, 59, 59) };
  }
};

function DateRangeField({ value, onApply }: { value: string; onApply: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'period' | 'date'>('period');
  const [gran, setGran] = useState('Day');
  const [opt, setOpt] = useState<'todate' | 'prevday' | 'prevdays' | 'range'>('range');
  const [prevDays, setPrevDays] = useState(2);
  const [rangeDays, setRangeDays] = useState(1);
  const [month, setMonth] = useState(6); // July
  const [day, setDay] = useState(11);
  const [year, setYear] = useState(2025);

  const base = new Date(2025, 6, 11);
  const computed = (): string => {
    if (opt === 'todate') return `${fmtDate(base)} to ${fmtDate(base)}`;
    if (opt === 'prevday') {
      const d = new Date(2025, 6, 10);
      return `${fmtDate(d)} to ${fmtDate(d)}`;
    }
    if (opt === 'prevdays') {
      const s = new Date(2025, 6, 11 - prevDays);
      const e = new Date(2025, 6, 10);
      return `${fmtDate(s)} to ${fmtDate(e)}`;
    }
    const s = new Date(year, month, day);
    const e = new Date(year, month, day + rangeDays - 1);
    return `${fmtDate(s)} to ${fmtDate(e)}`;
  };

  return (
    <div className="drf">
      <div className="rep-daterange drf-field" onClick={() => setOpen((o) => !o)}>
        <span>📅 {value}</span>
        <span className="drf-chev">▾</span>
      </div>
      {open && (
        <div className="drf-pop">
          <div className="drf-tabs">
            <span className={tab === 'period' ? 'active' : ''} onClick={() => setTab('period')}>Specify period</span>
            <span className={tab === 'date' ? 'active' : ''} onClick={() => setTab('date')}>Specify date</span>
          </div>
          <div className="drf-gran">
            {GRANS.map((g) => (
              <button key={g} className={gran === g ? 'active' : ''} onClick={() => setGran(g)}>{g}</button>
            ))}
          </div>
          <div className="drf-opts">
            <label className="drf-opt" onClick={() => setOpt('todate')}>
              <span className={`drf-radio ${opt === 'todate' ? 'on' : ''}`} /> {gran} to date
            </label>
            <label className="drf-opt" onClick={() => setOpt('prevday')}>
              <span className={`drf-radio ${opt === 'prevday' ? 'on' : ''}`} /> Previous {gran.toLowerCase()}
            </label>
            <label className="drf-opt" onClick={() => setOpt('prevdays')}>
              <span className={`drf-radio ${opt === 'prevdays' ? 'on' : ''}`} /> Choose previous {gran.toLowerCase()}s
            </label>
            {opt === 'prevdays' && (
              <div className="drf-sub">
                <label>Number of {gran.toLowerCase()}s</label>
                <input type="number" value={prevDays} min={1} onChange={(e) => setPrevDays(Math.max(1, Number(e.target.value)))} />
              </div>
            )}
            <label className="drf-opt" onClick={() => setOpt('range')}>
              <span className={`drf-radio ${opt === 'range' ? 'on' : ''}`} /> Choose range of {gran.toLowerCase()}s
            </label>
            {opt === 'range' && (
              <div className="drf-sub range">
                <div>
                  <label>Number of {gran.toLowerCase()}s</label>
                  <input type="number" value={rangeDays} min={1} onChange={(e) => setRangeDays(Math.max(1, Number(e.target.value)))} />
                </div>
                <div>
                  <label>Start {gran.toLowerCase()}</label>
                  <div className="drf-selects">
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                      {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                      {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                      {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="drf-foot">
            <span>{computed()}</span>
            <button className="btn-p" onClick={() => { onApply(computed()); setOpen(false); }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

interface ClosureRow {
  num: number;
  opened: number;
  closed: number | null;
  openingFloat: number;
  expected: number | null;
  counted: number | null;
  variance: number | null;
  open: boolean;
}

interface CashRow {
  session: string;
  type: 'ADD' | 'REMOVE';
  amountMinor: number;
  note: string;
  by: string;
  at: number;
}


function downloadCSV(name: string, rows: string[][]) {
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportingPage() {
  const sales = useCart((s) => s.sales);
  const regStatus = useRegisterSession((s) => s.status);
  const regOpenedAt = useRegisterSession((s) => s.openedAt);
  const regOpeningFloat = useRegisterSession((s) => s.openingFloatMinor);
  const regClosureSeq = useRegisterSession((s) => s.closureSeq);
  const regMovements = useRegisterSession((s) => s.movements);
  const regClosures = useRegisterSession((s) => s.closures);
  const customers = useCustomers((s) => s.customers);
  const [active, setActive] = useState('dashboard');

  // Dashboard filters
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [dateOffset, setDateOffset] = useState(0);
  const [outlet, setOutlet] = useState('Main Outlet');
  const dashDate = useMemo(() => {
    const d = new Date();
    if (view === 'Day') d.setDate(d.getDate() + dateOffset);
    else if (view === 'Week') d.setDate(d.getDate() + dateOffset * 7);
    else d.setMonth(d.getMonth() + dateOffset);
    return d;
  }, [view, dateOffset]);

  // Register closures
  const [regFilter, setRegFilter] = useState('All Registers');
  const [, setAppliedReg] = useState('All Registers');
  const [page, setPage] = useState(1);

  // Cash movement / Inventory
  const [cashType, setCashType] = useState('All cash movement types');
  const [cashNote, setCashNote] = useState('');
  const [invTab, setInvTab] = useState<'summary' | 'replenishment' | 'performance'>('summary');
  const [invReport, setInvReport] = useState('Product');
  const [invMeasure, setInvMeasure] = useState('Low inventory');

  // Sales report
  const [salesReport, setSalesReport] = useState('Sales summary');
  const [salesMeasure, setSalesMeasure] = useState('Revenue');
  const [salesComparison, setSalesComparison] = useState('No comparison');
  const [salesRange, setSalesRange] = useState('Jul 11, 2025 to Jul 11, 2025');

  // Payment report
  const [payReport, setPayReport] = useState('Payment type');
  const [payMeasure, setPayMeasure] = useState('Amount');
  const [payComparison, setPayComparison] = useState('No comparison');
  const [payRange, setPayRange] = useState('Jul 1, 2025 to Jul 31, 2025');

  // Adjustment report
  const [adjReasons, setAdjReasons] = useState('All reasons');
  const [adjMode, setAdjMode] = useState('Include');
  const [adjFilter, setAdjFilter] = useState('');
  const [adjRange, setAdjRange] = useState('Jun 15, 2026 to Jul 11, 2026');

  // User reports
  const [userSearch, setUserSearch] = useState('');
  const [userRange, setUserRange] = useState('Jul 4, 2026 to Jul 11, 2026');
  const [partnerOpen, setPartnerOpen] = useState(true);
  const [userSort, setUserSort] = useState<'asc' | 'desc'>('asc');

  // Gift card
  const [gcQuery, setGcQuery] = useState('');
  const [gcLoading, setGcLoading] = useState(true);
  useEffect(() => {
    if (active === 'gift') {
      setGcLoading(true);
      const t = setTimeout(() => setGcLoading(false), 900);
      return () => clearTimeout(t);
    }
  }, [active]);

  // Dashboard KPI buckets: 8 periods (day/week/month) ending at the selected date.
  const dash = useMemo(() => {
    const bucketStart = (i: number): Date => {
      const back = 7 - i;
      if (view === 'Day') {
        const d = new Date(dashDate);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - back);
        return d;
      }
      if (view === 'Week') {
        const d = new Date(dashDate);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - back * 7); // Monday start
        return d;
      }
      return new Date(dashDate.getFullYear(), dashDate.getMonth() - back, 1);
    };
    const bucketEnd = (d: Date): number => {
      if (view === 'Day') return d.getTime() + DAY_MS;
      if (view === 'Week') return d.getTime() + 7 * DAY_MS;
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    };
    const starts = Array.from({ length: 8 }, (_, i) => bucketStart(i));
    const buckets = starts.map((d) => {
      const s0 = d.getTime();
      const s1 = bucketEnd(d);
      const inB = sales.filter((x) => x.at >= s0 && x.at < s1);
      const rev = inB.reduce((a, x) => a + x.totalMinor, 0);
      const items = inB.reduce((a, x) => a + x.lines.reduce((q, l) => q + l.quantity, 0), 0);
      const custs = new Set(inB.map((x) => x.customer).filter(Boolean)).size;
      return { rev, count: inB.length, items, custs };
    });
    const labels = starts.map((d) =>
      view === 'Month'
        ? `${MON[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`
        : `${MON[d.getMonth()]} ${d.getDate()}`,
    );
    return { buckets, labels };
  }, [sales, view, dashDate]);

  // Date range metrics for Sales Report
  const salesParsedRange = useMemo(() => parseRange(salesRange), [salesRange]);
  const salesFiltered = useMemo(() => {
    return sales.filter((s) => s.at >= salesParsedRange.start.getTime() && s.at <= salesParsedRange.end.getTime());
  }, [sales, salesParsedRange]);

  const salesMetrics = useMemo(() => {
    const revMinor = salesFiltered.reduce((sum, s) => sum + s.totalMinor, 0);
    const cogsMinor = Math.round(revMinor * 0.4);
    const profitMinor = revMinor - cogsMinor;
    const margin = revMinor > 0 ? 60 : 0;
    const taxMinor = Math.round(revMinor * 0.0825); // 8.25% tax rate basis points

    return {
      revenue: revMinor,
      cogs: cogsMinor,
      profit: profitMinor,
      margin,
      tax: taxMinor,
    };
  }, [salesFiltered]);

  const dayHeaderLabel = useMemo(() => {
    const startDay = salesParsedRange.start;
    const dayName = startDay.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Fri"
    return `${startDay.getDate()} ${dayName}`;
  }, [salesParsedRange]);

  // Date range metrics for Payment Report
  const payParsedRange = useMemo(() => parseRange(payRange), [payRange]);
  const payFiltered = useMemo(() => {
    return sales.filter((s) => s.at >= payParsedRange.start.getTime() && s.at <= payParsedRange.end.getTime());
  }, [sales, payParsedRange]);

  const payMetrics = useMemo(() => {
    let cashTotal = 0;
    let cardTotal = 0;
    for (const s of payFiltered) {
      for (const t of s.tenders) {
        if (t.method === 'CASH') cashTotal += t.amountMinor;
        else if (t.method === 'CARD') cardTotal += t.amountMinor;
      }
    }
    return {
      cash: cashTotal,
      card: cardTotal,
      total: cashTotal + cardTotal,
    };
  }, [payFiltered]);

  // Date range metrics for Inventory Report (defaults to Jul 1, 2025 to Jul 31, 2025)
  const invFiltered = useMemo(() => {
    const start = new Date(2025, 6, 1).getTime();
    const end = new Date(2025, 6, 31, 23, 59, 59, 999).getTime();
    return sales.filter((s) => s.at >= start && s.at <= end);
  }, [sales]);

  const invProducts = useProducts((s) => s.products);
  const staffUsers = useUsers((s) => s.users);
  const invMetrics = useMemo(() => {
    const prodMap = new Map<string, { qty: number; rev: number }>();
    for (const s of invFiltered) {
      for (const l of s.lines) {
        const cur = prodMap.get(l.name) ?? { qty: 0, rev: 0 };
        prodMap.set(l.name, { qty: cur.qty + l.quantity, rev: cur.rev + l.unitPriceMinor * l.quantity });
      }
    }

    let totalInv = 0;
    let totalRev = 0;
    let totalCost = 0;

    const list = invProducts.map((p) => {
      const stats = prodMap.get(p.name) ?? { qty: 0, rev: 0 };
      const closing = 15 - stats.qty; // Assume initial stock of 15
      const cost = Math.round(p.priceMinor * 0.4 * closing);
      totalInv += closing;
      totalRev += stats.rev;
      totalCost += cost;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        emoji: p.emoji,
        closing,
        revenue: stats.rev,
        cost,
      };
    });

    return {
      list,
      totalInv,
      totalRev,
      totalCost,
    };
  }, [invFiltered, invProducts]);

  const money = (minor: number) => (minor === 0 ? '$0' : fmt(minor));
  const bs = dash.buckets;
  const curB = bs[bs.length - 1] ?? { rev: 0, count: 0, items: 0, custs: 0 };
  const trim = (v: number) => String(Math.round(v * 100) / 100);
  const kpis = [
    { label: 'Revenue', value: money(curB.rev), series: bs.map((b) => b.rev / 100), fmtY: kMoney },
    { label: 'Sale count', value: String(curB.count), series: bs.map((b) => b.count), fmtY: String },
    { label: 'Customer count', value: curB.custs > 0 ? String(curB.custs) : '-', series: bs.map((b) => b.custs), fmtY: trim },
    { label: 'Gross profit', value: money(Math.round(curB.rev * 0.6)), series: bs.map((b) => Math.round(b.rev * 0.6) / 100), fmtY: kMoney },
    { label: 'Avg. sale value', value: money(curB.count ? Math.round(curB.rev / curB.count) : 0), series: bs.map((b) => (b.count ? b.rev / b.count / 100 : 0)), fmtY: trim },
    { label: 'Avg. items per sale', value: curB.count ? trim(curB.items / curB.count) : '0', series: bs.map((b) => (b.count ? b.items / b.count : 0)), fmtY: trim },
  ].map((k) => ({ ...k, yTicks: niceTicks(Math.max(...k.series)) }));

  // Register closures: real history from the register session store, with the
  // currently open session shown as a "Still open" row on top.
  const closureRows = useMemo<ClosureRow[]>(() => {
    const rows: ClosureRow[] = regClosures.map((c) => ({
      num: c.number,
      opened: c.openedAt,
      closed: c.closedAt,
      openingFloat: c.openingFloatMinor,
      expected: c.expectedMinor,
      counted: c.countedMinor,
      variance: c.varianceMinor,
      open: false,
    }));
    if (regStatus === 'open' && regOpenedAt !== null)
      rows.unshift({
        num: regClosureSeq,
        opened: regOpenedAt,
        closed: null,
        openingFloat: regOpeningFloat,
        expected: null,
        counted: null,
        variance: null,
        open: true,
      });
    return rows;
  }, [regClosures, regStatus, regOpenedAt, regClosureSeq, regOpeningFloat]);

  const totalPages = Math.max(1, Math.ceil(closureRows.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * PAGE_SIZE;
  const pageRows = closureRows.slice(start, start + PAGE_SIZE);
  const pageWindow = () => {
    const win: number[] = [];
    let lo = Math.max(1, curPage - 2);
    const hi = Math.min(totalPages, lo + 4);
    lo = Math.max(1, hi - 4);
    for (let p = lo; p <= hi; p++) win.push(p);
    return win;
  };
  const exportClosures = () =>
    downloadCSV('register-closures.csv', [
      ['Register', '#', 'Time Opened', 'Time Closed', 'Opening Float', 'Expected', 'Counted', 'Variance'],
      ...closureRows.map((r) => [
        'Main Register',
        String(r.num),
        `"${fmtDateTime(new Date(r.opened))}"`,
        r.open ? 'Still open' : `"${fmtDateTime(new Date(r.closed!))}"`,
        (r.openingFloat / 100).toFixed(2),
        r.expected === null ? '-' : (r.expected / 100).toFixed(2),
        r.counted === null ? '-' : (r.counted / 100).toFixed(2),
        r.variance === null ? '-' : (r.variance / 100).toFixed(2),
      ]),
    ]);

  // Cash movements: all closures' movements plus the current session's.
  const cashRows = useMemo<CashRow[]>(() => {
    const rows: CashRow[] = [];
    for (const c of regClosures)
      for (const m of c.movements)
        rows.push({ session: `Closure #${c.number}`, type: m.type, amountMinor: m.amountMinor, note: m.note, by: m.by, at: m.at });
    for (const m of regMovements)
      rows.push({ session: 'Current session', type: m.type, amountMinor: m.amountMinor, note: m.note, by: m.by, at: m.at });
    return rows.sort((a, b) => b.at - a.at);
  }, [regClosures, regMovements]);
  const cashFiltered = cashRows.filter(
    (r) =>
      (cashType === 'All cash movement types' ||
        (cashType === 'Cash added' ? r.type === 'ADD' : r.type === 'REMOVE')) &&
      (cashNote.trim() === '' || r.note.toLowerCase().includes(cashNote.trim().toLowerCase())),
  );
  const cashAdded = cashFiltered.filter((r) => r.type === 'ADD').reduce((a, r) => a + r.amountMinor, 0);
  const cashRemoved = cashFiltered.filter((r) => r.type === 'REMOVE').reduce((a, r) => a + r.amountMinor, 0);

  // Gift cards: sale lines whose product name contains "gift card".
  const giftLines = useMemo(() => {
    const rows: { order: string; at: number; qty: number; amountMinor: number }[] = [];
    for (const s of sales)
      for (const l of s.lines)
        if (l.name.toLowerCase().includes('gift card'))
          rows.push({ order: s.orderNumber, at: s.at, qty: l.quantity, amountMinor: l.unitPriceMinor * l.quantity });
    return rows.sort((a, b) => b.at - a.at);
  }, [sales]);
  const gcFiltered = giftLines.filter(
    (g) => gcQuery.trim() === '' || g.order.toLowerCase().includes(gcQuery.trim().toLowerCase()),
  );
  const gcSold = giftLines.reduce((a, g) => a + g.amountMinor, 0);
  const gcCount = giftLines.reduce((a, g) => a + g.qty, 0);

  // Store credit: outstanding balances held by customers.
  const creditCustomers = customers.filter((c) => c.storeCreditMinor > 0);
  const creditTotal = customers.reduce((a, c) => a + c.storeCreditMinor, 0);

  // Top sales people: sales grouped by who rang them up.
  const salesPeople = useMemo(() => {
    const m = new Map<string, { rev: number; count: number; items: number }>();
    for (const s of sales) {
      const key = s.soldBy ?? 'Staff';
      const cur = m.get(key) ?? { rev: 0, count: 0, items: 0 };
      cur.rev += s.totalMinor;
      cur.count += 1;
      cur.items += s.lines.reduce((a, l) => a + l.quantity, 0);
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev);
  }, [sales]);

  // Per-product daily quantity over the last 7 days (for the Trend sparkline).
  const trendMap = useMemo(() => {
    const t0 = startOfDay(Date.now());
    const m = new Map<string, number[]>();
    for (const sale of sales) {
      const daysAgo = Math.round((t0 - startOfDay(sale.at)) / DAY_MS);
      if (daysAgo < 0 || daysAgo > 6) continue;
      for (const l of sale.lines) {
        const arr = m.get(l.name) ?? [0, 0, 0, 0, 0, 0, 0];
        arr[6 - daysAgo] = (arr[6 - daysAgo] ?? 0) + l.quantity;
        m.set(l.name, arr);
      }
    }
    return m;
  }, [sales]);

  const topMap = new Map<string, { qty: number; rev: number }>();
  for (const sale of sales)
    for (const l of sale.lines) {
      const cur = topMap.get(l.name) ?? { qty: 0, rev: 0 };
      topMap.set(l.name, { qty: cur.qty + l.quantity, rev: cur.rev + l.unitPriceMinor * l.quantity });
    }
  const soldProducts = [...topMap.entries()].sort((a, b) => b[1].rev - a[1].rev);
  const activeLabel = NAV.find((n) => n.key === active)?.label ?? 'Report';

  return (
    <>
      <ContextNav items={NAV} active={active} onSelect={setActive} />
      <main className="admin-main">
        <div className="admin-page">
          {active === 'register' ? (
            <>
              <div className="page-head">
                <h1 className="page-title">Register Closures</h1>
                <span className="rlink rc-export" onClick={exportClosures}>Export CSV</span>
              </div>
              <div className="rc-filter">
                <div className="rc-fgroup">
                  <label>Register</label>
                  <select value={regFilter} onChange={(e) => setRegFilter(e.target.value)}>
                    <option>All Registers</option>
                    <option>Main Register</option>
                  </select>
                </div>
                <button className="btn-s" onClick={() => { setAppliedReg(regFilter); setPage(1); }}>Update</button>
              </div>
              <div className="rc-scroll">
                <div className="rc-table">
                  <div className="rc-head rc-real">
                    <span>Register</span><span className="r">#</span><span>Time Opened</span><span>Time Closed ▾</span>
                    <span className="r">Opening Float</span><span className="r">Expected</span><span className="r">Counted</span><span className="r">Variance</span>
                  </div>
                  {pageRows.map((r, i) => (
                    <div key={`${r.num}-${r.opened}`} className={`rc-row rc-real ${i % 2 ? 'alt' : ''}`}>
                      <span className="rc-reg">Main Register</span>
                      <span className="r">{r.num}</span>
                      <span>{fmtDateTime(new Date(r.opened))}</span>
                      <span className={r.open ? 'rc-open' : ''}>{r.open ? 'Still open' : fmtDateTime(new Date(r.closed!))}</span>
                      <span className="r">{fmt(r.openingFloat)}</span>
                      <span className="r">{r.expected === null ? '-' : fmt(r.expected)}</span>
                      <span className="r">{r.counted === null ? '-' : fmt(r.counted)}</span>
                      <span className={`r ${r.variance === null || r.variance === 0 ? '' : r.variance < 0 ? 'var-neg' : 'var-pos'}`}>
                        {r.variance === null ? '-' : fmt(r.variance)}
                      </span>
                    </div>
                  ))}
                  {closureRows.length === 0 && <div className="rc-empty">No register closures for this period.</div>}
                  <div className="rc-foot">DISPLAYING {closureRows.length === 0 ? 0 : start + 1} TO {start + pageRows.length} OF {closureRows.length}.</div>
                </div>
              </div>
              <div className="rc-pager">
                <span className={`rc-pg ${curPage === 1 ? 'off' : ''}`} onClick={() => setPage(1)}>◄◄ FIRST</span>
                <span className={`rc-pg ${curPage === 1 ? 'off' : ''}`} onClick={() => setPage((p) => Math.max(1, p - 1))}>◄ PREV</span>
                {pageWindow().map((p) => (
                  <span key={p} className={`rc-pg ${p === curPage ? 'cur' : ''}`} onClick={() => setPage(p)}>{p}</span>
                ))}
                <span className={`rc-pg ${curPage === totalPages ? 'off' : ''}`} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>NEXT ►</span>
                <span className={`rc-pg ${curPage === totalPages ? 'off' : ''}`} onClick={() => setPage(totalPages)}>LAST ►►</span>
              </div>
            </>
          ) : active === 'cash' ? (
            <>
              <h1 className="page-title">Cash movement report</h1>
              <div className="rep-band"><span>Cash added to and removed from the register drawer, across all sessions.</span></div>
              <div className="rep-filter">
                <div className="rep-fg">
                  <label>Type</label>
                  <select value={cashType} onChange={(e) => setCashType(e.target.value)}>
                    <option>All cash movement types</option>
                    <option>Cash added</option>
                    <option>Cash removed</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Cash movement note</label>
                  <input value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder="Search cash movement notes" />
                </div>
              </div>
              <div className="rep-toolbar">
                <span>Showing {cashFiltered.length} movement{cashFiltered.length === 1 ? '' : 's'}</span>
                <span
                  className="rlink"
                  onClick={() =>
                    downloadCSV('cash-movement.csv', [
                      ['Session', 'Type', 'Note', 'By', 'Time', 'Cash added', 'Cash removed', 'Amount'],
                      ...cashFiltered.map((r) => [
                        r.session,
                        r.type === 'ADD' ? 'Cash added' : 'Cash removed',
                        `"${r.note.replace(/"/g, '""')}"`,
                        r.by,
                        `"${fmtDateTime(new Date(r.at))}"`,
                        r.type === 'ADD' ? (r.amountMinor / 100).toFixed(2) : '',
                        r.type === 'REMOVE' ? (r.amountMinor / 100).toFixed(2) : '',
                        ((r.type === 'ADD' ? 1 : -1) * (r.amountMinor / 100)).toFixed(2),
                      ]),
                      ['Totals', '', '', '', '', (cashAdded / 100).toFixed(2), (cashRemoved / 100).toFixed(2), ((cashAdded - cashRemoved) / 100).toFixed(2)],
                    ])
                  }
                >
                  ⤓ Export report…
                </span>
              </div>
              <div className="cm-table">
                <div className="cm-grouphead"><span /><span /><span /><span className="cm-total">TOTAL</span></div>
                <div className="cm-head"><span>Type</span><span>Cash added</span><span>Cash removed</span><span>Amount</span></div>
                <div className="cm-row totals">
                  <span>Totals</span>
                  <span>{cashFiltered.length ? fmt(cashAdded) : '—'}</span>
                  <span>{cashFiltered.length ? fmt(cashRemoved) : '—'}</span>
                  <span>{cashFiltered.length ? fmt(cashAdded - cashRemoved) : '—'}</span>
                </div>
                {cashFiltered.length === 0 ? (
                  <div className="cm-empty">No data available for this period</div>
                ) : (
                  cashFiltered.map((r) => (
                    <div key={`${r.at}-${r.session}`} className="cm-row">
                      <span>
                        {r.type === 'ADD' ? 'Cash added' : 'Cash removed'}
                        <span className="cm-note">
                          {r.session} · {r.note || 'No note'} · {r.by} · {fmtDateTime(new Date(r.at))}
                        </span>
                      </span>
                      <span>{r.type === 'ADD' ? fmt(r.amountMinor) : '—'}</span>
                      <span>{r.type === 'REMOVE' ? fmt(r.amountMinor) : '—'}</span>
                      <span>{r.type === 'ADD' ? fmt(r.amountMinor) : `-${fmt(r.amountMinor)}`}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : active === 'gift' ? (
            <>
              <h1 className="page-title">Gift card report</h1>
              <div className="gc-searchcard">
                <div className="gc-search">
                  <label>Gift card number</label>
                  <input value={gcQuery} onChange={(e) => setGcQuery(e.target.value)} placeholder="🔍 Search for a gift card number" />
                </div>
                <button className="btn-p" disabled={!gcQuery.trim()} onClick={() => { setGcLoading(true); setTimeout(() => setGcLoading(false), 700); }}>Apply filter</button>
              </div>
              <div className="gc-stats">
                <div className="gc-stat"><span>Total value sold</span><b>{fmt(gcSold)}</b></div>
                <div className="gc-stat"><span>Total value redeemed</span><b>{fmt(0)}</b></div>
                <div className="gc-stat"><span>Outstanding balance</span><b>{fmt(gcSold)}</b></div>
                <div className="gc-stat"><span>Gift cards in circulation</span><b>{gcCount}</b></div>
              </div>
              <div className="rep-toolbar">
                <span>Showing {gcFiltered.length} gift card{gcFiltered.length === 1 ? '' : 's'}</span>
                <span
                  className="rlink"
                  onClick={() =>
                    downloadCSV('gift-cards.csv', [
                      ['Gift card (sale)', 'Total sold', 'Total redeemed', 'Balance'],
                      ...gcFiltered.map((g) => [g.order, (g.amountMinor / 100).toFixed(2), '0.00', (g.amountMinor / 100).toFixed(2)]),
                    ])
                  }
                >
                  ⤓ Export report
                </span>
              </div>
              <div className="gc-table">
                <div className="gc-head"><span>Gift card (sale)</span><span className="r">Total sold</span><span className="r">Total redeemed</span><span className="r">Balance</span></div>
                <div className="gc-body">
                  {gcLoading ? (
                    <div className="spinner" />
                  ) : gcFiltered.length === 0 ? (
                    <div className="cm-empty">No gift cards found for this period</div>
                  ) : (
                    gcFiltered.map((g, i) => (
                      <div key={`${g.order}-${i}`} className="gc-row">
                        <span>
                          {g.order} <span className="prod-sku">{fmtDateTime(new Date(g.at))}</span>
                        </span>
                        <span className="r">{fmt(g.amountMinor)}</span>
                        <span className="r">{fmt(0)}</span>
                        <span className="r">{fmt(g.amountMinor)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : active === 'inventory' ? (
            <>
              <h1 className="page-title">Inventory report</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${invTab === 'summary' ? 'active' : ''}`} onClick={() => setInvTab('summary')}>Summary</button>
                <button className={`sh-tab ${invTab === 'replenishment' ? 'active' : ''}`} onClick={() => setInvTab('replenishment')}>Replenishment</button>
                <button className={`sh-tab ${invTab === 'performance' ? 'active' : ''}`} onClick={() => setInvTab('performance')}>Performance</button>
              </div>
              <div className="rep-band"><span>Get an overview of inventory and its performance over time.</span></div>
              {invTab === 'summary' ? (
                <>
                  <div className="rep-filter">
                    <div className="rep-fg">
                      <label>Report type</label>
                      <select value={invReport} onChange={(e) => setInvReport(e.target.value)}>
                        <option>Product</option>
                        <option>Supplier</option>
                        <option>Brand</option>
                        <option>Category</option>
                      </select>
                    </div>
                    <div className="rep-fg">
                      <label>Measure</label>
                      <select value={invMeasure} onChange={(e) => setInvMeasure(e.target.value)}>
                        <option>Low inventory</option>
                        <option>Closing inventory</option>
                        <option>Revenue</option>
                      </select>
                    </div>
                    <div className="rep-fg">
                      <label>Date range</label>
                      <div className="rep-daterange">📅 Jul 1, 2025 to Jul 31, 2025</div>
                    </div>
                  </div>
                  <div className="rep-toolbar">
                    <span className="rlink" onClick={() => downloadCSV('inventory-report.csv', [['Product', 'Closing inventory', 'Revenue', 'Inventory cost'], ...invMetrics.list.map((item) => [item.name, String(item.closing), fmt(item.revenue), fmt(item.cost)])])}>⤓ Export report…</span>
                  </div>
                  <div className="ir-table">
                    <div className="ir-grouphead"><span /><span className="ir-hist">HISTORICAL ⓘ</span></div>
                    <div className="ir-head">
                      <span className="cth-s"><span className="cth-label">Product</span><SortGlyph dir="asc" /></span>
                      <span className="r">Closing inventory</span>
                      <span className="r">Revenue</span>
                      <span className="r">Inventory cost</span>
                    </div>
                    <div className="ir-row totals">
                      <span>Totals</span>
                      <span className="r">{invMetrics.totalInv}</span>
                      <span className="r">{fmt(invMetrics.totalRev)}</span>
                      <span className="r">{fmt(invMetrics.totalCost)}</span>
                    </div>
                    {invMetrics.list.map((p) => (
                      <div key={p.id} className="ir-row">
                        <span className="ir-name">
                          <span className="rt-thumb">{p.emoji}</span>
                          <span>
                            <span className="rlink">{p.name}</span>
                            <br />
                            <span className="prod-sku">{p.sku}</span>
                          </span>
                        </span>
                        <span className="r">{p.closing}</span>
                        <span className="r">{p.revenue > 0 ? fmt(p.revenue) : '—'}</span>
                        <span className="r">{fmt(p.cost)}</span>
                      </div>
                    ))}
                    <div className="ir-row totals">
                      <span>Totals</span>
                      <span className="r">{invMetrics.totalInv}</span>
                      <span className="r">{fmt(invMetrics.totalRev)}</span>
                      <span className="r">{fmt(invMetrics.totalCost)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="placeholder-card">
                  <div className="placeholder-icon">📦</div>
                  <div className="placeholder-title">{invTab === 'replenishment' ? 'Replenishment' : 'Performance'}</div>
                  <div className="placeholder-hint">Run a report to see {invTab} data for this period.</div>
                </div>
              )}
            </>
          ) : active === 'sales' ? (
            <>
              <h1 className="page-title">Sales report</h1>
              <div className="rep-band"><span>Get an overview of how your sales are performing.</span></div>
              <div className="rep-filter">
                <div className="rep-fg">
                  <label>Report type</label>
                  <select value={salesReport} onChange={(e) => setSalesReport(e.target.value)}>
                    <option>Sales summary</option><option>Sales by product</option><option>Sales by outlet</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Measure</label>
                  <select value={salesMeasure} onChange={(e) => setSalesMeasure(e.target.value)}>
                    <option>Revenue</option><option>Profit</option><option>Tax</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Date range</label>
                  <DateRangeField value={salesRange} onApply={setSalesRange} />
                </div>
                <div className="rep-fg">
                  <label>Comparison</label>
                  <select value={salesComparison} onChange={(e) => setSalesComparison(e.target.value)}>
                    <option>No comparison</option><option>Previous period</option><option>Previous year</option>
                  </select>
                </div>
              </div>
              <div className="dash-morefilters"><span className="rlink">More filters</span></div>
              <div className="rep-toolbar">
                <span className="rlink">⇄ Format results</span>
                <span className="rlink" onClick={() => downloadCSV('sales-report.csv', [['Sales summary', 'Revenue', 'Cost of goods sold', 'Gross profit', 'Margin (%)', 'Tax'], ['Totals', fmt(salesMetrics.revenue), fmt(salesMetrics.cogs), fmt(salesMetrics.profit), `${salesMetrics.margin}%`, fmt(salesMetrics.tax)]])}>⤓ Export report…</span>
              </div>
              <div className="sr-table">
                <div className="sr-grouphead"><span /><span className="rpt-year">{salesParsedRange.start.getFullYear()}</span><span className="rpt-total">TOTAL</span></div>
                <div className="sr-head">
                  <span>Sales summary</span>
                  <span className="r">{dayHeaderLabel}</span>
                  <span className="r ps-sortable">Revenue <SortGlyph /></span>
                  <span className="r ps-sortable">Cost of goods sold <SortGlyph /></span>
                  <span className="r ps-sortable">Gross profit <SortGlyph /></span>
                  <span className="r ps-sortable">Margin (%) <SortGlyph /></span>
                  <span className="r ps-sortable">Tax <SortGlyph /></span>
                </div>
                <div className="sr-row totals">
                  <span>Totals</span>
                  <span className="r">{fmt(salesMetrics.revenue)}</span>
                  <span className="r">{fmt(salesMetrics.revenue)}</span>
                  <span className="r">{fmt(salesMetrics.cogs)}</span>
                  <span className="r">{fmt(salesMetrics.profit)}</span>
                  <span className="r">{salesMetrics.margin}%</span>
                  <span className="r">{fmt(salesMetrics.tax)}</span>
                </div>
                <div className="sr-breakdown">
                  <span className="sr-vlabel">TOTALS BY DATE RANGE</span>
                  <div className="sr-blist">
                    <div className="sr-brow"><span>Revenue</span><span className="r">{fmt(salesMetrics.revenue)}</span></div>
                    <div className="sr-brow"><span>Cost of goods sold</span><span className="r">{fmt(salesMetrics.cogs)}</span></div>
                    <div className="sr-brow"><span>Gross profit</span><span className="r">{fmt(salesMetrics.profit)}</span></div>
                    <div className="sr-brow"><span>Margin (%)</span><span className="r">{salesMetrics.margin}%</span></div>
                    <div className="sr-brow"><span>Tax</span><span className="r">{fmt(salesMetrics.tax)}</span></div>
                  </div>
                </div>
              </div>
            </>
          ) : active === 'payment' ? (
            <>
              <h1 className="page-title">Payment report</h1>
              <div className="rep-band"><span>Get an overview of your payment reports.</span></div>
              <div className="rep-filter">
                <div className="rep-fg">
                  <label>Report type</label>
                  <select value={payReport} onChange={(e) => setPayReport(e.target.value)}>
                    <option>Payment type</option><option>Register</option><option>User</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Measure</label>
                  <select value={payMeasure} onChange={(e) => setPayMeasure(e.target.value)}>
                    <option>Amount</option><option>Count</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Date range</label>
                  <DateRangeField value={payRange} onApply={setPayRange} />
                </div>
                <div className="rep-fg">
                  <label>Comparison</label>
                  <select value={payComparison} onChange={(e) => setPayComparison(e.target.value)}>
                    <option>No comparison</option><option>Previous period</option>
                  </select>
                </div>
              </div>
              <div className="rep-toolbar">
                <span className="rlink">⇄ Format results</span>
                <span className="rlink" onClick={() => downloadCSV('payment-report.csv', [['Payment type', MON[payParsedRange.start.getMonth()] ?? '', 'Amount'], ['Cash', fmt(payMetrics.cash), fmt(payMetrics.cash)], ['Credit Card', fmt(payMetrics.card), fmt(payMetrics.card)], ['Totals', fmt(payMetrics.total), fmt(payMetrics.total)]])}>⤓ Export report…</span>
              </div>
              <div className="pm-table">
                <div className="pm-grouphead"><span /><span className="rpt-year">{payParsedRange.start.getFullYear()}</span><span className="rpt-total">TOTAL</span></div>
                <div className="pm-head"><span>Payment type</span><span className="r">{MON[payParsedRange.start.getMonth()]}</span><span className="r">Amount</span></div>
                {payFiltered.length > 0 ? (
                  <>
                    <div className="pm-row">
                      <span>Cash</span>
                      <span className="r">{fmt(payMetrics.cash)}</span>
                      <span className="r">{fmt(payMetrics.cash)}</span>
                    </div>
                    <div className="pm-row">
                      <span>Credit Card</span>
                      <span className="r">{fmt(payMetrics.card)}</span>
                      <span className="r">{fmt(payMetrics.card)}</span>
                    </div>
                    <div className="pm-row totals">
                      <span>Totals</span>
                      <span className="r">{fmt(payMetrics.total)}</span>
                      <span className="r">{fmt(payMetrics.total)}</span>
                    </div>
                  </>
                ) : (
                  <div className="rpt-empty">No data available for this period</div>
                )}
              </div>
            </>
          ) : active === 'adjustment' ? (
            <>
              <h1 className="page-title">Adjustment report</h1>
              <div className="rep-band"><span>Get an overview of inventory adjustments.</span></div>
              <div className="rep-filter">
                <div className="rep-fg">
                  <label>Reasons</label>
                  <select value={adjReasons} onChange={(e) => setAdjReasons(e.target.value)}>
                    <option>All reasons</option><option>Damage</option><option>Theft</option><option>Stock Found</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Date range</label>
                  <DateRangeField value={adjRange} onApply={setAdjRange} />
                </div>
                <div className="rep-fg wide">
                  <label>Filter report by user, product or other keywords</label>
                  <div className="adj-filter">
                    <select value={adjMode} onChange={(e) => setAdjMode(e.target.value)}>
                      <option>Include</option><option>Exclude</option>
                    </select>
                    <input value={adjFilter} onChange={(e) => setAdjFilter(e.target.value)} placeholder="Add a filter..." />
                  </div>
                </div>
              </div>
              <div className="rep-toolbar">
                <span className="rlink">⇄ Format results</span>
                <span className="rlink" onClick={() => downloadCSV('adjustment-report.csv', [['Adjustment reason', 'Quantity', 'Cost']])}>⤓ Export report…</span>
              </div>
              <div className="adjr-table">
                <div className="adjr-grouphead"><span /><span className="rpt-total adjr-total">TOTAL</span></div>
                <div className="adjr-head">
                  <span>Adjustment reason</span>
                  <span className="r ps-sortable">Quantity <SortGlyph /></span>
                  <span className="r ps-sortable">Cost <SortGlyph /></span>
                </div>
                <div className="adjr-row totals"><span>Totals</span><span /><span /></div>
                <div className="rpt-empty">No data available for this period</div>
              </div>
            </>
          ) : active === 'storecredit' ? (
            <>
              <h1 className="page-title">Store credit report</h1>
              <div className="gc-stats sc-stats">
                <div className="gc-stat"><span>Total value issued</span><b>{fmt(creditTotal)}</b></div>
                <div className="gc-stat"><span>Total value redeemed</span><b>{fmt(0)}</b></div>
                <div className="gc-stat"><span>Outstanding balance</span><b>{fmt(creditTotal)}</b></div>
                <div className="gc-stat"><span>Customers with credit</span><b>{creditCustomers.length}</b></div>
              </div>
              <div className="gc-table">
                <div className="gc-head sc-head"><span>Customer</span><span className="r">Total issued</span><span className="r">Total redeemed</span><span className="r">Balance</span></div>
                {creditCustomers.length === 0 ? (
                  <div className="sc-empty">No store credit data available</div>
                ) : (
                  creditCustomers.map((c) => (
                    <div key={c.id} className="gc-row">
                      <span>
                        {c.firstName} {c.lastName} <span className="prod-sku">{c.code}</span>
                      </span>
                      <span className="r">{fmt(c.storeCreditMinor)}</span>
                      <span className="r">{fmt(0)}</span>
                      <span className="r">{fmt(c.storeCreditMinor)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : active === 'user' ? (
            (() => {
              const filteredUsers = staffUsers
                .map((u) => ({ disp: u.name, email: u.email, init: initials(u.name), av: u.av }))
                .filter(
                  (u) => userSearch.trim() === '' || u.disp.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()),
                )
                .sort((a, b) => (userSort === 'asc' ? 1 : -1) * a.disp.localeCompare(b.disp));
              return (
                <>
                  <h1 className="page-title">User reports</h1>
                  <div className="sh-tabs"><button className="sh-tab active">Time cards</button></div>
                  <div className="rep-band"><span>View and export your users time cards</span></div>
                  <div className="ur-filter">
                    <div className="rep-fg">
                      <label>Search users</label>
                      <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="🔍 Enter a name or email address" />
                    </div>
                    <div className="rep-fg">
                      <label>Date range</label>
                      <DateRangeField value={userRange} onApply={setUserRange} />
                    </div>
                    <button className="btn-p ur-search">Search</button>
                  </div>
                  {partnerOpen && (
                    <div className="partner-card">
                      <div className="shiftly-logo">shiftly</div>
                      <div className="partner-body">
                        <div className="partner-h">Simplify your team management with shiftly</div>
                        <div className="partner-t">Unlock the everything app for hourly teams and conquer team scheduling, activity and time cards with ease with the new enhanced shiftly partnership, now offering exclusive pricing for Nova customers.</div>
                        <span className="rlink">Learn more ↗</span>
                      </div>
                      <span className="rlink partner-dismiss" onClick={() => setPartnerOpen(false)}>Dismiss</span>
                    </div>
                  )}
                  <div className="disp-row">
                    <span>Displaying {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}</span>
                    <span className="rlink" onClick={() => downloadCSV('user-time-cards.csv', [['User', 'Email', 'Total worked hours'], ...filteredUsers.map((u) => [u.disp, u.email, '0 min'])])}>⤓ Export list</span>
                  </div>
                  <div className="ur-table">
                    <div className="ur-head">
                      <span className="cth-s" onClick={() => setUserSort((s) => (s === 'asc' ? 'desc' : 'asc'))}><span className="cth-label">User</span><SortGlyph dir={userSort} /></span>
                      <span className="r">Total worked hours</span>
                    </div>
                    {filteredUsers.map((u) => (
                      <div key={u.email} className="ur-row">
                        <span className="ur-user">
                          <span className="ur-chev">›</span>
                          <span className="cust-av" style={{ background: u.av }}>{u.init}</span>
                          <span><b>{u.disp}</b><br /><span className="cust-code">{u.email}</span></span>
                        </span>
                        <span className="r">0 min</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()
          ) : active !== 'dashboard' ? (
            <>
              <h1 className="page-title">{activeLabel}</h1>
              <div className="placeholder-card">
                <div className="placeholder-icon">📊</div>
                <div className="placeholder-title">{activeLabel}</div>
                <div className="placeholder-hint">This report is being built to match X-Series.</div>
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">Retail dashboard</h1>
              <div className="dash-filters">
                <div className="dash-fgroup">
                  <label>View</label>
                  <div className="dash-seg">
                    {(['Day', 'Week', 'Month'] as const).map((v) => (
                      <button key={v} className={`dash-seg-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="dash-fgroup">
                  <label>Dates</label>
                  <div className="date-nav">
                    <button className="date-arrow" onClick={() => setDateOffset((o) => o - 1)}>‹</button>
                    <div className="date-box">{fmtDate(dashDate)}</div>
                    <button className="date-arrow" onClick={() => setDateOffset((o) => o + 1)}>›</button>
                  </div>
                </div>
                <div className="dash-fgroup">
                  <label>Outlet</label>
                  <select className="dash-outlet" value={outlet} onChange={(e) => setOutlet(e.target.value)}>
                    <option>Main Outlet</option>
                    <option>All outlets</option>
                  </select>
                </div>
              </div>
              <div className="dash-morefilters"><span className="rlink">More filters</span></div>

              <div className="kpi-grid">
                {kpis.map((k) => {
                  const series = k.series;
                  const today = series[series.length - 1] ?? 0;
                  const prev = series[series.length - 2] ?? 0;
                  const flat = today === prev;
                  const pct = prev > 0 ? Math.round(((today - prev) / prev) * 100) : today > 0 ? 100 : 0;
                  const changeText = flat ? 'No change' : `${today < prev ? '▼' : '▲'} ${Math.abs(pct)}%`;
                  const cls = flat ? 'kflat' : today < prev ? 'kdown' : 'kup';
                  return (
                    <div key={k.label} className="kpi-card">
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi-head">
                        <div className="kpi-value">{k.value}</div>
                        <div className="kpi-change">
                          <span className={cls}>{changeText}</span>
                          <div className="kpi-prev">Previous {view.toLowerCase()}</div>
                        </div>
                      </div>
                      <div className="kpi-outlet">
                        <span className="kpi-leg"><span className="kpi-swatch" />{outlet}</span>
                        <span>{k.value}</span>
                      </div>
                      <div className="kpi-chart tall">
                        <KpiChart data={series} labels={dash.labels} yTicks={k.yTicks} fmtY={k.fmtY} />
                      </div>
                      <button className="kpi-link" onClick={() => setActive('sales')}>View report</button>
                    </div>
                  );
                })}
              </div>

              <div className="rep-table wide">
                <div className="rep-table-h">Products sold</div>
                <div className="ps-head">
                  <span>Product</span>
                  <span className="r ps-sortable">Revenue <SortGlyph /></span>
                  <span className="r">Items sold</span>
                  <span className="r">Discounted</span>
                  <span className="r">Trend</span>
                </div>
                {soldProducts.length === 0 ? (
                  <div className="rep-empty">No data available for this period.</div>
                ) : (
                  soldProducts.map(([name, v], i) => (
                    <div key={name} className="ps-row">
                      <span className="ps-name">
                        <span className="rt-thumb">{CATBYNAME.get(name)?.emoji ?? '📦'}</span>
                        <span><span className="rlink">{name}</span><br /><span className="prod-sku">{CATBYNAME.get(name)?.sku ?? '—'}</span></span>
                      </span>
                      <span className="r">{fmt(v.rev)}</span>
                      <span className="r">{v.qty}</span>
                      <span className="r">$0.00</span>
                      <span className="r ps-trend"><Sparkline data={trendMap.get(name) ?? [0, 0, 0, 0, 0, 0, 0]} height={26} /></span>
                    </div>
                  ))
                )}
              </div>

              <div className="rep-table wide">
                <div className="rep-table-h">Top sales people</div>
                <div className="tsp-head">
                  <span>User</span>
                  <span className="r ps-sortable">Revenue <SortGlyph /></span>
                  <span className="r">Sale count</span>
                  <span className="r">Items sold</span>
                  <span className="r">Avg. sale value</span>
                  <span className="r">Avg. items per sale</span>
                </div>
                {salesPeople.length === 0 ? (
                  <div className="rep-empty">No data available for this period.</div>
                ) : (
                  salesPeople.map(([name, v]) => (
                    <div key={name} className="tsp-row">
                      <span className="rlink">{name}</span>
                      <span className="r">{fmt(v.rev)}</span>
                      <span className="r">{v.count}</span>
                      <span className="r">{v.items}</span>
                      <span className="r">{fmt(v.count ? Math.round(v.rev / v.count) : 0)}</span>
                      <span className="r">{v.count ? (v.items / v.count).toFixed(1) : '0'}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
