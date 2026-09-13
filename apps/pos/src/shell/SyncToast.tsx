import { useEffect, useState } from 'react';
import { DB_ERROR_EVENT, type DbErrorDetail } from '../lib/syncErrors';

const AUTO_HIDE_MS = 8000;

/** Friendly wording for the PostgREST messages operators will actually hit. */
const humanize = (d: DbErrorDetail): string => {
  const m = d.message.toLowerCase();
  if (m.includes('duplicate key')) return 'That number is already in use in the cloud. Reload to resync and try again.';
  if (m.includes('could not find') && m.includes('column')) return 'The database schema is out of date for this record.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection — the change is kept on this device only.';
  return d.message;
};

/**
 * Bottom-center toast shown whenever a Supabase call fails. The local change
 * has already been applied, so the message is explicit that it did NOT reach
 * the cloud rather than implying the whole action failed.
 */
export function SyncToast() {
  const [err, setErr] = useState<DbErrorDetail | null>(null);

  useEffect(() => {
    const onErr = (e: Event) => setErr((e as CustomEvent<DbErrorDetail>).detail);
    window.addEventListener(DB_ERROR_EVENT, onErr);
    return () => window.removeEventListener(DB_ERROR_EVENT, onErr);
  }, []);

  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(null), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [err]);

  if (!err) return null;
  return (
    <div className="sync-toast" role="alert">
      <span className="sync-toast-ic">⚠</span>
      <span className="sync-toast-body">
        <b>Not saved to the cloud</b> — {humanize(err)}
        <span className="sync-toast-scope">{err.scope}</span>
      </span>
      <button className="sync-toast-x" onClick={() => setErr(null)} aria-label="Dismiss">×</button>
    </div>
  );
}
