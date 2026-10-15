'use client';

// Week's board: pick up a task from a day or the backlog and put it on a line
// of any day from today on, or back in the backlog. The card lifts off the page
// on raised paper and follows the pointer anywhere; where it was, the task
// stays, faded. Over another day the rows part with a little spring around a
// dashed slot where it will land; over its own day the faded task itself moves
// to its new line; over the backlog the backlog lights up. Let go and the card
// glides into place, then the caller puts the new week on screen in the same
// frame, and whatever else moved (the rows closing up behind it) slides there.
// Escape, or a drop on nothing (a past day, the margin), glides it home. On a
// touchscreen, hold a task a moment to lift it (a quick swipe still scrolls).
//
// The drop zones are the board's own markup, read as the task moves:
// - data-zone="<key>" on an area that may take drops (a day's column, the
//   backlog); `accepts` says which do (not a past day).
// - data-zone-rows inside it holds the tasks, each with data-board-id, in order.
// - data-zone-pile on a zone whose tasks wrap (the backlog's chips): it has no
//   lines, and a task dropped there goes first.
// Lines come from layout (offsetTop), which rows moving aside doesn't change,
// and zones stacked in a column keep their heights while a task is held (one
// that grows doesn't take room from the others), so the preview never wobbles. In the Mac app a Force Touch trackpad ticks as
// the task lifts, finds a new place and lands (components/mac.ts). Today and
// Plan reorder one list with components/sortable.ts, which feels the same.

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { feel } from './mac';

/** Where a task will land: on the line before position `index` of the zone's tasks (see placeAt). */
export type Spot = { zone: string; index: number };
/** The dashed slot in a zone where a task from elsewhere will land, in px from the top of its rows. */
export type BoardSlot = { zone: string; top: number; height: number };

export type BoardCard = {
  'data-board-id': string;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
};

type Point = { left: number; top: number };

// A press on a task, and once it has moved far enough (or held long enough on
// touch), the task picked up.
type Lift = {
  id: string;
  el: HTMLElement; // the task where it was: it stays there, faded
  from: string | null; // its zone (none on a past day)
  pointer: number;
  touch: boolean;
  x0: number; // where the press started
  y0: number;
  x: number; // where the pointer is now
  y: number;
  gx: number; // where on the card it was picked up
  gy: number;
  height: number; // the card's
  step: number; // the room it takes in a day's list
  ghost?: HTMLElement; // the card that follows the pointer
  pinned: HTMLElement[]; // zones held at their height while it moves
  spot: Spot | null;
  land: number; // where it lands in the spot's rows, from their top
  lifted: boolean;
  hold?: ReturnType<typeof setTimeout>;
  frame?: number;
  scroller?: HTMLElement;
  off?: () => void;
};

const SLOP = 5; // px a mouse moves before a press becomes a drag
const TOUCH_SLOP = 8; // px a finger may wander while it holds
const HOLD = 300; // ms a finger rests before the task lifts
const EDGE = 56; // px from the scroller's edge where it starts scrolling
const REACH = 12; // px outside a zone that still count as over it (the gap between days)
const STEP = 36; // px a task takes in a day when there's none to measure
// Presses on these do what they do (tick, open a link, type), not drag.
const CONTROLS = 'button, a, input, textarea, select, label, [contenteditable="true"]';

// What scrolls when a task is held near the edge: the placard, or the page.
const scrollerOf = (el: HTMLElement) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
};

const cardsIn = (rows: HTMLElement | null) =>
  rows ? Array.from(rows.children).filter((n): n is HTMLElement => n instanceof HTMLElement && Boolean(n.dataset.boardId)) : [];

// How far each task is from the next: its height and the space after it.
const stepsOf = (els: HTMLElement[]) =>
  els.map((n, i) => (i < els.length - 1 ? els[i + 1].offsetTop - n.offsetTop : n.offsetHeight + parseFloat(getComputedStyle(n).marginBottom || '0')));

// What slides into place after a drop: the tasks, and the rest of each zone
// (a day's heading, its add line) when the zones above it change height. Not
// what holds the tasks: they slide on their own.
const slides = (board: HTMLElement) =>
  Array.from(board.querySelectorAll<HTMLElement>('[data-board-id], [data-zone] > *, [data-zone-rows] ~ *')).filter(
    (n) => n.dataset.boardId || (!n.hasAttribute('data-zone-rows') && !n.querySelector('[data-zone-rows]')),
  );

