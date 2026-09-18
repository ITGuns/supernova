import type { AppUser } from '../store/userStore';

// What each role may do (Setup → Users → Roles). Route paths map to a
// permission so the rail and the router can both enforce it.

export type Permission =
  | 'sell'
  | 'park-quote'
  | 'returns'
  | 'discounts'
  | 'register-open-close'
  | 'cash-management'
  | 'catalog-inventory'
  | 'customers'
  | 'reports'
  | 'setup'
  | 'billing';

export type RoleName = 'Account owner' | 'Admin' | 'Manager' | 'Cashier';

export const roleOf = (u: Pick<AppUser, 'role' | 'owner'>): RoleName =>
  u.owner || /owner/i.test(u.role) ? 'Account owner' : /admin/i.test(u.role) ? 'Admin' : /manager/i.test(u.role) ? 'Manager' : 'Cashier';

const GRANTS: Record<Permission, RoleName[]> = {
  sell: ['Account owner', 'Admin', 'Manager', 'Cashier'],
  'park-quote': ['Account owner', 'Admin', 'Manager', 'Cashier'],
  returns: ['Account owner', 'Admin', 'Manager'],
  discounts: ['Account owner', 'Admin', 'Manager'],
  'register-open-close': ['Account owner', 'Admin', 'Manager'],
  'cash-management': ['Account owner', 'Admin', 'Manager'],
  'catalog-inventory': ['Account owner', 'Admin', 'Manager'],
  customers: ['Account owner', 'Admin', 'Manager'],
  reports: ['Account owner', 'Admin', 'Manager'],
  setup: ['Account owner', 'Admin'],
  billing: ['Account owner'],
};

export const can = (u: Pick<AppUser, 'role' | 'owner'> | null | undefined, p: Permission): boolean => !!u && GRANTS[p].includes(roleOf(u));

/** The permission a route needs, or null when any signed-in user may open it. */
export const permissionForPath = (path: string): Permission | null => {
  if (path.startsWith('/sell/open-close')) return 'register-open-close';
  if (path.startsWith('/sell/cash-management')) return 'cash-management';
  if (path.startsWith('/sell')) return 'sell';
  if (path.startsWith('/catalog') || path.startsWith('/inventory')) return 'catalog-inventory';
  if (path.startsWith('/customers')) return 'customers';
  if (path.startsWith('/reporting') || path.startsWith('/finance')) return 'reports';
  if (path.startsWith('/setup')) return 'setup';
  if (path.startsWith('/services')) return 'customers';
  return null;
};
