import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Button, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

import { registerThunk } from '../store/slices/authSlice';
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

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      {/* Right side panel - registration form card */}
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
              <h1 className="font-display mb-1 text-gradient" style={{ fontSize: '2.2rem', fontWeight: 800 }}>Create account</h1>
              <p className="text-muted mb-4">It only takes a minute to get started.</p>
            </motion.div>

            {error && (
              <motion.div variants={itemVariants}>
                <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 border-0 bg-danger-subtle text-danger" style={{ borderRadius: 10 }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span style={{ fontSize: '0.9rem' }}>{error}</span>
                </Alert>
              </motion.div>
            )}

            <Form onSubmit={handleSubmit}>
              <motion.div variants={itemVariants}>
                <Form.Group className="mb-3" controlId="name">
                  <Form.Label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Full name</Form.Label>
                  <div className="input-with-icon">
                    <i className="bi bi-person input-icon-left" />
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      minLength={2}
                    />
                  </div>
                </Form.Group>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Form.Group className="mb-3" controlId="email">
                  <Form.Label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Email address</Form.Label>
                  <div className="input-with-icon">
                    <i className="bi bi-envelope input-icon-left" />
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </Form.Group>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Form.Group className="mb-4" controlId="password">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="mb-0" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Password</Form.Label>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }} className="text-muted">Min 6 characters</span>
                  </div>
                  <div className="input-with-icon">
                    <i className="bi bi-shield-lock input-icon-left" />
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
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
                  disabled={submitting}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(124, 58, 237, 0.25)';
                  }}
                >
                  {submitting ? (
                    <div className="d-flex align-items-center justify-content-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Creating account…</span>
                    </div>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </motion.div>
            </Form>

            <motion.p variants={itemVariants} className="text-muted text-center mb-0 mt-3" style={{ fontSize: '0.9rem' }}>
              Already have an account?{' '}
              <Link to="/login" className="text-brand" style={{ fontWeight: 600, textDecoration: 'none', borderBottom: '1px dashed transparent', transition: 'border-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = 'var(--brand)'}
                onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}
              >
                Sign in
              </Link>
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
