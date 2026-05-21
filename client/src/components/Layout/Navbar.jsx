import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
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

  // Match exact path first, then fall back to a prefix (so /articles/:id
  // shows "Article" rather than nothing).
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
    <header className="app-navbar">
      <div className="d-flex align-items-center gap-2">
        <button
          className="icon-button d-md-none"
          onClick={() => dispatch(toggleMobileSidebar())}
          aria-label="Open menu"
        >
          <i className="bi bi-list" />
        </button>
        <div className="app-navbar__title">{title}</div>
      </div>

      <div className="app-navbar__actions">
        <button
          className="icon-button"
          onClick={() => dispatch(toggleTheme())}
          aria-label="Toggle theme"
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          <i className={`bi ${themeMode === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
        </button>

        <Dropdown align="end">
          <Dropdown.Toggle as="button" className="icon-button" style={{ width: 'auto', padding: '0 0.6rem' }}>
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
          <Dropdown.Menu>
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
    </header>
  );
}
