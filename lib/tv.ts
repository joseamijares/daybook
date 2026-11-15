// The TV on the wall (the Frame Dashboard screen): the week as it draws it.
// Same JSON as Frame Dashboard's API (/api/week, /api/plan, /api/settings,
// /api/events), so its screen, its TV apps and Frame Desk work against Daybook
// unchanged. Built from Daybook's own week; while a Frame is still connected,
// its meetings and paintings come from it.

import { type Artwork, artFor } from './art';
import { type DayView, getDay, getWeek, type Task } from './daybook';
import { type FrameEvent, type FramePlan, frameArt, frameEventsOrError, mergeFromFrame, type MergeResult, toFramePlan } from './frame';
import { store } from './storage';
import { addDays, isYmd, mondayOf, today, tzName, weekDays, ymdInTz } from './time';

// The screen's designs. Names and descriptions are what Frame Desk lists.
export const TV_LAYOUTS = [
  { id: 'bleed', name: 'Day and night', description: 'The painting fills the screen by day; the salon wall after 7 pm.' },
  { id: 'salon', name: 'Salon', description: 'The painting in its frame on the gallery wall, all day.' },
  { id: 'painting', name: 'Painting', description: 'The painting fills the screen, day and night.' },
] as const;
export type TvLayout = (typeof TV_LAYOUTS)[number]['id'];
const isLayout = (v: unknown): v is TvLayout => TV_LAYOUTS.some((l) => l.id === v);

// Art packs: Daybook has its built-in one; the museum packs come with the screen.
export const TV_PACKS = [
  { id: 'impressionists', name: 'Impressionists', description: 'Monet, Van Gogh, Sisley, Cézanne and friends, plus Hokusai and Hiroshige.', count: 44 },
];
const PACK_IDS = TV_PACKS.map((p) => p.id);

export interface TvSettings {
  layout: TvLayout;
  packs: string[];
}

export async function getTvSettings(): Promise<TvSettings> {
  const saved = await store().get<Partial<TvSettings>>('meta', 'tv');
  const packs = Array.isArray(saved?.packs) ? saved.packs.filter((id) => PACK_IDS.includes(id)) : [];
  return { layout: isLayout(saved?.layout) ? saved.layout : 'bleed', packs: packs.length ? packs : PACK_IDS };
}

