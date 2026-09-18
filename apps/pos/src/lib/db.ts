/**
 * db.ts — Typed Supabase query helpers for every Nova POS table.
 *
 * Each function is a thin wrapper around the Supabase JS client.
 * Stores call these instead of touching supabase directly so all
 * SQL logic is co-located and easy to swap out later.
 *
 * Reads report failures via reportDbError(). Writes go through
 * syncQueue.write(): they run immediately, and if the failure is transient
 * (offline, 5xx) the write is queued and replayed automatically.
 *
 * Naming convention:
 *   db<Table>.list()    → SELECT *
 *   db<Table>.upsert()  → INSERT … ON CONFLICT DO UPDATE
 *   db<Table>.del()     → DELETE WHERE id = …
 *   db<Table>.get()     → SELECT WHERE id = …  (singletons only)
 *   db<Table>.save()    → UPDATE singleton row (settings, config rows)
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { reportDbError } from './syncErrors';
import { write } from './syncQueue';

// ─── Guard ───────────────────────────────────────────────────────────────────
// Returns true + logs nothing when Supabase is ready.
// Returns false + silently no-ops all calls when keys are missing.
const ok = () => isSupabaseConfigured();

const SETTINGS_ID   = '00000000-0000-0000-0000-000000000001';
const SETUP_ID      = '00000000-0000-0000-0000-000000000002';
const SESSION_ID    = '00000000-0000-0000-0000-000000000003';
const REGISTER_ID   = '00000000-0000-0000-0000-000000000004';
const SECURITY_ID   = '00000000-0000-0000-0000-000000000005';

type Row = Record<string, unknown>;

// Shared write shapes so each table helper stays one line.
const upsert = (table: string, row: Row) => write({ table, kind: 'upsert', payload: row, scope: `${table}.upsert` });
const insert = (table: string, row: Row) => write({ table, kind: 'insert', payload: row, scope: `${table}.insert` });
const delBy  = (table: string, col: string, val: string) =>
  write({ table, kind: 'delete', match: { col, val }, scope: `${table}.del` });
const saveSingleton = (table: string, id: string, patch: Row) =>
  write({ table, kind: 'upsert', payload: { id, ...patch }, scope: `${table}.save` });

/**
 * Whether `table` has `column`. PostgREST validates the selected column even
 * on an empty table, so this works before the first row exists. Stores call
 * it on sync so a write never sends a column an older schema would reject.
 * null = couldn't tell (offline / other error).
 */
async function hasColumn(table: string, column: string): Promise<boolean | null> {
  if (!ok()) return null;
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  if (error.message.includes(column)) return false;
  reportDbError(`${table}.probe`, error.message);
  return null;
}

// ─── Settings ────────────────────────────────────────────────────────────────
export const dbSettings = {
  /** Whether settings has tax_groups (migration 0009) / tax_exclusive (0010). */
  hasTaxGroups: () => hasColumn('settings', 'tax_groups'),
  hasTaxExclusive: () => hasColumn('settings', 'tax_exclusive'),
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .single();
    if (error) reportDbError('settings.get', error.message);
    return data ?? null;
  },
  save: (patch: Row) => saveSingleton('settings', SETTINGS_ID, patch),
};

