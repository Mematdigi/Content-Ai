import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Row, Col, Button, Alert, ProgressBar } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { generateArticleThunk, setPipelineProgress } from '../store/slices/articleSlice';
import api from '../services/api';

// Import step slides modularly
import StepTopic from '../components/WizardSteps/StepTopic';
import StepType from '../components/WizardSteps/StepType';
import StepKeywords from '../components/WizardSteps/StepKeywords';
import StepWordLength from '../components/WizardSteps/StepWordLength';
import StepToneLang from '../components/WizardSteps/StepToneLang';
import StepAudiencePOV from '../components/WizardSteps/StepAudiencePOV';
import StepOptimizations from '../components/WizardSteps/StepOptimizations';
import StepReferences from '../components/WizardSteps/StepReferences';
import StepReview from '../components/WizardSteps/StepReview';
import StepGenerate from '../components/WizardSteps/StepGenerate';

const PIPELINE_STEPS = [
  { id: 'research', label: 'Research', icon: 'bi-globe2' },
  { id: 'outline', label: 'Outline', icon: 'bi-list-ol' },
  { id: 'writing', label: 'Writing', icon: 'bi-pencil-square' },
  { id: 'humanize', label: 'SEO + Humanize', icon: 'bi-magic' },
];

const WIZARD_STEPS = [
  { step: 1, label: 'Enter a Topic', title: 'Start Your Article: Choose Your Topic' },
  { step: 2, label: 'Select Article Type', title: 'Article Type and Research Method' },
  { step: 3, label: 'Select Keywords', title: 'Target Search Keywords' },
  { step: 4, label: 'Select Article Length', title: 'Set Sizing & Heading Boundaries' },
  { step: 5, label: 'Tone & Language', title: 'Select Tone & Language' },
  { step: 6, label: 'Target Audience & POV', title: 'Narrative POV & Target Audience' },
  { step: 7, label: 'Snippet Optimizations', title: 'Configure FAQ & Metadata Settings' },
  { step: 8, label: 'Research Grounding', title: 'Select Competitor Reference Grounding' },
  { step: 9, label: 'Review Configurations', title: 'Confirm Generation Brief' },
  { step: 10, label: 'Launch Generator', title: 'Forging Your Article' }
];

