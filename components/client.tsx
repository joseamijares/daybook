'use client';

// Browser side: a tiny API client, the session context and a polling loader,
// so changes an agent makes over MCP show up without a reload.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type Locale, type Strings, strings } from '@/lib/i18n';

export interface Session {
  authorized: boolean;
  needsKey: boolean;
  misconfigured: boolean;
  locale: Locale;
  today: string;
  tz: string;
  capacity: number;
  linear: boolean;
  frame: boolean;
  linearSyncedAt?: string | null;
  frameSentAt?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
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
}

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

// Load a JSON resource, refresh it every 20 s and when the tab regains focus.
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
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', load);
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
