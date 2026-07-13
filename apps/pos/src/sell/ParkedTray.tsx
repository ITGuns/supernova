import { fmt } from '../lib/format';
import { computeTotals } from '../lib/totals';
import { useCart } from '../store/cartStore';
import { useSettings } from '../store/settingsStore';

export function ParkedTray({ onClose }: { onClose: () => void }) {
  const parked = useCart((s) => s.parked);
  const retrieve = useCart((s) => s.retrieve);
  const discard = useCart((s) => s.discardParked);
  const taxBps = useSettings((s) => s.defaultTaxRateBps);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Retrieve sale</h3>
          <button className="pm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {parked.length === 0 && <div className="drawer-empty">No parked sales.</div>}
        {parked.map((p) => {
          const t = computeTotals(p.lines, 0, 'USD', taxBps);
          return (
            <div key={p.id} className="parked-item">
              <div>
                <div className="parked-label">Sale {p.label}</div>
                <div className="parked-meta">
                  {t.itemCount} item{t.itemCount === 1 ? '' : 's'} · {fmt(t.totalMinor)}
                </div>
              </div>
              <div className="parked-actions">
                <button className="parked-retrieve" onClick={() => { retrieve(p.id); onClose(); }}>
                  Retrieve
                </button>
                <button className="parked-discard" onClick={() => discard(p.id)}>
                  Discard
                </button>
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
