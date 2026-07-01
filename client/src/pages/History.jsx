import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { listArticlesThunk, deleteArticleThunk } from '../store/slices/articleSlice';

function getArticleSnippet(article) {
  if (article.metaDescription && article.metaDescription.trim()) {
    return article.metaDescription;
  }
  if (!article.content) {
    return 'Click to open and read the full article.';
  }
  // Strip Markdown syntax and return a clean text snippet
  const clean = article.content
    .replace(/[#*`_~\[\]()\-+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 140 ? clean.slice(0, 140) + '...' : clean;
}

export default function History() {
  const dispatch = useDispatch();
  const { items = [], total = 0 } = useSelector((s) => s.articles);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 12;

  const fetchList = async () => {
    setLoading(true);
    try {
      await dispatch(listArticlesThunk({
        q,
        status: status === 'all' ? undefined : status,
        page,
        limit,
      })).unwrap();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [page, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const handleDelete = (id) => {
    toast((t) => (
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span className="small text-text me-1">Delete this article?</span>
        <button
          className="btn btn-sm py-1 px-2 border-0 fw-bold"
          style={{ background: '#ef4444', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }}
          onClick={async () => {
            toast.dismiss(t.id);
            try {
              await dispatch(deleteArticleThunk(id)).unwrap();
              toast.success('Article deleted successfully.');
            } catch {
              toast.error('Could not delete.');
            }
          }}
        >
          Delete
        </button>
        <button
          className="btn btn-sm py-1 px-2 border-0 fw-bold"
          style={{ background: 'var(--surface-alt)', color: 'var(--text)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)' }}
          onClick={() => toast.dismiss(t.id)}
        >
          Cancel
        </button>
      </div>
    ), {
      duration: 5000,
      style: {
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        color: 'var(--text)',
        boxShadow: 'var(--shadow-lg)',
      }
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Article history</h1>
          <p className="page__subtitle">{total} article{total === 1 ? '' : 's'} total.</p>
        </div>
        <Link to="/generate" className="btn btn-primary">
          <i className="bi bi-stars me-2" /> New article
        </Link>
      </div>

      <Form onSubmit={handleSearch} className="mb-3">
        <Row className="g-2">
          <Col md={8}>
            <InputGroup>
              <InputGroup.Text className="bg-transparent"><i className="bi bi-search" /></InputGroup.Text>
              <Form.Control
                placeholder="Search by title or keyword…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button type="submit" variant="primary">Search</Button>
            </InputGroup>
          </Col>
          <Col md={4}>
            <Form.Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Form.Select>
          </Col>
        </Row>
      </Form>

      {loading ? (
        <Row className="g-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Col xs={12} sm={6} lg={4} key={i}>
              <div className="skeleton" style={{ height: 180 }} />
            </Col>
          ))}
        </Row>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><i className="bi bi-journal-text" /></div>
          <p>No articles found. Try a different search or generate a new one.</p>
          <Link to="/generate"><Button>Generate article</Button></Link>
        </div>
      ) : (
        <>
          <Row className="g-3">
            {items.map((a, index) => {
              const hasImage = a.images && a.images.length > 0;
              const imageUrl = hasImage ? a.images[0].url : null;
              
              return (
                <Col xs={12} sm={6} lg={4} key={a._id}>
                  <Link 
                    to={`/articles/${a._id}`}
                    className="cf-card cf-card--hoverable cf-card--article h-100 d-flex flex-column cf-card-animated text-decoration-none"
                    style={{ animationDelay: `${index * 50}ms`, color: 'inherit' }}
                  >
                    <div className="cf-card__image-container">
                      {hasImage ? (
                        <img 
                          src={imageUrl} 
                          alt={a.title || 'Article thumbnail'} 
                          className="cf-card__image" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="cf-card__image-placeholder" />
                      )}
                      <span className={`badge cf-card__status-badge bg-${a.status === 'completed' ? 'success' : a.status === 'archived' ? 'secondary' : 'warning'}-subtle text-${a.status === 'completed' ? 'success' : a.status === 'archived' ? 'secondary' : 'warning'}`}>
                        {a.status}
                      </span>
                    </div>

                    <div className="cf-card__body d-flex flex-column flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h3 className="cf-card__title clamp-2 mb-0" style={{ color: 'var(--text)' }}>
                          {a.title || 'Untitled'}
                        </h3>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 text-muted ms-2"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(a._id);
                          }}
                          title="Delete"
                        >
                          <i className="bi bi-trash" />
                        </Button>
                      </div>

                      <div className="flex-grow-1">
                        <p className="text-muted small clamp-3 mb-2">
                          {getArticleSnippet(a)}
                        </p>
                      </div>

                      <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                        <div className="d-flex gap-1 flex-wrap">
                          <span className="badge bg-secondary-subtle text-secondary">SEO {a.seoScore || 0}</span>
                          <span className="badge bg-info-subtle text-info">AI {a.aiScoreAfter ?? '—'}%</span>
                        </div>
                        <span className="text-muted small">{a.wordCount || 0}w</span>
                      </div>
                    </div>
                  </Link>
                </Col>
              );
            })}
          </Row>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-2 mt-4">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <i className="bi bi-chevron-left" /> Prev
              </Button>
              <span className="text-muted small">Page {page} of {totalPages}</span>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <i className="bi bi-chevron-right" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
