import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { listArticlesThunk, deleteArticleThunk } from '../store/slices/articleSlice';

export default function History() {
  const dispatch = useDispatch();
  const { items, total } = useSelector((s) => s.articles);
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this article?')) return;
    try {
      await dispatch(deleteArticleThunk(id)).unwrap();
      toast.success('Deleted.');
    } catch {
      toast.error('Could not delete.');
    }
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
          <i className="bi bi-journal-text" />
          <p>No articles found. Try a different search or generate a new one.</p>
          <Link to="/generate"><Button>Generate article</Button></Link>
        </div>
      ) : (
        <>
          <Row className="g-3">
            {items.map((a) => (
              <Col xs={12} sm={6} lg={4} key={a._id}>
                <div className="cf-card cf-card--hoverable h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className={`badge bg-${a.status === 'completed' ? 'success' : a.status === 'archived' ? 'secondary' : 'warning'}-subtle text-${a.status === 'completed' ? 'success' : a.status === 'archived' ? 'secondary' : 'warning'}`}>
                      {a.status}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-muted"
                      onClick={() => handleDelete(a._id)}
                      title="Delete"
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  </div>
                  <Link to={`/articles/${a._id}`} className="text-decoration-none flex-grow-1">
                    <h3 className="h6 clamp-2">{a.title || 'Untitled'}</h3>
                    {a.metaDescription && (
                      <p className="text-muted small clamp-3 mb-2">{a.metaDescription}</p>
                    )}
                  </Link>
                  <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                    <div className="d-flex gap-1 flex-wrap">
                      <span className="badge bg-secondary-subtle text-secondary">SEO {a.seoScore || 0}</span>
                      <span className="badge bg-info-subtle text-info">AI {a.aiScoreAfter ?? '—'}%</span>
                    </div>
                    <span className="text-muted small">{a.wordCount || 0}w</span>
                  </div>
                </div>
              </Col>
            ))}
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
