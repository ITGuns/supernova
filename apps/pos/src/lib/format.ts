import { formatMoney, money } from '@nova/domain';

/** Format integer minor units as a currency string, e.g. 680 → "$6.80". */
export const fmt = (amountMinor: number, currency = 'USD'): string =>
  formatMoney(money(amountMinor, currency), 'en-US');
