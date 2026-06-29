import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Row, Col, Button, Alert, ProgressBar } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { generateArticleThunk, setPipelineProgress } from '../store/slices/articleSlice';

const TONES = ['Professional', 'Casual', 'Friendly', 'Persuasive', 'Witty', 'Academic'];
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];
const ARTICLE_TYPES = ['Blog post', 'How-to', 'Listicle', 'Comparison', 'Review', 'News', 'Product description'];
const POVS = ['1st person', '2nd person', '3rd person'];

const PIPELINE_STEPS = [
  { id: 'research', label: 'Research', icon: 'bi-globe2' },
  { id: 'outline', label: 'Outline', icon: 'bi-list-ol' },
  { id: 'writing', label: 'Writing', icon: 'bi-pencil-square' },
  { id: 'humanize', label: 'SEO + Humanize', icon: 'bi-magic' },
];

// Tags input — comma/enter to add
function TagsInput({ value, onChange, placeholder, disabled }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const v = raw.trim().replace(/,$/, '');
    if (!v) return;
    if (value.includes(v)) return;
    onChange([...value, v]);
  };
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
      setText('');
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="tags-input" style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {value.map((tag) => (
        <span key={tag} className="tag-pill">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} disabled={disabled}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (text) { add(text); setText(''); } }}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
    </div>
  );
}

