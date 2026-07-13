import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeTax,
  priceCart,
  type AppliedDiscountInput,
  type ResolvedTaxRate,
} from '@nova/domain';
import type { TaxGroupId } from '../catalog/catalog.data';
import { CatalogService } from '../catalog/catalog.service';
import type { AddPaymentDto } from './dto/add-payment.dto';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ApiOrder, ApiOrderLine } from './orders.types';

@Injectable()
export class OrdersService {
  private readonly orders = new Map<string, ApiOrder>();
  private seq = 1000;

  constructor(private readonly catalog: CatalogService) {}

  create(dto: CreateOrderDto): ApiOrder {
    const resolved = dto.lines.map((l) => {
      const variant = this.catalog.findVariant(l.variantId);
      if (!variant) throw new BadRequestException(`Unknown variant: ${l.variantId}`);
      return { variant, quantity: l.quantity };
    });

    const discounts: AppliedDiscountInput[] = dto.discountBps
      ? [
          {
            id: 'order-disc',
            name: `Discount ${dto.discountBps / 100}%`,
            scope: 'ORDER',
            method: 'PERCENT',
            value: dto.discountBps,
          },
        ]
      : [];

    const priced = priceCart({
      channel: dto.channel ?? 'RETAIL',
      currency: 'USD',
      lines: resolved.map((r) => ({
        lineId: r.variant.id,
        variantId: r.variant.id,
        quantity: r.quantity,
        unitPriceMinor: r.variant.priceMinor,
        taxGroupId: r.variant.taxGroupId,
      })),
      discounts,
    });

    const tax = computeTax(priced.lines, (line): ResolvedTaxRate[] => {
      const group = (line.taxGroupId ?? 'standard') as TaxGroupId;
      const bps = this.catalog.taxBasisPoints(group);
      if (!bps) return [];
      return [
        {
          taxRateId: group,
          name: 'Sales Tax',
          rateBasisPoints: bps,
          inclusive: false,
          compound: false,
          priority: 0,
        },
      ];
    });

    const subtotalMinor = priced.subtotalMinor;
    const discountTotalMinor = priced.discountTotalMinor;
    const taxTotalMinor = tax.taxTotalMinor;
    const totalMinor = subtotalMinor - discountTotalMinor + taxTotalMinor;

    const lines: ApiOrderLine[] = priced.lines.map((pl) => {
      const match = resolved.find((r) => r.variant.id === pl.variantId);
      return {
        variantId: pl.variantId ?? '',
        name: match ? match.variant.name : 'Item',
        quantity: pl.quantity,
        unitPriceMinor: pl.unitPriceMinor,
        lineSubtotalMinor: pl.lineSubtotalMinor,
      };
    });

    this.seq += 1;
    const order: ApiOrder = {
      id: randomUUID(),
      orderNumber: `#${this.seq}`,
      channel: dto.channel ?? 'RETAIL',
      state: 'OPEN',
      currency: 'USD',
      lines,
      subtotalMinor,
      discountTotalMinor,
      taxTotalMinor,
      totalMinor,
      paidMinor: 0,
      changeMinor: 0,
      tenders: [],
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  addPayment(id: string, dto: AddPaymentDto): ApiOrder {
    const order = this.get(id);
    order.tenders.push({ method: dto.method, amountMinor: dto.amountMinor });
    order.paidMinor += dto.amountMinor;
    if (order.paidMinor >= order.totalMinor) {
      order.state = 'PAID';
      order.changeMinor = order.paidMinor - order.totalMinor;
    } else {
      order.state = 'PARTIALLY_PAID';
    }
    return order;
  }

  list(): ApiOrder[] {
    return [...this.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): ApiOrder {
    const order = this.orders.get(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }
}
