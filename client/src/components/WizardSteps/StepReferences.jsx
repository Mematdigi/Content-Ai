import { useState } from 'react';
import { Form, Row, Col, Button, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function StepReferences({ form, set }) {
  const [loading, setLoading] = useState(false);
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
      // Reset input value to allow uploading same file again
      e.target.value = '';
    }
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .ref-mode-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          height: 100%;
          text-align: left;
        }
        .ref-mode-card:hover {
          border-color: var(--brand);
          box-shadow: 0 4px 12px rgba(217, 79, 24, 0.06);
        }
        .ref-mode-card.is-active {
          border-color: var(--brand);
          background: var(--brand-soft);
          box-shadow: 0 4px 12px rgba(217, 79, 24, 0.08);
        }
        .ref-btn-select {
          width: 100%;
          padding: 0.4rem;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.82rem;
          text-align: center;
          margin-top: auto;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }
        .ref-btn-select.is-selected {
          background: rgba(217, 79, 24, 0.1);
          border: 1px solid var(--brand);
          color: var(--brand);
        }
        .ref-btn-select.is-unselected {
          background: var(--surface-alt);
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

      <p className="text-muted small">Select how you want to ground your article to ensure factual accuracy and prevent hallucinations.</p>

      <Row className="g-3 mt-1">
        {/* 1. Auto Scrape */}
        <Col xs={12} md={4}>
          <div 
            className={`ref-mode-card ${selectedMode === 'auto' ? 'is-active' : ''}`}
            onClick={() => set('referenceMode', 'auto')}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-globe2 text-primary" style={{ fontSize: '1.2rem' }} />
              <strong style={{ color: selectedMode === 'auto' ? 'var(--brand)' : 'var(--text)' }}>
                Auto Web Scrape
              </strong>
            </div>
            <p className="text-muted small mb-3" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
              Crawls top search results automatically using topic and keywords to capture live dates and competitor stats.
            </p>
            <div className={`ref-btn-select ${selectedMode === 'auto' ? 'is-selected' : 'is-unselected'}`}>
              {selectedMode === 'auto' ? <><i className="bi bi-check-lg" /> Selected</> : 'Select Mode'}
            </div>
          </div>
        </Col>

        {/* 2. Custom Sources */}
        <Col xs={12} md={4}>
          <div 
            className={`ref-mode-card ${selectedMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => set('referenceMode', 'custom')}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-file-earmark-arrow-up text-success" style={{ fontSize: '1.2rem' }} />
              <strong style={{ color: selectedMode === 'custom' ? 'var(--brand)' : 'var(--text)' }}>
                Custom Sources
              </strong>
            </div>
            <p className="text-muted small mb-3" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
              Grounds generation using specific website URLs, uploaded files (PDF, DOCX, TXT), or custom grounding text content.
            </p>
            <div className={`ref-btn-select ${selectedMode === 'custom' ? 'is-selected' : 'is-unselected'}`}>
              {selectedMode === 'custom' ? <><i className="bi bi-check-lg" /> Selected</> : 'Select Mode'}
            </div>
          </div>
        </Col>

        {/* 3. Generic Writing */}
        <Col xs={12} md={4}>
          <div 
            className={`ref-mode-card ${selectedMode === 'none' ? 'is-active' : ''}`}
            onClick={() => set('referenceMode', 'none')}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-cpu text-secondary" style={{ fontSize: '1.2rem' }} />
              <strong style={{ color: selectedMode === 'none' ? 'var(--brand)' : 'var(--text)' }}>
                Generic Writing
              </strong>
            </div>
            <p className="text-muted small mb-3" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
              Skips live web crawling. Writes content purely from the AI model's built-in, pre-trained knowledge base.
            </p>
            <div className={`ref-btn-select ${selectedMode === 'none' ? 'is-selected' : 'is-unselected'}`}>
              {selectedMode === 'none' ? <><i className="bi bi-check-lg" /> Selected</> : 'Select Mode'}
            </div>
          </div>
        </Col>
      </Row>

      {/* Custom Sources Form Panel */}
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
                onClick={() => document.getElementById('grounding-file-input').click()}
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
                id="grounding-file-input"
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
