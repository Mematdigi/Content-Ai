import { useState } from 'react';
import { Tab, Nav, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';
import api from '../services/api';

function HumanizerTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tools/humanize', { text });
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Humanizer failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row className="g-3">
      <Col md={6}>
        <Form.Label className="fw-semibold">Original text</Form.Label>
        <Form.Control
          as="textarea"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste AI-generated text here…"
        />
        <Button className="mt-2" onClick={run} disabled={busy || !text.trim()}>
          {busy ? 'Humanizing…' : 'Humanize'}
        </Button>
      </Col>
      <Col md={6}>
        <Form.Label className="fw-semibold">Humanized output</Form.Label>
        <Form.Control as="textarea" rows={14} value={result?.humanized || ''} readOnly />
        {result && (
          <div className="d-flex justify-content-between mt-2 align-items-center">
            <div className="small">
              <span className="badge bg-danger-subtle text-danger me-1">Before AI: {result.aiScoreBefore}%</span>
              <span className="badge bg-success-subtle text-success">After AI: {result.aiScoreAfter}%</span>
            </div>
            <Button size="sm" variant="outline-secondary" onClick={() => { navigator.clipboard.writeText(result.humanized); toast.success('Copied.'); }}>
              <i className="bi bi-clipboard me-1" /> Copy
            </Button>
          </div>
        )}
      </Col>
    </Row>
  );
}

function AiDetector() {
  const [text, setText] = useState('');
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tools/ai-detect', { text });
      setScore(data);
    } catch (e) {
      toast.error('Detection failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row className="g-3">
      <Col md={7}>
        <Form.Label className="fw-semibold">Paste text to analyze</Form.Label>
        <Form.Control
          as="textarea"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste any text to estimate AI-detection probability…"
        />
        <Button className="mt-2" onClick={run} disabled={busy || !text.trim()}>
          {busy ? 'Analyzing…' : 'Analyze'}
        </Button>
      </Col>
      <Col md={5}>
        {score && (
          <div className="cf-card text-center">
            <div className="display-4 gradient-text">{score.aiScore}%</div>
            <p className="text-muted">Estimated AI probability</p>
            <Alert variant={score.aiScore < 20 ? 'success' : score.aiScore < 50 ? 'warning' : 'danger'} className="mb-0">
              {score.aiScore < 20 ? 'Reads human ✅' : score.aiScore < 50 ? 'Mixed signals' : 'Likely AI-generated'}
            </Alert>
          </div>
        )}
      </Col>
    </Row>
  );
}

function Paraphraser() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tools/paraphrase', { text });
      setResult(data.paraphrased);
    } catch {
      toast.error('Paraphrase failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row className="g-3">
      <Col md={6}>
        <Form.Label className="fw-semibold">Original</Form.Label>
        <Form.Control as="textarea" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        <Button className="mt-2" onClick={run} disabled={busy || !text.trim()}>
          {busy ? 'Rewriting…' : 'Paraphrase'}
        </Button>
      </Col>
      <Col md={6}>
        <Form.Label className="fw-semibold">Paraphrased</Form.Label>
        <Form.Control as="textarea" rows={12} value={result} readOnly />
        {result && (
          <Button className="mt-2" size="sm" variant="outline-secondary"
            onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied.'); }}>
            <i className="bi bi-clipboard me-1" /> Copy
          </Button>
        )}
      </Col>
    </Row>
  );
}

function TitleGenerator() {
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [titles, setTitles] = useState([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tools/title-suggestions', { topic, keyword });
      setTitles(data.titles || []);
    } catch {
      toast.error('Could not generate titles.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row className="g-3 mb-3">
        <Col md={7}>
          <Form.Label className="fw-semibold">Topic</Form.Label>
          <Form.Control value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. cold brew coffee at home" />
        </Col>
        <Col md={5}>
          <Form.Label className="fw-semibold">Primary keyword (optional)</Form.Label>
          <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="cold brew coffee" />
        </Col>
      </Row>
      <Button onClick={run} disabled={busy || !topic.trim()}>
        {busy ? 'Generating…' : 'Generate 10 titles'}
      </Button>
      {titles.length > 0 && (
        <ul className="list-group mt-3">
          {titles.map((t, i) => (
            <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
              <span>{t}</span>
              <Button size="sm" variant="outline-secondary"
                onClick={() => { navigator.clipboard.writeText(t); toast.success('Copied.'); }}>
                <i className="bi bi-clipboard" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SeoChecker() {
  const [text, setText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim() || !keyword.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tools/seo-score', {
        content: text,
        primaryKeyword: keyword,
      });
      setReport(data);
    } catch {
      toast.error('SEO check failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Form.Label className="fw-semibold">Primary keyword</Form.Label>
          <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </Col>
        <Col md={8}>
          <Form.Label className="fw-semibold">Article content (markdown supported)</Form.Label>
          <Form.Control as="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        </Col>
      </Row>
      <Button onClick={run} disabled={busy || !text.trim() || !keyword.trim()}>
        {busy ? 'Analyzing…' : 'Run SEO check'}
      </Button>

      {report && (
        <div className="cf-card mt-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="h5 mb-0">SEO score</h3>
            <span className="display-6 gradient-text">{report.overall}/100</span>
          </div>
          {Object.entries(report.breakdown || {}).map(([k, v]) => (
            <div key={k} className="mb-2">
              <div className="d-flex justify-content-between small">
                <span className="text-capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <strong>{v}</strong>
              </div>
              <div className="progress" style={{ height: 5 }}>
                <div className="progress-bar" style={{ width: `${v}%`, background: 'var(--brand-gradient)' }} />
              </div>
            </div>
          ))}
          {report.suggestions?.length > 0 && (
            <div className="mt-3">
              <h4 className="h6">Suggestions</h4>
              <ul className="mb-0">
                {report.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const TABS = [
  { key: 'humanize', label: 'Humanizer', icon: 'bi-magic', component: <HumanizerTool /> },
  { key: 'detect', label: 'AI Detector', icon: 'bi-robot', component: <AiDetector /> },
  { key: 'paraphrase', label: 'Paraphraser', icon: 'bi-arrow-repeat', component: <Paraphraser /> },
  { key: 'titles', label: 'Title Generator', icon: 'bi-lightbulb', component: <TitleGenerator /> },
  { key: 'seo', label: 'SEO Checker', icon: 'bi-graph-up-arrow', component: <SeoChecker /> },
];

export default function Tools() {
  const [active, setActive] = useState('humanize');
  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Writing tools</h1>
          <p className="page__subtitle">Quick utilities for editing, optimizing, and humanizing.</p>
        </div>
      </div>

      <Tab.Container activeKey={active} onSelect={(k) => setActive(k)}>
        <Nav variant="pills" className="cf-tabs mb-3 flex-wrap">
          {TABS.map((t) => (
            <Nav.Item key={t.key}>
              <Nav.Link eventKey={t.key}>
                <i className={`bi ${t.icon} me-2`} />{t.label}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <div className="cf-card">
          <Tab.Content>
            {TABS.map((t) => (
              <Tab.Pane key={t.key} eventKey={t.key}>{t.component}</Tab.Pane>
            ))}
          </Tab.Content>
        </div>
      </Tab.Container>
    </>
  );
}
