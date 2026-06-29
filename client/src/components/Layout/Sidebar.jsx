import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
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
      <motion.div 
        className="sidebar__brand"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.span 
          className="logo-mark"
          whileHover={{ rotate: 180, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          CF
        </motion.span>
        <span>ContentForge</span>
      </motion.div>

      <nav className="sidebar__section">
        <div className="sidebar__section-label">Workspace</div>
        {NAV_ITEMS.map((item, idx) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
          >
            <NavLink
              to={item.to}
              onClick={onClick}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
            >
              <i className={`bi ${item.icon}`} />
              {item.label}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <nav className="sidebar__section">
        <div className="sidebar__section-label">Account</div>
        {SECONDARY.map((item, idx) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + idx * 0.05 }}
          >
            <NavLink
              to={item.to}
              onClick={onClick}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
            >
              <i className={`bi ${item.icon}`} />
              {item.label}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="sidebar__footer">
        {user ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
            <div>{user.plan?.toUpperCase()} plan</div>
            <div className="mt-2" style={{ fontSize: '0.78rem' }}>
              {user.wordsUsed?.toLocaleString()} / {user.wordsLimit?.toLocaleString()} words
            </div>
          </motion.div>
        ) : null}
      </div>
    </aside>
  );
}
