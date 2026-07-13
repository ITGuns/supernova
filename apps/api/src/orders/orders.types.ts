export type Channel = 'RETAIL' | 'RESTAURANT' | 'ECOM';
export type OrderState = 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID';
export type TenderMethod = 'CASH' | 'CARD' | 'GIFT_CARD' | 'STORE_CREDIT';

export interface ApiOrderLine {
  variantId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
}

export interface ApiTender {
  method: TenderMethod;
  amountMinor: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  channel: Channel;
  state: OrderState;
  currency: string;
  lines: ApiOrderLine[];
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  paidMinor: number;
  changeMinor: number;
  tenders: ApiTender[];
  createdAt: string;
}
