import { useEffect, useState } from 'react';
import { CONSENT_OPEN_EVENT, setConsent, useConsent } from '../lib/analytics.js';

// Analytics consent. Shown until the visitor chooses, and again whenever the footer's
// "Cookie settings" is used. Both buttons carry the same weight on purpose.
export default function ConsentBanner() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  if (consent !== null && !reopened) return null;

  const choose = (value) => {
    setConsent(value);
    setReopened(false);
  };

  return (
    <section className="consent" role="region" aria-label="Analytics cookies">
      <p className="consent__text">
        We use Google Analytics to count visits and see which pages are used. It sets cookies only if you accept.{' '}
        <a href="#/privacy">Privacy &amp; cookies</a>
      </p>
      <div className="consent__actions">
        <button type="button" className="pill pill--ghost" onClick={() => choose('denied')}>Reject</button>
        <button type="button" className="pill pill--ghost" onClick={() => choose('granted')}>Accept analytics</button>
      </div>
    </section>
  );
}
