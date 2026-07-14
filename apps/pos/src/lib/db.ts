/**
 * db.ts — Typed Supabase query helpers for every Nova POS table.
 *
 * Each function is a thin wrapper around the Supabase JS client.
 * Stores call these instead of touching supabase directly so all
 * SQL logic is co-located and easy to swap out later.
 *
 * Naming convention:
 *   db<Table>.list()    → SELECT *
 *   db<Table>.upsert()  → INSERT … ON CONFLICT DO UPDATE
 *   db<Table>.del()     → DELETE WHERE id = …
 *   db<Table>.get()     → SELECT WHERE id = …  (singletons only)
 *   db<Table>.save()    → UPDATE singleton row (settings, config rows)
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ─── Guard ───────────────────────────────────────────────────────────────────
// Returns true + logs nothing when Supabase is ready.
// Returns false + silently no-ops all calls when keys are missing.
const ok = () => isSupabaseConfigured();

const SETTINGS_ID   = '00000000-0000-0000-0000-000000000001';
const SETUP_ID      = '00000000-0000-0000-0000-000000000002';
const SESSION_ID    = '00000000-0000-0000-0000-000000000003';
const REGISTER_ID   = '00000000-0000-0000-0000-000000000004';
const SECURITY_ID   = '00000000-0000-0000-0000-000000000005';

// ─── Settings ────────────────────────────────────────────────────────────────
export const dbSettings = {
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .single();
    if (error) console.error('[db] settings.get', error.message);
    return data ?? null;
  },
  async save(patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('settings')
      .upsert({ id: SETTINGS_ID, ...patch });
    if (error) console.error('[db] settings.save', error.message);
  },
};

// ─── Setup Config ────────────────────────────────────────────────────────────
export const dbSetup = {
  async get() {
    if (!ok()) return null;
    const { data, error } = await supabase
      .from('setup_config')
      .select('*')
      .eq('id', SETUP_ID)
      .single();
    if (error) console.error('[db] setup.get', error.message);
    return data ?? null;
  },
  async save(patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('setup_config')
      .upsert({ id: SETUP_ID, ...patch });
    if (error) console.error('[db] setup.save', error.message);
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const dbUsers = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase.from('users').select('*').order('created_at');
    if (error) console.error('[db] users.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('users').upsert(row);
    if (error) console.error('[db] users.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) console.error('[db] users.del', error.message);
  },
};

// ─── Catalog Meta (categories / brands / suppliers) ──────────────────────────
export const dbCatalogMeta = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase.from('catalog_meta').select('*');
    if (error) console.error('[db] catalog_meta.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('catalog_meta').upsert(row);
    if (error) console.error('[db] catalog_meta.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('catalog_meta').delete().eq('id', id);
    if (error) console.error('[db] catalog_meta.del', error.message);
  },
};

// ─── Products ────────────────────────────────────────────────────────────────
export const dbProducts = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[db] products.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('products').upsert(row);
    if (error) console.error('[db] products.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) console.error('[db] products.del', error.message);
  },
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const dbCustomers = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[db] customers.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('customers').upsert(row);
    if (error) console.error('[db] customers.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) console.error('[db] customers.del', error.message);
  },
  // Customer groups
  async listGroups() {
    if (!ok()) return [];
    const { data, error } = await supabase.from('customer_groups').select('name').order('id');
    if (error) console.error('[db] customer_groups.list', error.message);
    return (data ?? []).map((r: { name: string }) => r.name);
  },
  async addGroup(name: string) {
    if (!ok()) return;
    const { error } = await supabase.from('customer_groups').insert({ name });
    if (error) console.error('[db] customer_groups.add', error.message);
  },
  async delGroup(name: string) {
    if (!ok()) return;
    const { error } = await supabase.from('customer_groups').delete().eq('name', name);
    if (error) console.error('[db] customer_groups.del', error.message);
  },
};

// ─── Sales ───────────────────────────────────────────────────────────────────
export const dbSales = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });
    if (error) console.error('[db] sales.list', error.message);
    return data ?? [];
  },
  async insert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('sales').insert(row);
    if (error) console.error('[db] sales.insert', error.message);
  },
  async update(orderNumber: string, patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('sales')
      .update(patch)
      .eq('order_number', orderNumber);
    if (error) console.error('[db] sales.update', error.message);
  },
};

// ─── Parked Sales ─────────────────────────────────────────────────────────────
export const dbParked = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('parked_sales')
      .select('*')
      .order('parked_at', { ascending: false });
    if (error) console.error('[db] parked_sales.list', error.message);
    return data ?? [];
  },
  async insert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('parked_sales').insert(row);
    if (error) console.error('[db] parked_sales.insert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('parked_sales').delete().eq('id', id);
    if (error) console.error('[db] parked_sales.del', error.message);
  },
};

// ─── Quotes ──────────────────────────────────────────────────────────────────
export const dbQuotes = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[db] quotes.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('quotes').upsert(row);
    if (error) console.error('[db] quotes.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) console.error('[db] quotes.del', error.message);
  },
};

// ─── Stock Transactions ───────────────────────────────────────────────────────
export const dbStockTx = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[db] stock_transactions.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('stock_transactions').upsert(row);
    if (error) console.error('[db] stock_transactions.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('stock_transactions').delete().eq('id', id);
    if (error) console.error('[db] stock_transactions.del', error.message);
  },
};

// ─── Inventory Counts ────────────────────────────────────────────────────────
export const dbInventoryCounts = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[db] inventory_counts.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('inventory_counts').upsert(row);
    if (error) console.error('[db] inventory_counts.upsert', error.message);
  },
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
    if (error) console.error('[db] register_sessions.get', error.message);
    return data ?? null;
  },
  async save(patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('register_sessions')
      .upsert({ id: SESSION_ID, ...patch });
    if (error) console.error('[db] register_sessions.save', error.message);
  },
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
    if (error) console.error('[db] register_config.get', error.message);
    return data ?? null;
  },
  async save(patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('register_config')
      .upsert({ id: REGISTER_ID, ...patch });
    if (error) console.error('[db] register_config.save', error.message);
  },
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
    if (error) console.error('[db] security_config.get', error.message);
    return data ?? null;
  },
  async save(patch: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase
      .from('security_config')
      .upsert({ id: SECURITY_ID, ...patch });
    if (error) console.error('[db] security_config.save', error.message);
  },
};

// ─── Adjustment Reasons ───────────────────────────────────────────────────────
export const dbAdjustmentReasons = {
  async list() {
    if (!ok()) return [];
    const { data, error } = await supabase.from('adjustment_reasons').select('*');
    if (error) console.error('[db] adjustment_reasons.list', error.message);
    return data ?? [];
  },
  async upsert(row: Record<string, unknown>) {
    if (!ok()) return;
    const { error } = await supabase.from('adjustment_reasons').upsert(row);
    if (error) console.error('[db] adjustment_reasons.upsert', error.message);
  },
  async del(id: string) {
    if (!ok()) return;
    const { error } = await supabase.from('adjustment_reasons').delete().eq('id', id);
    if (error) console.error('[db] adjustment_reasons.del', error.message);
  },
};
