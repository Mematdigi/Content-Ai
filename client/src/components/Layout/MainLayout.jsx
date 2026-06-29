import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { closeMobileSidebar } from '../../store/slices/themeSlice';

import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout() {
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.theme.sidebarCollapsed);
  const mobileOpen = useSelector((s) => s.theme.mobileSidebarOpen);

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={() => dispatch(closeMobileSidebar())}
      />
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
}
