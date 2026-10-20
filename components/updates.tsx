'use client';

// The small "Update" mark beside the Settings gear: a newer Daybook for Mac
// (Sparkle found it; one click opens its install window), or a newer deploy of
// this Daybook than the page that's open (one click reloads). The page knows
// the commit it was built from (NEXT_PUBLIC_DAYBOOK_SHA, next.config.ts) and
// asks the public /api/health which commit is live now. Nothing else is sent.

import { useEffect, useState } from 'react';
import { fill, type Strings } from '@/lib/i18n';
import { DEVICE, onComeBack } from './client';
import { askMac, useDaybookMac } from './mac';

const RUNNING = process.env.NEXT_PUBLIC_DAYBOOK_SHA || 'dev';
const EVERY = 30 * 60 * 1000;

/** A newer deploy is live: both commits are known (not a dev build) and differ. */
export function newerDeploy(running: string, live: unknown) {
  return typeof live === 'string' && Boolean(live) && live !== 'dev' && running !== 'dev' && live !== running;
}

/** Whether the deploy that's live now is newer than this page; checked every half hour and when the page comes back. */
function useNewerDeploy() {
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    if (RUNNING === 'dev' || DEVICE) return; // the Mac app's copy updates with the app
    let alive = true;
    let last = 0;
    const check = () => {
      if (Date.now() - last < 60_000) return; // a burst of focus events asks once
      last = Date.now();
      fetch('/api/health', { cache: 'no-store' })
        .then((r) => r.json())
        .then((h: { sha?: unknown }) => alive && newerDeploy(RUNNING, h.sha) && setNewer(true))
        .catch(() => undefined); // offline: ask again later
    };
    check();
    const timer = setInterval(() => document.visibilityState === 'visible' && check(), EVERY);
    const stop = onComeBack(check);
    return () => {
      alive = false;
      clearInterval(timer);
      stop();
    };
  }, []);
  return newer;
}

/** In the nav, so outside the session: Salon passes the strings. */
export function UpdateMark({ t }: { t: Strings }) {
  const mac = useDaybookMac();
  const deploy = useNewerDeploy();
  // The Mac app's own update comes first: installing it reopens the window, which loads the new deploy too.
  const macVersion = mac?.available ?? null;
  if (!macVersion && !deploy) return null;
  const says = macVersion ? fill(t.macAvailable, { version: macVersion }) : t.updateDeploy;
  return (
    <button
      type="button"
      className="update-mark"
      title={says}
      aria-label={`${t.macUpdate}: ${says}`}
      onClick={() => (macVersion ? askMac('install') : window.location.reload())}
    >
      <i aria-hidden />
      <span>{t.macUpdate}</span>
    </button>
  );
}
