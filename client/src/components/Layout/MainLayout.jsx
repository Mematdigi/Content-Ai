import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout() {
  const collapsed = useSelector((s) => s.theme.sidebarCollapsed);

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
}
