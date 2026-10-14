'use client';

// Browser side: a tiny API client, the session context and a polling loader,
// so changes an agent makes over MCP show up without a reload.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Appearance, Palette, Style } from '@/lib/appearance';
import type { Artwork } from '@/lib/art';
import { type Locale, type Strings, strings } from '@/lib/i18n';

export interface Session {
  /** This server can keep a cloud Daybook (storage and a key are set). */
  cloud?: boolean;
  /** Running on this device: the browser keeps everything, no server data. */
  local?: boolean;
  authorized: boolean;
  needsKey: boolean;
  locale: Locale;
  today: string;
  tz: string;
  capacity: number;
  linear: boolean;
  frame: boolean;
  owner?: boolean;
  art?: Artwork;
  weekArt?: Artwork;
  storage?: 'upstash' | 'file' | 'browser';
  linearSyncedAt?: string | null;
  frameSentAt?: string | null;
  appearance?: Appearance;
  closedToday?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Where this browser keeps its Daybook: "local" (on this device, in
// localStorage) or "cloud" (a Daybook server). Unset until the welcome screen
// asks, except for a browser a server already lets in.
export type Mode = 'local' | 'cloud';
const MODE_KEY = 'daybook.mode';

export function getMode(): Mode | null {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'local' || m === 'cloud' ? m : null;
  } catch {
    return null;
  }
}

export function setMode(mode: Mode | null) {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // Storage refused (a locked-down private window): on this device can't work there.
  }
}

// The on-device API, loaded only when it's used.
let device: Promise<typeof import('@/lib/localApi')> | null = null;
const onDevice = () =>
  (device ??= import('@/lib/localApi').then(async (m) => {
    await m.startLocal(window.localStorage, { locale: navigator.language });
    return m;
  }));

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (getMode() === 'local') {
    const r = await (await onDevice()).handle(init.method || 'GET', path, init.body);
    if (r.status >= 400) throw new ApiError((r.data as { error?: string }).error || 'error', r.status);
    return r.data as T;
  }
  const res = await fetch(path, {
    method: init.method || 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || res.statusText, res.status);
  return data as T;
}

interface Ctx {
  session: Session;
  t: Strings;
  toast: (message: string) => void;
  refreshSession: () => Promise<void>;
  /** Run a mutation, surface its error or warnings as a toast, then reload. */
  run: <T>(fn: () => Promise<T>, after?: () => unknown) => Promise<T | undefined>;
  /** Change the design or palette now, and save it. */
  setAppearance: (patch: Partial<Appearance>) => Promise<void>;
}

// The design and palette the room is wearing right now (Settings → Appearance,
// with Nocturne after shutdown when that is switched on). Provided even on the
// sign-in screen, so it never needs a session.
export interface Look {
  style: Style;
  palette: Palette;
}
export const LookContext = createContext<Look>({ style: 'wall', palette: 'salon' });
export const useLook = () => useContext(LookContext);

export const SessionContext = createContext<Ctx | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside <Salon>');
  return ctx;
}

export function useStrings() {
  return useSession().t;
}

export function stringsFor(locale: Locale) {
  return strings[locale] || strings.en;
}

// Call fn whenever the page comes back: the window regains focus, the tab is
// shown again, the page returns from the back-forward cache, or the Mac app
// says the computer woke up (it fires a focus event). Timers stop while a
// computer sleeps, so the minute's poll alone can leave yesterday on screen.
export function onComeBack(fn: () => void) {
  const visible = () => document.visibilityState === 'visible' && fn();
  const restored = (e: PageTransitionEvent) => e.persisted && fn();
  window.addEventListener('focus', fn);
  window.addEventListener('pageshow', restored);
  document.addEventListener('visibilitychange', visible);
  return () => {
    window.removeEventListener('focus', fn);
    window.removeEventListener('pageshow', restored);
    document.removeEventListener('visibilitychange', visible);
  };
}

// Load a JSON resource, refresh it every minute and whenever the page comes back.
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      api<T>(path)
        .then((next) => {
          if (!alive) return;
          setData(next);
          setError(null);
        })
        .catch((err: Error) => alive && setError(err.message));
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    const stop = onComeBack(load);
    return () => {
      alive = false;
      clearInterval(timer);
      stop();
    };
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [path]);

  return { data, error, reload, setData };
}

export function timeIn(iso: string | null | undefined, tz: string, locale: Locale) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
