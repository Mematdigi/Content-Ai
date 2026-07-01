import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Button, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { registerThunk } from '../store/slices/authSlice';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((s) => s.auth);

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(registerThunk({ name, email, password })).unwrap();
      toast.success('Welcome to ContentForge AI!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-shell__left">
        <div className="brand-block">
          <div className="d-flex align-items-center gap-2">
            <span className="logo-mark" style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center',
              fontWeight: 800, fontSize: '1.1rem',
            }}>CF</span>
            <strong style={{ fontSize: '1.2rem' }}>ContentForge AI</strong>
          </div>
          <h2>Start writing in seconds.</h2>
          <p>Free plan includes 5,000 words per month. No credit card required.</p>
          <ul className="feature-list">
            <li><i className="bi bi-check-lg" /> 5,000 free words/month</li>
            <li><i className="bi bi-check-lg" /> Multi-model AI pipeline</li>
            <li><i className="bi bi-check-lg" /> SEO + humanizer built-in</li>
            <li><i className="bi bi-check-lg" /> Export to MD, HTML, DOCX</li>
          </ul>
        </div>
        <p style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: '2rem' }}>
          © {new Date().getFullYear()} ContentForge AI
        </p>
      </div>

      <div className="auth-shell__right">
        <div className="auth-shell__form">
          <h1 className="font-display mb-1">Create account</h1>
          <p className="text-muted mb-4">It only takes a minute.</p>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Full name</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                minLength={2}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="password">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </Form.Group>

            <Button type="submit" className="w-100 btn-primary" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </Form>

          <p className="text-center mt-4 mb-0 text-muted">
            Already have an account? <Link to="/login" className="text-brand">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
