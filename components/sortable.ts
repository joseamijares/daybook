'use client';

// Drag to reorder, smoothly. Press a task and move: it lifts off the page
// (raised paper, a soft shadow) and follows the pointer, and the other rows
// part with a little spring to show where it will land. Let go and it settles
// into that place; then the caller puts the new order on screen (and saves it
// behind) in the same frame, so nothing jumps. Escape, or a drop that changes
// nothing, slides everything back. On a touchscreen, hold a task a moment to
// lift it (a quick swipe still scrolls).
//
// A task dragged in from elsewhere with HTML drag and drop (Plan's right
// column) parts the rows the same way and gets a dashed slot.
//
// Rows are the list's children with data-sort-id, in the order of `ids`; an
// open editor right after a row moves with it, and a row with its editor open
// stays put. The list needs position: relative. Where a task lands is worked
// out from layout (offsetTop), which the rows moving aside doesn't change, so
// the preview never wobbles. In the Mac app a Force Touch trackpad ticks as
// the task finds each new place (components/mac.ts).

import { type DragEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Task, WeekView } from '@/lib/daybook';
import { feel } from './mac';

export const TASK_TYPE = 'application/x-daybook-task';

export type SortRow = {
  'data-sort-id': string;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
};

type Slot = { top: number; height: number };

// A press on a row, and once it has moved far enough (or held long enough on
// touch), the row lifted off the page.
type Lift = {
  id: string;
  el: HTMLElement;
  pointer: number;
  touch: boolean;
  x0: number; // where the press started
  y0: number;
  y: number; // where the pointer is now
  grab: number; // where on the row it was picked up, from its top
  at: number; // how far the row is drawn from its place
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
const STRETCH = 24; // px a row gives when pulled past the end of its list
// Presses on these do what they do (tick, open a link, type), not drag.
const CONTROLS = 'button, a, input, textarea, select, label, [contenteditable="true"]';

const withEditor = (n: HTMLElement) => {
  const next = n.nextElementSibling;
  return next instanceof HTMLElement && next.classList.contains('editor') ? [n, next] : [n];
};

// What scrolls when a task is held near the edge: the placard, or the page.
const scrollerOf = (el: HTMLElement) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
};

