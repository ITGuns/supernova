import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUsers } from '../store/userStore';

/**
 * Gate for every screen behind the login. The logged-in cashier is persisted,
 * so a refresh keeps them; a fresh browser or a logout lands here with no
 * user and is sent to the login screen instead of silently acting as the
 * owner account.
 */
export function RequireUser() {
  const currentUserId = useUsers((s) => s.currentUserId);
  const users = useUsers((s) => s.users);
  const location = useLocation();
  const known = currentUserId !== null && users.some((u) => u.id === currentUserId && u.enabled);
  if (!known) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
