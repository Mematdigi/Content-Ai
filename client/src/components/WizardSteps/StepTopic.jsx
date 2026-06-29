import { Form, Row, Col } from 'react-bootstrap';

const LOCATIONS = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'GL', name: 'Global', flag: '🌐' }
];

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];

export default function StepTopic({ form, set }) {
  const suggestedTopics = [
    "Exploring the Health Benefits of Buttermilk",
    "Creative Recipes Using Buttermilk",
    "The History and Cultural Significance of Buttermilk",
    "Alternatives to Buttermilk in Cooking"
  ];

  return (
    <div>
      <p className="text-muted small">Define the key elements to tailor your content for targeted impact.</p>
      
      <Form.Group className="mb-4">
        <Form.Label className="fw-bold">Topic</Form.Label>
        <Form.Control
          type="text"
          value={form.topic}
          onChange={(e) => set('topic', e.target.value)}
          placeholder="Enter your article's topic here..."
          required
        />
      </Form.Group>

      <div className="mb-4">
        <span className="text-muted small me-2">Suggested Topics:</span>
        <div className="d-flex flex-wrap gap-2 mt-1">
          {suggestedTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="btn btn-sm btn-ghost text-primary border-0 p-0 me-3 fw-medium"
              onClick={() => set('topic', topic)}
              style={{ fontSize: '0.88rem', background: 'transparent', textDecoration: 'underline' }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <Row className="g-3">
        <Col xs={12} sm={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Target Audience Location</Form.Label>
            <Form.Select 
              value={form.targetLocation || 'India'} 
              onChange={(e) => set('targetLocation', e.target.value)}
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.code} value={loc.name}>
                  {loc.flag} {loc.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12} sm={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Article Language</Form.Label>
            <Form.Select 
              value={form.language || 'English'} 
              onChange={(e) => set('language', e.target.value)}
            >
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
}
