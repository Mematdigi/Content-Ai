import { useEffect, useState } from 'react';

export default function AuthSimulator() {
  const [step, setStep] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [seoScore, setSeoScore] = useState(45);
  const [aiScore, setAiScore] = useState(99);
  const [sources, setSources] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => {
        const next = (prev + 1) % 4;
        if (next === 0) {
          // Reset all values on cycle restart
          setWordCount(0);
          setSeoScore(45);
          setAiScore(99);
          setSources(0);
        }
        return next;
      });
    }, 2000); // Snappy 2.0s duration per step for fast demonstration

    return () => clearInterval(interval);
  }, []);

  // Snappy counter updates matching the 2.0s step speed
  useEffect(() => {
    let timer;
    if (step === 0) {
      timer = setInterval(() => {
        setSources((prev) => (prev < 5 ? prev + 1 : prev));
      }, 250);
    } else if (step === 1) {
      timer = setInterval(() => {
        setWordCount((prev) => (prev < 1200 ? prev + 120 : 1200));
      }, 100);
    } else if (step === 2) {
      timer = setInterval(() => {
        setSeoScore((prev) => (prev < 96 ? prev + 6 : 96));
      }, 100);
    } else if (step === 3) {
      timer = setInterval(() => {
        setAiScore((prev) => (prev > 4 ? prev - 10 : 4));
      }, 80);
    }

    return () => clearInterval(timer);
  }, [step]);

  const steps = [
    {
      label: 'Competitor Research',
      desc: 'Analyzing top SERPs and gathering SEO intelligence.',
      icon: 'bi-search',
    },
    {
      label: 'Multi-Model Generation',
      desc: 'Structuring content blocks and drafting draft versions.',
      icon: 'bi-cpu',
    },
    {
      label: 'SEO & Readability Tuning',
      desc: 'Injecting LSI keywords and optimizing reading grades.',
      icon: 'bi-graph-up-arrow',
    },
    {
      label: 'AI-Detection Humanizer',
      desc: 'Varying sentence complexity and smoothing AI markers.',
      icon: 'bi-shield-check',
    },
  ];

  return (
    <div className="pipeline-simulator">
      <div className="pipeline-simulator__title-row">
        <span className="pipeline-simulator__badge">Engine Preview</span>
        <div className="pipeline-simulator__indicator">
          <span className="dot pulsing" />
          <span>Live Demo</span>
        </div>
      </div>

      <div className="pipeline-steps-container">
        {steps.map((item, idx) => {
          let statusClass = '';
          if (step === idx) statusClass = 'active';
          else if (idx < step) statusClass = 'completed';

          return (
            <div key={idx} className={`pipeline-simulator__step ${statusClass}`}>
              <div className={`step-icon ${statusClass === 'active' ? 'active' : statusClass === 'completed' ? 'completed' : ''}`}>
                {statusClass === 'completed' ? (
                  <i className="bi bi-check-lg" />
                ) : (
                  <i className={`bi ${item.icon}`} />
                )}
              </div>
              <div className="step-content">
                <h4>{item.label}</h4>
                <p>{item.desc}</p>
                {statusClass === 'active' && (
                  <div className="step-progress-bar-container">
                    <div className="step-progress-bar" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pipeline-simulator__metric-box">
        <div className="pipeline-simulator__metric">
          <span className="metric-label">Sources Scraped</span>
          <div className="metric-value">
            {step === 0 && sources < 5 ? (
              <span style={{ color: '#a78bfa' }}>{sources}/5</span>
            ) : step === 0 ? (
              <span className="text-success">5/5</span>
            ) : (
              <span style={{ opacity: 0.85 }}>5</span>
            )}
          </div>
        </div>

        <div className="pipeline-simulator__metric">
          <span className="metric-label">Words Drafted</span>
          <div className="metric-value">
            {step >= 1 ? (
              <span className={step > 1 ? 'text-success' : ''} style={step === 1 ? { color: '#a78bfa' } : {}}>
                {wordCount}
              </span>
            ) : (
              <span className="opacity-50">--</span>
            )}
          </div>
        </div>

        <div className="pipeline-simulator__metric">
          <span className="metric-label">SEO Score</span>
          <div className="metric-value">
            {step >= 2 ? (
              <span className={step > 2 ? 'text-success' : ''} style={step === 2 ? { color: '#a78bfa' } : {}} >
                {seoScore}/100
              </span>
            ) : (
              <span className="opacity-50">--</span>
            )}
          </div>
        </div>

        <div className="pipeline-simulator__metric">
          <span className="metric-label">AI Score</span>
          <div className="metric-value">
            {step >= 3 ? (
              <span className={aiScore <= 10 ? 'text-success font-weight-bold' : 'text-danger'}>
                {aiScore}%
              </span>
            ) : (
              <span className="opacity-50">--</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
