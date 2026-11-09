'use client';

// The how-to walkthrough (2:29, English voice and captions): the "?" in the nav,
// "Watch how it works" on Welcome, and Today's one-time "New here?" line open it
// in a dialog. The file lives on the landing page (site/public/film), so every
// Daybook (browser, cloud, the Mac and Windows copies) streams the same cut.
// Nothing is fetched until the video plays: `preload="none"` and no poster
// request before the dialog opens, so "nothing is sent anywhere" holds until
// you press play.

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { Strings } from '@/lib/i18n';

const SITE = 'https://daybooksalon.vercel.app';
const VIDEO = `${SITE}/film/daybook-howto.mp4`;
const POSTER = `${SITE}/film/howto-poster.webp`;
const SEEN = 'daybook.howtoSeen';

/** Whether this browser has opened or put off the walkthrough. */
export function howtoSeen() {
  try {
    return localStorage.getItem(SEEN) !== null;
  } catch {
    return true; // storage refused: don't nag
  }
}
function markSeen() {
  try {
    localStorage.setItem(SEEN, String(Date.now()));
  } catch {
    // storage refused
  }
}

type Walkthrough = { open: () => void; dismiss: () => void; seen: boolean };
const Ctx = createContext<Walkthrough>({ open: () => {}, dismiss: () => {}, seen: true });
export const useWalkthrough = () => useContext(Ctx);

export function WalkthroughProvider({ t, children }: { t: Strings; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(howtoSeen);
  const [opened, setOpened] = useState(false);

  const dismiss = useCallback(() => {
    markSeen();
    setSeen(true);
  }, []);
  const open = useCallback(() => {
    dismiss();
    setOpened(true);
    const d = dialog.current;
    if (!d || typeof d.showModal !== 'function') return void window.open(VIDEO, '_blank', 'noopener');
    d.showModal();
    const v = video.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }, [dismiss]);
  const close = () => dialog.current?.close();

  return (
    <Ctx.Provider value={{ open, dismiss, seen }}>
      {children}
      <dialog
        ref={dialog}
        className="walkthrough"
        aria-label={t.howtoTitle}
        onClose={() => video.current?.pause()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="walkthrough-head">
          <span>{t.howtoTitle}</span>
          <button type="button" className="link-btn" onClick={close}>
            {t.howtoClose}
          </button>
        </div>
        <video ref={video} controls playsInline preload="none" poster={opened ? POSTER : undefined} src={opened ? VIDEO : undefined} aria-label={t.howtoTitle} />
      </dialog>
    </Ctx.Provider>
  );
}

/** The nav's "?": a circle with a question mark, like the gear beside it. */
export function HelpLink({ t }: { t: Strings }) {
  const { open } = useWalkthrough();
  return (
    <button type="button" className="link help" onClick={open} aria-label={t.howtoTitle} title={t.howtoTitle}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 4" strokeLinecap="round" />
        <circle cx="12" cy="17.4" r="0.4" fill="currentColor" />
      </svg>
    </button>
  );
}