export function useSortable<T extends HTMLElement = HTMLDivElement>({
  ids,
  onMove,
  accepts,
}: {
  ids: string[];
  /** Put `id` on the line before position `index` of `ids` (see placeAt). */
  onMove: (id: string, index: number) => void;
  /** A task dragged in from elsewhere: may it land here? Without this, only the list's own rows move. */
  accepts?: (id: string) => boolean;
}) {
  const list = useRef<T | null>(null);
  const lift = useRef<Lift | null>(null);
  const settling = useRef(false);
  const target = useRef<number | null>(null);
  const landing = useRef(0); // where the lifted row's new place is, from its old one
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A drag outlives the render it started in: it drops with the latest order.
  const latest = useRef({ ids, onMove });
  useEffect(() => {
    latest.current = { ids, onMove };
  });
  const [sorted, setSorted] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);

  const rows = () => {
    const el = list.current;
    if (!el) return [];
    const byId = new Map<string, HTMLElement>();
    for (const n of Array.from(el.children)) if (n instanceof HTMLElement && n.dataset.sortId) byId.set(n.dataset.sortId, n);
    return latest.current.ids.map((id) => byId.get(id)).filter((n): n is HTMLElement => Boolean(n));
  };

  // The line the pointer is nearest: before the first row whose middle is below it.
  const indexAt = (y: number) => {
    const el = list.current;
    if (!el) return latest.current.ids.length;
    const at = y - el.getBoundingClientRect().top - el.clientTop;
    const els = rows();
    const i = els.findIndex((n) => at < n.offsetTop + n.offsetHeight / 2);
    return i < 0 ? els.length : i;
  };

  // Where the lifted row would land: past every row whose middle its leading
  // edge has crossed, so a short move is enough to swap with a neighbour.
  const placeOf = (l: Lift, delta: number) => {
    const els = rows();
    const from = els.indexOf(l.el);
    if (from < 0) return null;
    const top = l.el.offsetTop + delta;
    const bottom = top + l.el.offsetHeight;
    const mid = (n: HTMLElement) => n.offsetTop + n.offsetHeight / 2;
    let index = from;
    for (let i = from + 1; i < els.length && bottom > mid(els[i]); i++) index = i + 1;
    if (index === from) for (let i = from - 1; i >= 0 && top < mid(els[i]); i--) index = i;
    return index;
  };

  const show = (index: number | null) => {
    if (index === target.current) return;
    const was = target.current;
    target.current = index;
    const l = lift.current?.lifted ? lift.current : null;
    const els = rows();
    const tops = els.map((n) => n.offsetTop);
    const sizes = els.map((n, i) => (i < els.length - 1 ? tops[i + 1] - tops[i] : n.offsetHeight));
    const shift = els.map(() => 0);
    const from = l ? els.indexOf(l.el) : -1;
    let gap: Slot | null = null;
    if (index !== null && from >= 0) {
      // Rows between step over by the lifted row's height; its place moves past them.
      for (let i = from + 1; i < index; i++) {
        shift[i] = -sizes[from];
        shift[from] += sizes[i];
      }
      for (let i = index; i < from; i++) {
        shift[i] = sizes[from];
        shift[from] -= sizes[i];
      }
    } else if (index !== null && els.length) {
      const height = sizes[0];
      for (let i = index; i < els.length; i++) shift[i] = height;
      gap = { top: index < els.length ? tops[index] : tops[els.length - 1] + sizes[els.length - 1], height };
    }
    landing.current = from >= 0 ? shift[from] : 0;
    els.forEach((n, i) => {
      if (i === from) return; // it follows the pointer
      for (const m of withEditor(n)) m.style.transform = shift[i] ? `translate3d(0, ${shift[i]}px, 0)` : '';
    });
    if (list.current) list.current.style.paddingBottom = gap ? `${gap.height}px` : '';
    setSlot(gap);
    if (index !== null && was !== null) feel('alignment');
  };

  // Put everything back where layout has it. After a drop that changed the
  // order this happens in the same frame as the new order, with no transition
  // (`animate` false), so the rows are already where the new order puts them.
  // Otherwise they slide back.
  const reset = (animate: boolean) => {
    clearTimeout(leaving.current);
    const l = lift.current;
    lift.current = null;
    if (l) {
      l.off?.();
      clearTimeout(l.hold);
      if (l.frame) cancelAnimationFrame(l.frame);
    }
    target.current = null;
    landing.current = 0;
    setSlot(null);
    document.documentElement.classList.remove('is-sorting');
    const el = list.current;
    if (el) el.style.paddingBottom = '';
    const els = el ? Array.from(el.children).filter((n): n is HTMLElement => n instanceof HTMLElement && (Boolean(n.dataset.sortId) || n.classList.contains('editor'))) : [];
    if (l && !els.includes(l.el)) els.push(l.el);
    for (const n of els) {
      if (!animate) n.style.transition = 'none';
      n.style.transform = '';
      n.style.translate = '';
      delete n.dataset.lift;
    }
    if (!animate) requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((n) => (n.style.transition = ''))));
  };

  // The lifted row glides into place `to` (from where it was), then `done`.
  const settle = (l: Lift, to: number, done: () => void) => {
    l.off?.();
    l.off = undefined;
    if (l.frame) cancelAnimationFrame(l.frame);
    settling.current = true;
    const waiting = new Set(['scale']);
    if (Math.abs(to - l.at) > 0.5) waiting.add('translate');
    l.el.dataset.lift = 'settle';
    l.el.style.translate = `0 ${to}px`;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      l.el.removeEventListener('transitionend', ended);
      clearTimeout(timer);
      settling.current = false;
      done();
    };
    const ended = (e: TransitionEvent) => {
      if (e.target !== l.el) return;
      waiting.delete(e.propertyName);
      if (!waiting.size) finish();
    };
    l.el.addEventListener('transitionend', ended);
    const timer = setTimeout(finish, 700); // in case a transition never runs
  };

  const frame = () => {
    const l = lift.current;
    const el = list.current;
    if (!l?.lifted || !el) return;
    if (!l.el.isConnected) return cancel();
    // Near the scroller's edges, scroll it: the closer, the faster.
    const s = l.scroller;
    if (s) {
      const page = s === document.scrollingElement || s === document.documentElement;
      const r = page ? { top: 0, bottom: window.innerHeight } : s.getBoundingClientRect();
      const over = l.y < r.top + EDGE ? l.y - (r.top + EDGE) : l.y > r.bottom - EDGE ? l.y - (r.bottom - EDGE) : 0;
      if (over) s.scrollTop += Math.max(-1, Math.min(1, over / EDGE)) * 18;
    }
    // Follow the pointer within the list, giving a little past its ends.
    const top = el.getBoundingClientRect().top + el.clientTop + l.el.offsetTop;
    const want = l.y - l.grab - top;
    const delta = Math.max(-l.el.offsetTop, Math.min(el.clientHeight - l.el.offsetTop - l.el.offsetHeight, want));
    const pull = want - delta;
    l.at = delta + (pull ? Math.sign(pull) * STRETCH * (1 - Math.exp(-Math.abs(pull) / (STRETCH * 3))) : 0);
    show(placeOf(l, delta));
    l.el.style.translate = `0 ${l.at}px`;
    l.frame = requestAnimationFrame(frame);
  };

  const begin = (l: Lift) => {
    const el = list.current;
    if (!el || !l.el.isConnected) return end();
    l.lifted = true;
    clearTimeout(l.hold);
    try {
      l.el.setPointerCapture(l.pointer);
    } catch {
      // The pointer is already gone; pointerup will end it.
    }
    window.getSelection()?.removeAllRanges();
    document.documentElement.classList.add('is-sorting');
    l.grab = l.y0 - l.el.getBoundingClientRect().top;
    l.scroller = scrollerOf(el);
    l.el.dataset.lift = 'up';
    target.current = null;
    setSorted(true);
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
    const index = target.current;
    const from = rows().indexOf(l.el);
    const moves = index !== null && from >= 0 && index !== from && index !== from + 1;
    if (!moves) show(null); // the others slide back
    settle(l, moves ? landing.current : 0, () => {
      if (moves) flushSync(() => latest.current.onMove(l.id, index));
      reset(false);
    });
    if (moves) feel('levelChange');
  };

  const cancel = () => {
    const l = lift.current;
    if (!l) return;
    if (!l.lifted) return end();
    show(null);
    settle(l, 0, () => reset(false));
  };

  const listen = (l: Lift) => {
    const move = (e: PointerEvent) => {
      if (e.pointerId !== l.pointer || lift.current !== l) return;
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
      // The click that ends a drag isn't a click on the task.
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
    list.current = el;
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
        lift.current = null;
        document.documentElement.classList.remove('is-sorting');
      }
      list.current = null;
    };
  }, []);

  const external = (e: DragEvent) => Boolean(accepts) && (e.dataTransfer.types.includes(TASK_TYPE) || e.dataTransfer.types.includes('text/plain'));

  const listProps = {
    ref: attach,
    'data-sorted': sorted || undefined,
    onDragOver: (e: DragEvent) => {
      if (lift.current || !external(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearTimeout(leaving.current);
      if (!sorted) setSorted(true);
      show(indexAt(e.clientY));
    },
    // WebKit often leaves relatedTarget empty, so ask where the pointer is, and
    // wait a beat: crossing from row to row fires a leave and then an over.
    onDragLeave: (e: DragEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      const { clientX: x, clientY: y } = e;
      if (x > r.left && x < r.right && y > r.top && y < r.bottom) return;
      clearTimeout(leaving.current);
      leaving.current = setTimeout(() => show(null), 60);
    },
    onDrop: (e: DragEvent) => {
      if (lift.current || !external(e)) return;
      e.preventDefault();
      const id = e.dataTransfer.getData(TASK_TYPE) || e.dataTransfer.getData('text/plain');
      const index = target.current ?? indexAt(e.clientY);
      const moves = Boolean(id && accepts?.(id));
      reset(!moves);
      if (moves) {
        feel('levelChange');
        onMove(id, index);
      }
    },
  };

  const rowProps = (id: string): SortRow => ({
    'data-sort-id': id,
    onPointerDown: (e) => {
      if (lift.current || settling.current || !e.isPrimary || e.button !== 0) return;
      const el = e.currentTarget;
      const control = e.target instanceof Element ? e.target.closest(CONTROLS) : null;
      if (control && el.contains(control)) return;
      if (withEditor(el).length > 1) return; // open: it stays put
      const l: Lift = { id, el, pointer: e.pointerId, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY, y: e.clientY, grab: 0, at: 0, lifted: false };
      lift.current = l;
      l.off = listen(l);
      if (l.touch) l.hold = setTimeout(() => lift.current === l && begin(l), HOLD);
    },
  });

  return { listProps, rowProps, slot };
}

// The week as it will be once `ids` is the order of `date` (of the backlog when
// `date` is null): put it on screen before the saves finish. A task may come
// from the backlog or another day.
export function arranged<W extends WeekView>(week: W, date: string | null, ids: string[]): W {
  const all = new Map<string, Task>([...week.days.flatMap((d) => d.tasks), ...week.backlog].map((x) => [x.id, x]));
  const placed = new Set(ids);
  const put = ids.flatMap((id) => (all.has(id) ? [{ ...all.get(id)!, date }] : []));
  return {
    ...week,
    backlog: date === null ? put : week.backlog.filter((x) => !placed.has(x.id)),
    days: week.days.map((d) => (d.date === date ? { ...d, tasks: put } : { ...d, tasks: d.tasks.filter((x) => !placed.has(x.id)) })),
  };
}
