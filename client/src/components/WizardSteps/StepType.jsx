import { useState } from 'react';
import { Form, Row, Col, Button, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TYPES_INFO = [
  { id: 'News', label: 'News Articles', icon: 'bi-newspaper' },
  { id: 'Blog post', label: 'Blog Posts', icon: 'bi-pencil', recommended: true },
  { id: 'How-to', label: 'How-To Guides', icon: 'bi-book' },
  { id: 'Listicle', label: 'Listicles', icon: 'bi-list-ul' },
  { id: 'Comparison', label: 'Comparison Blogs', icon: 'bi-layout-split' },
  { id: 'Technical', label: 'Technical Articles', icon: 'bi-cpu' },
  { id: 'Review', label: 'Product Reviews', icon: 'bi-star' },
  { id: 'Glossary', label: 'Glossary Pages', icon: 'bi-alphabet' }
];

export default function StepType({ form, set }) {
  const [loading, setLoading] = useState(false);
  const selectedType = form.articleType || 'Blog post';
  const selectedMode = form.referenceMode || 'auto';
  const customUrls = form.customUrls || [''];

  const handleAddUrl = () => {
    set('customUrls', [...customUrls, '']);
  };

  const handleUrlChange = (idx, val) => {
    const next = [...customUrls];
    next[idx] = val;
    set('customUrls', next);
  };

  const handleRemoveUrl = (idx) => {
    const next = customUrls.filter((_, i) => i !== idx);
    set('customUrls', next.length > 0 ? next : ['']);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/tools/extract-text', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const separator = form.customDocText ? '\n\n' : '';
      const headerText = `[File: ${file.name}]\n`;
      set('customDocText', `${form.customDocText}${separator}${headerText}${data.text}`);
      toast.success(`Extracted text from ${file.name} successfully!`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to extract text from file.';
      toast.error(msg);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .article-type-pill {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.88rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .article-type-pill:hover {
          border-color: #d94f18;
          color: #d94f18;
        }
        .article-type-pill.is-active {
          background: rgba(217, 79, 24, 0.08);
          border-color: #d94f18;
          color: #d94f18;
          font-weight: 600;
        }
        
        .badge-recommended {
          background: #e9d5ff;
          color: #7c3aed;
          font-size: 0.72rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
        }

        .research-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          height: 100%;
          text-align: left;
        }
        .research-card:hover {
          border-color: #d94f18;
          box-shadow: 0 4px 12px rgba(217, 79, 24, 0.08);
        }
        .research-card.is-active {
          border-color: #d94f18;
          box-shadow: 0 4px 12px rgba(217, 79, 24, 0.08);
        }

        .research-card__graphic-research {
          background: linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%);
          border-radius: 8px;
          height: 120px;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        
        .research-card__graphic-sources {
          background: linear-gradient(135deg, #f0f7ff 0%, #e0efff 100%);
          border-radius: 8px;
          height: 120px;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .btn-select-method {
          width: 100%;
          padding: 0.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          text-align: center;
          margin-top: auto;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-select-method.is-selected {
          background: rgba(217, 79, 24, 0.08);
          border: 1px solid #d94f18;
          color: #d94f18;
        }
        .btn-select-method.is-unselected {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
        }

        /* Custom Grounding Styles */
        .custom-sources-panel {
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 1.5rem;
        }
        .url-input-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          align-items: center;
        }
        .upload-dashed-zone {
          border: 2px dashed var(--border);
          border-radius: 10px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          background: var(--surface-alt);
          transition: all 0.2s ease;
        }
        .upload-dashed-zone:hover {
          border-color: var(--brand);
          background: var(--brand-soft);
        }
        .extracted-text-area {
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          background: var(--surface-alt);
          border-color: var(--border);
          color: var(--text);
          resize: vertical;
        }
      ` }} />

      <p className="text-muted small mb-4">Choose your Article type and how you want to gather information for it</p>
      
      <div className="mb-4">
        <h3 className="h6 fw-bold mb-3">Article Type</h3>
        <div className="d-flex flex-wrap gap-2">
          {TYPES_INFO.map((t) => {
            const active = selectedType === t.id;
            return (
              <div
                key={t.id}
                className={`article-type-pill ${active ? 'is-active' : ''}`}
                onClick={() => set('articleType', t.id)}
              >
                <i className={`bi ${t.icon}`} />
                <span>{t.label}</span>
                {t.recommended && <span className="badge-recommended ms-1">Recommended</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="h6 fw-bold mb-3">Research Method</h3>
        <Row className="g-3">
          <Col xs={12} sm={6}>
            <div 
              className={`research-card ${selectedMode === 'auto' ? 'is-active' : ''}`}
              onClick={() => set('referenceMode', 'auto')}
            >
              <div className="research-card__graphic-research">
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#1a202c',
                  transform: 'translate(-40px, -15px) rotate(-8deg)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="bi bi-reddit text-danger"></i> Reddit
                </div>
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#1a202c',
                  transform: 'translate(0px, 0px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="bi bi-medium text-dark"></i> Medium
                </div>
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#1a202c',
                  transform: 'translate(40px, 15px) rotate(8deg)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="bi bi-wikipedia text-secondary"></i> Wikipedia
                </div>
              </div>
              
              <div className="fw-bold mb-2 d-flex align-items-center justify-content-between">
                <span>AI Web Research</span>
                <span className="badge-recommended" style={{ background: '#ffe8db', color: '#d94f18' }}>Recommended</span>
              </div>
              <ul className="text-muted small ps-3 mb-4" style={{ fontSize: '0.82rem', lineHeight: '1.6' }}>
                <li>Analyzes hundreds of relevant articles</li>
                <li>Includes Competitor Analysis</li>
                <li>Provides up-to-date information</li>
                <li>Best for new or broad topics</li>
              </ul>
              
              <div className={`btn-select-method ${selectedMode === 'auto' ? 'is-selected' : 'is-unselected'}`}>
                {selectedMode === 'auto' ? (
                  <>
                    <i className="bi bi-check-lg" /> Selected
                  </>
                ) : (
                  'Select Method'
                )}
              </div>
            </div>
          </Col>

          <Col xs={12} sm={6}>
            <div 
              className={`research-card ${selectedMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => set('referenceMode', 'custom')}
            >
              <div className="research-card__graphic-sources">
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  transform: 'translate(-50px, -15px) rotate(-10deg)',
                  color: '#e11d48',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <i className="bi bi-file-pdf"></i> PDF
                </div>
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  transform: 'translate(50px, -15px) rotate(10deg)',
                  color: '#2563eb',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <i className="bi bi-file-word"></i> DOCX
                </div>
                <div style={{
                  position: 'absolute',
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  transform: 'translate(0px, 20px)',
                  color: '#16a34a',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <i className="bi bi-link-45deg"></i> Links
                </div>
                <div style={{
                  position: 'absolute',
                  background: '#e0efff',
                  border: '2px dashed #3b82f6',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#3b82f6',
                  zIndex: 2,
                  transform: 'translate(0px, -10px)'
                }}>
                  <i className="bi bi-cloud-upload"></i>
                </div>
              </div>
              
              <div className="fw-bold mb-2">
                Custom Sources
              </div>
              <ul className="text-muted small ps-3 mb-4" style={{ fontSize: '0.82rem', lineHeight: '1.6' }}>
                <li>Upload your own files or links</li>
                <li>Use your existing content</li>
                <li>Ensure brand consistency</li>
                <li>Best for specific or proprietary info</li>
              </ul>
              
              <div className={`btn-select-method ${selectedMode === 'custom' ? 'is-selected' : 'is-unselected'}`}>
                {selectedMode === 'custom' ? (
                  <>
                    <i className="bi bi-check-lg" /> Selected
                  </>
                ) : (
                  'Select Method'
                )}
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Custom Sources Panel inside Step 2 */}
      {selectedMode === 'custom' && (
        <div className="custom-sources-panel fade-in">
          <h4 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-sliders text-brand" /> Configure Grounding Data
          </h4>

          {/* URLs section */}
          <div className="mb-4">
            <Form.Label className="small fw-semibold mb-1">Competitor Website URLs</Form.Label>
            <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
              Add specific URLs you want the AI to scrape and reference.
            </p>
            {customUrls.map((url, idx) => (
              <div key={idx} className="url-input-row">
                <Form.Control
                  type="url"
                  placeholder="https://example.com/competitor-page-url"
                  value={url}
                  onChange={(e) => handleUrlChange(idx, e.target.value)}
                  size="sm"
                />
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  onClick={() => handleRemoveUrl(idx)}
                  disabled={customUrls.length === 1 && !url}
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  <i className="bi bi-trash" />
                </Button>
              </div>
            ))}
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={handleAddUrl}
              className="mt-1 d-inline-flex align-items-center gap-1"
            >
              <i className="bi bi-plus-lg" /> Add URL
            </Button>
          </div>

          <Row className="g-3">
            {/* Upload Zone */}
            <Col xs={12} md={5}>
              <Form.Label className="small fw-semibold mb-1">Upload Grounding Document</Form.Label>
              <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                Upload PDF, DOCX, or TXT reference materials.
              </p>
              
              <div 
                className="upload-dashed-zone"
                onClick={() => document.getElementById('grounding-file-input-step2').click()}
              >
                {loading ? (
                  <div className="py-2">
                    <Spinner animation="border" variant="primary" size="sm" className="mb-2" />
                    <div className="small text-muted font-weight-bold">Extracting document text...</div>
                  </div>
                ) : (
                  <div className="py-2">
                    <i className="bi bi-cloud-arrow-up text-brand" style={{ fontSize: '1.8rem' }} />
                    <div className="small fw-bold mt-1 text-dark">Click to browse file</div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>PDF, DOCX, TXT (Max 10MB)</div>
                  </div>
                )}
              </div>
              <input
                id="grounding-file-input-step2"
                type="file"
                accept=".txt,.md,.pdf,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={loading}
              />
            </Col>

            {/* Custom Content Textarea */}
            <Col xs={12} md={7}>
              <div className="d-flex align-items-center justify-content-between mb-1">
                <Form.Label className="small fw-semibold mb-0">Manual Document Text / Grounding Content</Form.Label>
                {form.customDocText && (
                  <Button 
                    variant="link" 
                    className="p-0 text-danger small text-decoration-none"
                    onClick={() => set('customDocText', '')}
                  >
                    Clear Text
                  </Button>
                )}
              </div>
              <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                Extracted file contents appear here. You can also paste text from any document directly.
              </p>
              <Form.Control
                as="textarea"
                rows={5}
                className="extracted-text-area"
                value={form.customDocText || ''}
                onChange={(e) => set('customDocText', e.target.value)}
                placeholder="Paste your custom research, statistics, or documents here to ground the AI generation..."
              />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
}