export default function WizardGenerator() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { generating, pipelineProgress } = useSelector((s) => s.articles);

  const [currentStep, setCurrentStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [pickingTopic, setPickingTopic] = useState(false);

  const [form, setForm] = useState({
    topic: '',
    primaryKeyword: '',
    secondaryKeywords: [],
    targetWordCount: 1200,
    headingsCount: 5,
    tone: 'Professional',
    audience: 'general readers',
    language: 'English',
    articleType: 'Blog post',
    pointOfView: '2nd person',
    includeFaqs: true,
    includeMeta: true,
    includeImages: false,
    referenceMode: 'auto',
    customUrls: [''],
    customDocText: '',
  });
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePickForMe = async () => {
    setError('');
    if (currentStep === 1) {
      setPickingTopic(true);
      try {
        const { data } = await api.post('/tools/auto-pick-topic');
        if (data) {
          setForm((f) => ({
            ...f,
            topic: data.topic || f.topic,
            targetLocation: data.targetLocation || f.targetLocation,
            language: data.language || f.language,
            audience: data.audience || f.audience,
          }));
          toast.success(`AI selected topic: "${data.topic}"`);
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to auto-pick topic. Please try again.';
        toast.error(msg);
      } finally {
        setPickingTopic(false);
      }
    } else if (currentStep === 2) {
      const types = ['News', 'Blog post', 'How-to', 'Listicle', 'Comparison', 'Technical', 'Review', 'Glossary'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomRefMode = Math.random() > 0.5 ? 'auto' : 'custom';
      
      setForm((f) => ({
        ...f,
        articleType: randomType,
        referenceMode: randomRefMode,
      }));
      
      const typeLabel = {
        News: 'News Articles',
        'Blog post': 'Blog Posts',
        'How-to': 'How-To Guides',
        Listicle: 'Listicles',
        Comparison: 'Comparison Blogs',
        Technical: 'Technical Articles',
        Review: 'Product Reviews',
        Glossary: 'Glossary Pages'
      }[randomType] || randomType;

      toast.success(`AI selected Type: "${typeLabel}" and Research Method: "${randomRefMode === 'auto' ? 'AI Web Research' : 'Custom Sources'}"`);
    }
  };

  // Simulate pipeline progress loaders
  useEffect(() => {
    if (!generating) return;
    let i = 0;
    dispatch(setPipelineProgress({ step: PIPELINE_STEPS[0].id, percent: 5 }));
    const id = setInterval(() => {
      i = Math.min(i + 1, PIPELINE_STEPS.length - 1);
      const pct = Math.min(95, ((i + 1) / PIPELINE_STEPS.length) * 100);
      dispatch(setPipelineProgress({ step: PIPELINE_STEPS[i].id, percent: pct }));
    }, 4500);
    return () => clearInterval(id);
  }, [generating, dispatch]);

  const handleNext = () => {
    setError('');
    if (currentStep === 1 && !form.topic.trim()) {
      setError('Please enter a topic before continuing.');
      return;
    }
    if (currentStep === 3 && !form.primaryKeyword.trim()) {
      setError('Please enter a primary keyword before continuing.');
      return;
    }
    
    const next = currentStep + 1;
    setCurrentStep(next);
    if (next > maxReachedStep) {
      setMaxReachedStep(next);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSidebarClick = (stepNum) => {
    if (stepNum <= maxReachedStep) {
      setCurrentStep(stepNum);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.topic.trim()) {
      setError('Topic title is required. Jump back to Step 1.');
      setCurrentStep(1);
      return;
    }
    if (!form.primaryKeyword.trim()) {
      setError('Primary keyword is required. Jump back to Step 3.');
      setCurrentStep(3);
      return;
    }
    try {
      const article = await dispatch(generateArticleThunk(form)).unwrap();
      toast.success('Article generated!');
      navigate(`/articles/${article._id}`);
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Generation failed. Try again.';
      setError(msg);
      toast.error(msg);
    }
  };

  const progress = pipelineProgress || { step: null, percent: 0 };
  const currentStepIdx = PIPELINE_STEPS.findIndex((s) => s.id === progress.step);

  const renderActiveStepComponent = () => {
    const props = { form, set, handleSubmit };
    switch (currentStep) {
      case 1: return <StepTopic {...props} />;
      case 2: return <StepType {...props} />;
      case 3: return <StepKeywords {...props} />;
      case 4: return <StepWordLength {...props} />;
      case 5: return <StepToneLang {...props} />;
      case 6: return <StepAudiencePOV {...props} />;
      case 7: return <StepOptimizations {...props} />;
      case 8: return <StepReferences {...props} />;
      case 9: return <StepReview {...props} />;
      case 10: return <StepGenerate {...props} />;
      default: return null;
    }
  };

  if (generating) {
    return (
      <div className="py-5">
        <Row className="justify-content-center">
          <Col xs={12} md={8} lg={6}>
            <div className="cf-card text-center p-4">
              <h2 className="h4 mb-3">
                <i className="bi bi-stars text-warning me-2 animate-pulse" /> Forging Your Article
              </h2>
              <p className="text-muted small mb-4">
                Our multi-model AI pipeline is crawling web competitors, constructing outlines, writing content, optimizing SEO, and humanizing sentence flow. Please do not close this tab.
              </p>

              <div className="pipeline text-start my-4">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isRunning = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={`pipeline__step ${isDone ? 'is-done' : ''} ${isRunning ? 'is-running' : ''} mb-2`}
                    >
                      <div className="pipeline__icon"><i className={`bi ${step.icon}`} /></div>
                      <div className="pipeline__body flex-grow-1">
                        <div className="pipeline__label">{step.label}</div>
                        <div className="pipeline__status small text-muted">
                          {isDone ? 'Complete' : isRunning ? 'Processing…' : 'Queued'}
                        </div>
                      </div>
                      {isDone && <i className="bi bi-check-circle-fill text-success" />}
                    </div>
                  );
                })}
              </div>

              <ProgressBar
                now={progress.percent}
                variant="primary"
                className="my-3"
                style={{ height: '8px', background: 'var(--surface-alt)' }}
              />
              <div className="small text-muted">{Math.round(progress.percent)}% Completed</div>
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  const activeStepObj = WIZARD_STEPS.find((w) => w.step === currentStep);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .wizard-sidebar {
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding-right: 1rem;
          min-height: 70vh;
        }
        .wizard-sidebar__title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.25rem;
        }
        .wizard-step-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0.5rem;
          border-radius: 8px;
          color: var(--text-muted);
          font-size: 0.88rem;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
          border: 1px solid transparent;
          margin-bottom: 0.25rem;
          cursor: not-allowed;
          opacity: 0.55;
        }
        .wizard-step-link.is-clickable {
          cursor: pointer;
          opacity: 1;
          color: var(--text);
        }
        .wizard-step-link.is-clickable:hover {
          background: var(--surface-alt);
        }
        .wizard-step-link.is-active {
          background: var(--brand-soft);
          color: var(--brand);
          font-weight: 600;
          border-color: var(--border);
          opacity: 1;
        }
        .wizard-step-link .dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--surface-alt);
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          font-weight: bold;
          border: 2px solid var(--border);
          color: var(--text-muted);
          transition: all 0.15s ease;
        }
        .wizard-step-link.is-active .dot {
          background: var(--brand);
          border-color: var(--brand);
          color: white;
        }
        .wizard-step-link.is-completed .dot {
          background: var(--success);
          border-color: var(--success);
          color: white;
        }
        .wizard-content {
          padding-left: 1.5rem;
          min-height: 70vh;
          display: flex;
          flex-direction: column;
        }
        .wizard-content__header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text);
        }
        .wizard-footer {
          margin-top: auto;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-pick-for-me {
          background: var(--surface);
          border: 1px solid #d94f18 !important;
          color: #d94f18 !important;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1.1rem !important;
          border-radius: 12px !important;
          transition: all 0.15s ease;
        }
        .btn-pick-for-me:hover:not(:disabled) {
          background: rgba(217, 79, 24, 0.08) !important;
          border-color: #c23e0d !important;
          color: #c23e0d !important;
        }
        .btn-pick-for-me:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-continue-orange {
          background: #d94f18 !important;
          border-color: #d94f18 !important;
          color: #ffffff !important;
          font-weight: 600;
          padding: 0.55rem 1.1rem !important;
          border-radius: 12px !important;
        }
        .btn-continue-orange:hover:not(:disabled) {
          background: #c23e0d !important;
          border-color: #c23e0d !important;
          color: #ffffff !important;
        }
      ` }} />

      <div className="mb-3">
        <Link to="/generate" className="text-muted small text-decoration-none">
          <i className="bi bi-arrow-left me-1" /> Back to Generator Choices
        </Link>
      </div>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      <Row className="g-0">
        {/* Left Timeline Sidebar */}
        <Col xs={12} md={3} className="wizard-sidebar d-none d-md-block">
          <div className="wizard-sidebar__title">
            10-Step Article Planner
          </div>
          <div className="d-flex flex-column">
            {WIZARD_STEPS.map((s) => {
              const isActive = s.step === currentStep;
              const isCompleted = s.step < currentStep;
              const isClickable = s.step <= maxReachedStep;
              return (
                <div
                  key={s.step}
                  onClick={() => handleSidebarClick(s.step)}
                  className={`wizard-step-link ${isActive ? 'is-active' : ''} ${isClickable ? 'is-clickable' : ''} ${isCompleted ? 'is-completed' : ''}`}
                >
                  <div className="dot">
                    {isCompleted ? <i className="bi bi-check" style={{ fontSize: '0.9rem' }} /> : s.step}
                  </div>
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
        </Col>

        {/* Right Content Area */}
        <Col xs={12} md={9} className="wizard-content">
          <div className="wizard-content__header mb-4">
            <h2 className="mb-1">{activeStepObj ? activeStepObj.title : 'Configure settings'}</h2>
            <div className="d-md-none text-muted small mb-2">Step {currentStep} of 10</div>
            <ProgressBar now={(currentStep / 10) * 100} style={{ height: '5px' }} />
          </div>

          <div className="flex-grow-1">
            {renderActiveStepComponent()}
          </div>

          <div className="wizard-footer mt-4">
            <Button
              variant="outline-secondary"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>

            <div className="d-flex gap-2">
              {(currentStep === 1 || currentStep === 2) && (
                <button
                  type="button"
                  className="btn btn-pick-for-me"
                  onClick={handlePickForMe}
                  disabled={pickingTopic}
                >
                  {pickingTopic ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" style={{ width: '14px', height: '14px' }}></span>
                  ) : (
                    <i className="bi bi-magic me-1" />
                  )}
                  {pickingTopic ? 'Picking...' : 'Pick for me'}
                </button>
              )}
              {currentStep < 10 ? (
                <Button 
                  onClick={handleNext}
                  className={(currentStep === 1 || currentStep === 2) ? 'btn-continue-orange' : ''}
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="btn-primary">
                  Launch AI Content Engine
                </Button>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}
