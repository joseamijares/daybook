// The whole domain: tasks on days (or in the backlog), a focus line per day
// and per week, rollover of unfinished work, and the shutdown ritual.
// The web app, the REST API and the MCP server all call these functions.

import { getAppearance } from './appearanceStore';
import { parseQuickAdd } from './quickadd';
import { lateWork, wrapLine } from './recap';
import { store } from './storage';
import { addDays, isYmd, minutesLabel, mondayOf, resolveDate, today, weekDays } from './time';

export interface LinearSource {
  type: 'linear';
  id: string;
  key: string; // APP-214
  url: string;
  state?: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  date: string | null; // null = backlog
  estimate: number | null; // minutes
  tag: string | null;
  done: boolean;
  doneAt: string | null;
  order: number;
  source: LinearSource | null;
  rolledFrom: string | null; // the day it was first planned for, if it rolled over
  createdAt: string;
  updatedAt: string;
}

export interface Day {
  date: string;
  focus: string | null;
  note: string | null; // the shutdown journal line
  shutdownAt: string | null;
}

export interface Week {
  weekOf: string;
  focus: string | null;
}

const MAX_TITLE = 200;
let capacityOverride: number | null = null;
/** Minutes of planned work that fit in a day (DAYBOOK_CAPACITY_MINUTES, or set on this device). */
export const capacity = () => capacityOverride || Number(process.env.DAYBOOK_CAPACITY_MINUTES) || 360;
export const setCapacity = (minutes: number | null) => {
  capacityOverride = minutes;
};

function clean(s: unknown, field: string, max = MAX_TITLE): string | null {
  if (s == null || s === '') return null;
  if (typeof s !== 'string') throw new Error(`${field} must be a string`);
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length > max) throw new Error(`${field} is longer than ${max} characters`);
  return t || null;
}

function minutes(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 24 * 60) throw new Error('estimate must be minutes between 0 and 1440');
  return n || null;
}

export { parseQuickAdd };

const now = () => new Date().toISOString();
const newId = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const byOrder = (a: Task, b: Task) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);
// A task's order is stamped from the clock so a new one goes last. Two stamped in
// the same millisecond would tie and sort either way, so each stamp is at least
// one past the last.
let lastStamp = 0;
const nextOrder = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

export async function allTasks(): Promise<Task[]> {
  return Object.values(await store().all<Task>('tasks'));
}

// Unfinished tasks from earlier days move to today, remembering where they
// started (Sunsama's rollover). Runs whenever today's view is read.
// Returns every task, after the rollover, so callers need no second read.
export async function rollover(day = today()): Promise<Task[]> {
  const tasks = await allTasks();
  return Promise.all(
    tasks.map(async (t) => {
      if (!t.date || t.date >= day || t.done) return t;
      const moved = { ...t, rolledFrom: t.rolledFrom || t.date, date: day, updatedAt: now() };
      await store().put('tasks', t.id, moved);
      return moved;
    }),
  );
}

export interface AddTaskInput {
  title?: string;
  text?: string; // quick-add syntax, parsed for estimate and #tag
  date?: string | null;
  estimate?: number | string | null;
  tag?: string | null;
  notes?: string | null;
  source?: LinearSource | null;
}