/** `{ layout?, packs? }`: the fields sent change, the others keep their value. */
export async function setTvSettings(input: unknown): Promise<TvSettings> {
  if (!input || typeof input !== 'object') throw new Error('body must be a JSON object');
  const { layout, packs } = input as { layout?: unknown; packs?: unknown };
  if (layout === undefined && packs === undefined) throw new Error('packs or layout is required');
  const next = await getTvSettings();
  if (layout !== undefined) {
    if (!isLayout(layout)) throw new Error(`layout must be one of ${TV_LAYOUTS.map((l) => l.id).join(', ')}`);
    next.layout = layout;
  }
  if (packs !== undefined) {
    if (!Array.isArray(packs)) throw new Error('packs must be an array of pack ids');
    const unknown = packs.filter((id) => !PACK_IDS.includes(id));
    if (unknown.length) throw new Error(`packs must be known pack ids (unknown: ${unknown.join(', ')})`);
    if (!packs.length) throw new Error('packs must have at least one pack');
    next.packs = [...new Set(packs as string[])];
  }
  await store().put('meta', 'tv', next);
  return next;
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

// The Frame's meetings and the ones Frame Desk pushed, by day.
function byDay(frame: Record<string, FrameEvent[]>, pushed: TvEvents | null): Record<string, FrameEvent[]> {
  const out: Record<string, FrameEvent[]> = {};
  for (const date of new Set([...Object.keys(frame), ...(pushed?.events.map((e) => e.date) || [])])) {
    out[date] = mergeEvents(frame[date], pushed?.events.filter((e) => e.date === date));
  }
  return out;
}

async function tvDay(d: DayView, events: Record<string, FrameEvent[]>): Promise<TvDay> {
  return { date: d.date, focus: d.focus, note: null, tasks: tvTasks(d.tasks), events: events[d.date] || [], art: await artOf(d.date) };
}

export async function tvWeek(date?: string): Promise<TvWeek> {
  const t = today();
  const anchor = isYmd(date) ? date : t;
  const [week, frame, pushed, settings] = await Promise.all([getWeek(anchor), frameEventsOrError(anchor), getTvEvents(anchor), getTvSettings()]);
  const days = await Promise.all(week.days.map((d) => tvDay(d, byDay(frame.events, pushed))));
  // The screen prints the first error in its status line.
  const errors = frame.error ? [`Meetings unavailable: ${frame.error}`] : [];

  // The evening view shows tomorrow. On Sunday that is next week's Monday.
  const next = addDays(t, 1);
  let tomorrow = days.find((d) => d.date === next) || null;
  if (!tomorrow && anchor === t) {
    const [day, nextFrame, nextPushed] = await Promise.all([getDay(next), frameEventsOrError(next), getTvEvents(next)]);
    tomorrow = await tvDay(day, byDay(nextFrame.events, nextPushed));
    if (nextFrame.error && !errors.length) errors.push(`Meetings unavailable: ${nextFrame.error}`);
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
    eventsSyncedAt: pushed?.syncedAt ?? null,
    days,
    tomorrow,
    errors,
    generatedAt: new Date().toISOString(),
  };
}

// ── Frame Desk: the plan document ─────────────────────────────────────

// The plan Frame Desk last read for a week. Its next save is merged against it:
// what Frame Desk changed applies, what Daybook changed meanwhile is kept.
const baseKey = (weekOf: string) => `tvBase:${weekOf}`;

export async function tvPlan(week?: string): Promise<FramePlan> {
  const plan = toFramePlan(await getWeek(mondayOf(isYmd(week) ? week : today())));
  await store().put('meta', baseKey(plan.weekOf), plan);
  return plan;
}

function text(v: unknown, field: string): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new Error(`${field} must be a string`);
  const t = v.trim();
  if (t.length > MAX_TEXT) throw new Error(`${field} is longer than ${MAX_TEXT} characters`);
  return t || null;
}

/** Frame Dashboard's plan rules: a Monday, days of that week, tasks as text or `{ text, done, tag }`. */
export function readPlan(input: unknown): FramePlan {
  if (!input || typeof input !== 'object') throw new Error('plan must be a JSON object');
  const p = input as { weekOf?: unknown; focus?: unknown; days?: unknown };
  if (!isYmd(p.weekOf) || mondayOf(p.weekOf) !== p.weekOf) throw new Error('weekOf must be a Monday (YYYY-MM-DD)');
  const allowed = new Set(weekDays(p.weekOf));
  const days: FramePlan['days'] = {};
  for (const [date, raw] of Object.entries((p.days as Record<string, unknown>) || {})) {
    if (!allowed.has(date)) throw new Error(`days.${date} must be in the week of ${p.weekOf}`);
    const day = (raw || {}) as { focus?: unknown; tasks?: unknown };
    const tasks = day.tasks ?? [];
    if (!Array.isArray(tasks)) throw new Error(`days.${date}.tasks must be an array`);
    if (tasks.length > MAX_TASKS) throw new Error(`days.${date}.tasks must have ${MAX_TASKS} tasks at most`);
    days[date] = {
      focus: text(day.focus, `days.${date}.focus`),
      tasks: tasks.map((t, i) => {
        const f = `days.${date}.tasks[${i}]`;
        if (typeof t === 'string') return { text: text(t, f) || '', done: false, tag: null };
        if (!t || typeof t !== 'object') throw new Error(`${f} must be a string or an object`);
        const o = t as { text?: unknown; done?: unknown; tag?: unknown };
        const body = text(o.text, `${f}.text`);
        if (!body) throw new Error(`${f}.text is required`);
        return { text: body, done: o.done === true, tag: text(o.tag, `${f}.tag`) };
      }).filter((t) => t.text),
    };
  }
  return { weekOf: p.weekOf, focus: text(p.focus, 'focus'), days };
}

