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

export type View = 'today' | 'week' | 'backlog' | 'shutdown';

const viewFor = (path: string): View =>
  path.startsWith('/week') ? 'week' : path.startsWith('/backlog') ? 'backlog' : path.startsWith('/shutdown') ? 'shutdown' : 'today';

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
  const art = session ? artFor(view === 'week' ? addDays(mondayOf(session.today), -1) : session.today) : null;
  const t = stringsFor(session?.locale || 'en');
  const pageClass = ['room', view === 'shutdown' && 'dusk-page', view === 'week' && 'wide-page', 'scroll-page'].filter(Boolean).join(' ');

  return (
    <div className={pageClass}>
      <Wall art={art} dusk={view === 'shutdown'} />
      {art && (
        <a key={art.slug} className="credit" href={art.source} target="_blank" rel="noreferrer" title={art.title}>
          <span className="t">{art.title}</span>
          <span className="s">{credit(art)}</span>
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
          <img className="fill" src={`/${a.image}`} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="art" src={`/${a.image}`} alt="" />
        </div>
      ))}
      <div className="scrim" />
    </div>
  );
}

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
    </section>
  );
}