export async function addTask(input: AddTaskInput): Promise<Task> {
  const parsed = input.text ? parseQuickAdd(input.text) : { title: '', estimate: null, tag: null };
  const title = clean(input.title ?? parsed.title, 'title');
  if (!title) throw new Error('title is required');
  // undefined → today; null or "backlog" → the backlog.
  const date = input.date === undefined ? today() : resolveDate(input.date);
  const t: Task = {
    id: newId(),
    title,
    notes: clean(input.notes, 'notes', 2000),
    date: date ?? null,
    estimate: minutes(input.estimate ?? parsed.estimate),
    tag: clean(input.tag ?? parsed.tag, 'tag', 40),
    done: false,
    doneAt: null,
    order: nextOrder(),
    source: input.source || null,
    rolledFrom: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await store().put('tasks', t.id, t);
  return t;
}

export async function getTask(id: string): Promise<Task> {
  const t = await store().get<Task>('tasks', id);
  if (!t) throw new NotFound(`no task with id ${id}`);
  return t;
}

export interface TaskPatch {
  title?: string;
  notes?: string | null;
  date?: string | null;
  estimate?: number | string | null;
  tag?: string | null;
  done?: boolean;
  order?: number;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const t = await getTask(id);
  const next: Task = { ...t, updatedAt: now() };
  if (patch.title !== undefined) {
    const title = clean(patch.title, 'title');
    if (!title) throw new Error('title cannot be empty');
    next.title = title;
  }
  if (patch.notes !== undefined) next.notes = clean(patch.notes, 'notes', 2000);
  if (patch.tag !== undefined) next.tag = clean(patch.tag, 'tag', 40);
  if (patch.estimate !== undefined) next.estimate = minutes(patch.estimate);
  if (patch.order !== undefined) next.order = Number(patch.order) || 0;
  if (patch.date !== undefined) {
    const date = resolveDate(patch.date);
    next.date = date ?? null;
    if (next.date !== t.date) next.order = patch.order ?? nextOrder();
    if (next.date === null) next.rolledFrom = null;
  }
  if (patch.done !== undefined && patch.done !== t.done) {
    next.done = Boolean(patch.done);
    next.doneAt = next.done ? now() : null;
    if (next.done && !next.date) next.date = today(); // finishing a backlog item counts today
    // A finished task goes under the ones still to do, unless this patch places
    // it or Settings keeps it where it was. Undone, it stays where it is.
    if (next.done && patch.order === undefined && (await getAppearance()).doneToBottom) next.order = nextOrder();
  }
  await store().put('tasks', id, next);
  return next;
}

export async function deleteTask(id: string): Promise<void> {
  await getTask(id);
  await store().del('tasks', id);
}

export async function getDayMeta(date: string): Promise<Day> {
  return (await store().get<Day>('days', date)) || { date, focus: null, note: null, shutdownAt: null };
}

export async function setDay(date: string, patch: { focus?: string | null; note?: string | null }): Promise<Day> {
  if (!isYmd(date)) throw new Error('date must be YYYY-MM-DD');
  const d = await getDayMeta(date);
  const next: Day = {
    ...d,
    ...(patch.focus !== undefined && { focus: clean(patch.focus, 'focus') }),
    ...(patch.note !== undefined && { note: clean(patch.note, 'note', 1000) }),
  };
  await store().put('days', date, next);
  return next;
}

export async function getWeekMeta(weekOf: string): Promise<Week> {
  return (await store().get<Week>('weeks', weekOf)) || { weekOf, focus: null };
}

export async function setWeekFocus(date: string, focus: string | null): Promise<Week> {
  if (!isYmd(date)) throw new Error('week must be YYYY-MM-DD');
  const weekOf = mondayOf(date);
  const w: Week = { weekOf, focus: clean(focus, 'focus') };
  await store().put('weeks', weekOf, w);
  return w;
}

export interface DayView extends Day {
  isToday: boolean;
  tasks: Task[];
  planned: number; // minutes planned (all tasks, done or not)
  remaining: number; // minutes left on unfinished tasks
  doneCount: number;
  capacity: number;
  over: number; // minutes over capacity, 0 if fine
  previous: string | null; // the latest earlier day with work on it
}

// The latest earlier day with work on it: a task dated then, or a task on this
// day that rolled over from then. The Shutdown screen offers to close it the
// morning after.
function previousDay(date: string, tasks: Task[]): string | null {
  let prev: string | null = null;
  for (const x of tasks) {
    for (const d of [x.date, x.date === date ? x.rolledFrom : null]) if (d && d < date && (!prev || d > prev)) prev = d;
  }
  return prev;
}

function dayView(meta: Day, tasks: Task[], t: string): DayView {
  const list = tasks.filter((x) => x.date === meta.date).sort(byOrder);
  const planned = list.reduce((s, x) => s + (x.estimate || 0), 0);
  const remaining = list.filter((x) => !x.done).reduce((s, x) => s + (x.estimate || 0), 0);
  return {
    ...meta,
    isToday: meta.date === t,
    tasks: list,
    planned,
    remaining,
    doneCount: list.filter((x) => x.done).length,
    capacity: capacity(),
    over: Math.max(0, planned - capacity()),
    previous: previousDay(meta.date, tasks),
  };
}

export async function getDay(date?: string): Promise<DayView> {
  const t = today();
  const d = date && isYmd(date) ? date : t;
  const [tasks, meta] = await Promise.all([d === t ? rollover(t) : allTasks(), getDayMeta(d)]);
  return dayView(meta, tasks, t);
}

export async function backlog(): Promise<Task[]> {
  return (await allTasks()).filter((t) => t.date === null && !t.done).sort(byOrder);
}

export interface WeekView extends Week {
  today: string;
  days: DayView[];
  backlog: Task[];
}

export async function getWeek(date?: string): Promise<WeekView> {
  const t = today();
  const weekOf = mondayOf(date && isYmd(date) ? date : t);
  const dates = weekDays(weekOf);
  // Three reads in total, whatever the week: tasks, all day records, the week record.
  const [tasks, days, meta] = await Promise.all([rollover(t), store().all<Day>('days'), getWeekMeta(weekOf)]);
  const metas = dates.map((date) => days[date] || { date, focus: null, note: null, shutdownAt: null });
  return {
    ...meta,
    today: t,
    days: metas.map((m) => dayView(m, tasks, t)),
    backlog: tasks.filter((x) => x.date === null && !x.done).sort(byOrder),
  };
}

// Sunsama-style planning: put these tasks on the day, in this order.
export async function planDay(date: string | undefined, taskIds: string[], focus?: string | null) {
  const d = resolveDate(date ?? 'today') || today();
  for (const [i, id] of taskIds.entries()) await updateTask(id, { date: d, order: i + 1 });
  if (focus !== undefined) await setDay(d, { focus });
  const view = await getDay(d);
  return {
    day: view,
    warning: view.over ? `Planned ${minutesLabel(view.planned)} against ${minutesLabel(view.capacity)}: ${minutesLabel(view.over)} over. Move something.` : null,
  };
}

export type Carry = 'tomorrow' | 'backlog' | 'keep';

// The shutdown ritual: review, decide where unfinished work goes, one line
// for the journal. Unfinished tasks default to the next day. A day closed late
// (the morning after) has already rolled its unfinished work onto today: that
// work is reviewed with it, and moving on means staying on today, never going
// back into the past.
export async function shutdown(date: string | undefined, opts: { note?: string | null; carry?: Record<string, Carry> } = {}) {
  const d = resolveDate(date ?? 'today') || today();
  for (const to of Object.values(opts.carry || {})) {
    if (!['tomorrow', 'backlog', 'keep'].includes(to)) throw new Error('carry must be tomorrow, backlog or keep');
  }
  const t = today();
  // Reading today first rolls every earlier unfinished task onto it.
  const rolled = d < t ? lateWork((await getDay(t)).tasks, d) : [];
  const before = await getDay(d);
  const target = d < t ? t : addDays(d, 1);
  let moved = 0;
  for (const x of [...before.tasks.filter((y) => !y.done), ...rolled]) {
    const to = opts.carry?.[x.id] || 'tomorrow';
    if (to === 'keep') continue;
    moved++;
    if (to === 'tomorrow' && x.date === target) continue; // already there, in its place
    await store().put('tasks', x.id, {
      ...x,
      date: to === 'backlog' ? null : target,
      rolledFrom: to === 'backlog' ? null : x.rolledFrom || d,
      order: nextOrder(),
      updatedAt: now(),
    });
  }
  const meta = await getDayMeta(d);
  const next: Day = { ...meta, shutdownAt: now(), ...(opts.note !== undefined && { note: clean(opts.note, 'note', 1000) }) };
  await store().put('days', d, next);
  return { date: d, summary: wrapLine([...before.tasks, ...rolled], moved), moved, day: await getDay(d) };
}

// Undo a shutdown: the day is open again (tasks already moved stay where they went).
export async function reopenDay(date: string | undefined): Promise<Day> {
  const d = resolveDate(date ?? 'today') || today();
  const next: Day = { ...(await getDayMeta(d)), shutdownAt: null };
  await store().put('days', d, next);
  return next;
}

export class NotFound extends Error {}
