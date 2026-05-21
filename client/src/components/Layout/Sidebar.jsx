import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { closeMobileSidebar } from '../../store/slices/themeSlice';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
  { to: '/generate', label: 'AI Generator', icon: 'bi-magic' },
  { to: '/history', label: 'History', icon: 'bi-clock-history' },
  { to: '/tools', label: 'Tools', icon: 'bi-tools' },
];

const SECONDARY = [
  { to: '/settings', label: 'Settings', icon: 'bi-gear' },
];

export default function Sidebar() {
  const dispatch = useDispatch();
  const mobileOpen = useSelector((s) => s.theme.mobileSidebarOpen);
  const user = useSelector((s) => s.auth.user);

  const onClick = () => dispatch(closeMobileSidebar());

  return (
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="sidebar__brand">
        <span className="logo-mark">CF</span>
        <span>ContentForge</span>
      </div>

      <nav className="sidebar__section">
        <div className="sidebar__section-label">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
          >
            <i className={`bi ${item.icon}`} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <nav className="sidebar__section">
        <div className="sidebar__section-label">Account</div>
        {SECONDARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
          >
            <i className={`bi ${item.icon}`} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        {user ? (
          <>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
            <div>{user.plan?.toUpperCase()} plan</div>
            <div className="mt-2" style={{ fontSize: '0.78rem' }}>
              {user.wordsUsed?.toLocaleString()} / {user.wordsLimit?.toLocaleString()} words
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
