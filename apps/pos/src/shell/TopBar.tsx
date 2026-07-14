import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { STORE } from '../data/catalog';
import { useProducts } from '../store/productStore';
import { useTheme } from '../store/themeStore';
import { useUsers } from '../store/userStore';
import { NotificationsDrawer } from './NotificationsDrawer';
import { NovaLogo } from './NovaLogo';
import { ProfileDrawer } from './ProfileDrawer';
import '../styles/setup.css';

export function TopBar() {
  const override = useTheme((s) => s.override);
  const setOverride = useTheme((s) => s.setOverride);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sectionDefault = pathname.startsWith('/sell') ? 'dark' : 'light';
  const effective = override ?? sectionDefault;
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const products = useProducts((s) => s.products);
  const currentUser = useUsers((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0]);
  const userName = (currentUser?.name ?? STORE.cashier).toLowerCase();

  // ⌘/ (or Ctrl+/) focuses the global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 6)
    : [];

  const goCatalog = (search: string) => {
    navigate('/catalog', { state: { q: search } });
    setQuery('');
    searchRef.current?.blur();
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="topbar-logo"><NovaLogo size={24} /></span>
        <span className="topbar-word">nova</span>
      </div>
      <div className="topbar-search">
        <span className="tsearch-icon">⌕</span>
        <input
          ref={searchRef}
          className="tsearch-input"
          placeholder="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && query.trim() && goCatalog(query.trim())}
        />
        <span className="tsearch-kbd">⌘/</span>
        {q && (
          <div className="tsearch-drop">
            {matches.length === 0 ? (
              <div className="tsearch-empty">No products match “{query.trim()}”.</div>
            ) : (
              matches.map((p) => (
                <div key={p.id} className="tsearch-item" onMouseDown={() => goCatalog(p.name)}>
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                  <span className="tsearch-item-sku">{p.sku}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <div className="help-wrap">
          <button className="topbar-help" onClick={() => setHelpOpen((v) => !v)}>Help</button>
          {helpOpen && (
            <>
              <div className="help-scrim" onClick={() => setHelpOpen(false)} />
              <div className="help-pop">
                <div className="help-pop-h">Get help with Nova</div>
                <Link className="help-pop-item" to="/sell/status" onClick={() => setHelpOpen(false)}>Register status</Link>
                <Link className="help-pop-item" to="/setup" onClick={() => setHelpOpen(false)}>Setup guide</Link>
                <Link className="help-pop-item" to="/reporting" onClick={() => setHelpOpen(false)}>Reporting</Link>
              </div>
            </>
          )}
        </div>
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
