import { MessengerBird } from '../admin/illustrations';

export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="nd-overlay" onClick={onClose}>
      <aside className="nd-panel" onClick={(e) => e.stopPropagation()}>
        <button className="nd-close" onClick={onClose} aria-label="Close">×</button>
        <div className="nd-header">Notifications</div>
        <div className="nd-body">
          <MessengerBird />
          <div className="nd-title">Woohoo! You have no new notifications.</div>
          <div className="nd-sub">Our messenger birds can take a break now.</div>
        </div>
      </aside>
    </div>
  );
}
