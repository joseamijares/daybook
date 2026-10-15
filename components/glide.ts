'use client';

// A finished task moves under the ones still to do (Settings → Appearance), and
// the list shouldn't jump when it does. Call `before()` just before the change
// is saved: it notes where every row is. When the screen's data comes back,
// each row slides from where it was to where it is now. Nothing is noted for a
// drag, so drag and drop (components/sortable.ts) keeps its own motion.

import { useCallback, useLayoutEffect, useRef } from 'react';

const rows = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-sort-id]'));

export function useGlide<T extends HTMLElement>(data: unknown) {
  const root = useRef<T>(null);
  const was = useRef<Map<string, number> | null>(null);

  useLayoutEffect(() => {
    const tops = was.current;
    was.current = null;
    if (!tops || !root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const row of rows(root.current)) {
      const from = tops.get(row.dataset.sortId || '');
      const dy = from === undefined ? 0 : from - row.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      // The open editor under a row travels with it.
      const next = row.nextElementSibling;
      for (const el of next instanceof HTMLElement && next.classList.contains('editor') ? [row, next] : [row]) {
        el.animate([{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  }, [data]);

  const attach = useCallback((el: T | null) => {
    root.current = el;
  }, []);
  const before = () => {
    if (root.current) was.current = new Map(rows(root.current).map((r) => [r.dataset.sortId || '', r.getBoundingClientRect().top]));
  };
  return { attach, before };
}
