import { useEffect, useMemo, useState } from 'react';
import { useCustomers } from '../store/customerStore';
import { useProducts } from '../store/productStore';
import { useRegisterSession } from '../store/registerSessionStore';
import { initials, useUsers } from '../store/userStore';
import { fmt } from '../lib/format';
import { ContextNav, type ContextItem } from '../shell/ContextNav';
import { saleCost, saleRevenue, useCart } from '../store/cartStore';
import { STORE_CREDIT, isCash, methodOf, tenderLabel } from '../lib/tenders';
import { useInventory } from '../store/inventoryStore';
import { useSharedReports } from '../store/sharedReportsStore';
import { fmtMinutes, minutesWorked, useTimeEntries } from '../store/timeEntryStore';
import { useGiftCards } from '../store/giftCardStore';
import { useSetup } from '../store/setupStore';
import { useSettings } from '../store/settingsStore';
import { useAdjustmentReasons } from '../store/adjustmentReasonsStore';
import { KpiChart } from './KpiChart';
import { Sparkline } from './Sparkline';
import '../styles/reporting.css';

const NAV: ContextItem[] = [
  { key: 'dashboard', label: 'Retail Dashboard' },
  { key: 'sales', label: 'Sales Reports' },
  { key: 'inventory', label: 'Inventory Reports' },
  { key: 'adjustment', label: 'Adjustment reports' },
  { key: 'cash', label: 'Cash movement reports' },
  { key: 'payment', label: 'Payment Reports' },
  { key: 'register', label: 'Register Closures' },
  { key: 'gift', label: 'Gift Card Reports' },
  { key: 'storecredit', label: 'Store Credit Reports' },
  { key: 'tax', label: 'Tax Reports' },
  { key: 'user', label: 'User Reports' },
  { key: 'shared', label: 'Shared Reports' },
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const kMoney = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));

const DAY_MS = 86_400_000;

/**
 * The measures Lightspeed's sales report can chart, in its order. Lightspeed
 * keeps "Revenue" and "Revenue (incl. tax)" as separate measures, so the plain
 * ones here are all net of tax. Its two surcharging measures are left out:
 * Nova has no surcharges, and a measure that silently equalled Revenue would
 * read as a real figure.
 */
type MeasureKind = 'money' | 'count' | 'percent' | 'decimal' | 'time';
interface DayTotals {
  rev: number;
  tax: number;
  cogs: number;
  items: number;
  disc: number;
  withCust: number;
  count: number;
  customers: number;
  returns: number;
  all: number;
}
const MEASURES: { label: string; kind: MeasureKind; of: (d: DayTotals) => number }[] = [
  { label: 'Avg. items per sale', kind: 'decimal', of: (d) => (d.count ? d.items / d.count : 0) },
  { label: 'Avg. sale value', kind: 'money', of: (d) => (d.count ? Math.round(d.rev / d.count) : 0) },
  { label: 'Avg. sale value (incl. tax)', kind: 'money', of: (d) => (d.count ? Math.round((d.rev + d.tax) / d.count) : 0) },
  { label: 'Cost of goods sold', kind: 'money', of: (d) => d.cogs },
  { label: 'Customer count', kind: 'count', of: (d) => d.customers },
  { label: 'Discounted', kind: 'money', of: (d) => d.disc },
  { label: 'Discounted (%)', kind: 'percent', of: (d) => (d.rev + d.disc > 0 ? (d.disc / (d.rev + d.disc)) * 100 : 0) },
  { label: 'First sale', kind: 'time', of: () => 0 },
  { label: 'Gross profit', kind: 'money', of: (d) => d.rev - d.cogs },
  { label: 'Items sold', kind: 'count', of: (d) => d.items },
  { label: 'Last sale', kind: 'time', of: () => 0 },
  { label: 'Margin (%)', kind: 'percent', of: (d) => (d.rev > 0 ? ((d.rev - d.cogs) / d.rev) * 100 : 0) },
  { label: 'Return count', kind: 'count', of: (d) => d.returns },
  { label: 'Returns (%)', kind: 'percent', of: (d) => (d.all > 0 ? (d.returns / d.all) * 100 : 0) },
  { label: 'Revenue', kind: 'money', of: (d) => d.rev },
  { label: 'Revenue (incl. tax)', kind: 'money', of: (d) => d.rev + d.tax },
  { label: 'Sale count', kind: 'count', of: (d) => d.count },
  { label: 'Sales with Customer', kind: 'count', of: (d) => d.withCust },
  { label: 'Sales with customer attached (%)', kind: 'percent', of: (d) => (d.count > 0 ? (d.withCust / d.count) * 100 : 0) },
  { label: 'Tax', kind: 'money', of: (d) => d.tax },
];
const measureOf = (label: string, d: DayTotals): number => (MEASURES.find((m) => m.label === label) ?? MEASURES[14]!).of(d);
const measureText = (label: string, value: number): string => {
  const kind = measureKind(label);
  if (kind === 'money') return fmt(value);
  if (kind === 'percent') return `${Math.round(value * 10) / 10}%`;
  if (kind === 'decimal') return String(Math.round(value * 100) / 100);
  if (kind === 'time') return value ? new Date(value).toLocaleString() : '\u2014';
  return String(value);
};
const measureKind = (label: string): MeasureKind => (MEASURES.find((m) => m.label === label) ?? MEASURES[14]!).kind;
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

/** Midnight today, in local time. */
const today = (): Date => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
/** Midnight `n` days before today. */
const daysAgo = (n: number): Date => {
  const d = today();
  d.setDate(d.getDate() - n);
  return d;
};
const rangeLabel = (s: Date, e: Date): string => `${fmtDate(s)} to ${fmtDate(e)}`;

