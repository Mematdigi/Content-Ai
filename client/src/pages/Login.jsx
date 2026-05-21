import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, Button, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';

import { loginThunk } from '../store/slices/authSlice';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { status, error, token } = useSelector((s) => s.auth);
  const from = location.state?.from?.pathname || '/dashboard';

  // If already authed, bounce to where we wanted to go.
  useEffect(() => {
    if (token) navigate(from, { replace: true });
  }, [token, navigate, from]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(loginThunk({ email, password }));
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Welcome back!');
      navigate(from, { replace: true });
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
          <h2>Generate articles that read like a human wrote them.</h2>
          <p>
            A multi-model AI pipeline researches your topic, drafts the piece, optimizes
            for SEO, and humanizes it — all in under a minute.
          </p>

          <ul className="feature-list">
            <li><i className="bi bi-check-lg" /> Multi-model AI: GPT-4o, Claude & Gemini</li>
            <li><i className="bi bi-check-lg" /> Live competitor research</li>
            <li><i className="bi bi-check-lg" /> SEO score 90+ out of the box</li>
            <li><i className="bi bi-check-lg" /> &lt;10% AI detection score</li>
          </ul>
        </div>

        <p style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: '2rem' }}>
          © {new Date().getFullYear()} ContentForge AI
        </p>
      </div>

      <div className="auth-shell__right">
        <div className="auth-shell__form">
          <h1 className="font-display mb-1">Welcome back</h1>
          <p className="text-muted mb-4">Sign in to continue forging content.</p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Group>

            <Button
              type="submit"
              variant="primary"
              className="w-100 mb-3"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </Button>
          </Form>

          <p className="text-muted text-center mb-0">
            New to ContentForge? <Link to="/register" className="text-brand">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
