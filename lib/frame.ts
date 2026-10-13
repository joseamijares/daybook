// Frame Dashboard (github.com/joseamijares/frame-dashboard): send the week to
// the TV. Builds the exact plan document its PUT /api/plan accepts — Monday
// weekOf, one entry per day with a focus and up to 20 tasks of 200 chars.

import { getWeek, type WeekView } from './daybook';
import { store } from './store';

const MAX_TASKS = 20;
const MAX_TEXT = 200;

export const frameEnabled = () => Boolean(process.env.FRAME_DASHBOARD_URL && process.env.FRAME_DASHBOARD_WRITE_KEY);

export interface FramePlan {
  weekOf: string;
  focus: string | null;
  days: Record<string, { focus: string | null; tasks: { text: string; done: boolean; tag: string | null }[] }>;
}

const cut = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

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
        .map((t) => ({ text: cut(t.title), done: t.done, tag: t.source?.key || t.tag || null })),
    };
  }
  return { weekOf: week.weekOf, focus: week.focus ? cut(week.focus) : null, days };
}

export async function pushToFrame(date?: string) {
  const base = process.env.FRAME_DASHBOARD_URL?.replace(/\/+$/, '');
  const key = process.env.FRAME_DASHBOARD_WRITE_KEY;
  if (!base || !key) throw new Error('Set FRAME_DASHBOARD_URL and FRAME_DASHBOARD_WRITE_KEY to send the week to your Frame');
  const plan = toFramePlan(await getWeek(date));
  const res = await fetch(`${base}/api/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(plan),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; updatedAt?: string };
  if (!res.ok) throw new Error(`Frame Dashboard answered ${res.status}: ${body.error || res.statusText}`);
  await store().put('meta', 'frameSentAt', new Date().toISOString());
  return { ok: true, weekOf: plan.weekOf, days: Object.keys(plan.days).length, updatedAt: body.updatedAt ?? null };
}
