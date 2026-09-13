/**
 * syncErrors.ts — surfaces failed Supabase writes/reads to the UI.
 *
 * Every db.ts helper used to swallow errors with a console.error, so a
 * rejected write (bad column, unique-constraint clash, network drop) looked
 * identical to success: the local store updated, the cloud silently didn't.
 * Helpers now call reportDbError(), which still logs but also broadcasts an
 * event the <SyncToast> listens to, so the operator sees "not saved" instantly.
 */

export const DB_ERROR_EVENT = 'nova:db-error';

export interface DbErrorDetail {
  /** Which helper failed, e.g. "customers.upsert". */
  scope: string;
  /** Raw Supabase/PostgREST message. */
  message: string;
  /** True when the write was kept in the retry queue and will be replayed. */
  queued: boolean;
  at: number;
}

export function reportDbError(scope: string, message: string, opts: { queued?: boolean } = {}): void {
  const queued = opts.queued ?? false;
  (queued ? console.warn : console.error)(`[db] ${scope}${queued ? ' (queued for retry)' : ''}`, message);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DbErrorDetail>(DB_ERROR_EVENT, {
      detail: { scope, message, queued, at: Date.now() },
    }),
  );
}
