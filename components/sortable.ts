'use client';

// Drag to reorder, smoothly. While a task is dragged over a list the rows part
// to show where it will land: a task from the list waits there, faded, and one
// from elsewhere gets an empty slot. On drop the caller puts the new order on
// screen at once (and saves it behind), and nothing jumps, because the rows are
// already where the new order puts them. A cancelled drag slides them back.
//
// Rows are the list's children with data-sort-id, in the order of `ids`; an
// open editor right after a row moves with it. The list needs position:
// relative. Where the pointer is pointing is measured from layout (offsetTop),
// which the rows moving aside doesn't change, so the preview never wobbles.

import { type DragEvent, useRef, useState } from 'react';
import type { Task, WeekView } from '@/lib/daybook';

export const TASK_TYPE = 'application/x-daybook-task';

export type SortRow = {
  'data-sort-id': string;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
};

type Slot = { top: number; height: number };

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
  const list = useRef<T>(null);
  const active = useRef<string | null>(null); // the row of this list being dragged
  const target = useRef<number | null>(null);
  const dropped = useRef(false);
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [dragging, setDragging] = useState<string | null>(null);
  const [sorted, setSorted] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);

  const rows = () => {
    const el = list.current;
    if (!el) return [];
    const byId = new Map<string, HTMLElement>();
    for (const n of Array.from(el.children)) if (n instanceof HTMLElement && n.dataset.sortId) byId.set(n.dataset.sortId, n);
    return ids.map((id) => byId.get(id)).filter((n): n is HTMLElement => Boolean(n));
  };
  const withEditor = (n: HTMLElement) => {
    const next = n.nextElementSibling;
    return next instanceof HTMLElement && next.classList.contains('editor') ? [n, next] : [n];
  };

  // The line the pointer is nearest: before the first row whose middle is below it.
  const indexAt = (y: number) => {
    const el = list.current;
    if (!el) return ids.length;
    const at = y - el.getBoundingClientRect().top - el.clientTop;
    const els = rows();
    const i = els.findIndex((n) => at < n.offsetTop + n.offsetHeight / 2);
    return i < 0 ? els.length : i;
  };

  const show = (index: number | null) => {
    if (index === target.current) return;
    target.current = index;
    const els = rows();
    const tops = els.map((n) => n.offsetTop);
    const sizes = els.map((n, i) => (i < els.length - 1 ? tops[i + 1] - tops[i] : n.offsetHeight));
    const shift = els.map(() => 0);
    const from = active.current ? ids.indexOf(active.current) : -1;
    let gap: Slot | null = null;
    if (index !== null && from >= 0) {
      // Rows between step over by the dragged row's height; it moves past them.
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
    els.forEach((n, i) => withEditor(n).forEach((m) => (m.style.transform = shift[i] ? `translate3d(0, ${shift[i]}px, 0)` : '')));
    if (list.current) list.current.style.paddingBottom = gap ? `${gap.height}px` : '';
    setSlot(gap);
  };

  // Slide back (a cancelled drag), or settle where the preview put them, with
  // no transition, in the same frame as the new order (`animate` false).
  const reset = (animate: boolean) => {
    clearTimeout(leaving.current);
    const els = rows().flatMap(withEditor);
    target.current = null;
    active.current = null;
    setDragging(null);
    setSlot(null);
    if (list.current) list.current.style.paddingBottom = '';
    for (const n of els) {
      if (!animate) n.style.transitionProperty = 'opacity';
      n.style.transform = '';
    }
    if (!animate) requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((n) => (n.style.transitionProperty = ''))));
  };

  const external = (e: DragEvent) => Boolean(accepts) && (e.dataTransfer.types.includes(TASK_TYPE) || e.dataTransfer.types.includes('text/plain'));

  const listProps = {
    ref: list,
    'data-sorted': sorted || undefined,
    onDragOver: (e: DragEvent) => {
      if (!active.current && !external(e)) return;
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
      e.preventDefault();
      const id = active.current || e.dataTransfer.getData(TASK_TYPE) || e.dataTransfer.getData('text/plain');
      const index = target.current ?? indexAt(e.clientY);
      const from = active.current ? ids.indexOf(active.current) : -1;
      const moves = from >= 0 ? index !== from && index !== from + 1 : Boolean(id && accepts?.(id));
      dropped.current = true;
      reset(!moves);
      if (moves) onMove(id, index);
    },
  };

  const rowProps = (id: string): SortRow => ({
    'data-sort-id': id,
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.setData(TASK_TYPE, id);
      e.dataTransfer.effectAllowed = 'move';
      active.current = id;
      dropped.current = false;
      // After the browser has taken its picture of the row, so the picture isn't faded.
      setTimeout(() => {
        if (active.current !== id) return;
        setDragging(id);
        setSorted(true);
      });
    },
    onDragEnd: () => {
      if (!dropped.current) reset(true);
      dropped.current = false;
    },
  });

  return { listProps, rowProps, dragging, slot };
}

// The week as it will be once `ids` is the order of `date`: put it on screen
// before the saves finish. A task may come from the backlog or another day.
export function arranged<W extends WeekView>(week: W, date: string, ids: string[]): W {
  const all = new Map<string, Task>([...week.days.flatMap((d) => d.tasks), ...week.backlog].map((x) => [x.id, x]));
  const placed = new Set(ids);
  return {
    ...week,
    backlog: week.backlog.filter((x) => !placed.has(x.id)),
    days: week.days.map((d) =>
      d.date === date
        ? { ...d, tasks: ids.flatMap((id) => (all.has(id) ? [{ ...all.get(id)!, date }] : [])) }
        : { ...d, tasks: d.tasks.filter((x) => !placed.has(x.id)) },
    ),
  };
}
