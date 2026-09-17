import type { CompletedSale } from '../store/cartStore';
import type { InventoryAdjustment } from '../store/inventoryAdjustmentStore';
import { lineQty, type InventoryCount, type StockTx } from '../store/inventoryStore';

// Every event that changed a product's stock, newest first — what the
// "View inventory movements" table shows (Date | Movement | From | To | User | Quantity).

export interface Movement {
  at: number;
  movement: string;
  from: string;
  to: string;
  user: string;
  /** Signed change to stock on hand. */
  quantity: number;
  reference: string;
}

export function movementsFor(
  productId: string,
  src: { sales: CompletedSale[]; transactions: StockTx[]; adjustments: InventoryAdjustment[]; counts: InventoryCount[] },
  outletName = '',
): Movement[] {
  const out: Movement[] = [];

  for (const s of src.sales) {
    for (const l of s.lines) {
      if (l.variantId !== productId) continue;
      const who = s.soldBy ?? '';
      const customer = s.customer || 'Customer';
      if (s.status === 'Voided') {
        out.push({ at: s.voidedAt ?? s.at, movement: 'Sale voided', from: customer, to: outletName, user: who, quantity: l.quantity, reference: s.orderNumber });
        out.push({ at: s.at, movement: 'Sale', from: outletName, to: customer, user: who, quantity: -l.quantity, reference: s.orderNumber });
        continue;
      }
      out.push({ at: s.at, movement: s.training ? 'Training sale' : 'Sale', from: outletName, to: customer, user: who, quantity: s.training ? 0 : -l.quantity, reference: s.orderNumber });
      if (s.status === 'Returned') out.push({ at: s.refundedAt ?? s.at, movement: 'Return', from: customer, to: outletName, user: who, quantity: l.quantity, reference: s.orderNumber });
    }
  }

  for (const t of src.transactions) {
    for (const l of t.lines) {
      if (l.productId !== productId) continue;
      const qty = lineQty(l, t.status);
      if (t.kind === 'order' && t.status === 'Received') out.push({ at: t.details.receivedAt ?? t.createdAt, movement: 'Received (purchase order)', from: t.from, to: t.to, user: '', quantity: qty, reference: t.number });
      else if (t.kind === 'return' && (t.status === 'Sent' || t.status === 'Received')) out.push({ at: t.createdAt, movement: 'Returned to supplier', from: t.from, to: t.to, user: '', quantity: -qty, reference: t.number });
      else if (t.kind === 'transfer' && t.status === 'Received') out.push({ at: t.details.receivedAt ?? t.createdAt, movement: 'Transfer', from: t.from, to: t.to, user: '', quantity: 0, reference: t.number });
    }
  }

  for (const a of src.adjustments) {
    if (a.productId !== productId) continue;
    out.push({ at: a.createdAt, movement: `Adjustment · ${a.reason || 'No reason'}`, from: a.quantity < 0 ? a.outlet : '', to: a.quantity < 0 ? '' : a.outlet, user: a.user, quantity: a.quantity, reference: a.note });
  }

  for (const c of src.counts) {
    if (c.status !== 'Completed') continue;
    for (const l of c.lines) {
      if (l.productId !== productId || l.counted === null) continue;
      const diff = l.counted - l.expected;
      if (diff !== 0) out.push({ at: c.completedAt ?? c.createdAt, movement: 'Inventory count', from: c.outlet, to: c.outlet, user: '', quantity: diff, reference: c.name });
    }
  }

  return out.sort((a, b) => b.at - a.at);
}
