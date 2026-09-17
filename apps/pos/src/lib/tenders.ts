import type { PaymentType } from '../store/setupStore';

// Tender methods: the two built-in payment types keep their historic codes
// ('CASH', 'CARD') so older sales still read correctly; every other payment
// type configured in Setup → Payment types is recorded by its id.

export const CASH = 'CASH';
export const CARD = 'CARD';
/** Balances held on the customer's account, taken at the register. */
export const STORE_CREDIT = 'STORE_CREDIT';
export const LOYALTY = 'LOYALTY';

/** The tender method a configured payment type records. */
export const methodOf = (t: PaymentType): string => (t.id === 'pt-cash' ? CASH : t.id === 'pt-card' ? CARD : t.id);

export const isCash = (method: string): boolean => method === CASH;

/** Display name for a tender method, from Setup → Payment types. */
export const tenderLabel = (method: string, paymentTypes: PaymentType[]): string => {
  if (method === STORE_CREDIT) return 'Store credit';
  if (method === LOYALTY) return 'Loyalty';
  if (method === CASH) return paymentTypes.find((t) => t.id === 'pt-cash')?.name ?? 'Cash';
  if (method === CARD) return paymentTypes.find((t) => t.id === 'pt-card')?.name ?? 'Card';
  return paymentTypes.find((t) => t.id === method)?.name ?? method;
};

/** Short label for buttons and receipts ("Card" instead of "Credit / Debit card"). */
export const tenderShort = (method: string, paymentTypes: PaymentType[]): string =>
  method === CARD ? 'Card' : tenderLabel(method, paymentTypes);
