import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { useSecurity } from '../store/securityStore';
import { useUsers } from '../store/userStore';

export function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const sales = useCart((s) => s.sales);
  const staff = useUsers((s) => s.users).filter((u) => u.enabled);
  const requireSwitchAuth = useSecurity((s) => s.switching === 'always' || s.switching === 'privileges');
  const [userIdx, setUserIdx] = useState(0);
  const [askAuth, setAskAuth] = useState(false);
  const [pin, setPin] = useState('');
  const doSwitch = () => setUserIdx((i) => (i + 1) % Math.max(1, staff.length));
  const [clockedIn, setClockedIn] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const user = staff.length ? staff[userIdx % staff.length]! : { name: 'User', role: '', email: '' };

  useEffect(() => {
    if (!clockedIn) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [clockedIn]);

  const elapsed = () => {
    if (!clockedIn || since === null) return '0hrs, 0min';
    const mins = Math.floor((Date.now() - since) / 60000);
    return `${Math.floor(mins / 60)}hrs, ${mins % 60}min`;
  };
  const toggleClock = () => {
    if (clockedIn) {
      setClockedIn(false);
      setSince(null);
    } else {
      setClockedIn(true);
      setSince(Date.now());
    }
  };

  const count = sales.length;
  const revenue = sales.reduce((s, x) => s + x.totalMinor, 0);

  return (
    <div className="pd-overlay" onClick={onClose}>
      <aside className="pd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pd-head">
          <button className="pd-close" onClick={onClose} aria-label="Close">×</button>
          <button className="pd-switch" onClick={() => (requireSwitchAuth ? setAskAuth(true) : doSwitch())}>Switch user</button>
        </div>

        {askAuth && (
          <div className="pd-authprompt">
            <label>Enter password to switch user</label>
            <input type="password" value={pin} autoFocus onChange={(e) => setPin(e.target.value)} placeholder="Password" />
            <div className="pd-auth-actions">
              <button className="btn-s" onClick={() => { setAskAuth(false); setPin(''); }}>Cancel</button>
              <button className="btn-p" disabled={!pin} onClick={() => { doSwitch(); setAskAuth(false); setPin(''); }}>Confirm</button>
            </div>
          </div>
        )}

        <div className="pd-user">
          <div className="pd-name">{user.name.toLowerCase()}</div>
          <div className="pd-role">
            {user.role} <span className="pd-email">{user.email}</span>
          </div>
          <span className="rlink pd-signout" onClick={() => { onClose(); nav('/login'); }}>Sign out</span>
        </div>

        <div className="pd-clock">
          <div className={`pd-clock-status ${clockedIn ? 'in' : ''}`}>You are clocked {clockedIn ? 'in' : 'out'}</div>
          <div className="pd-clock-time">{elapsed()}</div>
          <button className="btn-s pd-clockbtn" onClick={toggleClock}>{clockedIn ? 'Clock out' : 'Clock in'}</button>
        </div>

        <div className="pd-stat">
          <span className="pd-stat-label">Today</span>
          <span className="pd-stat-vals">
            <span className="pd-stat-sub">{count} sale{count === 1 ? '' : 's'}</span>
            <span className="pd-stat-amt">{fmt(revenue)}</span>
          </span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">This month</span>
          <span className="pd-stat-vals">
            <span className="pd-stat-sub">{count} sale{count === 1 ? '' : 's'}</span>
            <span className="pd-stat-amt">{fmt(revenue)}</span>
          </span>
        </div>
      </aside>
    </div>
  );
}
