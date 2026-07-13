import { NavLink, useLocation, useNavigate } from 'react-router-dom';

type IconName =
  | 'home'
  | 'sell'
  | 'online'
  | 'reporting'
  | 'catalog'
  | 'inventory'
  | 'customers'
  | 'finance'
  | 'setup';

const TOP: { key: IconName; to: string; label: string }[] = [
  { key: 'home', to: '/home', label: 'Home' },
  { key: 'sell', to: '/sell', label: 'Sell' },
  { key: 'online', to: '/online', label: 'Online' },
];

const MAIN: { key: IconName; to: string; label: string }[] = [
  { key: 'reporting', to: '/reporting', label: 'Reporting' },
  { key: 'catalog', to: '/catalog', label: 'Catalog' },
  { key: 'inventory', to: '/inventory', label: 'Inventory' },
  { key: 'customers', to: '/customers', label: 'Customers' },
  { key: 'finance', to: '/finance', label: 'Finance' },
  { key: 'setup', to: '/setup', label: 'Setup' },
];

function Icon({ name }: { name: IconName }) {
  const c = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...c}>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case 'sell':
      return (
        <svg {...c}>
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M2 3h3l2.2 11h11l1.8-8H6.2" />
        </svg>
      );
    case 'online':
      return (
        <svg {...c}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M3 9h18" />
        </svg>
      );
    case 'reporting':
      return (
        <svg {...c}>
          <path d="M3 21h18" />
          <rect x="5" y="11" width="3" height="7" />
          <rect x="10.5" y="6" width="3" height="12" />
          <rect x="16" y="13" width="3" height="5" />
        </svg>
      );
    case 'catalog':
      return (
        <svg {...c}>
          <path d="M20.5 12.5 12 21l-8.5-8.5V4H12z" />
          <circle cx="8" cy="8" r="1.3" />
        </svg>
      );
    case 'inventory':
      return (
        <svg {...c}>
          <path d="M3 8l9-4 9 4-9 4z" />
          <path d="M3 8v8l9 4 9-4V8" />
          <path d="M12 12v8" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...c}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 5a3 3 0 0 1 0 6M18 14c2.2.8 4 2.8 4 6" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...c}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'setup':
      return (
        <svg {...c}>
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export function IconRail() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/');
  const expanded = pathname === '/home' || pathname === '/online' || pathname === '/finance';

  const item = (i: { key: IconName; to: string; label: string }) => (
    <NavLink
      key={i.key}
      to={i.to}
      className={`rail-item ${isActive(i.to) ? 'rail-active' : ''}`}
      title={i.label}
      aria-label={i.label}
    >
      <Icon name={i.key} />
      <span className="rail-label">{i.label}</span>
    </NavLink>
  );

  return (
    <nav className={`iconrail ${expanded ? 'expanded' : ''}`}>
      {TOP.map(item)}
      <div className="rail-divider" />
      {MAIN.map(item)}
      <button className="rail-collapse" title="Log out" aria-label="Log out" onClick={() => nav('/login')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
    </nav>
  );
}
