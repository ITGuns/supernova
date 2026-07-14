import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../lib/format';
import { useCart } from '../store/cartStore';
import { useSecurity } from '../store/securityStore';
import { useUsers } from '../store/userStore';

const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const sales = useCart((s) => s.sales);
  const staff = useUsers((s) => s.users).filter((u) => u.enabled);
  const currentUserId = useUsers((s) => s.currentUserId);
  const setCurrentUser = useUsers((s) => s.setCurrentUser);
  const clockedInAt = useUsers((s) => s.clockedInAt);
  const clockIn = useUsers((s) => s.clockIn);
  const clockOut = useUsers((s) => s.clockOut);
  const requireSwitchAuth = useSecurity((s) => s.switching === 'always' || s.switching === 'privileges');
  const [askAuth, setAskAuth] = useState(false);
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [, setTick] = useState(0);

  const idx = Math.max(0, staff.findIndex((u) => u.id === currentUserId));
  const user = staff[idx] ?? { id: '', name: 'User', role: '', email: '', password: '' };
  const nextUser = staff[(idx + 1) % Math.max(1, staff.length)];

  const doSwitch = () => {
    if (nextUser) setCurrentUser(nextUser.id);
  };
  const confirmSwitch = () => {
    // Switching requires the password of the user being switched to.
    if (nextUser && pin === nextUser.password) {
      doSwitch();
      setAskAuth(false);
      setPin('');
      setAuthError('');
    } else {
      setAuthError('Incorrect password.');
    }
  };

  const clockedIn = clockedInAt !== null;
  useEffect(() => {
    if (!clockedIn) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [clockedIn]);

  const elapsed = () => {
    if (clockedInAt === null) return '0hrs, 0min';
    const mins = Math.floor((Date.now() - clockedInAt) / 60000);
    return `${Math.floor(mins / 60)}hrs, ${mins % 60}min`;
  };

  // Personal stats: this user's non-training sales, bucketed by day / calendar month.
  const now = Date.now();
  const todayStart = startOfDay(now);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const mine = sales.filter((s) => !s.training && (s.soldBy ?? '') === user.name);
  const today = mine.filter((s) => s.at >= todayStart);
  const month = mine.filter((s) => s.at >= monthStart);
  const sum = (list: typeof mine) => list.reduce((a, x) => a + x.totalMinor, 0);

  return (
    <div className="pd-overlay" onClick={onClose}>
      <aside className="pd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pd-head">
          <button className="pd-close" onClick={onClose} aria-label="Close">×</button>
          {staff.length > 1 && (
            <button className="pd-switch" onClick={() => (requireSwitchAuth ? setAskAuth(true) : doSwitch())}>
              Switch user
            </button>
          )}
        </div>

        {askAuth && nextUser && (
          <div className="pd-authprompt">
            <label>Enter {nextUser.name}’s password to switch</label>
            <input type="password" value={pin} autoFocus onChange={(e) => { setPin(e.target.value); setAuthError(''); }} placeholder="Password" />
            {authError && <div className="pd-auth-error">{authError}</div>}
            <div className="pd-auth-actions">
              <button className="btn-s" onClick={() => { setAskAuth(false); setPin(''); setAuthError(''); }}>Cancel</button>
              <button className="btn-p" disabled={!pin} onClick={confirmSwitch}>Confirm</button>
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
          <button className="btn-s pd-clockbtn" onClick={() => (clockedIn ? clockOut() : clockIn())}>
            {clockedIn ? 'Clock out' : 'Clock in'}
          </button>
        </div>

        <div className="pd-stat">
          <span className="pd-stat-label">Today</span>
          <span className="pd-stat-vals">
            <span className="pd-stat-sub">{today.length} sale{today.length === 1 ? '' : 's'}</span>
            <span className="pd-stat-amt">{fmt(sum(today))}</span>
          </span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">This month</span>
          <span className="pd-stat-vals">
            <span className="pd-stat-sub">{month.length} sale{month.length === 1 ? '' : 's'}</span>
            <span className="pd-stat-amt">{fmt(sum(month))}</span>
          </span>
        </div>
      </aside>
    </div>
  );
}
