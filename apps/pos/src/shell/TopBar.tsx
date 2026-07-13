import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { STORE } from '../data/catalog';
import { useTheme } from '../store/themeStore';
import { useUsers } from '../store/userStore';
import { NotificationsDrawer } from './NotificationsDrawer';
import { ProfileDrawer } from './ProfileDrawer';

export function TopBar() {
  const override = useTheme((s) => s.override);
  const setOverride = useTheme((s) => s.setOverride);
  const { pathname } = useLocation();
  const sectionDefault = pathname.startsWith('/sell') ? 'dark' : 'light';
  const effective = override ?? sectionDefault;
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const currentUser = useUsers((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0]);
  const userName = (currentUser?.name ?? STORE.cashier).toLowerCase();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="topbar-logo">◆</span>
        <span className="topbar-word">nova</span>
      </div>
      <div className="topbar-search">
        <span className="tsearch-icon">⌕</span>
        <input className="tsearch-input" placeholder="Search" />
        <span className="tsearch-kbd">⌘/</span>
      </div>
      <div className="topbar-right">
        <button className="topbar-help">Help</button>
        <button
          className="topbar-theme"
          onClick={() => setOverride(effective === 'dark' ? 'light' : 'dark')}
          title="Toggle light / dark"
          aria-label="Toggle theme"
        >
          {effective === 'dark' ? '☾' : '☀'}
        </button>
        <button className="topbar-bell" aria-label="Notifications" onClick={() => setNotifOpen(true)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>
        <button className="topbar-user" onClick={() => setProfileOpen(true)}>
          {userName}
        </button>
      </div>
      {profileOpen && <ProfileDrawer onClose={() => setProfileOpen(false)} />}
      {notifOpen && <NotificationsDrawer onClose={() => setNotifOpen(false)} />}
    </header>
  );
}
