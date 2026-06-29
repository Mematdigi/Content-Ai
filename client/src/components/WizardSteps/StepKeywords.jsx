import { Form } from 'react-bootstrap';
import { useState } from 'react';

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

export default function StepKeywords({ form, set }) {
  return (
    <div>
      <p className="text-muted small">Target the search queries you want to rank for.</p>
      
      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Primary Keyword <span className="text-danger">*</span></Form.Label>
        <Form.Control
          type="text"
          value={form.primaryKeyword}
          onChange={(e) => set('primaryKeyword', e.target.value)}
          placeholder="e.g. cold brew coffee"
          required
        />
        <Form.Text className="text-muted">
          Used in H1, first paragraph, and H2. Crucial for indexing.
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Secondary Keywords</Form.Label>
        <TagsInput
          value={form.secondaryKeywords}
          onChange={(v) => set('secondaryKeywords', v)}
          placeholder="Type tag and press comma or Enter"
        />
        <Form.Text className="text-muted">
          Add supporting keywords to weave contextually throughout sections.
        </Form.Text>
      </Form.Group>
    </div>
  );
}
