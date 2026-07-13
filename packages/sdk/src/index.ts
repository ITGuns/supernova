// @nova/sdk — typed client for the Nova API. Isomorphic (browser + Node 18+ global fetch).

export type TaxGroupId = 'standard' | 'food' | 'exempt';
export type Channel = 'RETAIL' | 'RESTAURANT' | 'ECOM';
export type TenderMethod = 'CASH' | 'CARD' | 'GIFT_CARD' | 'STORE_CREDIT';

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  productId: string;
  name: string;
  categoryId: string;
  priceMinor: number;
  taxGroupId: TaxGroupId;
  sku: string;
  emoji: string;
}

export interface OrderLineInput {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  lines: OrderLineInput[];
  discountBps?: number;
  channel?: Channel;
  customerId?: string;
}

export interface AddPaymentInput {
  method: TenderMethod;
  amountMinor: number;
}

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
  state: string;
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

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email?: string;
  pin?: string;
  password?: string;
}

export interface NovaClientOptions {
  baseUrl?: string;
  token?: string;
}

export class NovaClient {
  private baseUrl: string;
  private token?: string;

  constructor(opts: NovaClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost:4000/api').replace(/\/$/, '');
    this.token = opts.token;
  }

  setToken(token?: string): void {
    this.token = token;
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...((init?.headers as Record<string, string>) ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Nova API ${res.status} ${res.statusText}: ${text}`);
    }
    return (await res.json()) as T;
  }

  getCategories(): Promise<Category[]> {
    return this.req('/catalog/categories');
  }

  getProducts(params: { category?: string; q?: string } = {}): Promise<Product[]> {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.req(`/catalog/products${suffix}`);
  }

  login(body: LoginInput): Promise<AuthResult> {
    return this.req('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  }

  me(): Promise<AuthUser> {
    return this.req('/auth/me');
  }

  createOrder(input: CreateOrderInput): Promise<ApiOrder> {
    return this.req('/orders', { method: 'POST', body: JSON.stringify(input) });
  }

  addPayment(orderId: string, input: AddPaymentInput): Promise<ApiOrder> {
    return this.req(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(input) });
  }

  listOrders(): Promise<ApiOrder[]> {
    return this.req('/orders');
  }
}
