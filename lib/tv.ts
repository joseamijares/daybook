// The TV on the wall (the Frame Dashboard screen): the week as it draws it.
// Same JSON as Frame Dashboard's /api/week, so its screen and its TV apps work
// against Daybook unchanged. Built from Daybook's own week; while a Frame is
// still connected, the meetings and the paintings come from it.

import { type Artwork, artFor } from './art';
import { type DayView, getDay, getWeek, type Task } from './daybook';
import { type FrameEvent, frameArt, frameEvents } from './frame';
import { store } from './storage';
import { addDays, isYmd, today, tzName } from './time';

export const TV_LAYOUTS = ['bleed', 'salon', 'painting'] as const;
export type TvLayout = (typeof TV_LAYOUTS)[number];

export interface TvSettings {
  layout: TvLayout;
}

export async function getTvSettings(): Promise<TvSettings> {
  const saved = await store().get<Partial<TvSettings>>('meta', 'tv');
  return { layout: TV_LAYOUTS.includes(saved?.layout as TvLayout) ? (saved!.layout as TvLayout) : 'bleed' };
}

const MAX_TASKS = 20;
const MAX_TEXT = 200;
const cut = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

export interface TvTask {
  text: string;
  done: boolean;
  tag: string | null;
}

export type TvArt = Artwork & { fallback?: Artwork };

export interface TvDay {
  date: string;
  focus: string | null;
  note: string | null;
  tasks: TvTask[];
  events: FrameEvent[];
  art: TvArt;
}

export interface TvWeek {
  tz: string;
  locale: 'en' | 'es';
  layout: TvLayout;
  today: string;
  weekOf: string;
  focus: string | null;
  planned: boolean;
  planUpdatedAt: string | null;
  eventsSyncedAt: string | null;
  days: TvDay[];
  tomorrow: TvDay | null;
  errors: string[];
  generatedAt: string;
}

// Daybook's paintings live at the site root; the screen sits under /tv/.
const rooted = (a: Artwork): Artwork => ({ ...a, image: a.image.startsWith('http') || a.image.startsWith('/') ? a.image : `/${a.image}` });

async function artOf(date: string): Promise<TvArt> {
  const own = rooted(artFor(date));
  const frame = await frameArt(date);
  // A remote painting that fails to load falls back to Daybook's own.
  return frame ? { ...frame, fallback: own } : own;
}

// Unfinished first, so the lines that fit on the wall are the ones that matter.
// The tag is the Linear key when there is one.
export function tvTasks(tasks: Task[]): TvTask[] {
  return [...tasks]
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, MAX_TASKS)
    .map((t) => ({ text: cut(t.title), done: t.done, tag: t.source?.key || t.tag || null }));
}

async function tvDay(d: DayView, events: Record<string, FrameEvent[]>): Promise<TvDay> {
  return { date: d.date, focus: d.focus, note: null, tasks: tvTasks(d.tasks), events: events[d.date] || [], art: await artOf(d.date) };
}

export async function tvWeek(date?: string): Promise<TvWeek> {
  const t = today();
  const anchor = isYmd(date) ? date : t;
  const [week, events, settings] = await Promise.all([getWeek(anchor), frameEvents(anchor), getTvSettings()]);
  const days = await Promise.all(week.days.map((d) => tvDay(d, events)));

  // The evening view shows tomorrow. On Sunday that is next week's Monday.
  const next = addDays(t, 1);
  let tomorrow = days.find((d) => d.date === next) || null;
  if (!tomorrow && anchor === t) {
    const [day, nextEvents] = await Promise.all([getDay(next), frameEvents(next)]);
    tomorrow = await tvDay(day, nextEvents);
  }

  const tasks = week.days.flatMap((d) => d.tasks);
  const stamps = tasks.map((x) => x.updatedAt).sort();
  return {
    tz: tzName(),
    locale: process.env.DAYBOOK_LOCALE === 'es' ? 'es' : 'en',
    layout: settings.layout,
    today: t,
    weekOf: week.weekOf,
    focus: week.focus,
    planned: Boolean(week.focus || week.days.some((d) => d.focus || d.tasks.length)),
    planUpdatedAt: stamps.at(-1) ?? null,
    eventsSyncedAt: null,
    days,
    tomorrow,
    errors: [],
    generatedAt: new Date().toISOString(),
  };
}
