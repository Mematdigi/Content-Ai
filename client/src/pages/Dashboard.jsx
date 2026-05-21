import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Row, Col, Button } from 'react-bootstrap';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../services/api';

const StatTile = ({ icon, label, value, delta, tone = 'brand' }) => (
  <div className="stat-tile">
    <div className={`stat-tile__icon stat-tile__icon--${tone}`}>
      <i className={`bi ${icon}`} />
    </div>
    <div className="stat-tile__body">
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className="stat-tile__delta">{delta}</div>
      )}
    </div>
  </div>
);

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
    <>
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

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg={3}>
          <StatTile icon="bi-file-earmark-text" label="Articles generated" value={loading ? '—' : totalArticles} tone="brand" />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatTile icon="bi-graph-up-arrow" label="Avg. SEO score" value={loading ? '—' : `${avgSeo}/100`} tone="success" />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatTile icon="bi-robot" label="Avg. AI detection" value={loading ? '—' : `${avgAi}%`} tone="info" />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatTile
            icon="bi-lightning-charge"
            label="Words used"
            value={`${wordsUsed.toLocaleString()} / ${wordsLimit.toLocaleString()}`}
            delta={`${usagePct}% of ${user?.plan || 'free'} plan`}
            tone="warning"
          />
        </Col>
      </Row>

      <Row className="g-3">
        <Col xs={12} lg={7}>
          <div className="cf-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Recent performance</h2>
              <span className="text-muted small">SEO vs AI score</span>
            </div>
            {chartData.length === 0 ? (
              <div className="empty-state">
                <i className="bi bi-bar-chart" />
                <p>No data yet. Generate your first article to see analytics here.</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--text)',
                      }}
                    />
                    <Bar dataKey="seo" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="ai" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Col>

        <Col xs={12} lg={5}>
          <div className="cf-card h-100">
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
              <div className="d-flex flex-column gap-2">
                {stats.recent.map((a) => (
                  <Link key={a._id} to={`/articles/${a._id}`} className="article-row">
                    <div className="article-row__title">{a.title || 'Untitled'}</div>
                    <div className="article-row__meta">
                      <span className="badge bg-secondary-subtle text-secondary me-1">SEO {a.seoScore || 0}</span>
                      <span className="badge bg-info-subtle text-info">AI {a.aiScoreAfter ?? '—'}%</span>
                      <span className="ms-2 text-muted small">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <i className="bi bi-journal-text" />
                <p>No articles yet.</p>
                <Link to="/generate"><Button size="sm">Generate one</Button></Link>
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </>
  );
}