export default function Generator() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { generating, pipelineProgress } = useSelector((s) => s.articles);

  const [mode, setMode] = useState(null); // null, 'instant'

  const [form, setForm] = useState({
    topic: '',
    primaryKeyword: '',
    secondaryKeywords: [],
    targetWordCount: 1200,
    headingsCount: 5,
    tone: 'Professional',
    audience: 'general readers',
    language: 'English',
    articleType: 'Blog post',
    pointOfView: '2nd person',
    includeFaqs: true,
    includeMeta: true,
    includeImages: false,
  });
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Simulate progress pipeline
  useEffect(() => {
    if (!generating) return;
    let i = 0;
    dispatch(setPipelineProgress({ step: PIPELINE_STEPS[0].id, percent: 5 }));
    const id = setInterval(() => {
      i = Math.min(i + 1, PIPELINE_STEPS.length - 1);
      const pct = Math.min(95, ((i + 1) / PIPELINE_STEPS.length) * 100);
      dispatch(setPipelineProgress({ step: PIPELINE_STEPS[i].id, percent: pct }));
    }, 4500);
    return () => clearInterval(id);
  }, [generating, dispatch]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!form.topic.trim()) {
      setError('Please enter a topic.');
      return;
    }
    if (!form.primaryKeyword.trim()) {
      setError('Please enter a primary keyword.');
      return;
    }
    try {
      const article = await dispatch(generateArticleThunk(form)).unwrap();
      toast.success('Article generated!');
      navigate(`/articles/${article._id}`);
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Generation failed. Try again.';
      setError(msg);
      toast.error(msg);
    }
  };

  const progress = pipelineProgress || { step: null, percent: 0 };
  const currentStepIdx = PIPELINE_STEPS.findIndex((s) => s.id === progress.step);

  const resetMode = () => {
    setMode(null);
    setError('');
  };

  // 1. Selector screen
  if (mode === null) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          .writesonic-card {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface);
            transition: transform 0.22s ease, box-shadow 0.22s ease;
            cursor: pointer;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .writesonic-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-md);
            border-color: var(--brand);
          }
          .writesonic-card .image-panel {
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .writesonic-card .time-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 0.78rem;
          }
          .writesonic-card .rec-badge {
            position: absolute;
            top: 12px;
            left: 12px;
            font-size: 0.75rem;
            text-transform: uppercase;
            font-weight: 600;
          }
          .writesonic-card .card-body {
            padding: 1.5rem;
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .writesonic-card ul {
            list-style: none;
            padding-left: 0;
            margin-bottom: 1.5rem;
            flex: 1;
          }
          .writesonic-card ul li {
            font-size: 0.88rem;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
            position: relative;
            padding-left: 1.2rem;
          }
          .writesonic-card ul li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: var(--brand);
            font-weight: bold;
            font-size: 1.25rem;
            line-height: 0.8;
          }
          .writesonic-card .btn-start {
            border: 1px solid #e2e8f0;
            background: transparent;
            color: var(--text);
            width: 100%;
            border-radius: 8px;
            padding: 0.6rem;
            font-weight: 600;
            transition: all 0.15s ease;
          }
          .writesonic-card:hover .btn-start {
            background: var(--brand);
            border-color: var(--brand);
            color: white !important;
          }
        ` }} />

        <div className="page__header text-center">
          <div>
            <h1 className="page__title">Create a New Article</h1>
            <p className="page__subtitle">Select a writing mode to begin generating content.</p>
          </div>
        </div>

        <Row className="g-4 justify-content-center mt-3">
          {/* Card 1: 10-Steps Article */}
          <Col xs={12} md={5} lg={4}>
            <div className="writesonic-card" onClick={() => navigate('/generate/wizard')}>
              <div className="image-panel" style={{ background: '#f5f3ff' }}>
                <span className="badge rec-badge bg-success text-white">Recommended</span>
                <span className="badge time-badge bg-light text-dark"><i className="bi bi-clock me-1" /> 5 mins</span>
                <div style={{ fontSize: '3rem', color: '#7c3aed' }}>
                  <i className="bi bi-list-stars" />
                </div>
              </div>
              <div className="card-body">
                <h3 className="h5 mb-2 font-weight-bold" style={{ color: 'var(--text)' }}>10-Steps Article</h3>
                <p className="text-muted small mb-3">Full control over every aspect of outline, research, style, and citations.</p>
                <ul>
                  <li>Article Type (Listicles, Guides, etc.)</li>
                  <li>Reference/Competitor Selection</li>
                  <li>Keywords Targeting</li>
                  <li>Word Length (300-5000 words)</li>
                  <li>Headings Outline Adjustments</li>
                  <li>Writing Style & Tone</li>
                  <li>Schema & FAQ Settings</li>
                </ul>
                <button className="btn-start">Click to start</button>
              </div>
            </div>
          </Col>

          {/* Card 2: Instant Article */}
          <Col xs={12} md={5} lg={4}>
            <div className="writesonic-card" onClick={() => setMode('instant')}>
              <div className="image-panel" style={{ background: '#ecfeff' }}>
                <span className="badge rec-badge bg-warning text-dark">Beta</span>
                <span className="badge time-badge bg-light text-dark"><i className="bi bi-clock me-1" /> 1 min</span>
                <div style={{ fontSize: '3rem', color: '#0891b2' }}>
                  <i className="bi bi-lightning-charge-fill" />
                </div>
              </div>
              <div className="card-body">
                <h3 className="h5 mb-2 font-weight-bold" style={{ color: 'var(--text)' }}>Instant Article</h3>
                <p className="text-muted small mb-3">Provide minimal guidelines and generate the article end-to-end in one click.</p>
                <ul>
                  <li>Topic / Title</li>
                  <li>Article Type Selection</li>
                  <li>Keywords (Optional)</li>
                  <li>Auto Competitor Scrape</li>
                  <li>We Handle the Rest!</li>
                </ul>
                <button className="btn-start">Click to start</button>
              </div>
            </div>
          </Col>
        </Row>
      </>
    );
  }

  // Generation loading progress overlay
  if (generating) {
    return (
      <div className="py-5">
        <Row className="justify-content-center">
          <Col xs={12} md={8} lg={6}>
            <div className="cf-card text-center p-4">
              <h2 className="h4 mb-3">
                <i className="bi bi-stars text-warning me-2 animate-pulse" /> Forging Your Article
              </h2>
              <p className="text-muted small mb-4">
                Our multi-model AI pipeline is crawling web competitors, constructing outlines, writing content, optimizing SEO, and humanizing sentence flow. Please do not close this tab.
              </p>

              <div className="pipeline text-start my-4">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isRunning = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={`pipeline__step ${isDone ? 'is-done' : ''} ${isRunning ? 'is-running' : ''} mb-2`}
                    >
                      <div className="pipeline__icon"><i className={`bi ${step.icon}`} /></div>
                      <div className="pipeline__body flex-grow-1">
                        <div className="pipeline__label">{step.label}</div>
                        <div className="pipeline__status small text-muted">
                          {isDone ? 'Complete' : isRunning ? 'Processing…' : 'Queued'}
                        </div>
                      </div>
                      {isDone && <i className="bi bi-check-circle-fill text-success" />}
                    </div>
                  );
                })}
              </div>

              <ProgressBar
                now={progress.percent}
                variant="primary"
                className="my-3"
                style={{ height: '8px', background: 'var(--surface-alt)' }}
              />
              <div className="small text-muted">{Math.round(progress.percent)}% Completed</div>
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  // Render Instant Article layout (Original single-page form)
  return (
    <>
      <div className="page__header flex-wrap gap-2">
        <div>
          <Button variant="link" className="p-0 text-muted small mb-2 text-decoration-none" onClick={resetMode}>
            <i className="bi bi-arrow-left me-1" /> Back to mode selection
          </Button>
          <h1 className="page__title">Instant Article Writer</h1>
          <p className="page__subtitle">Configure guidelines on one page and launch the generator.</p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4">
        <Col xs={12}>
          <Form onSubmit={handleSubmit} className="cf-card">
            <h2 className="h5 mb-3">Article Brief</h2>

            <Form.Group className="mb-3">
              <Form.Label>Topic / Title <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                value={form.topic}
                onChange={(e) => set('topic', e.target.value)}
                placeholder="e.g. The Complete Guide to Cold Brew Coffee at Home"
                required
                disabled={generating}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Primary keyword <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    value={form.primaryKeyword}
                    onChange={(e) => set('primaryKeyword', e.target.value)}
                    placeholder="cold brew coffee"
                    required
                    disabled={generating}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Secondary keywords</Form.Label>
                  <TagsInput
                    value={form.secondaryKeywords}
                    onChange={(v) => set('secondaryKeywords', v)}
                    placeholder="press Enter to add"
                    disabled={generating}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Target word count: <strong>{form.targetWordCount}</strong>
                  </Form.Label>
                  <Form.Range
                    min={300}
                    max={5000}
                    step={100}
                    value={form.targetWordCount}
                    onChange={(e) => set('targetWordCount', Number(e.target.value))}
                    disabled={generating}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Number of headings (H2): <strong>{form.headingsCount}</strong></Form.Label>
                  <Form.Range
                    min={3}
                    max={12}
                    step={1}
                    value={form.headingsCount}
                    onChange={(e) => set('headingsCount', Number(e.target.value))}
                    disabled={generating}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Tone</Form.Label>
                  <Form.Select value={form.tone} onChange={(e) => set('tone', e.target.value)} disabled={generating}>
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Language</Form.Label>
                  <Form.Select value={form.language} onChange={(e) => set('language', e.target.value)} disabled={generating}>
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Article type</Form.Label>
                  <Form.Select value={form.articleType} onChange={(e) => set('articleType', e.target.value)} disabled={generating}>
                    {ARTICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Target audience</Form.Label>
                  <Form.Control
                    type="text"
                    value={form.audience}
                    onChange={(e) => set('audience', e.target.value)}
                    placeholder="e.g. busy parents who love specialty coffee"
                    disabled={generating}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Point of view</Form.Label>
                  <Form.Select value={form.pointOfView} onChange={(e) => set('pointOfView', e.target.value)} disabled={generating}>
                    {POVS.map((p) => <option key={p}>{p}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row className="mb-3">
              <Col md={4}>
                <Form.Check
                  type="switch"
                  id="faq-toggle"
                  label="Include FAQs"
                  checked={form.includeFaqs}
                  onChange={(e) => set('includeFaqs', e.target.checked)}
                  disabled={generating}
                />
              </Col>
              <Col md={4}>
                <Form.Check
                  type="switch"
                  id="meta-toggle"
                  label="Generate meta tags"
                  checked={form.includeMeta}
                  onChange={(e) => set('includeMeta', e.target.checked)}
                  disabled={generating}
                />
              </Col>
              <Col md={4}>
                <Form.Check
                  type="switch"
                  id="img-toggle"
                  label="Suggest images"
                  checked={form.includeImages}
                  onChange={(e) => set('includeImages', e.target.checked)}
                  disabled={generating}
                />
              </Col>
            </Row>

            <Button type="submit" className="btn-primary w-100" disabled={generating}>
              <i className="bi bi-stars me-2" /> Generate Article
            </Button>
            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-clock-history me-1" />
              Average generation time: 30–60 seconds for 1500 words.
            </p>
          </Form>
        </Col>
      </Row>
    </>
  );
}