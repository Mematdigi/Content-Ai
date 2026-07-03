import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, Button, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

import { loginThunk } from '../store/slices/authSlice';
import AuthSimulator from '../components/AuthSimulator';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 110,
      damping: 14,
    },
  },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
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
      {/* Background ambient glow blobs for professional aesthetics */}
      <div className="ambient-glow ambient-glow--1" />
      <div className="ambient-glow ambient-glow--2" />

      {/* Left side panel - animated brand block and AI Pipeline Simulator */}
      <div className="auth-shell__left">
        <motion.div 
          className="brand-block"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="d-flex align-items-center gap-2 mb-4">
            <span className="logo-mark" style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center',
              fontWeight: 800, fontSize: '1.25rem', border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', textShadow: '0 2px 4px rgba(0,0,0,0.15)',
            }}>CF</span>
            <strong style={{ fontSize: '1.35rem', letterSpacing: '-0.5px' }}>ContentForge AI</strong>
          </div>
        </motion.div>

        {/* Live animated AI engine simulation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          <AuthSimulator />
        </motion.div>

        <motion.p 
          style={{ opacity: 0.7, fontSize: '0.82rem', marginTop: '2.5rem', zIndex: 5, position: 'relative' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.5 }}
        >
          © {new Date().getFullYear()} ContentForge AI. All rights reserved.
        </motion.p>
      </div>

      {/* Right side panel - login form card */}
      <div className="auth-shell__right">
        <motion.div 
          className="auth-shell__form"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, cubicBezier: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="text-center text-lg-start">
              <h1 className="font-display mb-1 text-gradient" style={{ fontSize: '2.2rem', fontWeight: 800 }}>Welcome back</h1>
              <p className="text-muted mb-4">Sign in to continue forging content.</p>
            </motion.div>

            {error && (
              <motion.div variants={itemVariants}>
                <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 border-0 bg-danger-subtle text-danger" style={{ borderRadius: 10 }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span style={{ fontSize: '0.9rem' }}>{error}</span>
                </Alert>
              </motion.div>
            )}

            <Form onSubmit={onSubmit}>
              <motion.div variants={itemVariants}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Email address</Form.Label>
                  <div className="input-with-icon">
                    <i className="bi bi-envelope input-icon-left" />
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </Form.Group>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Form.Group className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="mb-0" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Password</Form.Label>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }} className="text-muted">Required</span>
                  </div>
                  <div className="input-with-icon">
                    <i className="bi bi-shield-lock input-icon-left" />
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="input-icon-right"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                </Form.Group>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 mb-3"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: '1rem',
                    background: 'var(--brand-gradient)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  disabled={status === 'loading'}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(124, 58, 237, 0.25)';
                  }}
                >
                  {status === 'loading' ? (
                    <div className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Signing in…</span>
                    </div>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </motion.div>
            </Form>

            <motion.p variants={itemVariants} className="text-muted text-center mb-0 mt-3" style={{ fontSize: '0.9rem' }}>
              New to ContentForge?{' '}
              <Link to="/register" className="text-brand" style={{ fontWeight: 600, textDecoration: 'none', borderBottom: '1px dashed transparent', transition: 'border-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = 'var(--brand)'}
                onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}
              >
                Create an account
              </Link>
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
