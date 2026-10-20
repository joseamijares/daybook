'use client';

// The first screen in a browser no Daybook has let in yet: one button, and your
// days live on this device (free, private, in this browser). Nothing else to
// press: a small footnote says how to set up your own Daybook (sync, the TV)
// and, on a server that keeps one, opens it with its key. Settings → "Use a
// cloud Daybook instead" comes back here with the key form open (/?own).
// In the Mac app's own copy (DEVICE) it's the button alone: a cloud Daybook is
// the app's Settings, never a first step.

import { useState } from 'react';
import { api, DEVICE, ON_PC, type Session, setMode, startOnDevice, stringsFor, useLook } from './client';
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
        <p className="lead">{ON_PC ? t.welcomeLeadPC : DEVICE ? t.welcomeLeadMac : t.welcomeLead}</p>
        <div>
          <button type="button" className={solid} onClick={start}>
            {t.start}
          </button>
        </div>
      </div>

      {DEVICE ? null : session.cloud && own ? (
        <div className="welcome-own">
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
        </div>
      ) : (
        <div className="welcome-foot">
          <p>
            {t.ownNone}{' '}
            <a href={SETUP_URL} target="_blank" rel="noreferrer">
              {t.ownSetup}
            </a>
          </p>
          {session.cloud && (
            <p>
              {t.ownHave}{' '}
              <button type="button" className="link-btn" onClick={() => setOwn(true)}>
                {t.ownOpen}
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
