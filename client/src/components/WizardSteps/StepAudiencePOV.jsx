import { Form, Row, Col } from 'react-bootstrap';

const POVS = ['1st person', '2nd person', '3rd person'];

export default function StepAudiencePOV({ form, set }) {
  return (
    <div>
      <p className="text-muted small">Target the reader persona and define grammatical perspective constraints.</p>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Target Audience Description</Form.Label>
        <Form.Control
          type="text"
          value={form.audience}
          onChange={(e) => set('audience', e.target.value)}
          placeholder="e.g. busy professionals who drink specialty coffee"
        />
        <Form.Text className="text-muted">
          Helps the AI adapt analogies and reading depth level for readers.
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Grammatical Perspective (POV)</Form.Label>
        <Form.Select value={form.pointOfView} onChange={(e) => set('pointOfView', e.target.value)}>
          {POVS.map((p) => <option key={p}>{p}</option>)}
        </Form.Select>
        <Form.Text className="text-muted">
          Controls pronoun structure (e.g. 2nd person uses "you/your" to speak directly).
        </Form.Text>
      </Form.Group>
    </div>
  );
}