// ─── Setup Config ────────────────────────────────────────────────────────────
export const dbSetup = {
  /** Whether setup_config has outlet_taxes (migration 0009). */
  hasOutletTaxes: () => hasColumn('setup_config', 'outlet_taxes'),
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('setup_config')
      .select('*')
      .eq('id', SETUP_ID)
      .single();
    if (error) reportDbError('setup.get', error.message);
    return data ?? null;
  },
  save: (patch: Row) => saveSingleton('setup_config', SETUP_ID, patch),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const dbUsers = {
  /** Whether users has the details column (migration 0010). */
  hasDetails: () => hasColumn('users', 'details'),
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase.from('users').select('*').order('created_at');
    if (error) {
      reportDbError('users.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('users', row),
  del: (id: string) => delBy('users', 'id', id),
};

// ─── Catalog Meta (categories / brands / suppliers) ──────────────────────────
export const dbCatalogMeta = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase.from('catalog_meta').select('*');
    if (error) {
      reportDbError('catalog_meta.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('catalog_meta', row),
  del: (id: string) => delBy('catalog_meta', 'id', id),
  /** Whether the table has the supplier `details` column (migration 0006). null = couldn't tell. */
  async hasDetails(): Promise<boolean | null> {
    if (!ok()) return null;
    const { error } = await supabase.from('catalog_meta').select('details').limit(1);
    if (!error) return true;
    if (/details/.test(error.message)) return false;
    reportDbError('catalog_meta.probe', error.message);
    return null;
  },
};

// ─── Products ────────────────────────────────────────────────────────────────
export const dbProducts = {
  /** Whether products has custom_fields (migration 0011). */
  hasCustomFields: () => hasColumn('products', 'custom_fields'),
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      reportDbError('products.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('products', row),
  del: (id: string) => delBy('products', 'id', id),
  /**
   * Whether the table has the product-profile columns (migration 0005).
   * Selecting the column is validated by PostgREST even on an empty table,
   * so this works before the first product exists. null = couldn't tell.
   */
  async hasDetailColumns(): Promise<boolean | null> {
    if (!ok()) return null;
    const { error } = await supabase.from('products').select('product_type').limit(1);
    if (!error) return true;
    if (/product_type/.test(error.message)) return false;
    reportDbError('products.probe', error.message);
    return null;
  },
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const dbCustomers = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      reportDbError('customers.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('customers', row),
  del: (id: string) => delBy('customers', 'id', id),
  // Customer groups
  /** Group names with their creation time (created_at arrived with migration 0010; older tables return only names). */
  async listGroups(): Promise<{ name: string; createdAt: number | null }[] | null> {
    if (!ok()) return null;
    const withDate = await supabase.from('customer_groups').select('name, created_at').order('id');
    if (!withDate.error) return (withDate.data ?? []).map((r: { name: string; created_at: string | null }) => ({ name: r.name, createdAt: r.created_at ? new Date(r.created_at).getTime() : null }));
    const { data, error } = await supabase.from('customer_groups').select('name').order('id');
    if (error) {
      reportDbError('customer_groups.list', error.message);
      return null;
    }
    return (data ?? []).map((r: { name: string }) => ({ name: r.name, createdAt: null }));
  },
  addGroup: (name: string) => insert('customer_groups', { name }),
  delGroup: (name: string) => delBy('customer_groups', 'name', name),
  /** Whether customers have the on-account limit / loyalty columns (migration 0009). */
  hasLimitColumns: () => hasColumn('customers', 'on_account_limit_minor'),
  /** Whether customers have the details column (migration 0010). */
  hasDetails: () => hasColumn('customers', 'details'),
};

// ─── Sales ───────────────────────────────────────────────────────────────────
export const dbSales = {
  /** Whether sales has returned_lines / custom_fields (migration 0011). */
  hasReturnedLines: () => hasColumn('sales', 'returned_lines'),
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });
    if (error) {
      reportDbError('sales.list', error.message);
      return null;
    }
    return data ?? [];
  },
  insert: (row: Row) => insert('sales', row),
  update: (orderNumber: string, patch: Row) =>
    write({ table: 'sales', kind: 'update', payload: patch, match: { col: 'order_number', val: orderNumber }, scope: 'sales.update' }),
  /** Whether the table has the tax / discount columns (migration 0008). */
  hasTaxColumns: () => hasColumn('sales', 'tax_minor'),
  /** Whether the table has the paid / voided columns (migration 0009). */
  hasPaidColumns: () => hasColumn('sales', 'paid_minor'),
};

// ─── Parked Sales ─────────────────────────────────────────────────────────────
export const dbParked = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('parked_sales')
      .select('*')
      .order('parked_at', { ascending: false });
    if (error) {
      reportDbError('parked_sales.list', error.message);
      return null;
    }
    return data ?? [];
  },
  insert: (row: Row) => insert('parked_sales', row),
  del: (id: string) => delBy('parked_sales', 'id', id),
};

// ─── Quotes ──────────────────────────────────────────────────────────────────
export const dbQuotes = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      reportDbError('quotes.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('quotes', row),
  del: (id: string) => delBy('quotes', 'id', id),
  /** Whether the table keeps quote lines (migration 0008). */
  hasLines: () => hasColumn('quotes', 'lines'),
  /** Whether the table keeps a quote note (migration 0009). */
  hasNote: () => hasColumn('quotes', 'note'),
};

// ─── Stock Transactions ───────────────────────────────────────────────────────
export const dbStockTx = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      reportDbError('stock_transactions.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('stock_transactions', row),
  del: (id: string) => delBy('stock_transactions', 'id', id),
  /** Whether the table has the `details` column (migration 0007). */
  hasDetails: () => hasColumn('stock_transactions', 'details'),
};

// ─── Inventory Counts ────────────────────────────────────────────────────────
export const dbInventoryCounts = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      reportDbError('inventory_counts.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('inventory_counts', row),
  del: (id: string) => delBy('inventory_counts', 'id', id),
  /** Whether the table has the `details` column (migration 0007). */
  hasDetails: () => hasColumn('inventory_counts', 'details'),
};

// ─── Register Session ─────────────────────────────────────────────────────────
export const dbRegisterSession = {
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('register_sessions')
      .select('*')
      .eq('id', SESSION_ID)
      .single();
    if (error) reportDbError('register_sessions.get', error.message);
    return data ?? null;
  },
  save: (patch: Row) => saveSingleton('register_sessions', SESSION_ID, patch),
};

// ─── Register Config ──────────────────────────────────────────────────────────
export const dbRegisterConfig = {
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('register_config')
      .select('*')
      .eq('id', REGISTER_ID)
      .single();
    if (error) reportDbError('register_config.get', error.message);
    return data ?? null;
  },
  save: (patch: Row) => saveSingleton('register_config', REGISTER_ID, patch),
};

