'use client';

// The first screen in a browser no Daybook has let in yet: keep your days on
// this device (free, private, in this browser) or open your own cloud Daybook
// with its key. When this server has no cloud set up, the cloud card says how.

import { useState } from 'react';
import { api, type Session, setMode, stringsFor, useLook } from './client';
import { Masthead } from './Masthead';

const SETUP_URL = 'https://github.com/joseamijares/daybook#deploy-your-own';

export function Welcome({ session, onDone }: { session: Session; onDone: () => Promise<void> }) {
  const t = stringsFor(session.locale);
  const { style } = useLook();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const solid = style === 'notebook' ? 'pill' : 'pill solid';

  const startHere = async () => {
    setMode('local');
    await onDone();
  };
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/session', { method: 'POST', body: { key } });
      setMode('cloud');
      await onDone();
    } catch {
      setError(t.wrongKey);
    }
  };

  return (
    <section className="placard welcome" aria-label={t.welcomeTitle}>
      <Masthead title={t.welcomeTitle} sub={t.welcomeSub} />

      <div className="choice-card raised">
        <h2>{t.deviceTitle}</h2>
        <p className="lead">{t.deviceLead}</p>
        <p className="note">{t.deviceNote}</p>
        <div>
          <button type="button" className={solid} onClick={startHere}>
            {t.deviceStart}
          </button>
        </div>
      </div>

      <div className="choice-card">
        <h2>{t.cloudTitle}</h2>
        <p className="lead">{t.cloudLead}</p>
        {session.cloud ? (
          <>
            <form className="keyform" onSubmit={signIn}>
              <input type="password" autoComplete="current-password" value={key} placeholder={t.keyTitle} onChange={(e) => setKey(e.target.value)} aria-label={t.keyTitle} />
              <button className="pill" type="submit">
                {t.open}
              </button>
            </form>
            {error && <p className="note warn-text">{error}</p>}
            <details className="key-where">
              <summary className="label">{t.keyWhere}</summary>
              <ol className="meta">
                {t.keyWhereSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p className="note">
            {t.cloudNone}{' '}
            <a href={SETUP_URL} target="_blank" rel="noreferrer">
              {t.cloudHowTo} →
            </a>
          </p>
        )}
      </div>

      <p className="meta">{t.welcomeFoot}</p>
    </section>
  );
}
