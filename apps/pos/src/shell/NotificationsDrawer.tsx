import { useNavigate } from 'react-router-dom';
import { MessengerBird } from '../admin/illustrations';
import { useNotifications } from '../store/notificationStore';

export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const dismiss = useNotifications((s) => s.dismiss);
  const clear = useNotifications((s) => s.clear);
  const nav = useNavigate();
  return (
    <div className="nd-overlay" onClick={onClose}>
      <aside className="nd-panel" onClick={(e) => e.stopPropagation()}>
        <button className="nd-close" onClick={onClose} aria-label="Close">×</button>
        <div className="nd-header">
          Notifications
          {items.length > 0 && (
            <span className="nd-actions">
              <span className="rlink" onClick={markAllRead}>Mark all read</span>
              <span className="rlink" onClick={clear}>Clear</span>
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="nd-body">
            <MessengerBird />
            <div className="nd-title">Woohoo! You have no new notifications.</div>
            <div className="nd-sub">Our messenger birds can take a break now.</div>
          </div>
        ) : (
          <div className="nd-list">
            {items.map((n) => (
              <div key={n.id} className={`nd-item ${n.read ? '' : 'unread'}`}>
                <div className="nd-item-body" onClick={() => { if (n.to) { nav(n.to); onClose(); } }} role={n.to ? 'button' : undefined}>
                  <b>{n.title}</b>
                  <span>{n.text}</span>
                  <span className="nd-time">{new Date(n.at).toLocaleString()}</span>
                </div>
                <button className="nd-x" onClick={() => dismiss(n.id)} aria-label="Dismiss">×</button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
