import { Form } from 'react-bootstrap';

export default function StepWordLength({ form, set }) {
  return (
    <div>
      <p className="text-muted small">Configure document boundaries for density and outline sizing.</p>

      <Form.Group className="mb-4">
        <Form.Label className="fw-bold d-flex justify-content-between">
          <span>Target Word Count</span>
          <span className="text-primary font-weight-bold">{form.targetWordCount} words</span>
        </Form.Label>
        <Form.Range
          min={300}
          max={5000}
          step={100}
          value={form.targetWordCount}
          onChange={(e) => set('targetWordCount', Number(e.target.value))}
        />
        <div className="d-flex justify-content-between text-muted small" style={{ fontSize: '0.75rem' }}>
          <span>300 words (Thin blog)</span>
          <span>5,000 words (Pillar post)</span>
        </div>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold d-flex justify-content-between">
          <span>Headings Count (H2 Outline)</span>
          <span className="text-primary font-weight-bold">{form.headingsCount} headings</span>
        </Form.Label>
        <Form.Range
          min={3}
          max={12}
          step={1}
          value={form.headingsCount}
          onChange={(e) => set('headingsCount', Number(e.target.value))}
        />
        <div className="d-flex justify-content-between text-muted small" style={{ fontSize: '0.75rem' }}>
          <span>3 headings</span>
          <span>12 headings</span>
        </div>
      </Form.Group>
    </div>
  );
}
