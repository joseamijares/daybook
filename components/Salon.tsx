'use client';

// The room every screen shares, mounted once in the root layout so it stays
// put while you move between screens: the painting of the day on the wall
// (a new painting fades in over the old one, the room dims at shutdown), the
// navigation pill, the credit, and the sign-in gate. Pages render only their
// placard.

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Appearance, DEFAULT_APPEARANCE } from '@/lib/appearance';
import { type Artwork, artFor, credit } from '@/lib/art';
import { addDays, mondayOf, ymdInTz } from '@/lib/time';
import { api, getMode, type Look, LookContext, onComeBack, type Session, SessionContext, setMode, stringsFor } from './client';
import { askMac } from './mac';
import { UpdateMark } from './updates';
import { Welcome } from './Welcome';

export type View = 'today' | 'plan' | 'week' | 'backlog' | 'shutdown' | 'settings';

const viewFor = (path: string): View =>
  path.startsWith('/plan')
    ? 'plan'
    : path.startsWith('/week')
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

  // In the Mac app's window: the page has its session and is about to paint, so
  // the window's launch scene can give way to it (once; nothing in a browser).
  const toldMac = useRef(false);
  useEffect(() => {
    if (!session || toldMac.current) return;
    toldMac.current = true;
    requestAnimationFrame(() => askMac('ready'));
  }, [session]);

  // Load the session, then keep it current: a tab or the Mac window left open
  // overnight, or a computer waking from sleep, moves on to the new day, and a
  // failed first load tries again.
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let shown: Session | null = null;
    let asked: string | null = null;
    const load = () => {
      const mode = getMode();
      return api<Session>('/api/session')
        .then((s) => {
          // Start (or a key) changed where this browser's days live while this
          // was on its way, as when the click that starts also focuses the
          // window: the answer is about the other Daybook, so drop it.
          if (!alive || getMode() !== mode) return;
          loaded.current = true;
          shown = s;
          // A browser a server already lets in (its cookie, or a server with no
          // key on your own machine) is a cloud browser; no need to ask.
          if (!getMode() && s.authorized && !s.local) setMode('cloud');
          setSession(s);
        })
        .catch(() => {
          asked = null; // just woke and the network isn't back: the clock asks again
          if (!alive || loaded.current) return;
          setMessage(stringsFor(navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en').unreachable);
          clearTimeout(retry);
          retry = setTimeout(load, 10000);
        });
    };
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    // The server decides what today is; this clock only notices that the date
    // has probably moved on and asks again at once (once per date, so a wrong
    // clock can't keep asking).
    const clock = setInterval(() => {
      if (!shown) return;
      const now = ymdInTz(new Date(), shown.tz);
      if (now !== shown.today && now !== asked) {
        asked = now;
        load();
      }
    }, 15000);
    const stop = onComeBack(load);
    return () => {
      alive = false;
      clearTimeout(retry);
      clearInterval(timer);
      clearInterval(clock);
      stop();
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4200);
    return () => clearTimeout(timer);
  }, [message]);

  const toast = useCallback((m: string) => setMessage(m), []);

  // The room the Daybook hangs in: the chosen design and palette, and Nocturne
  // once the day is closed if that is switched on.
  const appearance: Appearance = session?.appearance || DEFAULT_APPEARANCE;
  const look = useMemo<Look>(
    () => ({ style: appearance.style, palette: appearance.eveningNocturne && session?.closedToday ? 'nocturne' : appearance.palette }),
    [appearance.style, appearance.palette, appearance.eveningNocturne, session?.closedToday],
  );
  useEffect(() => {
    if (!session) return;
    const html = document.documentElement;
    html.dataset.style = look.style;
    html.dataset.palette = look.palette;
    try {
      // The chosen palette, plus the evening it turned to Nocturne, so the next
      // morning doesn't open dark before the session arrives.
      // Dated in the browser's own calendar, the same one the head script reads.
      const d = new Date();
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const night = look.palette !== appearance.palette ? local : undefined;
      localStorage.setItem('daybook.look', JSON.stringify({ style: look.style, palette: appearance.palette, night }));
    } catch {
      // Private windows may refuse storage; the session still sets the look.
    }
  }, [session, look, appearance.palette]);

  const setAppearance = useCallback(
    async (patch: Partial<Appearance>) => {
      // Show it at once, then save; a failure puts the old one back.
      const before = session?.appearance;
      setSession((s) => (s ? { ...s, appearance: { ...(s.appearance || DEFAULT_APPEARANCE), ...patch } } : s));
      try {
        const saved = await api<Appearance>('/api/appearance', { method: 'PUT', body: patch });
        setSession((s) => (s ? { ...s, appearance: saved } : s));
      } catch (err) {
        setSession((s) => (s ? { ...s, appearance: before } : s));
        setMessage((err as Error).message);
      }
    },
    [session?.appearance],
  );

  const ctx = useMemo(() => {
    if (!session) return null;
    return {
      session,
      t: stringsFor(session.locale),
      toast,
      refreshSession,
      setAppearance,
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
  }, [session, toast, refreshSession, setAppearance]);

  // Week shows the painting of the Sunday before, so it differs from every weekday's.
  // The server picks the painting (the Frame's, when connected, so the TV and Daybook match).
  const art = session ? ((view === 'week' ? session.weekArt : session.art) ?? artFor(view === 'week' ? addDays(mondayOf(session.today), -1) : session.today)) : null;
  const t = stringsFor(session?.locale || 'en');
  const pageClass = ['room', view === 'shutdown' && 'dusk-page', view === 'plan' && 'plan-page', (view === 'week' || view === 'settings') && 'wide-page', 'scroll-page'].filter(Boolean).join(' ');

  return (
    <LookContext.Provider value={look}>
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
        {/* The first screen has one thing to press, Start: no links until a Daybook lets this browser in. */}
        {(!session || session.authorized) && (
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
            <UpdateMark t={t} />
          </div>
        )}
      </nav>
      {!session ? (
        <section className="placard">
          <p className="meta">{t.loading}</p>
        </section>
      ) : !session.authorized ? (
        <Welcome session={session} onDone={refreshSession} />
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
    </LookContext.Provider>
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
