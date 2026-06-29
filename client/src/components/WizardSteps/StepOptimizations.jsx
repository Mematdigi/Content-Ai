import { Form } from 'react-bootstrap';

export default function StepOptimizations({ form, set }) {
  return (
    <div>
      <p className="text-muted small">Enable additional SEO integrations and schema features.</p>

      <div className="cf-card cf-card--inset d-flex flex-column gap-3 mt-2">
        <Form.Check
          type="switch"
          id="wiz-faq-toggle"
          label="Include FAQ Accordion (Generates structured FAQPage schema)"
          checked={form.includeFaqs}
          onChange={(e) => set('includeFaqs', e.target.checked)}
        />
        
        <Form.Check
          type="switch"
          id="wiz-meta-toggle"
          label="Generate Metadata Tags (Title & Description formatted for Google)"
          checked={form.includeMeta}
          onChange={(e) => set('includeMeta', e.target.checked)}
        />

        <Form.Check
          type="switch"
          id="wiz-img-toggle"
          label="Suggest Visual Images (Extracts stock suggestions with credits)"
          checked={form.includeImages}
          onChange={(e) => set('includeImages', e.target.checked)}
        />
      </div>
    </div>
  );
}
