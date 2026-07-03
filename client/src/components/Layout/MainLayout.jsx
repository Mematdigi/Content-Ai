import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { closeMobileSidebar, toggleTheme } from '../../store/slices/themeSlice';

import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout() {
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.theme.sidebarCollapsed);
  const mobileOpen = useSelector((s) => s.theme.mobileSidebarOpen);
  const token = useSelector((s) => s.auth.token);
  const themeMode = useSelector((s) => s.theme.mode);

  if (!token) {
    return (
      <div className="app-shell is-public">
        <div className="ambient-glow ambient-glow--1" />
        <div className="ambient-glow ambient-glow--2" />
        <div className="app-main" style={{ minHeight: '100vh' }}>
          <header className="app-navbar d-flex align-items-center justify-content-between px-3 px-md-4">
            <div className="d-flex align-items-center gap-2">
              <span className="logo-mark" style={{
                width: 32,
                height: 32,
                borderRadius: '9px',
                background: 'var(--brand-gradient)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 800,
                boxShadow: 'var(--shadow-glow)',
                flexShrink: 0
              }}>CF</span>
              <span className="fw-bold" style={{ fontSize: '1.1rem', letterSpacing: '-0.02em', background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>ContentForge AI</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                className="icon-button"
                onClick={() => dispatch(toggleTheme())}
                aria-label="Toggle theme"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <i className={`bi ${themeMode === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
              </button>
              <a href="/login" className="btn btn-sm btn-outline-secondary px-3 py-1.5" style={{ borderRadius: '10px', fontWeight: 500 }}>Sign In</a>
              <a href="/register" className="btn btn-sm btn-primary px-3 py-1.5" style={{ borderRadius: '10px', fontWeight: 500 }}>Get Started</a>
            </div>
          </header>
          <div className="page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="ambient-glow ambient-glow--1" />
      <div className="ambient-glow ambient-glow--2" />
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={() => dispatch(closeMobileSidebar())}
      />
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
