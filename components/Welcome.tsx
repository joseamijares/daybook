'use client';

// The first screen in a browser no Daybook has let in yet: one Start, and your
// days live on this device (free, private, in this browser). Below a rule, a
// quiet way into your own cloud Daybook with its key, or, when this server has
// no cloud set up, how to make one. Settings → "Use a cloud Daybook instead"
// comes back here with the key form open (/?own).

import { useState } from 'react';
import { api, type Session, setMode, startOnDevice, stringsFor, useLook } from './client';
import { Masthead } from './Masthead';

const SETUP_URL = 'https://github.com/joseamijares/daybook#deploy-your-own';

export function Welcome({ session, onDone }: { session: Session; onDone: () => Promise<void> }) {
  const t = stringsFor(session.locale);
  const { style } = useLook();
  const [own, setOwn] = useState(() => new URLSearchParams(window.location.search).has('own'));
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const solid = style === 'notebook' ? 'pill big' : 'pill solid big';

  // Settings' way here leaves ?own in the address; the screen after this doesn't need it.
  const clean = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('own')) return;
    url.searchParams.delete('own');
    window.history.replaceState(null, '', url);
  };
  const start = async () => {
    startOnDevice();
    clean();
    await onDone();
  };
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/session', { method: 'POST', body: { key } });
      setMode('cloud');
      clean();
      await onDone();
    } catch {
      setError(t.wrongKey);
    }
  };

  return (
    <section className="placard welcome" aria-label={t.welcomeTitle}>
      <Masthead title={t.welcomeTitle} sub={t.welcomeSub} />

      <div className="welcome-start">
        <p className="lead">{t.welcomeLead}</p>
        <div>
          <button type="button" className={solid} onClick={start}>
            {t.start}
          </button>
        </div>
      </div>

      <div className="welcome-own">
        {!session.cloud ? (
          <p>
            <span className="ask">{t.ownNone}</span>{' '}
            <a href={SETUP_URL} target="_blank" rel="noreferrer">
              {t.ownSetup} →
            </a>
          </p>
        ) : !own ? (
          <p>
            <span className="ask">{t.ownHave}</span>{' '}
            <button type="button" className="link-btn" onClick={() => setOwn(true)}>
              {t.ownOpen}
            </button>
          </p>
        ) : (
          <>
            <p className="ask">{t.ownHave}</p>
            <form className="keyform" onSubmit={signIn}>
              <input type="password" autoComplete="current-password" autoFocus value={key} placeholder={t.keyTitle} onChange={(e) => setKey(e.target.value)} aria-label={t.keyTitle} />
              <button className="pill" type="submit">
                {t.open}
              </button>
            </form>
            {error && <p className="warn-text">{error}</p>}
            <details className="key-where">
              <summary className="label">{t.keyWhere}</summary>
              <ol className="meta">
                {t.keyWhereSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
