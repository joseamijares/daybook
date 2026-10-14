'use client';

import { useEffect } from 'react';

// The page's one motion runtime, kept small:
// - [data-reveal] elements get .is-in the first time they enter the viewport
//   (each section's CSS decides what that means: hang, rise, open, dim);
// - [data-progress] elements get --p, 0 → 1 as they cross the viewport;
// - [data-parallax] elements get --px/--py, -1 → 1 from the pointer.
// With prefers-reduced-motion everything is shown at rest and nothing tracks.
export function Motion() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (reduced || !('IntersectionObserver' in window)) {
      reveal.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    reveal.forEach((el) => io.observe(el));

    const tracked = Array.from(document.querySelectorAll<HTMLElement>('[data-progress]'));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of tracked) {
        const r = el.getBoundingClientRect();
        // 0 when the top enters from below, 1 when the bottom leaves at the top.
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        el.style.setProperty('--p', p.toFixed(3));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const fine = window.matchMedia('(pointer: fine)').matches;
    const parallax = fine ? Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]')) : [];
    const onPointer = (e: PointerEvent) => {
      for (const el of parallax) {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) continue;
        el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      }
    };
    if (parallax.length) window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