/** Start of the granularity's period containing `d` (weeks start Monday). */
const startOfUnit = (gran: string, d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (gran === 'Year') return new Date(x.getFullYear(), 0, 1);
  if (gran === 'Quarter') return new Date(x.getFullYear(), Math.floor(x.getMonth() / 3) * 3, 1);
  if (gran === 'Month') return new Date(x.getFullYear(), x.getMonth(), 1);
  if (gran === 'Week') {
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  return x; // Day and Hour both report by day.
};

/** Move `d` by `n` whole periods of the granularity. */
const addUnits = (gran: string, d: Date, n: number): Date => {
  const x = new Date(d);
  if (gran === 'Year') x.setFullYear(x.getFullYear() + n);
  else if (gran === 'Quarter') x.setMonth(x.getMonth() + 3 * n);
  else if (gran === 'Month') x.setMonth(x.getMonth() + n);
  else if (gran === 'Week') x.setDate(x.getDate() + 7 * n);
  else x.setDate(x.getDate() + n);
  return x;
};

/** Last day of the `n` periods that begin at `start`. */
const lastDayOf = (gran: string, start: Date, n: number): Date => {
  const after = addUnits(gran, start, n);
  after.setDate(after.getDate() - 1);
  return after;
};

const parseRange = (rangeStr: string): { start: Date; end: Date } => {
  try {
    const parts = rangeStr.split(' to ');
    const parseDate = (s: string) => {
      const clean = s.trim();
      const match = clean.match(/^([A-Za-z]+)\s+(\d+),\s+(\d+)$/);
      if (!match) return today();
      const [, mStr, dStr, yStr] = match;
      if (!mStr || !dStr || !yStr) return today();
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
    const s = today();
    const end = new Date(s);
    end.setHours(23, 59, 59, 999);
    return { start: s, end };
  }
};

function DateRangeField({ value, onApply }: { value: string; onApply: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'period' | 'date'>('period');
  const [gran, setGran] = useState('Day');
  const [opt, setOpt] = useState<'todate' | 'prevday' | 'prevdays' | 'range'>('range');
  const [prevDays, setPrevDays] = useState(2);
  const [rangeDays, setRangeDays] = useState(1);
  const base = today();
  const [month, setMonth] = useState(base.getMonth());
  const [day, setDay] = useState(base.getDate());
  const [year, setYear] = useState(base.getFullYear());

  const computed = (): string => {
    const thisUnit = startOfUnit(gran, base);
    if (opt === 'todate') return rangeLabel(thisUnit, base);
    if (opt === 'prevday') {
      const start = addUnits(gran, thisUnit, -1);
      return rangeLabel(start, lastDayOf(gran, start, 1));
    }
    if (opt === 'prevdays') {
      const start = addUnits(gran, thisUnit, -prevDays);
      return rangeLabel(start, lastDayOf(gran, start, prevDays));
    }
    const start = startOfUnit(gran, new Date(year, month, day));
    return rangeLabel(start, lastDayOf(gran, start, rangeDays));
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
                      {Array.from({ length: 5 }, (_, i) => base.getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
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
  /** Takings during the session: cash net of change, store credit, everything. */
  cash: number;
  storeCredit: number;
  total: number;
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
  const allSales = useCart((s) => s.sales);
  // Training-mode sales are practice runs: they never count in any report.
  const sales = useMemo(() => allSales.filter((s) => !s.training), [allSales]);
  const adjustmentReasons = useAdjustmentReasons((s) => s.reasons);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const taxes = useSettings((s) => s.taxes);
  const regStatus = useRegisterSession((s) => s.status);
  const regOpenedAt = useRegisterSession((s) => s.openedAt);
  const regOpeningFloat = useRegisterSession((s) => s.openingFloatMinor);
  const regClosureSeq = useRegisterSession((s) => s.closureSeq);
  const regMovements = useRegisterSession((s) => s.movements);
  const regClosures = useRegisterSession((s) => s.closures);
  const customers = useCustomers((s) => s.customers);
  const allProducts = useProducts((s) => s.products);
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
  const [invTab, setInvTab] = useState<'turns' | 'summary' | 'replenishment' | 'performance' | 'outofstock' | 'sellthrough' | 'dusty'>('summary');
  const [invReport, setInvReport] = useState('Product');
  const [invMeasure, setInvMeasure] = useState('Low inventory');

  // Sales report
  const [salesReport, setSalesReport] = useState('Sales summary');
  const [salesTab, setSalesTab] = useState<'summary' | 'individual' | 'hour'>('summary');
  const [salesView, setSalesView] = useState<'table' | 'chart'>('table');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [shareModal, setShareModal] = useState<{ report: string; recipients: string } | null>(null);
  const [shareError, setShareError] = useState('');
  const sharedReports = useSharedReports((s) => s.shared);
  const shareReport = useSharedReports((s) => s.share);
  const unshareReport = useSharedReports((s) => s.unshare);
  const currentUserId = useUsers((s) => s.currentUserId);
  const timeEntries = useTimeEntries((s) => s.entries);
  const stockTransactions = useInventory((s) => s.transactions);
  const [salesMeasure, setSalesMeasure] = useState('Revenue');
  const [salesComparison, setSalesComparison] = useState('No comparison');
  const [salesRange, setSalesRange] = useState(() => rangeLabel(today(), today()));

  // Payment report
  const [payReport, setPayReport] = useState('Payment type');
  const [payMeasure, setPayMeasure] = useState('Amount');
  const [payComparison, setPayComparison] = useState('No comparison');
  const [payRange, setPayRange] = useState(() => rangeLabel(new Date(today().getFullYear(), today().getMonth(), 1), today()));

  // Adjustment report
  const [adjReasons, setAdjReasons] = useState('All reasons');
  const [adjMode, setAdjMode] = useState('Include');
  const [adjFilter, setAdjFilter] = useState('');
  const [adjRange, setAdjRange] = useState(() => rangeLabel(daysAgo(30), today()));

  // Tax report
  const [taxRange, setTaxRange] = useState(() => rangeLabel(new Date(today().getFullYear(), today().getMonth(), 1), today()));
  const [taxReportType, setTaxReportType] = useState('Tax code');
  const taxParsedRange = useMemo(() => parseRange(taxRange), [taxRange]);
  const taxFiltered = useMemo(
    () => sales.filter((s) => s.status !== 'Returned' && s.at >= taxParsedRange.start.getTime() && s.at <= taxParsedRange.end.getTime()),
    [sales, taxParsedRange],
  );
  // One row per tax rate actually charged. The rate is recovered from each
  // sale's tax and taxable amounts, then named from Setup → Sales taxes.
  const taxRows = useMemo(() => {
    const rows = new Map<number, { label: string; ratePct: string; taxable: number; tax: number; count: number }>();
    for (const s of taxFiltered) {
      const tax = s.taxMinor ?? 0;
      const taxable = s.totalMinor - tax;
      const rateBps = tax > 0 && taxable > 0 ? Math.round((tax / taxable) * 10000) : 0;
      const configured = taxes.find((t) => Math.abs(t.rateBps - rateBps) <= 5);
      const key = configured?.rateBps ?? rateBps;
      const label = configured?.label ?? (rateBps === 0 ? 'No Tax (0%)' : `Sales Tax (${(rateBps / 100).toFixed(2)}%)`);
      const row = rows.get(key) ?? { label, ratePct: (key / 100).toFixed(2).replace(/\.?0+$/, ''), taxable: 0, tax: 0, count: 0 };
      row.taxable += taxable;
      row.tax += tax;
      row.count += 1;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.tax - a.tax);
  }, [taxFiltered, taxes]);
  const taxTotals = useMemo(() => taxRows.reduce((a, r) => ({ taxable: a.taxable + r.taxable, tax: a.tax + r.tax }), { taxable: 0, tax: 0 }), [taxRows]);

  // User reports
  const [userSearch, setUserSearch] = useState('');
  const [userRange, setUserRange] = useState(() => rangeLabel(daysAgo(7), today()));
  const [partnerOpen, setPartnerOpen] = useState(true);
  const [userSort, setUserSort] = useState<'asc' | 'desc'>('asc');
  const [userExpanded, setUserExpanded] = useState<string | null>(null);
  const deleteTimeEntry = useTimeEntries((s) => s.deleteEntry);

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
      const inB = sales.filter((x) => x.status !== 'Returned' && x.status !== 'Voided' && x.at >= s0 && x.at < s1);
      const rev = inB.reduce((a, x) => a + saleRevenue(x), 0);
      const items = inB.reduce((a, x) => a + x.lines.reduce((q, l) => q + l.quantity, 0), 0);
      const custs = new Set(inB.map((x) => x.customer).filter(Boolean)).size;
      const profit = inB.reduce((a, x) => a + saleRevenue(x) - saleCost(x, allProducts), 0);
      const discounted = inB.reduce((a, x) => a + (x.discountMinor ?? 0), 0);
      return { rev, count: inB.length, items, custs, profit, discounted };
    });
    const labels = starts.map((d) =>
      view === 'Month'
        ? `${MON[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`
        : `${MON[d.getMonth()]} ${d.getDate()}`,
    );
    return { buckets, labels };
  }, [sales, view, dashDate, allProducts]);

  // Date range metrics for Sales Report
  const salesParsedRange = useMemo(() => parseRange(salesRange), [salesRange]);
  const salesFiltered = useMemo(() => {
    return sales.filter((s) => s.status !== 'Returned' && s.status !== 'Voided' && s.at >= salesParsedRange.start.getTime() && s.at <= salesParsedRange.end.getTime());
  }, [sales, salesParsedRange]);

  // Revenue excludes tax; cost of goods is the supplier cost locked in on each
  // sale line (older sales fall back to the product's current supplier price).
  const salesMetrics = useMemo(() => {
    const revMinor = salesFiltered.reduce((sum, s) => sum + saleRevenue(s), 0);
    const cogsMinor = salesFiltered.reduce((sum, s) => sum + saleCost(s, allProducts), 0);
    const profitMinor = revMinor - cogsMinor;
    const margin = revMinor > 0 ? Math.round((profitMinor / revMinor) * 1000) / 10 : 0;
    const taxMinor = salesFiltered.reduce((sum, s) => sum + (s.taxMinor ?? 0), 0);

    const itemsSold = salesFiltered.reduce((sum, s) => sum + s.lines.reduce((q, l) => q + l.quantity, 0), 0);
    const withCustomer = salesFiltered.filter((s) => !!s.customer).length;
    const customerCount = new Set(salesFiltered.map((s) => s.customer).filter(Boolean)).size;
    const discounted = salesFiltered.reduce((sum, s) => sum + (s.discountMinor ?? 0), 0);
    const count = salesFiltered.length;
    // Returns are filtered out of the range, so count them from the same window.
    const inRange = sales.filter((s) => s.at >= salesParsedRange.start.getTime() && s.at <= salesParsedRange.end.getTime());
    const returnCount = inRange.filter((s) => s.status === 'Returned' || s.status === 'Partially returned').length;
    const times = salesFiltered.map((s) => s.at).sort((a, b) => a - b);

    return {
      revenue: revMinor,
      revenueInclTax: revMinor + taxMinor,
      cogs: cogsMinor,
      profit: profitMinor,
      margin,
      tax: taxMinor,
      count,
      itemsSold,
      withCustomer,
      customerCount,
      discounted,
      returnCount,
      returnsPct: inRange.length > 0 ? Math.round((returnCount / inRange.length) * 1000) / 10 : 0,
      withCustomerPct: count > 0 ? Math.round((withCustomer / count) * 1000) / 10 : 0,
      discountedPct: revMinor + discounted > 0 ? Math.round((discounted / (revMinor + discounted)) * 1000) / 10 : 0,
      avgSale: count > 0 ? Math.round(revMinor / count) : 0,
      avgSaleInclTax: count > 0 ? Math.round((revMinor + taxMinor) / count) : 0,
      avgItems: count > 0 ? Math.round((itemsSold / count) * 100) / 100 : 0,
      firstSale: times[0],
      lastSale: times[times.length - 1],
    };
  }, [salesFiltered, allProducts, sales, salesParsedRange]);

  // Sales by product / by outlet for the report type selector.
  const salesByProduct = useMemo(() => {
    const m = new Map<string, { rev: number; qty: number; cogs: number; tax: number }>();
    for (const sale of salesFiltered) {
      const gross = sale.lines.reduce((a, l) => a + l.unitPriceMinor * l.quantity, 0);
      for (const l of sale.lines) {
        const value = l.unitPriceMinor * l.quantity * (1 - (l.discountPct ?? 0) / 100);
        const share = gross > 0 ? value / gross : 0;
        const cur = m.get(l.name) ?? { rev: 0, qty: 0, cogs: 0, tax: 0 };
        cur.rev += Math.round(saleRevenue(sale) * share);
        cur.qty += l.quantity;
        cur.cogs += (l.costMinor ?? allProducts.find((p) => p.id === l.variantId)?.supplierPriceMinor ?? 0) * l.quantity;
        cur.tax += Math.round((sale.taxMinor ?? 0) * share);
        m.set(l.name, cur);
      }
    }
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev);
  }, [salesFiltered, allProducts]);
  const salesByOutlet = useMemo(() => [{ name: outlet === 'All outlets' ? 'Main Outlet' : outlet, ...salesMetrics, count: salesFiltered.length }], [outlet, salesMetrics, salesFiltered.length]);

  // Individual performance: what each staff member sold in the range.
  const salesByUser = useMemo(() => {
    const m = new Map<string, { rev: number; count: number; items: number; profit: number }>();
    for (const s of salesFiltered) {
      const key = s.soldBy ?? 'Staff';
      const cur = m.get(key) ?? { rev: 0, count: 0, items: 0, profit: 0 };
      cur.rev += saleRevenue(s);
      cur.count += 1;
      cur.items += s.lines.reduce((a, l) => a + l.quantity, 0);
      cur.profit += saleRevenue(s) - saleCost(s, allProducts);
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev);
  }, [salesFiltered, allProducts]);
  // Sales by hour of day across the range.
  const salesByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, rev: 0, count: 0, items: 0 }));
    for (const s of salesFiltered) {
      const b = hours[new Date(s.at).getHours()];
      if (!b) continue;
      b.rev += saleRevenue(s);
      b.count += 1;
      b.items += s.lines.reduce((a, l) => a + l.quantity, 0);
    }
    return hours;
  }, [salesFiltered]);
  // Revenue per day across the range, for the chart view.
  const salesByDay = useMemo(() => {
    const days: { label: string; rev: number; value: number }[] = [];
    const d = new Date(salesParsedRange.start);
    d.setHours(0, 0, 0, 0);
    const end = salesParsedRange.end.getTime();
    let guard = 0;
    while (d.getTime() <= end && guard < 92) {
      const s0 = d.getTime();
      const s1 = s0 + DAY_MS;
      const inD = salesFiltered.filter((s) => s.at >= s0 && s.at < s1);
      const allD = sales.filter((s) => s.at >= s0 && s.at < s1);
      const rev = inD.reduce((a, s) => a + saleRevenue(s), 0);
      const tax = inD.reduce((a, s) => a + (s.taxMinor ?? 0), 0);
      const cogs = inD.reduce((a, s) => a + saleCost(s, allProducts), 0);
      const items = inD.reduce((a, s) => a + s.lines.reduce((q, l) => q + l.quantity, 0), 0);
      const disc = inD.reduce((a, s) => a + (s.discountMinor ?? 0), 0);
      const withCust = inD.filter((s) => !!s.customer).length;
      const n = inD.length;
      days.push({
        label: `${MON[d.getMonth()]} ${d.getDate()}`,
        rev,
        value: measureOf(salesMeasure, {
          rev, tax, cogs, items, disc, withCust, count: n,
          customers: new Set(inD.map((s) => s.customer).filter(Boolean)).size,
          returns: allD.filter((s) => s.status === 'Returned' || s.status === 'Partially returned').length,
          all: allD.length,
        }),
      });
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return days;
  }, [salesFiltered, sales, salesParsedRange, allProducts, salesMeasure]);
  const shareNow = () => {
    if (!shareModal) return;
    const recipients = shareModal.recipients.split(/[,;\s]+/).map((r) => r.trim()).filter(Boolean);
    if (!recipients.length || recipients.some((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))) return setShareError('Enter one or more valid email addresses.');
    shareReport(shareModal.report, staffUsers.find((u) => u.id === currentUserId)?.name ?? 'You', recipients);
    setShareModal(null);
    setShareError('');
  };

  const dayHeaderLabel = useMemo(() => {
    const startDay = salesParsedRange.start;
    const dayName = startDay.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Fri"
    return `${startDay.getDate()} ${dayName}`;
  }, [salesParsedRange]);

  // Date range metrics for Payment Report
  const payParsedRange = useMemo(() => parseRange(payRange), [payRange]);
  const payFiltered = useMemo(() => {
    return sales.filter((s) => s.status !== 'Returned' && s.at >= payParsedRange.start.getTime() && s.at <= payParsedRange.end.getTime());
  }, [sales, payParsedRange]);

  // One row per payment type (Setup → Payment types), plus anything older
  // sales were paid with that's no longer configured. Cash is net of change.
  const payMetrics = useMemo(() => {
    const amount = new Map<string, number>();
    const count = new Map<string, number>();
    for (const s of payFiltered) {
      for (const t of s.tenders) {
        amount.set(t.method, (amount.get(t.method) ?? 0) + t.amountMinor);
        count.set(t.method, (count.get(t.method) ?? 0) + 1);
      }
      if (s.changeMinor) amount.set('CASH', (amount.get('CASH') ?? 0) - s.changeMinor);
    }
    const methods = [...paymentTypes.map(methodOf), ...[...amount.keys()].filter((m) => !paymentTypes.some((t) => methodOf(t) === m))];
    const rows = methods.map((m) => ({ method: m, label: tenderLabel(m, paymentTypes), amount: amount.get(m) ?? 0, count: count.get(m) ?? 0 }));
    return { rows, total: rows.reduce((a, r) => a + r.amount, 0), totalCount: rows.reduce((a, r) => a + r.count, 0) };
  }, [payFiltered, paymentTypes]);

  // Inventory report covers the current calendar month to date.
  const invRange = useMemo(() => {
    const t = today();
    return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: t };
  }, []);
  const invFiltered = useMemo(() => {
    const start = invRange.start.getTime();
    const end = new Date(invRange.end.getFullYear(), invRange.end.getMonth(), invRange.end.getDate(), 23, 59, 59, 999).getTime();
    return sales.filter((s) => s.status !== 'Returned' && s.at >= start && s.at <= end);
  }, [sales, invRange]);

  const invProducts = useProducts((s) => s.products);
  // Sale lines carry the product name; look the product up for its icon/SKU.
  const catByName = useMemo(() => new Map(invProducts.map((p) => [p.name, p])), [invProducts]);
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
      const closing = p.available;
      const cost = (p.supplierPriceMinor ?? 0) * closing;
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

  // The other inventory report tabs, all from the same month-to-date sales.
  const invExtra = useMemo(() => {
    const soldQty = new Map<string, number>();
    const soldRev = new Map<string, number>();
    const soldCost = new Map<string, number>();
    const lastSold = new Map<string, number>();
    for (const s of sales) {
      if (s.status === 'Returned' || s.status === 'Voided' || s.training) continue;
      for (const l of s.lines) {
        // Older sale lines may lack the product id; match them by name.
        const vid = l.variantId ?? invProducts.find((p) => p.name === l.name)?.id;
        if (!vid) continue;
        lastSold.set(vid, Math.max(lastSold.get(vid) ?? 0, s.at));
        if (!invFiltered.includes(s)) continue;
        soldQty.set(vid, (soldQty.get(vid) ?? 0) + l.quantity);
        soldRev.set(vid, (soldRev.get(vid) ?? 0) + l.unitPriceMinor * l.quantity * (1 - (l.discountPct ?? 0) / 100));
        soldCost.set(vid, (soldCost.get(vid) ?? 0) + (l.costMinor ?? invProducts.find((p) => p.id === vid)?.supplierPriceMinor ?? 0) * l.quantity);
      }
    }
    const rows = invProducts.filter((p) => p.enabled).map((p) => {
      const qty = soldQty.get(p.id) ?? 0;
      const rev = Math.round(soldRev.get(p.id) ?? 0);
      const cogs = soldCost.get(p.id) ?? 0;
      const stockValue = (p.supplierPriceMinor ?? 0) * p.available;
      const reorderAt = p.replenishMethod === 'reorder' ? p.reorderPoint : p.minQty;
      const reorderQty = p.replenishMethod === 'reorder' ? p.reorderQty : p.maxQty != null ? Math.max(0, p.maxQty - p.available) : null;
      const onOrder = stockTransactions.filter((t) => t.kind === 'order' && (t.status === 'Open' || t.status === 'Sent' || t.status === 'Dispatched')).reduce((a, t) => a + t.lines.filter((l) => l.productId === p.id).reduce((q, l) => q + l.quantity, 0), 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        emoji: p.emoji,
        supplier: p.supplier,
        stock: p.available,
        qty,
        rev,
        cogs,
        profit: rev - cogs,
        margin: rev > 0 ? Math.round(((rev - cogs) / rev) * 1000) / 10 : 0,
        stockValue,
        turns: stockValue > 0 ? Math.round((cogs / stockValue) * 100) / 100 : qty > 0 ? Infinity : 0,
        sellThrough: qty + p.available > 0 ? Math.round((qty / (qty + p.available)) * 1000) / 10 : 0,
        reorderAt: reorderAt ?? null,
        reorderQty: reorderQty ?? null,
        onOrder,
        lastSold: lastSold.get(p.id) ?? null,
        low: p.trackInventory !== false && reorderAt != null && p.available <= reorderAt,
      };
    });
    const ninetyDays = Date.now() - 90 * DAY_MS;
    return {
      turns: [...rows].sort((a, b) => b.turns - a.turns),
      replenishment: rows.filter((r) => r.low).sort((a, b) => a.stock - b.stock),
      performance: [...rows].sort((a, b) => b.rev - a.rev),
      outOfStock: rows.filter((r) => r.stock <= 0).sort((a, b) => (b.lastSold ?? 0) - (a.lastSold ?? 0)),
      sellThrough: [...rows].sort((a, b) => b.sellThrough - a.sellThrough),
      dusty: rows.filter((r) => r.stock > 0 && (r.lastSold === null || r.lastSold < ninetyDays)).sort((a, b) => b.stockValue - a.stockValue),
    };
  }, [sales, invFiltered, invProducts, stockTransactions]);

  const money = (minor: number) => (minor === 0 ? '$0' : fmt(minor));
  const bs = dash.buckets;
  const curB = bs[bs.length - 1] ?? { rev: 0, count: 0, items: 0, custs: 0, profit: 0, discounted: 0 };
  const trim = (v: number) => String(Math.round(v * 100) / 100);
  const kpis = [
    { label: 'Revenue', value: money(curB.rev), series: bs.map((b) => b.rev / 100), fmtY: kMoney },
    { label: 'Sale count', value: String(curB.count), series: bs.map((b) => b.count), fmtY: String },
    { label: 'Customer count', value: curB.custs > 0 ? String(curB.custs) : '-', series: bs.map((b) => b.custs), fmtY: trim },
    { label: 'Gross profit', value: money(curB.profit), series: bs.map((b) => b.profit / 100), fmtY: kMoney },
    { label: 'Discounted', value: money(curB.discounted), series: bs.map((b) => b.discounted / 100), fmtY: kMoney },
    { label: 'Discounted %', value: `${(curB.rev + curB.discounted > 0 ? (curB.discounted / (curB.rev + curB.discounted)) * 100 : 0).toFixed(2)}%`, series: bs.map((b) => (b.rev + b.discounted > 0 ? (b.discounted / (b.rev + b.discounted)) * 100 : 0)), fmtY: trim },
    { label: 'Avg. sale value', value: money(curB.count ? Math.round(curB.rev / curB.count) : 0), series: bs.map((b) => (b.count ? b.rev / b.count / 100 : 0)), fmtY: trim },
    { label: 'Avg. items per sale', value: curB.count ? trim(curB.items / curB.count) : '0', series: bs.map((b) => (b.count ? b.items / b.count : 0)), fmtY: trim },
  ].map((k) => ({ ...k, yTicks: niceTicks(Math.max(...k.series)) }));

  // Register closures: real history from the register session store, with the
  // currently open session shown as a "Still open" row on top.
  const closureRows = useMemo<ClosureRow[]>(() => {
    const takings = (from: number, to: number | null) => {
      const inS = sales.filter((x) => !x.training && x.status !== 'Voided' && x.at >= from && x.at <= (to ?? Number.MAX_SAFE_INTEGER));
      let cash = 0;
      let storeCredit = 0;
      let total = 0;
      for (const x of inS) {
        for (const t of x.tenders) {
          if (isCash(t.method)) cash += t.amountMinor;
          if (t.method === STORE_CREDIT) storeCredit += t.amountMinor;
        }
        cash -= x.changeMinor;
        total += x.tenders.reduce((a, t) => a + t.amountMinor, 0) - x.changeMinor;
      }
      return { cash, storeCredit, total };
    };
    const rows: ClosureRow[] = regClosures.map((c) => ({
      num: c.number,
      opened: c.openedAt,
      closed: c.closedAt,
      openingFloat: c.openingFloatMinor,
      expected: c.expectedMinor,
      counted: c.countedMinor,
      variance: c.varianceMinor,
      open: false,
      ...takings(c.openedAt, c.closedAt),
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
        ...takings(regOpenedAt, null),
      });
    return rows;
  }, [regClosures, regStatus, regOpenedAt, regClosureSeq, regOpeningFloat, sales]);

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
      ['Register', '#', 'Time Opened', 'Time Closed', 'Opening Float', 'Cash', 'Store Credit', 'Total', 'Expected', 'Counted', 'Variance'],
      ...closureRows.map((r) => [
        'Main Register',
        String(r.num),
        `"${fmtDateTime(new Date(r.opened))}"`,
        r.open ? 'Still open' : `"${fmtDateTime(new Date(r.closed!))}"`,
        (r.openingFloat / 100).toFixed(2),
        (r.cash / 100).toFixed(2),
        (r.storeCredit / 100).toFixed(2),
        (r.total / 100).toFixed(2),
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
  const giftCards = useGiftCards((s) => s.cards);
  const gcFiltered = giftCards.filter((c) => gcQuery.trim() === '' || c.number.includes(gcQuery.replace(/[\s-]/g, '')));
  const gcSold = giftCards.reduce((a, c) => a + c.initialMinor, 0);
  const gcRedeemed = giftCards.reduce((a, c) => a + (c.initialMinor - c.balanceMinor), 0);
  const gcOutstanding = giftCards.filter((c) => c.status === 'Active').reduce((a, c) => a + c.balanceMinor, 0);
  const gcCount = giftCards.filter((c) => c.status === 'Active').length;

  // Store credit: outstanding balances held by customers.
  const creditCustomers = customers.filter((c) => c.storeCreditMinor > 0);
  const creditTotal = customers.reduce((a, c) => a + c.storeCreditMinor, 0);

  // Sales that fall inside the selected dashboard period (Day/Week/Month at the
  // chosen date), excluding returned sales. The "Products sold" and "Top sales
  // people" tables below reflect this window — not the entire sales history.
  const periodSales = useMemo(() => {
    const s0 = (() => {
      const d = new Date(dashDate);
      d.setHours(0, 0, 0, 0);
      if (view === 'Week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      else if (view === 'Month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return d.getTime();
    })();
    const s1 =
      view === 'Day' ? s0 + DAY_MS
      : view === 'Week' ? s0 + 7 * DAY_MS
      : new Date(new Date(s0).getFullYear(), new Date(s0).getMonth() + 1, 1).getTime();
    return sales.filter((s) => s.status !== 'Returned' && s.status !== 'Voided' && s.at >= s0 && s.at < s1);
  }, [sales, view, dashDate]);

  // Top sales people for the selected period, grouped by who rang them up.
  const salesPeople = useMemo(() => {
    const m = new Map<string, { rev: number; count: number; items: number }>();
    for (const s of periodSales) {
      const key = s.soldBy ?? 'Staff';
      const cur = m.get(key) ?? { rev: 0, count: 0, items: 0 };
      cur.rev += saleRevenue(s);
      cur.count += 1;
      cur.items += s.lines.reduce((a, l) => a + l.quantity, 0);
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev);
  }, [periodSales]);

  // Per-product daily quantity over the last 7 days (for the Trend sparkline).
  const trendMap = useMemo(() => {
    const t0 = startOfDay(Date.now());
    const m = new Map<string, number[]>();
    for (const sale of sales) {
      if (sale.status === 'Returned') continue;
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

  // Per product: units, revenue and how much discount they carried (their own
  // line discount plus a share of any sale-wide discount).
  const topMap = new Map<string, { qty: number; rev: number; disc: number }>();
  for (const sale of periodSales) {
    const gross = sale.lines.reduce((a, l) => a + l.unitPriceMinor * l.quantity, 0);
    const lineDiscs = sale.lines.map((l) => Math.round(l.unitPriceMinor * l.quantity * ((l.discountPct ?? 0) / 100)));
    const orderDisc = Math.max(0, (sale.discountMinor ?? 0) - lineDiscs.reduce((a, d) => a + d, 0));
    sale.lines.forEach((l, i) => {
      const value = l.unitPriceMinor * l.quantity;
      const disc = (lineDiscs[i] ?? 0) + (gross > 0 ? Math.round((orderDisc * value) / gross) : 0);
      const cur = topMap.get(l.name) ?? { qty: 0, rev: 0, disc: 0 };
      topMap.set(l.name, { qty: cur.qty + l.quantity, rev: cur.rev + value - disc, disc: cur.disc + disc });
    });
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
                  <div className="rc-head rc-real rc-7">
                    <span>Register</span><span className="r">#</span><span>Time Opened</span><span>Time Closed ▾</span>
                    <span className="r">Cash</span><span className="r">Store Credit</span><span className="r">Total</span>
                  </div>
                  {pageRows.map((r, i) => (
                    <div key={`${r.num}-${r.opened}`} className={`rc-row rc-real rc-7 ${i % 2 ? 'alt' : ''}`} title={r.open ? '' : `Opening float ${fmt(r.openingFloat)} · expected ${r.expected === null ? '-' : fmt(r.expected)} · counted ${r.counted === null ? '-' : fmt(r.counted)} · variance ${r.variance === null ? '-' : fmt(r.variance)}`}>
                      <span className="rc-reg">Main Register</span>
                      <span className="r">{r.num}</span>
                      <span>{fmtDateTime(new Date(r.opened))}</span>
                      <span className={r.open ? 'rc-open' : ''}>{r.open ? 'Still open' : fmtDateTime(new Date(r.closed!))}</span>
                      <span className="r">{r.open ? '-' : (r.cash / 100).toFixed(2)}</span>
                      <span className="r">{r.open ? '-' : (r.storeCredit / 100).toFixed(2)}</span>
                      <span className="r">{(r.total / 100).toFixed(2)}</span>
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
                <div className="gc-stat"><span>Total value redeemed</span><b>{fmt(gcRedeemed)}</b></div>
                <div className="gc-stat"><span>Outstanding balance</span><b>{fmt(gcOutstanding)}</b></div>
                <div className="gc-stat"><span>Gift cards in circulation</span><b>{gcCount}</b></div>
              </div>
              <div className="rep-toolbar">
                <span>Showing {gcFiltered.length} gift card{gcFiltered.length === 1 ? '' : 's'}</span>
                <span
                  className="rlink"
                  onClick={() =>
                    downloadCSV('gift-cards.csv', [
                      ['Gift card', 'Sale', 'Status', 'Total sold', 'Total redeemed', 'Balance'],
                      ...gcFiltered.map((c) => [c.number, c.saleOrderNumber, c.status, (c.initialMinor / 100).toFixed(2), ((c.initialMinor - c.balanceMinor) / 100).toFixed(2), (c.balanceMinor / 100).toFixed(2)]),
                    ])
                  }
                >
                  ⤓ Export report
                </span>
              </div>
              <div className="gc-table">
                <div className="gc-head"><span>Gift card number</span><span className="r">Total sold</span><span className="r">Total redeemed</span><span className="r">Balance</span></div>
                <div className="gc-body">
                  {gcLoading ? (
                    <div className="spinner" />
                  ) : gcFiltered.length === 0 ? (
                    <div className="cm-empty">No gift cards found for this period</div>
                  ) : (
                    gcFiltered.map((c) => (
                      <div key={c.id} className="gc-row">
                        <span>
                          ••••{c.number.slice(-4)} <span className="prod-sku">{c.saleOrderNumber ? `Sale ${c.saleOrderNumber} · ` : ''}{fmtDateTime(new Date(c.createdAt))} · {c.status}</span>
                        </span>
                        <span className="r">{fmt(c.initialMinor)}</span>
                        <span className="r">{fmt(c.initialMinor - c.balanceMinor)}</span>
                        <span className="r">{fmt(c.balanceMinor)}</span>
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
                {(
                  [
                    ['turns', 'Inventory turns'],
                    ['summary', 'Summary'],
                    ['replenishment', 'Replenishment'],
                    ['performance', 'Performance'],
                    ['outofstock', 'Recently out of stock'],
                    ['sellthrough', 'Sell through'],
                    ['dusty', 'Dusty inventory'],
                  ] as [typeof invTab, string][]
                ).map(([k, label]) => (
                  <button key={k} className={`sh-tab ${invTab === k ? 'active' : ''}`} onClick={() => setInvTab(k)}>{label}</button>
                ))}
              </div>
              <div className="rep-band"><span>Track inventory performance and make smarter buying decisions. <span className="rlink">Need help?</span></span></div>
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
                      <label>Date range</label>
                      <div className="rep-daterange">📅 {rangeLabel(invRange.start, invRange.end)}</div>
                    </div>
                    <div className="rep-fg">
                      <label>Primary measure</label>
                      <select value={invMeasure} onChange={(e) => setInvMeasure(e.target.value)}>
                        <option>Low inventory</option>
                        <option>Closing inventory</option>
                        <option>Revenue</option>
                      </select>
                    </div>
                    <div className="rep-fg rep-fg-btn">
                      <span className="rlink">More filters</span>
                      <button className="btn-p">Search</button>
                    </div>
                  </div>
                  <div className="rep-toolbar">
                    <span className="rlink">⇄ Format results</span>
                    <span className="rlink" onClick={() => downloadCSV('inventory-report.csv', [['Product', 'Closing inventory', 'Revenue', 'Inventory cost'], ...invMetrics.list.map((item) => [item.name, String(item.closing), fmt(item.revenue), fmt(item.cost)])])}>⤓ Export report...</span>
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
                (() => {
                  const cols: Record<Exclude<typeof invTab, 'summary'>, { hint: string; head: string[]; rows: (typeof invExtra.turns) ; cells: (r: (typeof invExtra.turns)[number]) => (string | number)[]; empty: string }> = {
                    turns: { hint: 'How many times each product’s stock has sold through this month: cost of goods sold ÷ value of stock on hand.', head: ['Cost of goods sold', 'Inventory value', 'Turns'], rows: invExtra.turns, cells: (r) => [fmt(r.cogs), fmt(r.stockValue), r.turns === Infinity ? '∞' : r.turns], empty: 'No products to report on.' },
                    replenishment: { hint: 'Products at or below their reorder point. Order them from Inventory → Stock control.', head: ['Stock on hand', 'Reorder point', 'Reorder quantity', 'On order'], rows: invExtra.replenishment, cells: (r) => [r.stock, r.reorderAt ?? '—', r.reorderQty ?? '—', r.onOrder], empty: 'Nothing needs reordering — every tracked product is above its reorder point.' },
                    performance: { hint: 'Revenue, gross profit and margin per product this month.', head: ['Items sold', 'Revenue', 'Gross profit', 'Margin'], rows: invExtra.performance, cells: (r) => [r.qty, fmt(r.rev), fmt(r.profit), `${r.margin}%`], empty: 'No products to report on.' },
                    outofstock: { hint: 'Active products with no stock on hand, most recently sold first.', head: ['Stock on hand', 'Last sold', 'Sold this month', 'On order'], rows: invExtra.outOfStock, cells: (r) => [r.stock, r.lastSold ? new Date(r.lastSold).toLocaleDateString() : 'Never', r.qty, r.onOrder], empty: 'Nothing is out of stock.' },
                    sellthrough: { hint: 'Units sold this month as a share of units sold plus units still on hand.', head: ['Sold this month', 'Stock on hand', 'Sell through'], rows: invExtra.sellThrough, cells: (r) => [r.qty, r.stock, `${r.sellThrough}%`], empty: 'No products to report on.' },
                    dusty: { hint: 'Stock that hasn’t sold in the last 90 days, by value tied up.', head: ['Stock on hand', 'Inventory value', 'Last sold'], rows: invExtra.dusty, cells: (r) => [r.stock, fmt(r.stockValue), r.lastSold ? new Date(r.lastSold).toLocaleDateString() : 'Never'], empty: 'No dusty inventory — everything in stock has sold recently.' },
                  };
                  const c = cols[invTab as Exclude<typeof invTab, 'summary'>];
                  return (
                    <>
                      <div className="rep-toolbar">
                        <span className="rep-hint">{c.hint}</span>
                        <span className="rlink" onClick={() => downloadCSV(`inventory-${invTab}.csv`, [['Product', 'SKU', ...c.head], ...c.rows.map((r) => [r.name, r.sku, ...c.cells(r).map(String)])])}>⤓ Export report…</span>
                      </div>
                      <div className="ir-table">
                        <div className={`ir-head ir-cols-${c.head.length + 1}`}>
                          <span className="cth-s"><span className="cth-label">Product</span></span>
                          {c.head.map((h) => <span key={h} className="r">{h}</span>)}
                        </div>
                        {c.rows.length === 0 ? (
                          <div className="rep-empty">{c.empty}</div>
                        ) : (
                          c.rows.map((r) => (
                            <div key={r.id} className={`ir-row ir-cols-${c.head.length + 1}`}>
                              <span className="ir-name">
                                <span className="rt-thumb">{r.emoji}</span>
                                <span><span className="rlink">{r.name}</span><br /><span className="prod-sku">{r.sku}{r.supplier ? ` · ${r.supplier}` : ''}</span></span>
                              </span>
                              {c.cells(r).map((v, i) => <span key={i} className="r">{v}</span>)}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()
              )}
            </>
          ) : active === 'sales' ? (
            <>
              <h1 className="page-title">Sales report</h1>
              <div className="sh-tabs">
                <button className={`sh-tab ${salesTab === 'summary' ? 'active' : ''}`} onClick={() => setSalesTab('summary')}>Summary</button>
                <button className={`sh-tab ${salesTab === 'individual' ? 'active' : ''}`} onClick={() => setSalesTab('individual')}>Individual performance</button>
                <button className={`sh-tab ${salesTab === 'hour' ? 'active' : ''}`} onClick={() => setSalesTab('hour')}>Sales by hour of day</button>
              </div>
              <div className="rep-band"><span>Get an overview of how your sales are performing.</span></div>
              <div className="rep-filter">
                {salesTab === 'summary' && (
                  <>
                    <div className="rep-fg">
                      <label>Report type</label>
                      <select value={salesReport} onChange={(e) => setSalesReport(e.target.value)}>
                        <option>Sales summary</option><option>Sales by product</option><option>Sales by outlet</option>
                      </select>
                    </div>
                    <div className="rep-fg">
                      <label>Measure</label>
                      <select value={salesMeasure} onChange={(e) => setSalesMeasure(e.target.value)}>
                        {MEASURES.map((m) => <option key={m.label}>{m.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="rep-fg">
                  <label>Date range</label>
                  <DateRangeField value={salesRange} onApply={setSalesRange} />
                </div>
                {salesTab === 'summary' && (
                  <div className="rep-fg">
                    <label>Comparison</label>
                    <select value={salesComparison} onChange={(e) => setSalesComparison(e.target.value)}>
                      <option>No comparison</option><option>Previous period</option><option>Previous year</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="dash-morefilters"><span className="rlink">More filters</span></div>
              <div className="rep-toolbar">
                <span className="rep-actions-wrap">
                  <span className="rlink" onClick={() => setActionsOpen((o) => !o)}>Actions… ▾</span>
                  {actionsOpen && (
                    <span className="rep-actions-menu" onMouseLeave={() => setActionsOpen(false)}>
                      <button onClick={() => { setActionsOpen(false); downloadCSV('sales-report.csv', salesTab === 'summary' ? [['Sales summary', 'Revenue', 'Cost of goods sold', 'Gross profit', 'Margin (%)', 'Tax'], ['Totals', fmt(salesMetrics.revenue), fmt(salesMetrics.cogs), fmt(salesMetrics.profit), `${salesMetrics.margin}%`, fmt(salesMetrics.tax)]] : salesTab === 'individual' ? [['User', 'Revenue', 'Sale count', 'Items sold', 'Avg. sale value', 'Gross profit'], ...salesByUser.map(([u, v]) => [u, fmt(v.rev), String(v.count), String(v.items), fmt(v.count ? Math.round(v.rev / v.count) : 0), fmt(v.profit)])] : [['Hour', 'Revenue', 'Sale count', 'Items sold'], ...salesByHour.map((h) => [`${h.hour}:00`, fmt(h.rev), String(h.count), String(h.items)])]); }}>Export CSV</button>
                      <button onClick={() => { setActionsOpen(false); window.print(); }}>Print</button>
                      <button onClick={() => { setActionsOpen(false); setShareModal({ report: 'Sales report', recipients: '' }); }}>Share report</button>
                    </span>
                  )}
                </span>
                <span className="pe-seg" role="group" aria-label="View">
                  <button type="button" className={salesView === 'table' ? 'active' : ''} onClick={() => setSalesView('table')}>Table</button>
                  <button type="button" className={salesView === 'chart' ? 'active' : ''} onClick={() => setSalesView('chart')}>Chart</button>
                </span>
              </div>
              <div className="rep-toolbar">
                <span className="rep-actions-wrap">
                  <span className="rlink" onClick={() => setFormatOpen((o) => !o)}>⇄ Format results</span>
                  {formatOpen && (
                    <span className="rep-actions-menu rep-format" onMouseLeave={() => setFormatOpen(false)}>
                      {(['Cost of goods sold', 'Gross profit', 'Margin (%)', 'Tax'] as const).map((c) => (
                        <label key={c} className="pe-check" style={{ margin: '4px 12px' }}>
                          <input type="checkbox" checked={!hiddenCols.includes(c)} onChange={() => setHiddenCols((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
                          <span>{c}</span>
                        </label>
                      ))}
                    </span>
                  )}
                </span>
                <span className="rlink" onClick={() => downloadCSV('sales-report.csv', [['Sales summary', 'Revenue', 'Cost of goods sold', 'Gross profit', 'Margin (%)', 'Tax'], ['Totals', fmt(salesMetrics.revenue), fmt(salesMetrics.cogs), fmt(salesMetrics.profit), `${salesMetrics.margin}%`, fmt(salesMetrics.tax)]])}>⤓ Export report...</span>
              </div>
              {salesView === 'chart' ? (
                <div className="rep-table wide">
                  <div className="rep-table-h">{salesMeasure} by day</div>
                  {measureKind(salesMeasure) === 'time' ? (
                    <div className="rep-empty">
                      {salesMeasure === 'First sale'
                        ? salesMetrics.firstSale ? `First sale in this period: ${new Date(salesMetrics.firstSale).toLocaleString()}` : 'No sales in this period.'
                        : salesMetrics.lastSale ? `Last sale in this period: ${new Date(salesMetrics.lastSale).toLocaleString()}` : 'No sales in this period.'}
                    </div>
                  ) : salesByDay.every((d) => d.value === 0) ? (
                    <div className="rep-empty">No data available for this period.</div>
                  ) : (
                    <div className="rep-bars">
                      {salesByDay.map((d) => {
                        const max = Math.max(...salesByDay.map((x) => x.value), 1);
                        return (
                          <div key={d.label} className="rep-bar-col" title={`${d.label}: ${measureText(salesMeasure, d.value)}`}>
                            <div className="rep-bar" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
                            <span className="rep-bar-l">{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : salesTab === 'summary' && salesReport !== 'Sales summary' ? (
                <div className="rep-table wide">
                  <div className="rep-table-h">{salesReport}</div>
                  <div className="tsp-head">
                    <span>{salesReport === 'Sales by product' ? 'Product' : 'Outlet'}</span>
                    <span className="r">Revenue</span>
                    <span className="r">{salesReport === 'Sales by product' ? 'Items sold' : 'Sale count'}</span>
                    <span className="r">Cost of goods sold</span>
                    <span className="r">Gross profit</span>
                    <span className="r">Tax</span>
                  </div>
                  {salesReport === 'Sales by product' ? (
                    salesByProduct.length === 0 ? (
                      <div className="rep-empty">No data available for this period.</div>
                    ) : (
                      salesByProduct.map(([name, v]) => (
                        <div key={name} className="tsp-row">
                          <span className="rlink">{name}</span>
                          <span className="r">{fmt(v.rev)}</span>
                          <span className="r">{v.qty}</span>
                          <span className="r">{fmt(v.cogs)}</span>
                          <span className="r">{fmt(v.rev - v.cogs)}</span>
                          <span className="r">{fmt(v.tax)}</span>
                        </div>
                      ))
                    )
                  ) : (
                    salesByOutlet.map((o) => (
                      <div key={o.name} className="tsp-row">
                        <span className="rlink">{o.name}</span>
                        <span className="r">{fmt(o.revenue)}</span>
                        <span className="r">{o.count}</span>
                        <span className="r">{fmt(o.cogs)}</span>
                        <span className="r">{fmt(o.profit)}</span>
                        <span className="r">{fmt(o.tax)}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : salesTab === 'summary' ? (
                <div className="sr-table">
                  <div className="sr-grouphead"><span /><span className="rpt-year">{salesParsedRange.start.getFullYear()}</span><span className="rpt-total">TOTAL</span></div>
                  <div className="sr-head">
                    <span>Sales summary</span>
                    <span className="r">{dayHeaderLabel}</span>
                    <span className="r ps-sortable">Revenue <SortGlyph /></span>
                    <span className="r ps-sortable">{hiddenCols.includes('Cost of goods sold') ? '' : <>Cost of goods sold <SortGlyph /></>}</span>
                    <span className="r ps-sortable">{hiddenCols.includes('Gross profit') ? '' : <>Gross profit <SortGlyph /></>}</span>
                    <span className="r ps-sortable">{hiddenCols.includes('Margin (%)') ? '' : <>Margin (%) <SortGlyph /></>}</span>
                    <span className="r ps-sortable">{hiddenCols.includes('Tax') ? '' : <>Tax <SortGlyph /></>}</span>
                  </div>
                  <div className="sr-row totals">
                    <span>Totals</span>
                    <span className="r">{fmt(salesMetrics.revenue)}</span>
                    <span className="r">{fmt(salesMetrics.revenue)}</span>
                    <span className="r">{hiddenCols.includes('Cost of goods sold') ? '' : fmt(salesMetrics.cogs)}</span>
                    <span className="r">{hiddenCols.includes('Gross profit') ? '' : fmt(salesMetrics.profit)}</span>
                    <span className="r">{hiddenCols.includes('Margin (%)') ? '' : `${salesMetrics.margin}%`}</span>
                    <span className="r">{hiddenCols.includes('Tax') ? '' : fmt(salesMetrics.tax)}</span>
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
              ) : salesTab === 'individual' ? (
                <div className="rep-table wide">
                  <div className="rep-table-h">Individual performance</div>
                  <div className="tsp-head">
                    <span>User</span>
                    <span className="r">Revenue</span>
                    <span className="r">Sale count</span>
                    <span className="r">Items sold</span>
                    <span className="r">Avg. sale value</span>
                    <span className="r">Gross profit</span>
                  </div>
                  {salesByUser.length === 0 ? (
                    <div className="rep-empty">No data available for this period.</div>
                  ) : (
                    salesByUser.map(([name, v]) => (
                      <div key={name} className="tsp-row">
                        <span className="rlink">{name}</span>
                        <span className="r">{fmt(v.rev)}</span>
                        <span className="r">{v.count}</span>
                        <span className="r">{v.items}</span>
                        <span className="r">{fmt(v.count ? Math.round(v.rev / v.count) : 0)}</span>
                        <span className="r">{fmt(v.profit)}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="rep-table wide">
                  <div className="rep-table-h">Sales by hour of day</div>
                  <div className="cm-head"><span>Hour</span><span>Revenue</span><span>Sale count</span><span>Items sold</span></div>
                  {salesByHour.every((h) => h.count === 0) ? (
                    <div className="rep-empty">No data available for this period.</div>
                  ) : (
                    salesByHour.filter((h) => h.count > 0 || (h.hour >= 7 && h.hour <= 21)).map((h) => (
                      <div key={h.hour} className="cm-row">
                        <span>{h.hour % 12 || 12}{h.hour >= 12 ? ' PM' : ' AM'}</span>
                        <span>{fmt(h.rev)}</span>
                        <span>{h.count}</span>
                        <span>{h.items}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : active === 'payment' ? (
            <>
              <h1 className="page-title">Payment report</h1>
              <div className="rep-band"><span>Get an overview of your payment reports.</span></div>
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
                <span className="rlink" onClick={() => downloadCSV('payment-report.csv', [['Payment type', MON[payParsedRange.start.getMonth()] ?? '', payMeasure], ...payMetrics.rows.map((r) => [r.label, payMeasure === 'Count' ? String(r.count) : fmt(r.amount), payMeasure === 'Count' ? String(r.count) : fmt(r.amount)]), ['Totals', payMeasure === 'Count' ? String(payMetrics.totalCount) : fmt(payMetrics.total), payMeasure === 'Count' ? String(payMetrics.totalCount) : fmt(payMetrics.total)]])}>⤓ Export report…</span>
              </div>
              <div className="pm-table">
                <div className="pm-grouphead"><span /><span className="rpt-year">{payParsedRange.start.getFullYear()}</span><span className="rpt-total">TOTAL</span></div>
                <div className="pm-head"><span>Payment type</span><span className="r">{MON[payParsedRange.start.getMonth()]}</span><span className="r">{payMeasure}</span></div>
                {payFiltered.length > 0 ? (
                  <>
                    {payMetrics.rows.map((r) => (
                      <div key={r.method} className="pm-row">
                        <span>{r.label}</span>
                        <span className="r">{payMeasure === 'Count' ? r.count : fmt(r.amount)}</span>
                        <span className="r">{payMeasure === 'Count' ? r.count : fmt(r.amount)}</span>
                      </div>
                    ))}
                    <div className="pm-row totals">
                      <span>Totals</span>
                      <span className="r">{payMeasure === 'Count' ? payMetrics.totalCount : fmt(payMetrics.total)}</span>
                      <span className="r">{payMeasure === 'Count' ? payMetrics.totalCount : fmt(payMetrics.total)}</span>
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
                    <option>All reasons</option>
                    {adjustmentReasons.map((r) => <option key={r.id}>{r.name}</option>)}
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
              const range = parseRange(userRange);
              const inRange = timeEntries.filter((t) => t.clockIn >= range.start.getTime() && t.clockIn <= range.end.getTime());
              const filteredUsers = staffUsers
                .map((u) => ({ id: u.id, disp: u.name, email: u.email, init: initials(u.name), av: u.av, entries: inRange.filter((t) => t.userName === u.name).sort((a, b) => b.clockIn - a.clockIn) }))
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
                      <div className="shiftly-logo">Homebase</div>
                      <div className="partner-body">
                        <div className="partner-h">Simplify your team management with Homebase</div>
                        <div className="partner-t">Unlock the everything app for hourly teams and conquer team scheduling, activity and time cards with ease with the new enhanced Homebase partnership, now offering exclusive pricing for Nova customers.</div>
                        <span className="rlink">Learn more ↗</span>
                      </div>
                      <span className="rlink partner-dismiss" onClick={() => setPartnerOpen(false)}>Dismiss</span>
                    </div>
                  )}
                  <div className="disp-row">
                    <span>Displaying {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}</span>
                    <span className="rlink" onClick={() => downloadCSV('user-time-cards.csv', [['User', 'Email', 'Clock in', 'Clock out', 'Minutes'], ...filteredUsers.flatMap((u) => (u.entries.length ? u.entries.map((t) => [u.disp, u.email, new Date(t.clockIn).toISOString(), t.clockOut ? new Date(t.clockOut).toISOString() : 'Still clocked in', String(minutesWorked([t]))]) : [[u.disp, u.email, '', '', '0']]))])}>⤓ Export list</span>
                  </div>
                  <div className="ur-table">
                    <div className="ur-head">
                      <span className="cth-s" onClick={() => setUserSort((s) => (s === 'asc' ? 'desc' : 'asc'))}><span className="cth-label">User</span><SortGlyph dir={userSort} /></span>
                      <span className="r">Total worked hours</span>
                    </div>
                    {filteredUsers.map((u) => (
                      <div key={u.email}>
                        <div className="ur-row" onClick={() => setUserExpanded((e) => (e === u.id ? null : u.id))} style={{ cursor: 'pointer' }}>
                          <span className="ur-user">
                            <span className="ur-chev">{userExpanded === u.id ? '▾' : '›'}</span>
                            <span className="cust-av" style={{ background: u.av }}>{u.init}</span>
                            <span><b>{u.disp}</b><br /><span className="cust-code">{u.email}</span></span>
                          </span>
                          <span className="r">{fmtMinutes(minutesWorked(u.entries))}{u.entries.some((t) => t.clockOut === null) ? ' · clocked in' : ''}</span>
                        </div>
                        {userExpanded === u.id && (
                          <div className="ur-entries">
                            {u.entries.length === 0 ? (
                              <div className="rep-empty">No time cards in this period. Users clock in and out from their profile menu.</div>
                            ) : (
                              <>
                                <div className="cm-head"><span>Clock in</span><span>Clock out</span><span>Duration</span><span /></div>
                                {u.entries.map((t) => (
                                  <div key={t.id} className="cm-row">
                                    <span>{fmtDateTime(new Date(t.clockIn))}</span>
                                    <span>{t.clockOut ? fmtDateTime(new Date(t.clockOut)) : <span className="tx-badge open">Clocked in</span>}</span>
                                    <span>{fmtMinutes(minutesWorked([t]))}</span>
                                    <span className="r"><span className="rlink" onClick={() => deleteTimeEntry(t.id)}>Delete</span></span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()
          ) : active === 'tax' ? (
            <>
              <h1 className="page-title">Tax report</h1>
              <div className="rep-band"><span>Get an overview of your tax reports.</span></div>
              <div className="rep-filter">
                <div className="rep-fg">
                  <label>Report type</label>
                  <select value={taxReportType} onChange={(e) => setTaxReportType(e.target.value)}>
                    <option>Tax code</option><option>Outlet</option>
                  </select>
                </div>
                <div className="rep-fg">
                  <label>Date range</label>
                  <DateRangeField value={taxRange} onApply={setTaxRange} />
                </div>
                <div className="rep-fg">
                  <label>Outlet</label>
                  <select value={outlet} onChange={(e) => setOutlet(e.target.value)}>
                    <option>Main Outlet</option>
                    <option>All outlets</option>
                  </select>
                </div>
              </div>
              <div className="rep-toolbar">
                <span>Showing {taxFiltered.length} sale{taxFiltered.length === 1 ? '' : 's'}</span>
                <span
                  className="rlink"
                  onClick={() =>
                    downloadCSV('tax-report.csv', [
                      ['Tax code', 'Rate', 'Tax', 'Revenue (excl. tax)', 'Total incl. tax'],
                      ...taxRows.map((r) => [r.label, `${r.ratePct}%`, fmt(r.tax), fmt(r.taxable), fmt(r.taxable + r.tax)]),
                      ['Totals', '', fmt(taxTotals.tax), fmt(taxTotals.taxable), fmt(taxTotals.taxable + taxTotals.tax)],
                    ])
                  }
                >
                  ⤓ Export report…
                </span>
              </div>
              <div className="gc-stats">
                <div className="gc-stat"><span>Taxable sales</span><b>{fmt(taxTotals.taxable)}</b></div>
                <div className="gc-stat"><span>Tax collected</span><b>{fmt(taxTotals.tax)}</b></div>
                <div className="gc-stat"><span>Total incl. tax</span><b>{fmt(taxTotals.taxable + taxTotals.tax)}</b></div>
                <div className="gc-stat"><span>Effective rate</span><b>{taxTotals.taxable > 0 ? `${(Math.round((taxTotals.tax / taxTotals.taxable) * 10000) / 100).toFixed(2)}%` : '0%'}</b></div>
              </div>
              <div className="cm-table">
                <div className="cm-head"><span>{taxReportType === 'Outlet' ? 'OUTLET' : 'TAX CODE'}</span><span>RATE</span><span>TAX</span><span>REVENUE (EXCL. TAX)</span></div>
                {taxRows.length === 0 ? (
                  <div className="cm-empty">No data available for this period</div>
                ) : (
                  <>
                    {taxRows.map((r) => (
                      <div key={r.label} className="cm-row">
                        <span>{taxReportType === 'Outlet' ? `${outlet === 'All outlets' ? 'Main Outlet' : outlet} · ${r.label}` : r.label}<span className="cm-note">{r.count} sale{r.count === 1 ? '' : 's'}</span></span>
                        <span>{r.ratePct}%</span>
                        <span>{fmt(r.tax)}</span>
                        <span>{fmt(r.taxable)}</span>
                      </div>
                    ))}
                    <div className="cm-row totals">
                      <span>Totals</span>
                      <span />
                      <span>{fmt(taxTotals.tax)}</span>
                      <span>{fmt(taxTotals.taxable)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : active === 'shared' ? (
            <>
              <h1 className="page-title">Shared reports</h1>
              <div className="rep-band">
                <span>View and manage the schedule of your shared reports.</span>
                <button className="btn-p" onClick={() => { setShareModal({ report: 'Sales report', recipients: '' }); setShareError(''); }}>Share a report</button>
              </div>
              <div className="atable">
                <div className="inv-thead shr4">
                  <span className="s">Report</span>
                  <span className="s">Owner</span>
                  <span className="s">Recipients</span>
                  <span className="s">Shared</span>
                </div>
                {sharedReports.length === 0 && <div className="ct-empty">No shared reports yet. Share a report to send its link to colleagues.</div>}
                {sharedReports.map((r) => (
                  <div key={r.id} className="inv-row shr4">
                    <span className="strong">{r.report}</span>
                    <span>{r.owner}</span>
                    <span>{r.recipients.join(', ')}</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()} · <span className="rlink" onClick={() => unshareReport(r.id)}>Stop sharing</span></span>
                  </div>
                ))}
              </div>
            </>
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
                        <span className="rt-thumb">{catByName.get(name)?.emoji ?? '📦'}</span>
                        <span><span className="rlink">{name}</span><br /><span className="prod-sku">{catByName.get(name)?.sku ?? '—'}</span></span>
                      </span>
                      <span className="r">{fmt(v.rev)}</span>
                      <span className="r">{v.qty}</span>
                      <span className="r">{fmt(v.disc)}</span>
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
      {shareModal && (
        <div className="pm-overlay" onClick={() => setShareModal(null)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>Share report</h2>
              <button className="pm-close" onClick={() => setShareModal(null)} aria-label="Close">×</button>
            </div>
            <form className="reg-open-body" onSubmit={(e) => { e.preventDefault(); shareNow(); }}>
              {shareError && <div className="pe-error" role="alert">{shareError}</div>}
              <label className="reg-open-field">
                <span>Report</span>
                <select value={shareModal.report} onChange={(e) => setShareModal({ ...shareModal, report: e.target.value })}>
                  {NAV.filter((n) => n.key !== 'shared').map((n) => <option key={n.key}>{n.label}</option>)}
                </select>
              </label>
              <label className="reg-open-field">
                <span>Recipients <span className="pe-hint">Email addresses, separated by commas</span></span>
                <input value={shareModal.recipients} autoFocus onChange={(e) => { setShareModal({ ...shareModal, recipients: e.target.value }); setShareError(''); }} placeholder="name@domain.com, other@domain.com" />
              </label>
              <button className="pm-complete" type="submit">Share report</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
