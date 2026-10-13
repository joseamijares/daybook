// A Daybook as one JSON file: every task, day and week, plus the appearance.
// "On this device" uses it to keep a copy and to move to the cloud; a cloud
// Daybook can export and import it too (owner only). Pure: runs on the server
// and in the browser.

import type { Appearance } from './appearance';
import { getAppearance, setAppearance } from './appearanceStore';
import type { Day, Task, Week } from './daybook';
import { store } from './storage';
import { isYmd } from './time';

export interface Backup {
  daybook: 1;
  exportedAt: string;
  tasks: Record<string, Task>;
  days: Record<string, Day>;
  weeks: Record<string, Week>;
  appearance?: Appearance;
}

export async function exportData(): Promise<Backup> {
  const [tasks, days, weeks, appearance] = await Promise.all([
    store().all<Task>('tasks'),
    store().all<Day>('days'),
    store().all<Week>('weeks'),
    getAppearance(),
  ]);
  return { daybook: 1, exportedAt: new Date().toISOString(), tasks, days, weeks, appearance };
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Check a file is a Daybook export before touching anything. */
export function readBackup(input: unknown): Backup {
  const fail = () => {
    throw new Error("can't read this file: it must be a Daybook export (daybook: 1)");
  };
  if (!isObject(input) || input.daybook !== 1 || !isObject(input.tasks) || !isObject(input.days) || !isObject(input.weeks)) fail();
  const b = input as unknown as Backup;
  for (const [id, t] of Object.entries(b.tasks)) {
    if (!isObject(t) || t.id !== id || typeof t.title !== 'string' || (t.date !== null && !isYmd(t.date))) fail();
  }
  for (const [date, d] of Object.entries(b.days)) if (!isObject(d) || d.date !== date || !isYmd(date)) fail();
  for (const [weekOf, w] of Object.entries(b.weeks)) if (!isObject(w) || w.weekOf !== weekOf || !isYmd(weekOf)) fail();
  return b;
}

/**
 * Bring a backup in. "merge" adds and updates records by id and keeps the
 * rest; "replace" makes this Daybook exactly the file (tasks, days, weeks).
 */
export async function importData(input: unknown, mode: 'merge' | 'replace' = 'merge') {
  const b = readBackup(input);
  if (mode === 'replace') {
    for (const kind of ['tasks', 'days', 'weeks'] as const) {
      for (const id of Object.keys(await store().all(kind))) await store().del(kind, id);
    }
  }
  for (const [id, t] of Object.entries(b.tasks)) await store().put('tasks', id, t);
  for (const [id, d] of Object.entries(b.days)) await store().put('days', id, d);
  for (const [id, w] of Object.entries(b.weeks)) await store().put('weeks', id, w);
  if (b.appearance) {
    try {
      await setAppearance(b.appearance);
    } catch {
      // an appearance from another version is skipped, not fatal
    }
  }
  return { tasks: Object.keys(b.tasks).length, days: Object.keys(b.days).length, weeks: Object.keys(b.weeks).length };
}