// Where an element sits in the page's layout, whatever is moving it just now.
const placeOf = (n: HTMLElement): Point => {
  const r = n.getBoundingClientRect();
  const t = getComputedStyle(n).transform;
  const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
  return { left: r.left - (m?.m41 ?? 0), top: r.top - (m?.m42 ?? 0) };
};

export function useBoard<T extends HTMLElement = HTMLElement>({
  onDrop,
  accepts,
}: {
  /** Put `id` in `zone`, on the line before position `index` of its tasks. */
  onDrop: (id: string, zone: string, index: number) => void;
  /** May `id` land in `zone`? A task may always move within its own. */
  accepts?: (id: string, zone: string) => boolean;
}) {
  const root = useRef<T | null>(null);
  const lift = useRef<Lift | null>(null);
  const settling = useRef(false);
  const parted = useRef<{ rows: HTMLElement; els: HTMLElement[] } | null>(null);
  // A drag outlives the render it started in: it drops with the latest week.
  const latest = useRef({ onDrop, accepts });
  useEffect(() => {
    latest.current = { onDrop, accepts };
  });
  const [sorted, setSorted] = useState(false);
  const [slot, setSlot] = useState<BoardSlot | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);

  const zones = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-zone]') ?? []);
  const zoneOf = (key: string) => zones().find((z) => z.dataset.zone === key) ?? null;
  const rowsOf = (zone: HTMLElement) => zone.querySelector<HTMLElement>('[data-zone-rows]');

  // The zone under the pointer, or the nearest one within reach.
  const zoneAt = (x: number, y: number) => {
    let best: HTMLElement | null = null;
    let near = REACH;
    for (const z of zones()) {
      const r = z.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d <= near) {
        best = z;
        near = d;
      }
    }
    return best;
  };

  // Where the card would land: in the zone under the pointer, on the line
  // nearest the card's middle. Nowhere if that's where it already is.
  const spotAt = (l: Lift): Spot | null => {
    const z = zoneAt(l.x, l.y);
    const key = z?.dataset.zone;
    if (!z || !key) return null;
    const own = key === l.from;
    if (latest.current.accepts && !latest.current.accepts(l.id, key)) return null;
    const rows = rowsOf(z);
    if (!rows || z.hasAttribute('data-zone-pile')) return own ? null : { zone: key, index: 0 };
    const els = cardsIn(rows);
    const mid = l.y - l.gy + l.height / 2 - rows.getBoundingClientRect().top - rows.clientTop;
    let index = els.findIndex((n) => mid < n.offsetTop + n.offsetHeight / 2);
    if (index < 0) index = els.length;
    const from = els.indexOf(l.el);
    if (own && from >= 0 && (index === from || index === from + 1)) return null;
    return { zone: key, index };
  };

  // Part the rows at the spot (and close the last spot's gap).
  const part = (l: Lift, spot: Spot | null) => {
    if (spot?.zone === l.spot?.zone && spot?.index === l.spot?.index) return;
    l.spot = spot;
    l.land = 0;
    const p = parted.current;
    parted.current = null;
    if (p) {
      for (const n of p.els) n.style.transform = '';
      p.rows.style.paddingBottom = '';
    }
    const z = spot && zoneOf(spot.zone);
    const rows = z && !z.hasAttribute('data-zone-pile') ? rowsOf(z) : null;
    let gap: BoardSlot | null = null;
    if (spot && rows) {
      const els = cardsIn(rows);
      const steps = stepsOf(els);
      const shift = els.map(() => 0);
      const from = els.indexOf(l.el);
      if (from >= 0) {
        // Its own day: the rows between step over, and the faded task moves past them.
        for (let i = from + 1; i < spot.index; i++) {
          shift[i] = -steps[from];
          shift[from] += steps[i];
        }
        for (let i = spot.index; i < from; i++) {
          shift[i] = steps[from];
          shift[from] -= steps[i];
        }
        l.land = l.el.offsetTop + shift[from];
      } else {
        for (let i = spot.index; i < els.length; i++) shift[i] = l.step;
        const last = els[els.length - 1];
        l.land = spot.index < els.length ? els[spot.index].offsetTop : last ? last.offsetTop + steps[els.length - 1] : 0;
        gap = { zone: spot.zone, top: l.land, height: l.step };
        rows.style.paddingBottom = `${l.step}px`;
      }
      els.forEach((n, i) => {
        if (shift[i]) n.style.transform = `translate3d(0, ${shift[i]}px, 0)`;
      });
      parted.current = { rows, els };
    }
    setSlot(gap);
    setOver(spot?.zone ?? null);
    if (spot) feel('alignment');
  };

  // Where the card will sit once it lands at the spot, on screen.
  const landingOf = (l: Lift, spot: Spot): Point | null => {
    const z = zoneOf(spot.zone);
    const rows = z && rowsOf(z);
    if (!z || !rows) return null;
    if (z.hasAttribute('data-zone-pile')) {
      const first = cardsIn(rows).find((n) => n !== l.el);
      if (first) return placeOf(first);
    }
    const r = rows.getBoundingClientRect();
    return { left: r.left + rows.clientLeft, top: r.top + rows.clientTop + l.land };
  };

  // Everything back the way layout has it, at once (no transitions): the gap,
  // the faded task, the card, the listeners.
  const reset = () => {
    const l = lift.current;
    lift.current = null;
    settling.current = false;
    const still: HTMLElement[] = [];
    if (l) {
      l.off?.();
      clearTimeout(l.hold);
      if (l.frame) cancelAnimationFrame(l.frame);
      l.ghost?.parentElement?.remove();
      if (l.el.dataset.boardSource !== undefined) {
        still.push(l.el);
        l.el.style.transition = 'none';
        delete l.el.dataset.boardSource;
      }
    }
    for (const z of l?.pinned ?? []) {
      z.style.minHeight = '';
      z.style.flex = '';
    }
    const p = parted.current;
    parted.current = null;
    if (p) {
      for (const n of [...p.els, p.rows]) {
        n.style.transition = 'none';
        still.push(n);
      }
      for (const n of p.els) n.style.transform = '';
      p.rows.style.paddingBottom = '';
    }
    document.documentElement.classList.remove('is-sorting');
    requestAnimationFrame(() => requestAnimationFrame(() => still.forEach((n) => (n.style.transition = ''))));
  };

  // The card glides to `to` and settles, then `done`.
  const settle = (l: Lift, to: Point, fade: boolean, done: () => void) => {
    l.off?.();
    l.off = undefined;
    if (l.frame) cancelAnimationFrame(l.frame);
    settling.current = true;
    const g = l.ghost;
    if (!g) return done();
    const waiting = new Set(['scale']);
    if (Math.hypot(to.left - (l.x - l.gx), to.top - (l.y - l.gy)) > 0.5) waiting.add('translate');
    g.dataset.lift = 'settle';
    g.style.translate = `${to.left}px ${to.top}px`;
    // A card that lands as something else (a day's task in the backlog, a chip
    // on a day) fades as it goes; the task fades in where it lands.
    if (fade) g.style.opacity = '0';
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      g.removeEventListener('transitionend', ended);
      clearTimeout(timer);
      done();
    };
    const ended = (e: TransitionEvent) => {
      if (e.target !== g) return;
      waiting.delete(e.propertyName);
      if (!waiting.size) finish();
    };
    g.addEventListener('transitionend', ended);
    const timer = setTimeout(finish, 700); // in case a transition never runs
  };

  // The drop: the caller puts the new week on screen, and what else moved
  // (the rows closing up behind the task, the chips making room) slides from
  // where it was to where it is now.
  const commit = (l: Lift, spot: Spot, fade: boolean) => {
    const board = root.current;
    const before = new Map<HTMLElement, DOMRect>();
    for (const n of board ? slides(board) : []) before.set(n, n.getBoundingClientRect());
    const card = l.ghost?.getBoundingClientRect();
    flushSync(() => {
      latest.current.onDrop(l.id, spot.zone, spot.index);
      setSlot(null);
      setOver(null);
      setLifted(null);
    });
    reset();
    if (!board) return;
    // The task itself starts from where the card came down.
    const landed = Array.from(board.querySelectorAll<HTMLElement>('[data-board-id]')).find((n) => n.dataset.boardId === l.id);
    if (landed && card) before.set(landed, card);
    const moved: HTMLElement[] = [];
    for (const [n, was] of before) {
      if (!n.isConnected) continue;
      const now = n.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      n.style.transition = 'none';
      n.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      moved.push(n);
    }
    if (moved.length) {
      void moved[0].offsetWidth; // start them from there
      for (const n of moved) {
        // Tasks have their spring in the stylesheet; the rest borrow it.
        n.style.transition = n.dataset.boardId ? '' : 'transform 0.5s var(--ease-spring)';
        n.style.transform = '';
      }
      setTimeout(() => moved.forEach((n) => !n.dataset.boardId && (n.style.transition = '')), 600);
    }
    if (fade && landed) {
      landed.dataset.boardLanded = '';
      setTimeout(() => delete landed.dataset.boardLanded, 400);
    }
  };

  // Back where it came from.
  const home = (l: Lift) => {
    part(l, null);
    if (!l.el.isConnected) return finishHome();
    settle(l, placeOf(l.el), false, finishHome);
  };
  const finishHome = () => {
    reset();
    setLifted(null);
  };

  const frame = () => {
    const l = lift.current;
    if (!l?.lifted || !l.ghost) return;
    if (!l.el.isConnected) {
      // The task went away under us (an agent moved it): nothing to drop.
      part(l, null);
      return finishHome();
    }
    // Near the scroller's edges, scroll it: the closer, the faster.
    const s = l.scroller;
    if (s) {
      const page = s === document.scrollingElement || s === document.documentElement;
      const r = page ? { top: 0, bottom: window.innerHeight } : s.getBoundingClientRect();
      const edge = l.y < r.top + EDGE ? l.y - (r.top + EDGE) : l.y > r.bottom - EDGE ? l.y - (r.bottom - EDGE) : 0;
      if (edge) s.scrollTop += Math.max(-1, Math.min(1, edge / EDGE)) * 18;
    }
    l.ghost.style.translate = `${l.x - l.gx}px ${l.y - l.gy}px`;
    part(l, spotAt(l));
    l.frame = requestAnimationFrame(frame);
  };

  const begin = (l: Lift) => {
    const board = root.current;
    if (!board || !l.el.isConnected) return end();
    l.lifted = true;
    clearTimeout(l.hold);
    try {
      l.el.setPointerCapture(l.pointer);
    } catch {
      // The pointer is already gone; pointerup will end it.
    }
    window.getSelection()?.removeAllRanges();
    document.documentElement.classList.add('is-sorting');
    const r = l.el.getBoundingClientRect();
    l.gx = l.x0 - r.left;
    l.gy = l.y0 - r.top;
    l.height = r.height;
    // The room it takes in a day: its own, or (a chip) that of a task on a day.
    const own = l.el.parentElement?.closest('[data-zone-pile]') ? null : l.el;
    const sample = own ?? board.querySelector<HTMLElement>('[data-zone]:not([data-zone-pile]) [data-board-id]');
    const sampleRows = sample?.parentElement ? cardsIn(sample.parentElement) : [];
    l.step = sample ? stepsOf(sampleRows)[sampleRows.indexOf(sample)] || STEP : STEP;
    l.scroller = scrollerOf(l.el);
    // Zones stacked in a column share its spare height: hold each at its own,
    // or one that opens a gap would shrink the others and move what's below.
    const stacked = Array.from(board.querySelectorAll<HTMLElement>('[data-zone]')).filter(
      (z) => z.parentElement && getComputedStyle(z.parentElement).flexDirection.startsWith('column'),
    );
    const heights = stacked.map((z) => z.offsetHeight);
    stacked.forEach((z, i) => {
      z.style.minHeight = `${heights[i]}px`;
      z.style.flex = '0 0 auto';
    });
    l.pinned = stacked;
    // The card that follows the pointer: a copy of the task, in a layer over
    // the page (with the day's look, so it's drawn the same).
    const layer = document.createElement('div');
    layer.className = 'board-float col';
    layer.setAttribute('aria-hidden', 'true');
    const ghost = l.el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-board-id');
    ghost.style.width = `${r.width}px`;
    ghost.style.translate = `${r.left}px ${r.top}px`;
    layer.append(ghost);
    document.body.append(layer);
    void ghost.offsetWidth; // so it rises from the page rather than appearing raised
    ghost.dataset.lift = 'up';
    l.ghost = ghost;
    l.el.dataset.boardSource = '';
    setSorted(true);
    setLifted(l.id);
    feel('generic');
    if (l.touch) navigator.vibrate?.(8);
    frame();
  };

  // A press that never lifted: a click, or a swipe that scrolls.
  const end = () => {
    const l = lift.current;
    lift.current = null;
    l?.off?.();
    clearTimeout(l?.hold);
  };

  const drop = (l: Lift) => {
    const spot = l.spot;
    const to = spot && landingOf(l, spot);
    if (!spot || !to) return home(l);
    // A chip lands on a day as a task, and a day's task in the backlog as a chip.
    const fade = Boolean(zoneOf(spot.zone)?.hasAttribute('data-zone-pile')) !== Boolean(l.el.parentElement?.closest('[data-zone-pile]'));
    feel('levelChange');
    settle(l, to, fade, () => commit(l, spot, fade));
  };

  const cancel = () => {
    const l = lift.current;
    if (!l) return;
    if (!l.lifted) return end();
    home(l);
  };

  const listen = (l: Lift) => {
    const move = (e: PointerEvent) => {
      if (e.pointerId !== l.pointer || lift.current !== l) return;
      l.x = e.clientX;
      l.y = e.clientY;
      if (l.lifted) {
        e.preventDefault();
        return;
      }
      const far = Math.hypot(e.clientX - l.x0, e.clientY - l.y0);
      if (l.touch) {
        if (far > TOUCH_SLOP) end(); // a swipe: let it scroll
      } else if (far > SLOP) begin(l);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== l.pointer || lift.current !== l) return;
      if (!l.lifted) return end(); // a click: let it through
      // The click that ends a drag isn't a click on what's under it (a day's heading opens the day).
      const swallow = (c: Event) => {
        c.preventDefault();
        c.stopPropagation();
      };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true));
      drop(l);
    };
    const cancelled = (e: PointerEvent) => {
      if (e.pointerId === l.pointer && lift.current === l) cancel();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !l.lifted || lift.current !== l) return;
      e.preventDefault();
      cancel();
    };
    // Holding a finger on a task is lifting it, not asking for a menu.
    const menu = (e: Event) => {
      if (l.touch) e.preventDefault();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelled);
    window.addEventListener('keydown', key);
    window.addEventListener('contextmenu', menu, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelled);
      window.removeEventListener('keydown', key);
      window.removeEventListener('contextmenu', menu, true);
    };
  };

  const attach = useCallback((el: T | null) => {
    root.current = el;
    if (!el) return;
    // A finger holding a task mustn't scroll the page, and only a touchmove
    // listener that was there before the touch began can stop it.
    const still = (e: TouchEvent) => {
      if (lift.current?.lifted) e.preventDefault();
    };
    el.addEventListener('touchmove', still, { passive: false });
    return () => {
      el.removeEventListener('touchmove', still);
      const l = lift.current;
      if (l) {
        l.off?.();
        clearTimeout(l.hold);
        if (l.frame) cancelAnimationFrame(l.frame);
        l.ghost?.parentElement?.remove();
        lift.current = null;
        document.documentElement.classList.remove('is-sorting');
      }
      root.current = null;
    };
  }, []);

  const boardProps = { ref: attach, 'data-board': '', 'data-sorted': sorted || undefined };

  const card = (id: string): BoardCard => ({
    'data-board-id': id,
    onPointerDown: (e) => {
      if (lift.current || settling.current || !e.isPrimary || e.button !== 0) return;
      const el = e.currentTarget;
      const control = e.target instanceof Element ? e.target.closest(CONTROLS) : null;
      if (control && el.contains(control)) return;
      const from = el.closest<HTMLElement>('[data-zone]')?.dataset.zone ?? null;
      const l: Lift = {
        id,
        el,
        from,
        pointer: e.pointerId,
        touch: e.pointerType === 'touch',
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        gx: 0,
        gy: 0,
        height: 0,
        step: STEP,
        pinned: [],
        spot: null,
        land: 0,
        lifted: false,
      };
      lift.current = l;
      l.off = listen(l);
      if (l.touch) l.hold = setTimeout(() => lift.current === l && begin(l), HOLD);
    },
  });

  return { boardProps, card, slot, over, lifted };
}
