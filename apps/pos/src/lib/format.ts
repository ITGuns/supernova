import { formatMoney, money } from '@nova/domain';

/** Format integer minor units as a currency string, e.g. 680 → "$6.80". */
export const fmt = (amountMinor: number, currency = 'USD'): string =>
  formatMoney(money(amountMinor, currency), 'en-US');

/** "Sep 17, 2026" — the way Lightspeed prints a date in a list. */
export const fmtDate = (value: string | number | Date | undefined): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