// ─── Security Config ──────────────────────────────────────────────────────────
export const dbSecurity = {
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('security_config')
      .select('*')
      .eq('id', SECURITY_ID)
      .single();
    if (error) reportDbError('security_config.get', error.message);
    return data ?? null;
  },
  save: (patch: Row) => saveSingleton('security_config', SECURITY_ID, patch),
};

// ─── Adjustment Reasons ───────────────────────────────────────────────────────
export const dbAdjustmentReasons = {
  async list() {
    if (!ok()) return null;
    const { data, error } = await supabase.from('adjustment_reasons').select('*');
    if (error) {
      reportDbError('adjustment_reasons.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('adjustment_reasons', row),
  del: (id: string) => delBy('adjustment_reasons', 'id', id),
  /** Whether the table has the `enabled` column (migration 0007). */
  hasEnabled: () => hasColumn('adjustment_reasons', 'enabled'),
};

// ─── Promotions / price books / fulfillments (migration 0008) ────────────────
// Each `list()` returns 'missing' when its table doesn't exist yet so the
// store can fall back to local data without raising a toast on every boot.
const listOrMissing = async (table: string, order: string): Promise<Row[] | 'missing' | null> => {
  if (!ok()) return null;
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending: false });
  if (error) {
    if (error.message.includes(table)) return 'missing';
    reportDbError(`${table}.list`, error.message);
    return null;
  }
  return data ?? [];
};
export const dbPromotions = {
  list: () => listOrMissing('promotions', 'created_at'),
  upsert: (row: Row) => upsert('promotions', row),
  del: (id: string) => delBy('promotions', 'id', id),
  /** Whether the table has the targeting / schedule columns (migration 0009). */
  hasTargeting: () => hasColumn('promotions', 'target'),
  /** Whether the table has the advanced-promotion column (migration 0011). */
  hasAdvanced: () => hasColumn('promotions', 'advanced'),
};
export const dbGiftCards = {
  list: () => listOrMissing('gift_cards', 'created_at'),
  upsert: (row: Row) => upsert('gift_cards', row),
  del: (id: string) => delBy('gift_cards', 'id', id),
};
export const dbPriceBooks = {
  list: () => listOrMissing('price_books', 'created_at'),
  upsert: (row: Row) => upsert('price_books', row),
  del: (id: string) => delBy('price_books', 'id', id),
};
export const dbFulfillments = {
  list: () => listOrMissing('fulfillments', 'created_at'),
  upsert: (row: Row) => upsert('fulfillments', row),
  del: (id: string) => delBy('fulfillments', 'id', id),
};

// ─── Lightspeed-parity tables (migration 0009) ───────────────────────────────
export const dbInventoryAdjustments = {
  list: () => listOrMissing('inventory_adjustments', 'created_at'),
  upsert: (row: Row) => upsert('inventory_adjustments', row),
  del: (id: string) => delBy('inventory_adjustments', 'id', id),
};
export const dbServices = {
  hasCustomFields: () => hasColumn('services', 'custom_fields'),
  list: () => listOrMissing('services', 'created_at'),
  upsert: (row: Row) => upsert('services', row),
  del: (id: string) => delBy('services', 'id', id),
};
export const dbServiceStatuses = {
  list: () => listOrMissing('service_statuses', 'position'),
  upsert: (row: Row) => upsert('service_statuses', row),
  del: (id: string) => delBy('service_statuses', 'id', id),
};
export const dbTimeEntries = {
  list: () => listOrMissing('time_entries', 'clock_in'),
  upsert: (row: Row) => upsert('time_entries', row),
  del: (id: string) => delBy('time_entries', 'id', id),
};
export const dbSerialNumbers = {
  list: () => listOrMissing('serial_numbers', 'created_at'),
  upsert: (row: Row) => upsert('serial_numbers', row),
  del: (id: string) => delBy('serial_numbers', 'id', id),
};
export const dbCustomFields = {
  list: () => listOrMissing('custom_fields', 'created_at'),
  upsert: (row: Row) => upsert('custom_fields', row),
  del: (id: string) => delBy('custom_fields', 'id', id),
};

// ─── Product tags ────────────────────────────────────────────────────────────
export const dbProductTags = {
  /**
   * All tag rows. Returns 'missing' when the table doesn't exist yet
   * (migration 0007 not run) so the store can fall back to local tags
   * without raising a sync toast on every boot.
   */
  async list(): Promise<Row[] | 'missing' | null> {
    if (!ok()) return null;
    const { data, error } = await supabase.from('product_tags').select('*').order('created_at');
    if (error) {
      if (/product_tags/.test(error.message)) return 'missing';
      reportDbError('product_tags.list', error.message);
      return null;
    }
    return data ?? [];
  },
  upsert: (row: Row) => upsert('product_tags', row),
  del: (id: string) => delBy('product_tags', 'id', id),
};
