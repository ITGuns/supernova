import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORIES,
  TAX_BASIS_POINTS,
  VARIANTS,
  type Category,
  type TaxGroupId,
  type Variant,
} from './catalog.data';

@Injectable()
export class CatalogService {
  getCategories(): Category[] {
    return CATEGORIES;
  }

  listProducts(opts: { categoryId?: string; q?: string }): Variant[] {
    const q = opts.q?.trim().toLowerCase();
    return VARIANTS.filter((v) => {
      const matchCat = !opts.categoryId || v.categoryId === opts.categoryId;
      const matchQ =
        !q || v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }

  getProduct(id: string): Variant {
    const v = VARIANTS.find((x) => x.id === id);
    if (!v) throw new NotFoundException(`Product ${id} not found`);
    return v;
  }

  findVariant(id: string): Variant | undefined {
    return VARIANTS.find((x) => x.id === id);
  }

  taxBasisPoints(group: TaxGroupId): number {
    return TAX_BASIS_POINTS[group];
  }
}
