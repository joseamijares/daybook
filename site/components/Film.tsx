'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type MouseEvent, type Ref } from 'react';
import type { Copy } from '@site/lib/copy';
import { FILM } from '@site/lib/site';

// The video, twice: a screening room under the hero, where it plays (muted, it
// has no sound) while it's in view, and a lightbox that the button in the
// hero's gilt frame opens. Without JavaScript that button is a link to the
// screening room. Phones in portrait get the 9:16 cut.

const OpenFilm = createContext<(e: MouseEvent) => void>(() => {});

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

export function FilmProvider({ c, children }: { c: Copy; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const open = useCallback((e: MouseEvent) => {
    const d = dialog.current;
    const v = video.current;
    if (!d || !v || typeof d.showModal !== 'function') return; // the link scrolls to the screening room
    e.preventDefault();
    d.showModal();
    v.currentTime = 0;
    v.play().catch(() => {});
  }, []);

  const close = () => dialog.current?.close();

  return (
    <OpenFilm.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="screen"
        aria-label={c.film.work}
        onClose={() => video.current?.pause()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <button type="button" className="screen__close" onClick={close} aria-label={c.film.close}>
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
        <div className="screen__frame">
          <FilmVideo ref={video} label={c.film.work} />
        </div>
      </dialog>
    </OpenFilm.Provider>
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
