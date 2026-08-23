import { useState } from 'react';
import ScreeningForm from './components/ScreeningForm';
import ResultsPanel from './components/ResultsPanel';
import DisclaimerBanner from './components/DisclaimerBanner';
import AboutPanel from './components/AboutPanel';
import BrandMark from './components/BrandMark';
import WelcomeGate from './components/WelcomeGate';
import { predictClinical, predictImage, predictFusion } from './api';
import './App.css';

const MODES = {
  CLINICAL: 'clinical',
  IMAGE: 'image',
  FUSION: 'fusion',
};

const SESSION_KEY = 'dr_system_entered';

function App() {
  const [hasEntered, setHasEntered] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [mode, setMode] = useState(MODES.FUSION);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  function handleEnter() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch {
      // sessionStorage unavailable — proceed without persisting; the
      // welcome gate will simply reappear on the next page load.
    }
    setHasEntered(true);
  }

  if (!hasEntered) {
    return <WelcomeGate onEnter={handleEnter} />;
  }

  async function handleSubmit({ clinicalData, imageFile }) {
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      let response;
      if (mode === MODES.CLINICAL) {
        response = await predictClinical(clinicalData);
      } else if (mode === MODES.IMAGE) {
        response = await predictImage(imageFile);
      } else {
        response = await predictFusion(clinicalData, imageFile);
      }
      setResult(response);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleModeChange(newMode) {
    setMode(newMode);
    setResult(null);
    setError(null);
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <span className="app-brand-mark">
              <BrandMark size={22} />
            </span>
            <div>
              <h1>Diabetic Retinopathy Detection System</h1>
              <p>AI-assisted clinical decision support</p>
            </div>
          </div>
          <button
            type="button"
            className="app-header-link"
            onClick={() => setIsAboutOpen((prev) => !prev)}
            aria-expanded={isAboutOpen}
          >
            {isAboutOpen ? 'Close' : 'About'}
          </button>
        </div>
      </header>

      <DisclaimerBanner />

      <main className="app-main">
        {isAboutOpen ? (
          // About is a standalone view — it fully replaces the
          // screening form / results while open, rather than
          // appearing stacked above them.
          <div className="view-transition">
            <AboutPanel onClose={() => setIsAboutOpen(false)} />
          </div>
        ) : (
          <div key={result ? 'results' : 'form'} className="view-transition">
            {!result && (
              <ScreeningForm
                mode={mode}
                onModeChange={handleModeChange}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
              />
            )}

            {result && <ResultsPanel result={result} onReset={handleReset} />}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          DR Detection System &mdash; Clinical Decision Support Tool. Not a
          diagnostic device.
        </p>
      </footer>
    </div>
  );
}

export default App;