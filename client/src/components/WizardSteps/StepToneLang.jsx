import { Form, Row, Col } from 'react-bootstrap';

const TONES = ['Professional', 'Casual', 'Friendly', 'Persuasive', 'Witty', 'Academic'];
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];

export default function StepToneLang({ form, set }) {
  return (
    <div>
      <p className="text-muted small">Configure language parameters and stylistic tones.</p>
      
      <Row className="g-3">
        <Col xs={12} sm={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Writing Tone</Form.Label>
            <Form.Select value={form.tone} onChange={(e) => set('tone', e.target.value)}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </Form.Select>
            <Form.Text className="text-muted">
              Controls general vocabulary and sentence structure style.
            </Form.Text>
          </Form.Group>
        </Col>

        <Col xs={12} sm={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Target Language</Form.Label>
            <Form.Select value={form.language} onChange={(e) => set('language', e.target.value)}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </Form.Select>
            <Form.Text className="text-muted">
              Generates content directly in the chosen language.
            </Form.Text>
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
}
