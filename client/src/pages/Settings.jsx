import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Button, Form } from 'react-bootstrap';
import { logout } from '../store/slices/authSlice';
import { toggleTheme } from '../store/slices/themeSlice';

const PLAN_FEATURES = {
  free: ['5,000 words / month', 'Multi-model pipeline', 'SEO + humanizer', '1 user'],
  pro: ['100,000 words / month', 'All free features', 'Priority queue', 'Bulk generation'],
  enterprise: ['1,000,000 words / month', 'All pro features', 'Dedicated support', 'API access'],
};

export default function Settings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { mode } = useSelector((s) => s.theme);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const wordsUsed = user?.wordsUsed ?? 0;
  const wordsLimit = user?.wordsLimit ?? 5000;
  const usagePct = Math.min(100, Math.round((wordsUsed / wordsLimit) * 100));
  const plan = user?.plan || 'free';
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.free;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__subtitle">Manage your profile, plan, and preferences.</p>
        </div>
      </div>

      <Row className="g-3">
        <Col xs={12} lg={6}>
          <div className="cf-card">
            <h2 className="h5 mb-3">Profile</h2>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Full name</Form.Label>
                <Form.Control value={user?.name || ''} disabled />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control value={user?.email || ''} disabled />
              </Form.Group>
              <p className="text-muted small mb-0">
                Profile editing is coming soon. Contact support to update your details.
              </p>
            </Form>
          </div>
        </Col>

        <Col xs={12} lg={6}>
          <div className="cf-card">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h2 className="h5 mb-1">Plan & usage</h2>
                <span className={`badge bg-${plan === 'enterprise' ? 'warning' : plan === 'pro' ? 'info' : 'secondary'}-subtle text-${plan === 'enterprise' ? 'warning' : plan === 'pro' ? 'info' : 'secondary'} text-uppercase`}>
                  {plan}
                </span>
              </div>
              <Button variant="outline-secondary" size="sm" disabled>
                Upgrade (coming soon)
              </Button>
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">Words used this period</span>
                <strong>{wordsUsed.toLocaleString()} / {wordsLimit.toLocaleString()}</strong>
              </div>
              <div className="progress" style={{ height: 8 }}>
                <div
                  className="progress-bar"
                  style={{ width: `${usagePct}%`, background: 'var(--brand-gradient)' }}
                />
              </div>
            </div>

            <h3 className="h6 text-muted">Plan features</h3>
            <ul className="list-unstyled mb-0">
              {features.map((f) => (
                <li key={f} className="mb-1">
                  <i className="bi bi-check2 text-success me-2" />{f}
                </li>
              ))}
            </ul>
          </div>
        </Col>

        <Col xs={12} lg={6}>
          <div className="cf-card">
            <h2 className="h5 mb-3">Appearance</h2>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">Theme</div>
                <div className="text-muted small">Currently using {mode} mode</div>
              </div>
              <Button variant="outline-secondary" onClick={() => dispatch(toggleTheme())}>
                <i className={`bi ${mode === 'dark' ? 'bi-sun' : 'bi-moon-stars'} me-2`} />
                Switch to {mode === 'dark' ? 'light' : 'dark'}
              </Button>
            </div>
          </div>
        </Col>

        <Col xs={12} lg={6}>
          <div className="cf-card">
            <h2 className="h5 mb-3">Account</h2>
            <p className="text-muted small">Sign out of this device. You can sign back in anytime.</p>
            <Button variant="outline-danger" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2" /> Sign out
            </Button>
          </div>
        </Col>
      </Row>
    </>
  );
}
