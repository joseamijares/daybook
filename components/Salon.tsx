'use client';

// The room every screen shares, mounted once in the root layout so it stays
// put while you move between screens: the painting of the day on the wall
// (a new painting fades in over the old one, the room dims at shutdown), the
// navigation pill, the credit, and the sign-in gate. Pages render only their
// placard.

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { type Artwork, artFor, credit } from '@/lib/art';
import { addDays, mondayOf } from '@/lib/time';
import { api, type Session, SessionContext, stringsFor } from './client';

export type View = 'today' | 'week' | 'backlog' | 'shutdown' | 'settings';

const viewFor = (path: string): View =>
  path.startsWith('/week')
    ? 'week'
    : path.startsWith('/backlog')
      ? 'backlog'
      : path.startsWith('/shutdown')
        ? 'shutdown'
        : path.startsWith('/settings')
          ? 'settings'
          : 'today';

export function Salon({ children }: { children: ReactNode }) {
  const view = viewFor(usePathname() || '/');
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setSession(await api<Session>('/api/session'));
  }, []);

  useEffect(() => {
    let alive = true;
    api<Session>('/api/session')
      .then((s) => alive && setSession(s))
      .catch(() => alive && setMessage('Daybook is not reachable.'));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4200);
    return () => clearTimeout(timer);
  }, [message]);

  const toast = useCallback((m: string) => setMessage(m), []);

  const ctx = useMemo(() => {
    if (!session) return null;
    return {
      session,
      t: stringsFor(session.locale),
      toast,
      refreshSession,
      async run<T>(fn: () => Promise<T>, after?: () => unknown) {
        try {
          const result = await fn();
          const warnings = (result as { warnings?: string[] })?.warnings;
          if (warnings?.length) toast(warnings.join(' '));
          return result;
        } catch (err) {
          toast((err as Error).message);
          return undefined;
        } finally {
          await after?.();
        }
      },
    };
  }, [session, toast, refreshSession]);

  // Week shows the painting of the Sunday before, so it differs from every weekday's.
  // The server picks the painting (the Frame's, when connected, so the TV and Daybook match).
  const art = session ? ((view === 'week' ? session.weekArt : session.art) ?? artFor(view === 'week' ? addDays(mondayOf(session.today), -1) : session.today)) : null;
  const t = stringsFor(session?.locale || 'en');
  const pageClass = ['room', view === 'shutdown' && 'dusk-page', (view === 'week' || view === 'settings') && 'wide-page', 'scroll-page'].filter(Boolean).join(' ');

  return (
    <div className={pageClass}>
      <Wall art={art} dusk={view === 'shutdown'} />
      {art && (
        <a key={art.slug} className="credit" href={art.source} target="_blank" rel="noreferrer" title={art.title}>
          <span className="t">{art.title}</span>
          <span className="s">{credit(art)}</span>
          {art.fact && <span className="f">{art.fact}</span>}
        </a>
      )}
      <nav className="nav" aria-label="Daybook">
        <Link className="mark" href="/">
          <Image src="/brand/daybook-lockup-dark.svg" alt="Daybook" width={91} height={23} priority />
        </Link>
        <div className="links">
          {(
            [
              ['today', '/', t.today],
              ['week', '/week', t.week],
              ['backlog', '/backlog', t.backlog],
              ['shutdown', '/shutdown', t.shutDown],
            ] as const
          ).map(([id, href, label]) => (
            <Link key={id} className="link" href={href} aria-current={view === id ? 'page' : undefined}>
              {label}
            </Link>
          ))}
          <Link className="link gear" href="/settings" aria-current={view === 'settings' ? 'page' : undefined} aria-label={t.settings} title={t.settings}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        </div>
      </nav>
      {!session ? (
        <section className="placard">
          <p className="meta">{t.loading}</p>
        </section>
      ) : !session.authorized ? (
        <KeyGate session={session} onDone={refreshSession} />
      ) : (
        <SessionContext.Provider value={ctx}>
          {/* Keyed by screen so each placard is hung fresh, with its entrance. */}
          <div key={view} className="hang">
            {children}
          </div>
        </SessionContext.Provider>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}

// The painting wall. When the painting changes, the new one fades in over the
// old (slowly, the way a gallery light comes up), then the old one is taken
// down. Each painting drifts very slightly while it hangs.
function Wall({ art, dusk }: { art: Artwork | null; dusk: boolean }) {
  const [layers, setLayers] = useState<{ art: Artwork; id: string }[]>([]);
  const [shown, setShown] = useState<string | null>(null);

  if (art && art.slug !== shown) {
    // Derived from props during render, React's pattern for "adjust state when a prop changes".
    setShown(art.slug);
    setLayers((l) => [...l.slice(-1), { art, id: `${art.slug}:${l.length}` }]);
  }

  useEffect(() => {
    if (layers.length < 2) return;
    const timer = setTimeout(() => setLayers((l) => l.slice(-1)), 2400);
    return () => clearTimeout(timer);
  }, [layers]);

  return (
    <div className={`wall${dusk ? ' dusk' : ''}`} aria-hidden>
      {layers.map(({ art: a, id }, i) => (
        <div key={id} className={`hanging${i === layers.length - 1 ? ' is-new' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="fill" src={src(a.image)} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="art" src={src(a.image)} alt="" />
        </div>
      ))}
      <div className="scrim" />
    </div>
  );
}

// Built-in paintings are served by Daybook; the Frame's come with a full URL.
const src = (image: string) => (/^https?:/.test(image) ? image : `/${image}`);

function KeyGate({ session, onDone }: { session: Session; onDone: () => Promise<void> }) {
  const t = stringsFor(session.locale);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (session.misconfigured) {
    return (
      <section className="placard">
        <p className="eyebrow">Daybook</p>
        <h1 className="big">{t.keyTitle}</h1>
        <p className="meta">{t.misconfigured}</p>
      </section>
    );
  }
  return (
    <section className="placard">
      <p className="eyebrow">Daybook</p>
      <h1 className="big">{t.keyTitle}</h1>
      <p className="meta">{t.keyHelp}</p>
      <form
        className="keyform"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('/api/session', { method: 'POST', body: { key } });
            await onDone();
          } catch {
            setError(t.wrongKey);
          }
        }}
      >
        <input type="password" autoFocus autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} aria-label={t.keyTitle} />
        <button className="pill solid" type="submit">
          {t.open}
        </button>
      </form>
      {error && <p className="meta" style={{ color: 'var(--color-amber)' }}>{error}</p>}
      <details className="key-where">
        <summary className="label">{t.keyWhere}</summary>
        <ol className="meta">
          {t.keyWhereSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
