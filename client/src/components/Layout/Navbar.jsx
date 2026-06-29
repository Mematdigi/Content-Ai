import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { toggleTheme, toggleMobileSidebar } from '../../store/slices/themeSlice';
import { logout } from '../../store/slices/authSlice';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/generate': 'AI Article Generator',
  '/history': 'Article History',
  '/tools': 'Tools',
  '/settings': 'Settings',
};

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const themeMode = useSelector((s) => s.theme.mode);
  const user = useSelector((s) => s.auth.user);


  const title =
    TITLES[pathname] ||
    (pathname.startsWith('/articles/') ? 'Article' : 'ContentForge');

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.header 
      className="app-navbar"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="d-flex align-items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="icon-button d-md-none"
          onClick={() => dispatch(toggleMobileSidebar())}
          aria-label="Open menu"
        >
          <i className="bi bi-list" />
        </motion.button>
        <div className="app-navbar__title">{title}</div>
      </div>

      <div className="app-navbar__actions">
        <motion.button
          whileHover={{ scale: 1.05, rotate: 15 }}
          whileTap={{ scale: 0.95 }}
          className="icon-button"
          onClick={() => dispatch(toggleTheme())}
          aria-label="Toggle theme"
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          <i className={`bi ${themeMode === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
        </motion.button>

        <Dropdown align="end">
          <Dropdown.Toggle as={motion.button} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="icon-button d-flex align-items-center" style={{ width: 'auto', padding: '0 0.6rem' }}>
            <span
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8rem',
                marginRight: 8,
              }}
            >
              {initials || 'U'}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user?.name}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu as={motion.div} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ backdropFilter: 'blur(12px)', background: 'var(--surface)' }}>
            <Dropdown.Item onClick={() => navigate('/settings')}>
              <i className="bi bi-gear me-2" /> Settings
            </Dropdown.Item>
            <Dropdown.Item onClick={() => navigate('/history')}>
              <i className="bi bi-clock-history me-2" /> History
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              onClick={() => {
                dispatch(logout());
                navigate('/login');
              }}
            >
              <i className="bi bi-box-arrow-right me-2" /> Sign out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </motion.header>
  );
}
