import { NavLink, Outlet } from 'react-router-dom';
import { IconRail } from '../shell/IconRail';
import { TopBar } from '../shell/TopBar';
import { useSettings } from '../store/settingsStore';
import { useSetup } from '../store/setupStore';
import { useTheme } from '../store/themeStore';

const SUB = [
  { to: '/sell', label: 'Sell', end: true },
  { to: '/sell/open-close', label: 'Open / Close', end: false },
  { to: '/sell/sales-history', label: 'Sales history', end: false },
  { to: '/sell/cash-management', label: 'Cash management', end: false },
  { to: '/sell/status', label: 'Status', end: false },
  { to: '/sell/settings', label: 'Settings', end: false },
  { to: '/sell/quotes', label: 'Quotes', end: false },
];

export function SellLayout() {
  const theme = useTheme((s) => s.override) ?? 'dark';
  const storeName = useSettings((s) => s.storeName);
  const registerName = useSetup((s) => s.outlets[0]?.registers[0]) ?? 'Main Register';
  return (
    <div className={`app theme-${theme}`}>
      <TopBar />
      <div className="body">
        <IconRail />
        <aside className="sellnav">
          <div className="sellnav-reg">
            <div className="sellnav-reg-name">{registerName}</div>
            <div className="sellnav-reg-outlet">{storeName}</div>
            <button className="sellnav-switch">Switch ⌄</button>
          </div>
          <nav className="sellnav-list">
            {SUB.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                className={({ isActive }) => `sellnav-item ${isActive ? 'sellnav-active' : ''}`}
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <Outlet />
      </div>
    </div>
  );
}
