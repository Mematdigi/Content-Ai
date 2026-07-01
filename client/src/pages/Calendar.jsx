import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Row, Col, Button, Modal, Form } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import PageTransition from '../components/Layout/PageTransition';

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 30)); // Set to local year 2026, June
  const [articles, setArticles] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    topic: '',
    primaryKeyword: '',
    articleType: 'Blog post',
    publishDate: '2026-07-01',
  });

  // Fetch generated articles
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/dashboard/stats');
        if (data && data.recent) {
          setArticles(data.recent);
        }
      } catch (err) {
        console.error('Failed to load articles for calendar', err);
      } finally {
        setLoading(false);
      }
    })();

    // Load custom schedules from local storage
    const saved = localStorage.getItem('cf_scheduled_posts');
    if (saved) {
      setScheduled(JSON.parse(saved));
    }
  }, []);

  // Save schedules
  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (!form.topic.trim()) {
      toast.error('Please enter a topic.');
      return;
    }

    const newSchedule = {
      id: 'sched_' + Date.now(),
      title: form.topic,
      primaryKeyword: form.primaryKeyword,
      articleType: form.articleType,
      publishDate: form.publishDate,
      status: 'scheduled',
    };

    const next = [...scheduled, newSchedule];
    setScheduled(next);
    localStorage.setItem('cf_scheduled_posts', JSON.stringify(next));
    toast.success('Successfully planned post for ' + form.publishDate);
    setShowModal(false);
    setForm({
      topic: '',
      primaryKeyword: '',
      articleType: 'Blog post',
      publishDate: '2026-07-01',
    });
  };

  const handleDeleteSchedule = (id) => {
    const next = scheduled.filter((s) => s.id !== id);
    setScheduled(next);
    localStorage.setItem('cf_scheduled_posts', JSON.stringify(next));
    toast.success('Plan removed.');
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthTotalDays - i,
      month: month === 0 ? 11 : month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push({
      day: i,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  // Next month padding days
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      day: i,
      month: month === 11 ? 0 : month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Filter articles and scheduled items by date
  const getItemsForDate = (cellYear, cellMonth, cellDay) => {
    const matches = [];

    // Match database articles
    articles.forEach((a) => {
      const d = new Date(a.createdAt);
      if (
        d.getFullYear() === cellYear &&
        d.getMonth() === cellMonth &&
        d.getDate() === cellDay
      ) {
        matches.push({
          id: a._id,
          title: a.title || 'Untitled',
          type: a.articleType || 'Blog post',
          status: 'published',
          words: a.wordCount || 0,
        });
      }
    });

    // Match local planned schedules
    scheduled.forEach((s) => {
      const d = new Date(s.publishDate);
      // publishDate string is YYYY-MM-DD
      const schedYear = d.getFullYear();
      const schedMonth = d.getMonth();
      const schedDay = d.getDate();

      if (schedYear === cellYear && schedMonth === cellMonth && schedDay === cellDay) {
        matches.push({
          id: s.id,
          title: s.title,
          type: s.articleType,
          status: 'scheduled',
          keyword: s.primaryKeyword,
        });
      }
    });

    return matches;
  };

  const getPillColor = (type, status) => {
    if (status === 'scheduled') return 'badge-schedule';
    switch (type.toLowerCase()) {
      case 'news': return 'badge-news';
      case 'blog post':
      case 'blog': return 'badge-blog';
      case 'listicle': return 'badge-listicle';
      case 'how-to': return 'badge-howto';
      default: return 'badge-generic';
    }
  };

  return (
    <PageTransition>
      <style dangerouslySetInnerHTML={{ __html: `
        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          backdrop-filter: blur(12px);
        }
        .calendar-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .calendar-nav-btn:hover {
          background: var(--brand);
          color: white;
          border-color: var(--brand);
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .calendar-day-header {
          background: var(--surface-alt);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.85rem;
          text-align: center;
          padding: 0.75rem 0.5rem;
          text-transform: uppercase;
        }
        .calendar-cell {
          background: var(--surface);
          min-height: 120px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: background 0.15s ease;
        }
        .calendar-cell.is-outside {
          background: var(--surface-alt);
          opacity: 0.5;
        }
        .calendar-cell:hover:not(.is-outside) {
          background: rgba(124, 58, 237, 0.03);
        }
        .calendar-date-number {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 4px;
          align-self: flex-start;
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }
        .calendar-cell.is-today .calendar-date-number {
          background: var(--brand);
          color: white !important;
        }

        .calendar-pill {
          font-size: 0.72rem;
          font-weight: 500;
          padding: 4px 6px;
          border-radius: 6px;
          text-decoration: none !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
          transition: transform 0.15s ease;
          border: 1px solid transparent;
        }
        .calendar-pill:hover {
          transform: translateY(-1px);
        }

        /* Color classes */
        .badge-news {
          background: rgba(59, 130, 246, 0.1) !important;
          color: #3b82f6 !important;
          border-color: rgba(59, 130, 246, 0.2) !important;
        }
        .badge-blog {
          background: rgba(124, 58, 237, 0.1) !important;
          color: #7c3aed !important;
          border-color: rgba(124, 58, 237, 0.2) !important;
        }
        .badge-listicle {
          background: rgba(16, 185, 129, 0.1) !important;
          color: #10b981 !important;
          border-color: rgba(16, 185, 129, 0.2) !important;
        }
        .badge-howto {
          background: rgba(236, 72, 153, 0.1) !important;
          color: #ec4899 !important;
          border-color: rgba(236, 72, 153, 0.2) !important;
        }
        .badge-schedule {
          background: rgba(217, 79, 24, 0.1) !important;
          color: #d94f18 !important;
          border-color: rgba(217, 79, 24, 0.25) !important;
        }
        .badge-generic {
          background: var(--surface-alt) !important;
          color: var(--text-muted) !important;
          border-color: var(--border) !important;
        }

        .calendar-sidebar-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          height: 100%;
        }
        .schedule-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0;
          border-bottom: 1px solid var(--border);
        }
        .schedule-item:last-child {
          border-bottom: none;
        }
      ` }} />

      <div className="page__header">
        <div>
          <h1 className="page__title">Content Calendar</h1>
          <p className="page__subtitle">Plan, schedule, and view your AI publication timeline.</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="btn btn-primary">
          <i className="bi bi-calendar-plus me-2" /> Plan Article
        </Button>
      </div>

      <Row className="g-4">
        {/* Calendar Grid Area */}
        <Col xs={12} xl={9}>
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <i className="bi bi-chevron-left" />
            </button>
            <h2 className="h5 mb-0 fw-bold text-center" style={{ minWidth: 150 }}>
              {monthNames[month]} {year}
            </h2>
            <button className="calendar-nav-btn" onClick={nextMonth} aria-label="Next month">
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          <div className="calendar-grid">
            {daysOfWeek.map((day) => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}

            {calendarDays.map((cell, idx) => {
              const matches = getItemsForDate(cell.year, cell.month, cell.day);
              const isToday =
                new Date().getDate() === cell.day &&
                new Date().getMonth() === cell.month &&
                new Date().getFullYear() === cell.year;

              return (
                <div
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  className={`calendar-cell ${!cell.isCurrentMonth ? 'is-outside' : ''} ${isToday ? 'is-today' : ''}`}
                >
                  <span className="calendar-date-number">{cell.day}</span>
                  <div className="flex-grow-1 d-flex flex-column gap-1 overflow-hidden">
                    {matches.map((item) => {
                      if (item.status === 'published') {
                        return (
                          <Link
                            key={item.id}
                            to={`/articles/${item.id}`}
                            className={`calendar-pill ${getPillColor(item.type, item.status)}`}
                            title={`${item.title} (${item.words} words)`}
                          >
                            {item.title}
                          </Link>
                        );
                      } else {
                        return (
                          <div
                            key={item.id}
                            className={`calendar-pill ${getPillColor(item.type, item.status)}`}
                            title={`Scheduled: ${item.title} (Keyword: ${item.keyword})`}
                          >
                            <i className="bi bi-clock me-1" />
                            {item.title}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Col>

        {/* Sidebar Summary Area */}
        <Col xs={12} xl={3}>
          <div className="d-flex flex-column gap-3 h-100">
            <div className="calendar-sidebar-card">
              <h3 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-bar-chart-line text-brand" /> Content Mix
              </h3>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center small">
                  <span className="text-muted"><i className="bi bi-circle-fill me-1 text-primary" style={{ fontSize: '0.6rem' }} /> Blog Posts</span>
                  <span className="fw-semibold">{articles.filter(a => (a.articleType || '').toLowerCase().includes('blog')).length}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center small">
                  <span className="text-muted"><i className="bi bi-circle-fill me-1 text-info" style={{ fontSize: '0.6rem' }} /> News Articles</span>
                  <span className="fw-semibold">{articles.filter(a => (a.articleType || '').toLowerCase().includes('news')).length}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center small">
                  <span className="text-muted"><i className="bi bi-circle-fill me-1 text-success" style={{ fontSize: '0.6rem' }} /> Listicles</span>
                  <span className="fw-semibold">{articles.filter(a => (a.articleType || '').toLowerCase().includes('list')).length}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center small">
                  <span className="text-muted"><i className="bi bi-circle-fill me-1 text-danger" style={{ fontSize: '0.6rem' }} /> How-To Guides</span>
                  <span className="fw-semibold">{articles.filter(a => (a.articleType || '').toLowerCase().includes('how')).length}</span>
                </div>
              </div>
            </div>

            <div className="calendar-sidebar-card flex-grow-1">
              <h3 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-clock-history text-brand" /> Planned Articles
              </h3>
              {scheduled.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-calendar-check mb-2 d-block" style={{ fontSize: '1.5rem' }} />
                  No planned articles yet. Click "Plan Article" to schedule content.
                </div>
              ) : (
                <div className="d-flex flex-column" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {scheduled.map((item) => (
                    <div key={item.id} className="schedule-item">
                      <div className="min-w-0 flex-grow-1">
                        <div className="text-truncate fw-semibold small text-text">{item.title}</div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {item.articleType} • {new Date(item.publishDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0 ms-2"
                        onClick={() => handleDeleteSchedule(item.id)}
                        title="Delete Schedule"
                      >
                        <i className="bi bi-x-circle" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Plan modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Modal.Title className="h5 fw-bold text-text">Plan & Schedule Article</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddSchedule}>
          <Modal.Body style={{ background: 'var(--surface)', color: 'var(--text)' }}>
            <Form.Group className="mb-3">
              <Form.Label>Topic / Topic Outline</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Clean Energy Tech Advancements"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Primary Keyword</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. clean energy tech"
                value={form.primaryKeyword}
                onChange={(e) => setForm({ ...form, primaryKeyword: e.target.value })}
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Article Type</Form.Label>
                  <Form.Select
                    value={form.articleType}
                    onChange={(e) => setForm({ ...form, articleType: e.target.value })}
                  >
                    <option value="Blog post">Blog Post</option>
                    <option value="News">News Article</option>
                    <option value="Listicle">Listicle</option>
                    <option value="How-to">How-To Guide</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Publish Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.publishDate}
                    onChange={(e) => setForm({ ...form, publishDate: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Schedule Plan
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </PageTransition>
  );
}
