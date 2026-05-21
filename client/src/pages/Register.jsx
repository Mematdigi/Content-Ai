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
      <aside className="auth-shell__brand">
        <div className="auth-shell__brand-inner">
          <div className="auth-shell__logo">
            <span className="logo-mark">CF</span>
            <span>ContentForge AI</span>
          </div>
          <h1 className="auth-shell__headline">Start writing in seconds.</h1>
          <p className="auth-shell__subtext">
            Free plan includes 5,000 words per month. No credit card required.
          </p>
          <ul className="feature-list">
            <li><i className="bi bi-check2-circle" /> 5,000 free words/month</li>
            <li><i className="bi bi-check2-circle" /> Multi-model AI pipeline</li>
            <li><i className="bi bi-check2-circle" /> SEO + humanizer built-in</li>
            <li><i className="bi bi-check2-circle" /> Export to MD, HTML, DOCX</li>
          </ul>
        </div>
      </aside>

      <main className="auth-shell__form-wrap">
        <div className="auth-shell__form">
          <h2 className="mb-1">Create account</h2>
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
      </main>
    </div>
  );
}
