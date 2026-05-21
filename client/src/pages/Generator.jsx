import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Row, Col, Button, Alert } from 'react-bootstrap';
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
function TagsInput({ value, onChange, placeholder }) {
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
    <div className="tags-input">
      {value.map((tag) => (
        <span key={tag} className="tag-pill">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (text) { add(text); setText(''); } }}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

export default function Generator() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { generating, pipelineProgress } = useSelector((s) => s.articles);

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

  // Simulate visual progress while server works (real progress requires SSE/WS — kept simple here)
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
    e.preventDefault();
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

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">AI Generator</h1>
          <p className="page__subtitle">Configure your article and launch the multi-model pipeline.</p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4">
        <Col xs={12} lg={generating ? 7 : 12} xl={generating ? 8 : 12}>
          <Form onSubmit={handleSubmit} className="cf-card">
            <h2 className="h5 mb-3">Article brief</h2>

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
              {generating
                ? <><i className="bi bi-stars me-2" /> Forging your article…</>
                : <><i className="bi bi-stars me-2" /> Generate article</>}
            </Button>
            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-clock-history me-1" />
              Average generation time: 30–60 seconds for 1500 words.
            </p>
          </Form>
        </Col>

        {generating && (
          <Col xs={12} lg={5} xl={4}>
            <div className="cf-card">
              <h2 className="h5 mb-3">Pipeline progress</h2>
              <div className="pipeline">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isRunning = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={`pipeline__step ${isDone ? 'is-done' : ''} ${isRunning ? 'is-running' : ''}`}
                    >
                      <div className="pipeline__icon"><i className={`bi ${step.icon}`} /></div>
                      <div className="pipeline__body">
                        <div className="pipeline__label">{step.label}</div>
                        <div className="pipeline__status">
                          {isDone ? 'Complete' : isRunning ? 'Processing…' : 'Queued'}
                        </div>
                      </div>
                      {isDone && <i className="bi bi-check-circle-fill text-success" />}
                    </div>
                  );
                })}
              </div>
              <div className="progress mt-3" style={{ height: 6 }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{
                    width: `${progress.percent}%`,
                    background: 'var(--brand-gradient)',
                  }}
                />
              </div>
              <p className="text-muted small mt-3 mb-0">
                Don't close this tab. The full pipeline runs server-side and may take up to 90 seconds.
              </p>
            </div>
          </Col>
        )}
      </Row>
    </>
  );
}