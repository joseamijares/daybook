'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type MouseEvent, type Ref } from 'react';
import type { Copy } from '@site/lib/copy';
import { FILM, HOWTO } from '@site/lib/site';

// The video, twice: a screening room under the hero, where it plays (muted, it
// has no sound) while it's in view, and a lightbox that the button in the
// hero's gilt frame opens. Without JavaScript that button is a link to the
// screening room. Phones in portrait get the 9:16 cut.
//
// The how-to walkthrough (2:29, with a voice and captions) has only a
// lightbox, opened from "How to use it" in the hero and on the Mac label.
// Without JavaScript that link plays the file itself.

const OpenFilm = createContext<(e: MouseEvent) => void>(() => {});
const OpenHowto = createContext<(e: MouseEvent) => void>(() => {});

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(FILM.portraitMedia);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function usePortrait() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(FILM.portraitMedia).matches,
    () => false,
  );
}

function FilmVideo({ ref, label, loop }: { ref: Ref<HTMLVideoElement>; label: string; loop?: boolean }) {
  const portrait = usePortrait();
  return (
    <video
      ref={ref}
      className="film-video"
      poster={portrait ? FILM.posterPortrait : FILM.poster}
      aria-label={label}
      controls
      muted
      playsInline
      loop={loop}
      preload="none"
    >
      <source src={FILM.portrait} type="video/mp4" media={FILM.portraitMedia} />
      <source src={FILM.landscape} type="video/mp4" />
    </video>
  );
}

function useLightbox() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const open = useCallback((e: MouseEvent) => {
    const d = dialog.current;
    const v = video.current;
    if (!d || !v || typeof d.showModal !== 'function') return; // the link does it without the lightbox
    e.preventDefault();
    d.showModal();
    v.currentTime = 0;
    v.play().catch(() => {});
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);
  const pause = useCallback(() => video.current?.pause(), []);
  return [dialog, video, open, close, pause] as const;
}

function Screen({ ref, label, closeLabel, onClose, onPause, children }: { ref: Ref<HTMLDialogElement>; label: string; closeLabel: string; onClose: () => void; onPause: () => void; children: React.ReactNode }) {
  return (
    <dialog
      ref={ref}
      className="screen"
      aria-label={label}
      onClose={onPause}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="screen__close" onClick={onClose} aria-label={closeLabel}>
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
      <div className="screen__frame">{children}</div>
    </dialog>
  );
}

export function FilmProvider({ c, children }: { c: Copy; children: React.ReactNode }) {
  const [filmDialog, filmVideo, openFilm, closeFilm, pauseFilm] = useLightbox();
  const [howtoDialog, howtoVideo, openHowto, closeHowto, pauseHowto] = useLightbox();

  return (
    <OpenFilm.Provider value={openFilm}>
      <OpenHowto.Provider value={openHowto}>
        {children}
        <Screen ref={filmDialog} label={c.film.work} closeLabel={c.film.close} onClose={closeFilm} onPause={pauseFilm}>
          <FilmVideo ref={filmVideo} label={c.film.work} />
        </Screen>
        <Screen ref={howtoDialog} label={c.howto.work} closeLabel={c.film.close} onClose={closeHowto} onPause={pauseHowto}>
          <video ref={howtoVideo} className="film-video" poster={HOWTO.poster} aria-label={c.howto.work} controls playsInline preload="none" src={HOWTO.src} />
        </Screen>
      </OpenHowto.Provider>
    </OpenFilm.Provider>
  );
}

// "How to use it · 2:29": opens the walkthrough. `className` places it.
export function HowtoLink({ c, className }: { c: Copy; className?: string }) {
  const open = useContext(OpenHowto);
  return (
    <a className={['howto-link', className].filter(Boolean).join(' ')} href={HOWTO.src} onClick={open} aria-haspopup="dialog">
      <span className="howto-link__icon" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M3 1.5v9l7.5-4.5z" />
        </svg>
      </span>
      {c.howto.watch}
      <span className="howto-link__time">{c.howto.length}</span>
    </a>
  );
}

// Sits inside today's painting in the hero.
export function FilmButton({ c }: { c: Copy }) {
  const open = useContext(OpenFilm);
  return (
    <a className="film-play" href="#film" onClick={open} aria-haspopup="dialog">
      <span className="film-play__icon" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M3 1.5v9l7.5-4.5z" />
        </svg>
      </span>
      <span className="film-play__text">{c.film.watch}</span>
      <span className="film-play__time">{c.film.length}</span>
    </a>
  );
}

export function FilmSection({ c }: { c: Copy }) {
  const video = useRef<HTMLVideoElement>(null);
  const f = c.film;

  // Plays while at least half of it is on screen and pauses when it leaves,
  // unless the visitor paused it. Not with reduced motion or Save-Data.
  useEffect(() => {
    const v = video.current;
    if (!v || !('IntersectionObserver' in window)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduced || saveData) return;

    let ours = false; // the next pause event is the observer's
    let held = false; // the visitor paused it
    const onPause = () => {
      if (ours) ours = false;
      else held = true;
    };
    const onPlay = () => {
      held = false;
    };
    v.addEventListener('pause', onPause);
    v.addEventListener('play', onPlay);

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.5) {
          if (v.paused && !held) {
            v.muted = true;
            v.play().catch(() => {});
          }
        } else if (!v.paused) {
          ours = true;
          v.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      v.removeEventListener('pause', onPause);
      v.removeEventListener('play', onPlay);
    };
  }, []);

  return (
    <section className="film" id="film" aria-labelledby="film-title">
      <div className="film__head" data-reveal="">
        <div>
          <p className="eyebrow">{f.eyebrow}</p>
          <h2 id="film-title">{f.title}</h2>
        </div>
        <p className="film__body">{f.body}</p>
      </div>
      <figure className="film__work" data-reveal="">
        <div className="film__frame">
          <FilmVideo ref={video} label={f.work} loop />
        </div>
        <figcaption className="film__label">
          <em>{f.work}</em>
          <span>{f.medium}</span>
        </figcaption>
      </figure>
    </section>
  );
}
