// Frame Dashboard (github.com/joseamijares/frame-dashboard): two-way sync of
// the week with the TV and its Mac app, Frame Desk.
//
// Frame stores one plan document per week (PUT /api/plan replaces it whole).
// Frame Desk and agents edit that document directly: they tick to-dos, add
// them, remove them, change a focus. So a sync is pull → merge → push:
//
//   base   = the plan Daybook pushed last time (kept in meta, per week)
//   remote = the plan on Frame now
//   local  = Daybook
//
// For each task, matched by text within its day: whichever side differs from
// base wins; if both changed, Daybook wins. New on Frame → added to Daybook.
// Removed on Frame → moved to Daybook's backlog (never deleted). With no base
// yet (first sync), Frame's tasks that Daybook lacks are imported and done
// only ever goes from false to true. Then the merged week is pushed and
// becomes the new base.

import { createHash } from 'node:crypto';
import { addTask, getWeek, setDay, setWeekFocus, type Task, updateTask, type WeekView } from './daybook';
import { store } from './store';
import { weekDays } from './time';

const MAX_TASKS = 20;
const MAX_TEXT = 200;

export const frameEnabled = () => Boolean(process.env.FRAME_DASHBOARD_URL && process.env.FRAME_DASHBOARD_WRITE_KEY);

export interface FrameTask {
  text: string;
  done: boolean;
  tag: string | null;
}

export interface FrameDay {
  focus: string | null;
  note?: string | null;
  tasks: FrameTask[];
}

export interface FramePlan {
  weekOf: string;
  focus: string | null;
  days: Record<string, FrameDay>;
}

export interface FrameEvent {
  title: string;
  location: string | null;
  allDay: boolean;
  date: string;
  start?: string;
  end?: string;
}

const cut = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const textOf = (t: Task) => cut(t.title);

export function toFramePlan(week: WeekView): FramePlan {
  const days: FramePlan['days'] = {};
  for (const d of week.days) {
    if (!d.focus && !d.tasks.length) continue;
    days[d.date] = {
      focus: d.focus ? cut(d.focus) : null,
      // Unfinished first, so the five lines the TV shows are the ones that matter.
      tasks: [...d.tasks]
        .sort((a, b) => Number(a.done) - Number(b.done))
        .slice(0, MAX_TASKS)
        .map((t) => ({ text: textOf(t), done: t.done, tag: t.source?.key || t.tag || null })),
    };
  }
  return { weekOf: week.weekOf, focus: week.focus ? cut(week.focus) : null, days };
}

// Pair items of two lists that have the same text, in order, so two
// identical titles on one day never cross-match.
function pair<A, B>(as: A[], bs: B[], ta: (a: A) => string, tb: (b: B) => string) {
  const used = new Set<number>();
  const matches = new Map<A, B>();
  for (const a of as) {
    const i = bs.findIndex((b, j) => !used.has(j) && norm(tb(b)) === norm(ta(a)));
    if (i >= 0) {
      used.add(i);
      matches.set(a, bs[i]);
    }
  }
  return { matches, unmatchedB: bs.filter((_, j) => !used.has(j)) };
}

export interface MergeResult {
  done: number;
  undone: number;
  added: number;
  removed: number;
  focus: number;
}

