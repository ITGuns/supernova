import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IconRail } from '../shell/IconRail';
import { TopBar } from '../shell/TopBar';
import { useRegister } from '../store/registerStore';
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
  const outlets = useSetup((s) => s.outlets);
  const outletId = useRegister((s) => s.outletId);
  const registerName = useRegister((s) => s.registerName);
  const setDevice = useRegister((s) => s.setDevice);
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];
  const register = registerName && outlet?.registers.includes(registerName) ? registerName : outlet?.registers[0] ?? 'Main Register';
  const [switching, setSwitching] = useState(false);
  const [pickOutlet, setPickOutlet] = useState(outlet?.id ?? '');
  const [pickRegister, setPickRegister] = useState(register);
  const pickOutletObj = outlets.find((o) => o.id === pickOutlet) ?? outlet;
  return (
    <div className={`app theme-${theme}`}>
      <TopBar />
      <div className="body">
        <IconRail />
        <aside className="sellnav">
          <div className="sellnav-reg">
            <div className="sellnav-reg-name">{register}</div>
            <div className="sellnav-reg-outlet">{outlet?.name ?? 'Main Outlet'}</div>
            <button className="sellnav-switch" onClick={() => { setPickOutlet(outlet?.id ?? ''); setPickRegister(register); setSwitching(true); }}>Switch ⌄</button>
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
      {switching && (
        <div className="pm-overlay" onClick={() => setSwitching(false)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>Switch register</h2>
              <button className="pm-close" onClick={() => setSwitching(false)} aria-label="Close">×</button>
            </div>
            <form
              className="reg-open-body"
              onSubmit={(e) => {
                e.preventDefault();
                setDevice(pickOutletObj?.id ?? null, pickRegister || pickOutletObj?.registers[0] || null);
                setSwitching(false);
              }}
            >
              <p className="reg-open-text">Choose the outlet and register this device sells from. Sales, taxes and stock movements are recorded against it.</p>
              <label className="reg-open-field">
                <span>Outlet</span>
                <select value={pickOutletObj?.id ?? ''} onChange={(e) => { setPickOutlet(e.target.value); setPickRegister(outlets.find((o) => o.id === e.target.value)?.registers[0] ?? ''); }}>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="reg-open-field">
                <span>Register</span>
                <select value={pickRegister} onChange={(e) => setPickRegister(e.target.value)}>
                  {(pickOutletObj?.registers ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <button className="pm-complete" type="submit">Switch</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
