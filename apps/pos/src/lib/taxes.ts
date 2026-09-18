import type { TaxGroup, TaxOption } from '../store/settingsStore';

// Which sales tax applies to a line at the register, the way Lightspeed
// resolves it: the product's own tax (Setup → Sales taxes, or a tax group),
// otherwise the outlet's default tax, otherwise the store default. A
// tax-exempt customer pays no tax at all.

export interface ResolvedRate {
  id: string;
  name: string;
  rateBps: number;
}

export interface TaxDeps {
  taxes: TaxOption[];
  taxGroups: TaxGroup[];
  /** outlet id → tax option / group id ('' = store default). */
  outletTaxes: Record<string, string>;
  outletId: string;
  defaultTaxLabel: string;
  defaultTaxRateBps: number;
  customerTaxExempt?: boolean;
}

/** Look a tax option or tax group up by id. Groups sum their members' rates. */
export const rateById = (id: string, deps: Pick<TaxDeps, 'taxes' | 'taxGroups'>): ResolvedRate | null => {
  const tax = deps.taxes.find((t) => t.id === id);
  if (tax) return { id: tax.id, name: tax.label, rateBps: tax.rateBps };
  const group = deps.taxGroups.find((g) => g.id === id);
  if (group) return { id: group.id, name: group.name, rateBps: group.taxIds.reduce((a, tid) => a + (deps.taxes.find((t) => t.id === tid)?.rateBps ?? 0), 0) };
  return null;
};

/** The outlet's default tax, or the store default when the outlet has none. */
export const outletDefaultRate = (deps: TaxDeps): ResolvedRate => {
  const id = deps.outletTaxes[deps.outletId];
  const r = id ? rateById(id, deps) : null;
  if (r) return r;
  const def = deps.taxes.find((t) => t.label === deps.defaultTaxLabel);
  return def ? { id: def.id, name: def.label, rateBps: def.rateBps } : { id: 'store-default', name: deps.defaultTaxLabel || 'Sales Tax', rateBps: deps.defaultTaxRateBps };
};

/** The rate for a product (its taxId) or a custom line (outlet default). null = no tax. */
export const resolveRate = (productTaxId: string | undefined, deps: TaxDeps): ResolvedRate | null => {
  if (deps.customerTaxExempt) return null;
  const own = productTaxId ? rateById(productTaxId, deps) : null;
  const r = own ?? outletDefaultRate(deps);
  return r.rateBps > 0 ? r : null;
};