// Apply what changed on Frame to Daybook. Pure decisions, Daybook writes.
export async function mergeFromFrame(local: WeekView, remote: FramePlan, base: FramePlan | null): Promise<MergeResult> {
  const r: MergeResult = { done: 0, undone: 0, added: 0, removed: 0, focus: 0 };
  for (const date of weekDays(local.weekOf)) {
    const day = local.days.find((d) => d.date === date);
    const mine = day?.tasks || [];
    const theirs = remote.days[date]?.tasks || [];
    const before = base?.days[date]?.tasks || [];
    const remoteToBase = pair(theirs, before, (t) => t.text, (t) => t.text).matches;
    const remoteToLocal = pair(theirs, mine, (t) => t.text, textOf).matches;

    for (const t of theirs) {
      const b = remoteToBase.get(t);
      const d = remoteToLocal.get(t);
      if (!d) {
        // On Frame, not in Daybook. If it was pushed before, Daybook removed it: Daybook wins.
        if (base && b) continue;
        await addTask({ title: t.text, date, tag: t.tag && !/^[A-Z]+-\d+$/.test(t.tag) ? t.tag : null }).then((n) =>
          t.done ? updateTask(n.id, { done: true }) : n,
        );
        r.added++;
        continue;
      }
      if (t.done === d.done) continue;
      if (!b) {
        // Never compared before: only ever promote to done.
        if (t.done) {
          await updateTask(d.id, { done: true });
          r.done++;
        }
        continue;
      }
      const frameChanged = t.done !== b.done;
      const localChanged = d.done !== b.done;
      if (frameChanged && !localChanged) {
        await updateTask(d.id, { done: t.done });
        if (t.done) r.done++;
        else r.undone++;
      }
    }

    // Pushed last time, gone from Frame now: someone removed it there.
    if (base) {
      const gone = pair(theirs, before, (t) => t.text, (t) => t.text).unmatchedB;
      const removedLocal = pair(gone, mine, (t) => t.text, textOf).matches;
      for (const d of removedLocal.values()) {
        if (d.done) continue;
        await updateTask(d.id, { date: null });
        r.removed++;
      }
    }

    // The day's focus line.
    const rf = remote.days[date]?.focus ?? null;
    const bf = base?.days[date]?.focus ?? null;
    const lf = day?.focus ?? null;
    if (rf !== lf && (base ? rf !== bf && lf === bf : !lf && rf)) {
      await setDay(date, { focus: rf });
      r.focus++;
    }
  }

  const rw = remote.focus ?? null;
  const bw = base?.focus ?? null;
  const lw = local.focus ?? null;
  if (rw !== lw && (base ? rw !== bw && lw === bw : !lw && rw)) {
    await setWeekFocus(local.weekOf, rw);
    r.focus++;
  }
  return r;
}

function frameConfig() {
  const base = process.env.FRAME_DASHBOARD_URL?.replace(/\/+$/, '');
  const key = process.env.FRAME_DASHBOARD_WRITE_KEY;
  if (!base || !key) throw new Error('Set FRAME_DASHBOARD_URL and FRAME_DASHBOARD_WRITE_KEY to sync with your Frame');
  return { base, key };
}

async function frameFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { base, key } = frameConfig();
  const res = await fetch(`${base}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`Frame Dashboard answered ${res.status}: ${body.error || res.statusText}`);
  return body;
}

// The base belongs to one Frame: pointing Daybook at a different Frame starts
// over with a first sync instead of merging against another TV's plan.
const baseKey = (weekOf: string) => `frameBase:${createHash('sha1').update(frameConfig().base).digest('hex').slice(0, 10)}:${weekOf}`;

export async function syncFrame(date?: string) {
  const local = await getWeek(date);
  const [remote, base] = await Promise.all([
    frameFetch<FramePlan>(`/api/plan?week=${local.weekOf}`),
    store().get<FramePlan>('meta', baseKey(local.weekOf)),
  ]);
  const pulled = await mergeFromFrame(local, { ...remote, days: remote.days || {} }, base);
  const plan = toFramePlan(await getWeek(local.weekOf));
  // Keep Frame's own per-day notes; Daybook doesn't own them.
  for (const [d, day] of Object.entries(remote.days || {})) {
    if (day.note && plan.days[d]) plan.days[d].note = day.note;
  }
  const saved = await frameFetch<{ updatedAt?: string }>('/api/plan', { method: 'PUT', body: plan });
  await store().put('meta', baseKey(plan.weekOf), plan);
  await store().put('meta', 'frameSentAt', new Date().toISOString());
  return { ok: true, weekOf: plan.weekOf, pulled, pushedDays: Object.keys(plan.days).length, updatedAt: saved.updatedAt ?? null };
}

// Meetings come from Frame's calendar feeds (iCal and Frame Desk's Mac calendars).
export async function frameEvents(date?: string): Promise<Record<string, FrameEvent[]>> {
  if (!frameEnabled()) return {};
  try {
    const week = await frameFetch<{ days: { date: string; events: FrameEvent[] }[] }>(`/api/week${date ? `?date=${date}` : ''}`);
    return Object.fromEntries(week.days.map((d) => [d.date, d.events || []]));
  } catch {
    return {};
  }
}
