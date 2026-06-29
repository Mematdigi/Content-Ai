import { Row, Col } from 'react-bootstrap';

export default function StepReview({ form }) {
  return (
    <div>
      <p className="text-muted small">Verify your article profile before triggering the generation pipeline.</p>
      
      <div className="cf-card cf-card--inset small">
        <Row className="g-3">
          <Col xs={12}>
            <div className="text-muted">Topic Title</div>
            <div className="fw-bold fs-6">{form.topic || 'Untitled'}</div>
          </Col>
          
          <Col xs={6} md={4}>
            <div className="text-muted">Article Type</div>
            <div className="fw-bold">{form.articleType}</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Primary Keyword</div>
            <div className="fw-bold text-primary">{form.primaryKeyword || 'None'}</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Secondary Keywords</div>
            <div className="fw-bold">
              {form.secondaryKeywords.length > 0 
                ? `${form.secondaryKeywords.length} tags` 
                : 'None'}
            </div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Target Word Count</div>
            <div className="fw-bold">{form.targetWordCount} words</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Outline Headings</div>
            <div className="fw-bold">{form.headingsCount} H2 tags</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Tone & Language</div>
            <div className="fw-bold">{form.tone} ({form.language})</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">POV / Audience</div>
            <div className="fw-bold">{form.pointOfView} / {form.audience || 'General'}</div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Research Grounding</div>
            <div className="fw-bold text-success">
              {form.referenceMode === 'auto' ? 'Enabled (Scraper)' : 'Disabled'}
            </div>
          </Col>

          <Col xs={6} md={4}>
            <div className="text-muted">Add-on Features</div>
            <div className="fw-bold">
              {form.includeFaqs ? 'FAQs ' : ''}
              {form.includeMeta ? 'Meta-Tags ' : ''}
              {form.includeImages ? 'Images ' : ''}
              {!form.includeFaqs && !form.includeMeta && !form.includeImages ? 'None' : ''}
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
}
