import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Button, Form, Dropdown, Tab, Nav } from 'react-bootstrap';
import toast from 'react-hot-toast';
import {
  getArticleThunk,
  updateArticleThunk,
  deleteArticleThunk,
  clearCurrent,
} from '../store/slices/articleSlice';

// Tiny markdown → HTML converter (intentionally minimal — no dependency)
function mdToHtml(md = '') {
  if (!md) return '';
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false;
  let inOl = false;
  let inTable = false;
  let tableAlignments = [];

  const closeLists = () => {
    if (inList) { out.push('</ul>'); inList = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
    if (inTable) { out.push('</tbody></table></div>'); inTable = false; tableAlignments = []; }
  };

  const parseTableRow = (l) => {
    let clean = l.trim();
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean.split('|').map(cell => cell.trim());
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      closeLists();
      out.push('');
      continue;
    }

    const isHtml = /^\s*<\/?\w+/i.test(line);
    if (isHtml) {
      closeLists();
      out.push(line);
      continue;
    }

    if (inTable) {
      if (line.includes('|')) {
        const cells = parseTableRow(line);
        const cellHtml = cells.map((cell, idx) => {
          const align = tableAlignments[idx] ? ` align="${tableAlignments[idx]}"` : '';
          return `<td${align}>${escape(cell)}</td>`;
        }).join('');
        out.push(`<tr>${cellHtml}</tr>`);
        continue;
      } else {
        closeLists();
      }
    }

    if (!inTable && line.includes('|')) {
      const nextLine = lines[i + 1];
      const isTableDelimiter = (l) => {
        if (!l) return false;
        const trimmed = l.trim();
        return /^[|\s:-]+$/.test(trimmed) && trimmed.includes('|') && trimmed.includes('-');
      };

      if (isTableDelimiter(nextLine)) {
        closeLists();
        out.push('<div class="table-responsive"><table><thead>');
        const headers = parseTableRow(line);
        const delimiters = parseTableRow(nextLine);
        tableAlignments = delimiters.map(cell => {
          const trimmed = cell.trim();
          const left = trimmed.startsWith(':');
          const right = trimmed.endsWith(':');
          if (left && right) return 'center';
          if (right) return 'right';
          if (left) return 'left';
          return '';
        });

        const headerHtml = headers.map((header, idx) => {
          const align = tableAlignments[idx] ? ` align="${tableAlignments[idx]}"` : '';
          return `<th${align}>${escape(header)}</th>`;
        }).join('');

        out.push(`<tr>${headerHtml}</tr>`);
        out.push('</thead><tbody>');
        inTable = true;
        i++; // skip the delimiter line
        continue;
      }
    }

    if (/^>\s/.test(line)) {
      closeLists();
      const quoteText = line.replace(/^>\s*/, '');
      out.push(`<blockquote><p>${escape(quoteText)}</p></blockquote>`);
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      closeLists();
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      const level = m[1].length;
      out.push(`<h${level}>${escape(m[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList) { closeLists(); out.push('<ul>'); inList = true; }
      out.push(`<li>${escape(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${escape(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${escape(line)}</p>`);
  }
  closeLists();
  let html = out.join('\n');
  // inline emphasis
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

const ScoreGauge = ({ value, max = 100, label, tone = 'brand', suffix = '' }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--brand)';
  return (
    <div className="score-gauge">
      <div
        className="score-gauge__ring"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-alt) 0deg)` }}
      >
        <div className="score-gauge__inner">
          <div className="score-gauge__value">{value}{suffix}</div>
          <div className="score-gauge__max">/ {max}{suffix}</div>
        </div>
      </div>
      <div className="score-gauge__label">{label}</div>
    </div>
  );
};

export default function ArticleView() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current } = useSelector((s) => s.articles);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    dispatch(getArticleThunk(id));
    return () => { dispatch(clearCurrent()); };
  }, [id, dispatch]);

  useEffect(() => {
    if (current?.content) setDraftContent(current.content);
  }, [current?.content]);

  const html = useMemo(() => mdToHtml(current?.content || ''), [current?.content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateArticleThunk({ id, payload: { content: draftContent } })).unwrap();
      toast.success('Saved.');
      setEditing(false);
    } catch (e) {
      toast.error('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    try {
      await dispatch(deleteArticleThunk(id)).unwrap();
      toast.success('Deleted.');
      navigate('/history');
    } catch {
      toast.error('Delete failed.');
    }
  };

  const handleExport = (fmt) => {
    if (!current) return;
    const filenameSafe = (current.title || 'article').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    let blob, ext;
    const content = current.content || '';

    if (fmt === 'md') {
      blob = new Blob([content], { type: 'text/markdown' });
      ext = 'md';
    } else if (fmt === 'txt') {
      const plain = content.replace(/[#*`_>]/g, '');
      blob = new Blob([plain], { type: 'text/plain' });
      ext = 'txt';
    } else if (fmt === 'html') {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${current.title || ''}</title></head><body>${mdToHtml(content)}</body></html>`;
      blob = new Blob([fullHtml], { type: 'text/html' });
      ext = 'html';
    } else if (fmt === 'pdf') {
      const articleHtml = mdToHtml(content);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${current.title || 'Article'}</title>
            <style>
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                color: #1f2937;
                line-height: 1.7;
                padding: 2rem;
                max-width: 800px;
                margin: 0 auto;
              }
              h1, h2, h3, h4, h5, h6 {
                color: #111827;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
              }
              h1 { font-size: 2.25rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
              h2 { font-size: 1.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3rem; }
              h3 { font-size: 1.25rem; }
              p { margin-bottom: 1em; }
              a { color: #7c3aed; text-decoration: none; }
              code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; font-family: monospace; }
              ul, ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
              li { margin-bottom: 0.5rem; }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 1.5rem 0;
                font-size: 0.9rem;
                border: 1px solid #e5e7eb;
              }
              th, td {
                padding: 0.75rem 1rem;
                border: 1px solid #e5e7eb;
                text-align: left;
                vertical-align: middle;
              }
              th {
                background: #f9fafb;
                font-weight: 600;
              }
              tr:nth-child(even) td {
                background: #f9fafb;
              }
              .table-responsive {
                width: 100%;
                overflow-x: auto;
              }
              .custom-chart {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 1.25rem;
                margin: 1.5rem 0;
              }
              .custom-chart__title {
                font-size: 0.95rem;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 1rem !important;
                margin-top: 0 !important;
              }
              .chart-bar-row {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 0.75rem;
              }
              .chart-label {
                width: 95px;
                font-size: 0.85rem;
                font-weight: 500;
                color: #1f2937;
                flex-shrink: 0;
              }
              .chart-bar-container {
                flex: 1;
                background: #ffffff;
                height: 24px;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #e5e7eb;
              }
              .chart-bar {
                height: 100%;
                display: flex;
                align-items: center;
                padding-left: 0.75rem;
                font-size: 0.75rem;
                font-weight: 600;
                color: white;
                border-radius: 4px 0 0 4px;
              }
              .bg-brand {
                background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
              }
              .bg-success {
                background: #10b981;
              }
              .bg-warning {
                background: #f59e0b;
              }
              .bg-danger {
                background: #ef4444;
              }
            </style>
          </head>
          <body>
            ${current.images && current.images.length > 0 ? `
              <div style="text-align: center; margin-bottom: 2rem;">
                <img src="${current.images[0].url}" alt="${current.images[0].alt || ''}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" />
              </div>
            ` : ''}
            ${articleHtml}
          </body>
        </html>
      `);
      doc.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
      return;
    } else if (fmt === 'copy') {
      navigator.clipboard.writeText(content);
      toast.success('Markdown copied to clipboard.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameSafe}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!current) {
    return (
      <div>
        <div className="skeleton mb-3" style={{ height: 40, width: '60%' }} />
        <div className="skeleton mb-3" style={{ height: 200 }} />
        <div className="skeleton mb-3" style={{ height: 200 }} />
      </div>
    );
  }

  const seoBreakdown = current.seoReport?.breakdown || {};

  return (
    <>
      <div className="page__header flex-wrap gap-2">
        <div>
          <Link to="/history" className="text-muted small mb-2 d-inline-block">
            <i className="bi bi-arrow-left me-1" /> Back to history
          </Link>
          <h1 className="page__title mb-1">{current.title || 'Untitled'}</h1>
          <p className="page__subtitle mb-0">
            {current.wordCount} words • {current.readingTimeMinutes || 1} min read •
            {' '}{new Date(current.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {!editing ? (
            <Button variant="outline-secondary" onClick={() => setEditing(true)}>
              <i className="bi bi-pencil me-1" /> Edit
            </Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={() => { setDraftContent(current.content); setEditing(false); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <i className="bi bi-check2 me-1" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" id="export-dropdown">
              <i className="bi bi-download me-1" /> Export
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => handleExport('md')}>Markdown (.md)</Dropdown.Item>
              <Dropdown.Item onClick={() => handleExport('html')}>HTML (.html)</Dropdown.Item>
              <Dropdown.Item onClick={() => handleExport('txt')}>Plain text (.txt)</Dropdown.Item>
              <Dropdown.Item onClick={() => handleExport('pdf')}>PDF (.pdf)</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => handleExport('copy')}>Copy markdown</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <Button variant="outline-danger" onClick={handleDelete}>
            <i className="bi bi-trash" />
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} md={3}>
          <div className="cf-card text-center">
            <ScoreGauge value={current.seoScore || 0} label="SEO score" tone="brand" />
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div className="cf-card text-center">
            <ScoreGauge
              value={current.aiScoreAfter ?? 0}
              label="AI detection"
              tone={(current.aiScoreAfter ?? 100) < 20 ? 'success' : 'danger'}
              suffix="%"
            />
            {current.aiScoreBefore != null && (
              <div className="small text-muted mt-2">
                Before humanizer: {current.aiScoreBefore}%
              </div>
            )}
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div className="cf-card text-center">
            <div className="h2 mb-1 gradient-text">{current.wordCount || 0}</div>
            <div className="text-muted small">Words</div>
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div className="cf-card text-center">
            <div className="h2 mb-1 gradient-text">{(current.sources || []).length}</div>
            <div className="text-muted small">Sources analyzed</div>
          </div>
        </Col>
      </Row>

      <Row className="g-3">
        <Col xs={12} lg={8}>
          <div className="cf-card">
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
              <Nav variant="tabs" className="mb-3">
                <Nav.Item><Nav.Link eventKey="content">Content</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="meta">Meta tags</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="seo">SEO breakdown</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="pipeline">Pipeline log</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="sources">Grounding Sources</Nav.Link></Nav.Item>
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="content">
                  {editing ? (
                    <Form.Control
                      as="textarea"
                      className="editor-textarea"
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      rows={28}
                    />
                  ) : (
                    <article className="article-preview">
                      {current.images && current.images.length > 0 && (
                        <div className="article-banner mb-4 text-center">
                          <img 
                            src={current.images[0].url} 
                            alt={current.images[0].alt || current.title} 
                            className="img-fluid rounded-4 shadow-sm"
                            style={{ width: '100%', maxHeight: '420px', objectFit: 'cover' }}
                          />
                          {current.images[0].credit && (
                            <div className="text-muted small mt-2 text-end">
                              <i className="bi bi-camera me-1" /> {current.images[0].credit}
                            </div>
                          )}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: html }} />
                    </article>
                  )}
                </Tab.Pane>

                <Tab.Pane eventKey="meta">
                  <div className="mb-3">
                    <h3 className="h6 text-muted">Meta title ({(current.metaTitle || '').length} chars)</h3>
                    <div className="cf-card cf-card--inset">{current.metaTitle || '—'}</div>
                  </div>
                  <div>
                    <h3 className="h6 text-muted">Meta description ({(current.metaDescription || '').length} chars)</h3>
                    <div className="cf-card cf-card--inset">{current.metaDescription || '—'}</div>
                  </div>
                </Tab.Pane>

                <Tab.Pane eventKey="seo">
                  <div className="d-flex flex-column gap-3">
                    {Object.keys(seoBreakdown).length === 0 && (
                      <div className="text-muted">No detailed breakdown available.</div>
                    )}
                    {Object.entries(seoBreakdown).map(([k, v]) => (
                      <div key={k}>
                        <div className="d-flex justify-content-between">
                          <span className="text-capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <strong>{v}</strong>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${v}%`, background: 'var(--brand-gradient)' }}
                          />
                        </div>
                      </div>
                    ))}
                    {current.seoReport?.lsiKeywords?.length > 0 && (
                      <div>
                        <h3 className="h6 mt-3">LSI keywords found</h3>
                        <div>
                          {current.seoReport.lsiKeywords.slice(0, 20).map((k) => (
                            <span key={k} className="badge bg-secondary-subtle text-secondary me-1 mb-1">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Tab.Pane>

                <Tab.Pane eventKey="pipeline">
                  {(current.pipelineSteps || []).length === 0 ? (
                    <div className="text-muted">No pipeline log recorded.</div>
                  ) : (
                    <ul className="list-unstyled m-0">
                      {current.pipelineSteps.map((s, i) => (
                        <li key={i} className="d-flex gap-2 align-items-start mb-2">
                          <i className={`bi ${s.status === 'ok' ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />
                          <div>
                            <strong>{s.step}</strong>
                            {s.provider && <span className="text-muted small ms-2">via {s.provider}</span>}
                            {s.note && <div className="text-muted small">{s.note}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tab.Pane>

                <Tab.Pane eventKey="sources">
                  <h3 className="h6 text-muted mb-3">Sources & Grounding References</h3>
                  {!current.sources || current.sources.length === 0 ? (
                    <div className="text-muted small">No external grounding reference sources were specified or crawled for this article.</div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {current.sources.map((src, idx) => {
                        const isDoc = src.sourceType === 'document';
                        return (
                          <div key={idx} className="p-3 rounded border d-flex flex-column gap-1" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}>
                            <div className="d-flex align-items-center justify-content-between">
                              <span className="badge" style={{
                                background: isDoc ? 'rgba(22, 163, 74, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                                color: isDoc ? '#16a34a' : '#2563eb',
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px'
                              }}>
                                {isDoc ? 'Document' : (src.sourceType || 'Web').toUpperCase()}
                              </span>
                              {!isDoc && src.url && (
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="small text-decoration-none" style={{ color: 'var(--brand)' }}>
                                  Visit Website <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.75rem' }} />
                                </a>
                              )}
                            </div>
                            <h4 className="h6 mb-1 fw-bold mt-2" style={{ color: 'var(--text)' }}>{src.title || src.url}</h4>
                            {src.snippet && <p className="text-muted mb-0 small" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>{src.snippet}</p>}
                            {src.note && <div className="text-warning small mt-1" style={{ fontSize: '0.75rem' }}><i className="bi bi-info-circle me-1" /> {src.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          </div>
        </Col>

        <Col xs={12} lg={4}>
          {/* Smart suggestions */}
          <div className="cf-card mb-3">
            <h2 className="h6 mb-3">
              <i className="bi bi-lightbulb me-1 text-warning" /> Enhance your article
            </h2>
            {(current.suggestions || []).length === 0 ? (
              <div className="text-muted small">No suggestions — your article looks complete.</div>
            ) : (
              <ul className="suggestion-list">
                {current.suggestions.map((s, i) => (
                  <li key={i} className="suggestion-list__item">
                    <span className={`badge-type badge-type--${s.type}`}>{s.type}</span>
                    <div className="suggestion-list__body">
                      <div className="suggestion-list__text">{s.text}</div>
                      {s.detail && <div className="suggestion-list__detail">{s.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sources */}
          <div className="cf-card">
            <h2 className="h6 mb-3"><i className="bi bi-globe2 me-1" /> Sources analyzed</h2>
            {(current.sources || []).length === 0 ? (
              <div className="text-muted small">No external sources were used.</div>
            ) : (
              <ul className="source-list">
                {current.sources.map((src, i) => (
                  <li key={i}>
                    <a href={src.url} target="_blank" rel="noreferrer noopener">
                      <strong>{src.title || src.url}</strong>
                      <div className="text-muted small">{src.url}</div>
                    </a>
                    {src.note && <p className="text-muted small mt-1 mb-0">{src.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Col>
      </Row>
    </>
  );
}
