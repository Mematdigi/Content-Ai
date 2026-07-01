import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Row, Col, Button } from 'react-bootstrap';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import api from '../services/api';
import PageTransition from '../components/Layout/PageTransition';

const StatTile = ({ icon, label, value, delta, tone = 'brand', progress }) => (
  <motion.div 
    className="stat-tile"
    whileHover={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <div className={`stat-tile__icon stat-tile__icon--${tone}`}>
      <i className={`bi ${icon}`} />
    </div>
    <div className="stat-tile__body w-100">
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value mb-2">{value}</div>
      <div className="mt-auto">
        {delta !== undefined && delta !== null && (
          <div className="stat-tile__delta">{delta}</div>
        )}
        {progress !== undefined && progress !== null && (
          <div className="stat-tile__progress mt-2">
            <div 
              className={`stat-tile__progress-bar stat-tile__progress-bar--${tone}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.message || 'Could not load stats.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalArticles = stats?.totalArticles ?? 0;
  const avgSeo = stats?.avgSeoScore ?? 0;
  const avgAi = stats?.avgAiScore ?? 0;
  const wordsUsed = user?.wordsUsed ?? 0;
  const wordsLimit = user?.wordsLimit ?? 5000;
  const usagePct = Math.min(100, Math.round((wordsUsed / wordsLimit) * 100));

  // Build a simple chart from recent articles
  const chartData = (stats?.recent || []).slice().reverse().map((a, i) => ({
    name: `#${i + 1}`,
    seo: a.seoScore || 0,
    ai: a.aiScoreAfter ?? 0,
  }));

  return (
    <PageTransition>
      <div className="page__header">
        <div>
          <h1 className="page__title">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.</h1>
          <p className="page__subtitle">Here's a snapshot of your content workspace.</p>
        </div>
        <Link to="/generate" className="btn btn-primary">
          <i className="bi bi-stars me-2" /> New article
        </Link>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      <motion.div variants={containerVariants} initial="hidden" animate="show">
        <Row className="g-3 mb-4">
          <Col xs={12} sm={6} lg={3}>
            <motion.div variants={itemVariants} className="h-100">
              <StatTile 
                icon="bi-file-earmark-text" 
                label="Articles generated" 
                value={loading ? '—' : totalArticles} 
                delta={loading ? null : 'All-time content count'} 
                tone="brand" 
              />
            </motion.div>
          </Col>
          <Col xs={12} sm={6} lg={3}> 
            <motion.div variants={itemVariants} className="h-100">
              <StatTile 
                icon="bi-graph-up-arrow" 
                label="Avg. SEO score" 
                value={loading ? '—' : `${avgSeo}/100`} 
                delta={loading ? null : `${avgSeo}% optimization avg.`} 
                tone="success" 
                progress={loading ? null : avgSeo} 
              />
            </motion.div>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <motion.div variants={itemVariants} className="h-100">
              <StatTile 
                icon="bi-robot" 
                label="Avg. AI detection" 
                value={loading ? '—' : `${avgAi}%`} 
                delta={loading ? null : `${100 - avgAi}% human-written avg.`} 
                tone="info" 
                progress={loading ? null : avgAi} 
              />
            </motion.div>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <motion.div variants={itemVariants} className="h-100">
              <StatTile
                icon="bi-lightning-charge"
                label="Words used"
                value={loading ? '—' : `${wordsUsed.toLocaleString()} / ${wordsLimit.toLocaleString()}`}
                delta={loading ? null : `${usagePct}% of ${user?.plan || 'free'} plan`}
                tone="warning"
                progress={usagePct}
              />
            </motion.div>
          </Col>
        </Row>
      </motion.div>

      <Row className="g-3">
        <Col xs={12} lg={7}>
          <motion.div 
            className="cf-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Recent performance</h2>
              <span className="text-muted small">SEO vs AI score</span>
            </div>
            {chartData.length === 0 ? (
              <div className="empty-state">
                <div className="icon"><i className="bi bi-bar-chart" /></div>
                <p>No data yet. Generate your first article to see analytics here.</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSeo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.15}/>
                      </linearGradient>
                      <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--info)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--info)" stopOpacity={0.15}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        color: 'var(--text)',
                        boxShadow: 'var(--shadow-md)',
                        backdropFilter: 'blur(8px)',
                      }}
                    />
                    <Bar dataKey="seo" name="SEO Score" fill="url(#colorSeo)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ai" name="AI Detection" fill="url(#colorAi)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </Col>

        <Col xs={12} lg={5}>
          <motion.div 
            className="cf-card h-100"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Recent articles</h2>
              <Link to="/history" className="text-brand small">View all</Link>
            </div>

            {loading ? (
              <>
                <div className="skeleton mb-2" style={{ height: 60 }} />
                <div className="skeleton mb-2" style={{ height: 60 }} />
                <div className="skeleton" style={{ height: 60 }} />
              </>
            ) : (stats?.recent?.length ? (
              <motion.div className="d-flex flex-column gap-2" variants={containerVariants} initial="hidden" animate="show">
                {stats.recent.map((a) => (
                  <motion.div key={a._id} variants={itemVariants}>
                    <Link 
                      to={`/articles/${a._id}`} 
                      className={`article-row article-row--status-${a.status || 'completed'}`}
                    >
                      <div className="article-row__main">
                        <div className="article-row__title">{a.title || 'Untitled'}</div>
                        <div className="article-row__meta">
                          <span className="article-row__date">
                            <i className="bi bi-calendar3 me-1" />
                            {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {a.wordCount !== undefined && a.wordCount !== null && (
                            <span className="article-row__words ms-3">
                              <i className="bi bi-file-earmark-word me-1" />
                              {a.wordCount.toLocaleString()} words
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="article-row__stats">
                        <div className="article-row__stat-badge article-row__stat-badge--seo">
                          <span className="label">SEO</span>
                          <span className="val">{a.seoScore || 0}</span>
                        </div>
                        <div className="article-row__stat-badge article-row__stat-badge--ai">
                          <span className="label">AI</span>
                          <span className="val">{a.aiScoreAfter ?? '—'}%</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="empty-state">
                <div className="icon"><i className="bi bi-journal-text" /></div>
                <p>No articles yet.</p>
                <Link to="/generate"><Button size="sm">Generate one</Button></Link>
              </div>
            ))}
          </motion.div>
        </Col>
      </Row>
    </PageTransition>
  );
}
