import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Row, Col, Button, Alert, ProgressBar } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { generateArticleThunk, setPipelineProgress } from '../store/slices/articleSlice';
import api from '../services/api';
import { setSidebarCollapsed } from '../store/slices/themeSlice';

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

  // Automatically collapse the main sidebar when this component is mounted,
  // and restore it to expanded when it is unmounted.
  useEffect(() => {
    dispatch(setSidebarCollapsed(true));
    return () => {
      dispatch(setSidebarCollapsed(false));
    };
  }, [dispatch]);

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

  const getStepSubheading = (step) => {
    switch (step) {
      case 1: return 'Enter a topic for your article and let our AI handle outline and details';
      case 2: return 'Choose your Article type and how you want to gather information for it';
      case 3: return 'Specify your target primary search keyword and secondary variations';
      case 4: return 'Configure size limits, target word count, and outline heading density';
      case 5: return 'Set the writing voice tone and the output publication language';
      case 6: return 'Define your target reader profile and narrative perspective';
      case 7: return 'Select featured schema options and custom FAQ inclusions';
      case 8: return 'Manage competitor analysis sources or custom reference materials';
      case 9: return 'Verify all selected configuration items before generating';
      case 10: return 'AI pipeline is constructing and humanizing your final article';
      default: return 'Configure your writing options below';
    }
  };

  const activeStepObj = WIZARD_STEPS.find((w) => w.step === currentStep);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .wizard-sidebar {
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 0 1.5rem 1.5rem 0;
          min-height: 80vh;
        }
        .brand-card {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.1rem;
        }
        .brand-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand-card__title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text);
        }
        .brand-card__docs-link {
          font-size: 0.72rem;
          font-weight: 600;
          color: #d94f18;
          text-decoration: none;
          border: 1px solid #d94f18;
          padding: 2px 8px;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .brand-card__docs-link:hover {
          background: rgba(217, 79, 24, 0.08);
        }
        .brand-card__desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .brand-subtitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text);
          padding: 0 0.5rem;
        }
        .brand-subtitle__change {
          background: transparent;
          border: none;
          color: #d94f18;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0;
          cursor: pointer;
        }
        .brand-subtitle__change:hover {
          color: #c23e0d;
        }

        .wizard-step-link {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 8px;
          border-radius: 8px;
          color: var(--text-muted);
          text-decoration: none;
          transition: all 0.15s ease;
          position: relative;
          opacity: 0.65;
          cursor: not-allowed;
        }
        .wizard-step-link::before {
          content: "";
          position: absolute;
          left: 18px;
          top: 30px;
          bottom: -15px;
          width: 2px;
          background: var(--border);
          z-index: 1;
        }
        .wizard-step-link:last-child::before {
          display: none;
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
          color: #d94f18;
          font-weight: 600;
          opacity: 1;
        }
        .wizard-step-link .dot-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 2;
        }
        .wizard-step-link .dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--surface);
          border: 2px solid var(--border);
          display: grid;
          place-items: center;
          font-size: 0.72rem;
          font-weight: bold;
          color: var(--text-muted);
          transition: all 0.15s ease;
        }
        .wizard-step-link.is-active .dot {
          background: #ffffff;
          border-color: #d94f18;
        }
        .wizard-step-link.is-active .dot::after {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d94f18;
        }
        .wizard-step-link.is-completed .dot {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }
        .wizard-step-link.is-completed::before {
          background: #10b981;
        }
        .wizard-step-link__content {
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .wizard-step-link__label {
          font-size: 0.88rem;
          font-weight: 500;
        }
        .wizard-step-link.is-active .wizard-step-link__label {
          font-weight: 600;
        }
        .wizard-step-link__subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-style: normal;
          margin-top: 1px;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .wizard-content {
          padding-left: 2rem;
          min-height: 80vh;
          display: flex;
          flex-direction: column;
        }
        .why-this-matters {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(217, 79, 24, 0.06);
          border: 1px solid rgba(217, 79, 24, 0.15);
          color: #d94f18;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .why-this-matters:hover {
          background: rgba(217, 79, 24, 0.12);
        }
        .why-this-matters i {
          font-size: 0.85rem;
        }
        .wizard-content__header {
          border-bottom: 1px solid var(--border);
          padding-bottom: 1rem;
        }
        .wizard-content__header h2 {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text);
        }
        .wizard-footer {
          margin-top: auto;
          padding-top: 1.5rem;
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
          padding: 0.55rem 1.15rem !important;
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
          padding: 0.55rem 1.25rem !important;
          border-radius: 12px !important;
          transition: all 0.15s ease;
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
          <div className="brand-card mb-3">
            <div className="brand-card__header">
              <span className="brand-card__title">AI Article Writer 6</span>
              <a href="#" className="brand-card__docs-link" onClick={(e) => { e.preventDefault(); toast('AI Article Writer 6: Factually accurate, SEO-optimized articles and blogs of up to 5000 words.'); }}>View Docs</a>
            </div>
            <div className="brand-card__desc mt-1">
              Factually accurate, SEO-optimized articles and blogs of up to 5000 words
            </div>
          </div>
          
          <div className="brand-subtitle mb-4">
            <span>10-Step Article</span>
            <button className="brand-subtitle__change" onClick={() => navigate('/generate')}>Change</button>
          </div>

          <div className="d-flex flex-column">
            {WIZARD_STEPS.map((s) => {
              const isActive = s.step === currentStep;
              const isCompleted = s.step < currentStep;
              const isClickable = s.step <= maxReachedStep;
              
              // Get choice subtitle for completed steps
              let subtitle = '';
              if (isCompleted) {
                if (s.step === 1) {
                  subtitle = form.topic ? (form.topic.length > 25 ? form.topic.slice(0, 25) + '...' : form.topic) : '';
                } else if (s.step === 2) {
                  subtitle = form.articleType ? `${form.articleType} (${form.referenceMode === 'auto' ? 'AI Web' : 'Custom'})` : '';
                } else if (s.step === 3) {
                  subtitle = form.primaryKeyword ? form.primaryKeyword : '';
                } else if (s.step === 4) {
                  subtitle = form.targetWordCount ? `${form.targetWordCount} words` : '';
                } else if (s.step === 5) {
                  subtitle = `${form.tone} (${form.language})`;
                } else if (s.step === 6) {
                  subtitle = `${form.audience} (${form.pointOfView})`;
                } else if (s.step === 7) {
                  subtitle = `FAQ: ${form.includeFaqs ? 'Yes' : 'No'}`;
                } else if (s.step === 8) {
                  subtitle = form.referenceMode === 'custom' ? 'Custom uploads/links' : 'AI Web search';
                } else if (s.step === 9) {
                  subtitle = 'Reviewed';
                }
              }

              return (
                <div
                  key={s.step}
                  onClick={() => handleSidebarClick(s.step)}
                  className={`wizard-step-link ${isActive ? 'is-active' : ''} ${isClickable ? 'is-clickable' : ''} ${isCompleted ? 'is-completed' : ''}`}
                >
                  <div className="dot-container">
                    <div className="dot">
                      {isCompleted ? <i className="bi bi-check" style={{ fontSize: '1rem' }} /> : null}
                    </div>
                  </div>
                  <div className="wizard-step-link__content">
                    <span className="wizard-step-link__label">{s.label}</span>
                    {subtitle && <span className="wizard-step-link__subtitle">{subtitle}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Col>

        {/* Right Content Area */}
        <Col xs={12} md={9} className="wizard-content">
          <div className="wizard-content__header mb-4 d-flex align-items-start justify-content-between">
            <div>
              <h2 className="mb-1">{activeStepObj ? activeStepObj.title : 'Configure settings'}</h2>
              <p className="text-muted small mb-0">{getStepSubheading(currentStep)}</p>
            </div>
            <div className="why-this-matters" onClick={() => toast('This wizard helps you customize each step of your article writing flow to maximize quality and SEO results.')}>
              <i className="bi bi-search" /> Why This matters
            </div>
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
                  className="btn-continue-orange"
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="btn-continue-orange">
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
