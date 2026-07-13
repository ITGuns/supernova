import { Outlet } from 'react-router-dom';
import { useTheme } from '../store/themeStore';
import { IconRail } from './IconRail';
import { TopBar } from './TopBar';

export function AdminLayout() {
  const theme = useTheme((s) => s.override) ?? 'light';
  return (
    <div className={`app theme-${theme}`}>
      <TopBar />
      <div className="body">
        <IconRail />
        <Outlet />
      </div>
    </div>
  );
}
