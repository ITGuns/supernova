/**
 * syncQueue.ts — durable retry queue for cloud writes.
 *
 * A register must keep selling when the connection drops. Before this, a
 * failed Supabase write was applied locally and then lost forever — the
 * cloud never caught up. Now every write goes through `write()`: it runs
 * immediately, and if it fails for a *transient* reason (offline, timeout,
 * 5xx) the operation is appended to a localStorage-backed queue and replayed
 * in order on reconnect, on app start, and on a slow timer.
 *
 * Permanent failures (bad column, unique-constraint clash, RLS) are not
 * queued — retrying can't fix them — they are reported once via the toast.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { reportDbError } from './syncErrors';

export type QueuedKind = 'upsert' | 'insert' | 'update' | 'delete';

export interface QueuedOp {
  id: string;
  table: string;
  kind: QueuedKind;
  /** Row / patch for upsert, insert, update. */
  payload?: Record<string, unknown>;
  /** Row selector for update / delete. */
  match?: { col: string; val: string };
  /** db.ts scope label, e.g. "sales.insert" — used in toasts. */
  scope: string;
  at: number;
  attempts: number;
}

const KEY = 'nova-sync-queue-v1';
const FLUSH_INTERVAL_MS = 30_000;

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const load = (): QueuedOp[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
};
const save = (ops: QueuedOp[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* storage full or unavailable — nothing more we can do */
  }
};

export const pendingCount = (): number => load().length;

interface SbError { message: string; code?: string; status?: number }

/**
 * Transient = worth retrying. PostgREST attaches a `code` to every server-side
 * rejection (PGRST…, 23505, 42703…); a plain fetch failure has none.
 */
export const isTransient = (e: SbError | null | undefined): boolean => {
  if (!e) return false;
  if (typeof e.status === 'number' && e.status >= 500) return true;
  if (e.code) return false;
  return /fetch|network|load failed|timeout|abort/i.test(e.message ?? '');
};

const execOp = async (op: QueuedOp): Promise<SbError | null> => {
  const t = supabase.from(op.table);
  let res: { error: SbError | null };
  switch (op.kind) {
    case 'upsert':
      res = await t.upsert(op.payload ?? {});
      break;
    case 'insert':
      res = await t.insert(op.payload ?? {});
      break;
    case 'update':
      res = await t.update(op.payload ?? {}).eq(op.match!.col, op.match!.val);
      break;
    case 'delete':
      res = await t.delete().eq(op.match!.col, op.match!.val);
      break;
  }
  return res.error;
};

/**
 * Run a write now; queue it for replay if it fails transiently.
 * `op` fully describes the write so it can be re-executed later without the
 * original closure.
 */
export async function write(op: Omit<QueuedOp, 'id' | 'at' | 'attempts'>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // Writes to one table run in the order they were issued. Two back-to-back
  // requests (park a sale, then retrieve it) can otherwise overtake each
  // other on the network, so a delete lands before the insert it undoes.
  const prev = tableChains.get(op.table) ?? Promise.resolve();
  const run = prev.then(() => execWrite(op));
  tableChains.set(op.table, run.catch(() => undefined));
  return run;
}

const tableChains = new Map<string, Promise<void>>();

async function execWrite(op: Omit<QueuedOp, 'id' | 'at' | 'attempts'>): Promise<void> {
  const error = await execOp({ ...op, id: '', at: 0, attempts: 0 });
  if (!error) return;
  if (isTransient(error)) {
    const ops = load();
    ops.push({ ...op, id: uid(), at: Date.now(), attempts: 1 });
    save(ops);
    reportDbError(op.scope, error.message, { queued: true });
  } else {
    reportDbError(op.scope, error.message);
  }
}

let flushing = false;

/** Replay queued writes in order. Stops at the first still-transient failure. */
export async function flush(): Promise<{ sent: number; left: number }> {
  if (flushing || !isSupabaseConfigured()) return { sent: 0, left: pendingCount() };
  flushing = true;
  let sent = 0;
  try {
    let ops = load();
    while (ops.length) {
      const op = ops[0]!;
      const error = await execOp(op);
      if (!error) {
        ops = ops.slice(1);
        save(ops);
        sent++;
        continue;
      }
      if (isTransient(error)) {
        op.attempts++;
        save(ops);
        break; // still offline — keep order, try again later
      }
      ops = ops.slice(1);
      save(ops);
      // A replayed insert that hits its own primary key means the original
      // request reached the server but its response never came back (tab
      // closed or reloaded mid-flight). The row is there — that's success.
      if (op.kind === 'insert' && error.code === '23505') {
        sent++;
        continue;
      }
      // Permanent: drop it so it can't block everything behind it, but say so.
      reportDbError(`${op.scope} (queued replay dropped)`, error.message);
    }
    return { sent, left: ops.length };
  } finally {
    flushing = false;
  }
}

/** Wire up automatic replay: on start, on reconnect, and every 30 s. */
export function startSyncQueue(): void {
  if (typeof window === 'undefined') return;
  void flush();
  window.addEventListener('online', () => void flush());
  setInterval(() => {
    if (pendingCount() > 0) void flush();
  }, FLUSH_INTERVAL_MS);
}
