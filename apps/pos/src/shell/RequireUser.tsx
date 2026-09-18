import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { can, permissionForPath, roleOf } from '../lib/permissions';
import { verifyPassword } from '../lib/password';
import { useSecurity } from '../store/securityStore';
import { useUsers } from '../store/userStore';

/**
 * Gate for every screen behind the login. The logged-in cashier is persisted,
 * so a refresh keeps them; a fresh browser or a logout lands here with no
 * user and is sent to the login screen instead of silently acting as the
 * owner account. Roles decide which sections open (Setup → Users → Roles),
 * and Setup → Security can lock the screen after inactivity.
 */
export function RequireUser() {
  const currentUserId = useUsers((s) => s.currentUserId);
  const users = useUsers((s) => s.users);
  const inactivity = useSecurity((s) => s.inactivity);
  const location = useLocation();
  const user = users.find((u) => u.id === currentUserId && u.enabled);
  const [locked, setLocked] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  // Inactivity lock: five minutes without input pauses the session.
  useEffect(() => {
    if (!inactivity || !user) return;
    let timer = window.setTimeout(() => setLocked(true), 5 * 60_000);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), 5 * 60_000);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [inactivity, user]);

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const needed = permissionForPath(location.pathname);
  if (needed && !can(user, needed)) {
    return (
      <div className="app theme-light">
        <div className="perm-denied">
          <h1>You don’t have access to this page</h1>
          <p>
            Your role is <b>{roleOf(user)}</b>. Ask an admin to change your role under Setup → Users if you need this section.
          </p>
          <a className="btn-p" href={can(user, 'sell') ? '/sell' : '/login'}>Back to the register</a>
        </div>
      </div>
    );
  }

  const unlock = async () => {
    const pin = user.details?.pin;
    if ((pin && pw === pin) || (await verifyPassword(pw, user.password))) {
      setLocked(false);
      setPw('');
      setErr('');
    } else setErr('Incorrect password or PIN.');
  };

  return (
    <>
      <Outlet />
      {locked && (
        <div className="lock-overlay">
          <form
            className="lock-card"
            onSubmit={(e) => {
              e.preventDefault();
              unlock();
            }}
          >
            <div className="lock-title">Session paused</div>
            <div className="lock-text">Signed in as <b>{user.name}</b>. Enter your password{user.details?.pin ? ' or PIN' : ''} to continue.</div>
            <input type="password" value={pw} autoFocus onChange={(e) => { setPw(e.target.value); setErr(''); }} placeholder={user.details?.pin ? 'Password or PIN' : 'Password'} />
            {err && <div className="lock-err">{err}</div>}
            <div className="lock-actions">
              <button type="button" className="btn-s" onClick={() => { useUsers.getState().logout(); setLocked(false); }}>Switch user</button>
              <button className="btn-p" type="submit">Unlock</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
