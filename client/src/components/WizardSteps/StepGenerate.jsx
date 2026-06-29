import { Button } from 'react-bootstrap';

export default function StepGenerate({ handleSubmit }) {
  return (
    <div className="text-center py-4">
      <div className="mb-3 animate-pulse" style={{ fontSize: '3.5rem', color: 'var(--brand)' }}>
        <i className="bi bi-stars" />
      </div>
      <h3 className="h5 mb-2 font-weight-bold" style={{ color: 'var(--text)' }}>
        Step 10: Ready for Forging
      </h3>
      <p className="text-muted small px-3 mb-4">
        Your blueprint has been locked. Click the button below to start the live web research, outline compilation, text generation, and SEO humanization.
      </p>
      
      <Button 
        type="button" 
        onClick={handleSubmit} 
        className="btn-primary w-100 py-3"
        style={{ fontSize: '1.05rem', borderRadius: '12px' }}
      >
        <i className="bi bi-lightning-charge-fill me-2" /> Launch AI Content Engine
      </Button>
    </div>
  );
}