/** Frame Desk saves a whole week: apply what it changed to Daybook. */
export async function saveTvPlan(input: unknown): Promise<{ ok: true; weekOf: string; updatedAt: string; merged: MergeResult }> {
  const remote = readPlan(input);
  const base = await store().get<FramePlan>('meta', baseKey(remote.weekOf));
  const merged = await mergeFromFrame(await getWeek(remote.weekOf), remote, base);
  await tvPlan(remote.weekOf); // the merged week is the next base
  return { ok: true, weekOf: remote.weekOf, updatedAt: new Date().toISOString(), merged };
}

// ── Frame Desk: meetings from the Mac's calendars ─────────────────────

export interface TvEvents {
  weekOf: string;
  source: string | null;
  events: FrameEvent[];
  syncedAt: string;
}

const MAX_EVENTS = 300;
const eventsKey = (weekOf: string) => `tv:events:${weekOf}`;

export async function getTvEvents(week?: string): Promise<TvEvents | null> {
  return store().get<TvEvents>('meta', eventsKey(mondayOf(isYmd(week) ? week : today())));
}

/** `{ weekOf, source?, events }`, replacing that week's. The day is decided in Daybook's zone. */
export async function saveTvEvents(input: unknown): Promise<TvEvents> {
  if (!input || typeof input !== 'object') throw new Error('body must be a JSON object');
  const b = input as { weekOf?: unknown; source?: unknown; events?: unknown };
  if (!isYmd(b.weekOf) || mondayOf(b.weekOf) !== b.weekOf) throw new Error('weekOf must be a Monday (YYYY-MM-DD)');
  if (!Array.isArray(b.events)) throw new Error('events must be an array');
  if (b.events.length > MAX_EVENTS) throw new Error(`events must have ${MAX_EVENTS} at most`);
  const week = new Set(weekDays(b.weekOf));
  const short = (v: unknown, field: string, required = false) => {
    if (v == null || v === '') {
      if (required) throw new Error(`${field} is required`);
      return null;
    }
    if (typeof v !== 'string') throw new Error(`${field} must be a string`);
    return v.trim().slice(0, MAX_TEXT) || null;
  };
  const iso = (v: unknown, field: string) => {
    const t = typeof v === 'string' ? Date.parse(v) : NaN;
    if (Number.isNaN(t)) throw new Error(`${field} must be an ISO date-time`);
    return new Date(t).toISOString();
  };
  const events: FrameEvent[] = [];
  b.events.forEach((raw, i) => {
    const f = `events[${i}]`;
    const e = (raw || {}) as Record<string, unknown>;
    const title = short(e.title, `${f}.title`, true) as string;
    const location = short(e.location, `${f}.location`);
    if (e.allDay) {
      if (!isYmd(e.date)) throw new Error(`${f}.date must be YYYY-MM-DD for all-day events`);
      if (week.has(e.date)) events.push({ title, location, allDay: true, date: e.date });
      return;
    }
    const start = iso(e.start, `${f}.start`);
    const end = e.end ? iso(e.end, `${f}.end`) : start;
    const date = ymdInTz(new Date(start));
    if (week.has(date)) events.push({ title, location, allDay: false, date, start, end });
  });
  const doc: TvEvents = { weekOf: b.weekOf, source: short(b.source, 'source'), events, syncedAt: new Date().toISOString() };
  await store().put('meta', eventsKey(b.weekOf), doc);
  return doc;
}

// The same meeting can come from the Frame and from the Mac: keep it once, in day order.
export function mergeEvents(...lists: (FrameEvent[] | undefined)[]): FrameEvent[] {
  const seen = new Set<string>();
  const out: FrameEvent[] = [];
  for (const e of lists.flat()) {
    if (!e) continue;
    const key = `${e.title.toLowerCase()}|${e.allDay ? e.date : e.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((a, b) =>
    a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.allDay ? a.title.localeCompare(b.title) : (a.start || '').localeCompare(b.start || ''),
  );
}
