// GET  /api/frame?date=   preview the plan document Frame Dashboard would receive
// POST /api/frame         { date? }  two-way sync with Frame Dashboard: pull what changed
//                         there (ticks, new or removed to-dos, focus), merge, push the week
import { getWeek } from '@/lib/daybook';
import { frameEnabled, syncFrame, toFramePlan } from '@/lib/frame';
import { body, json, route } from '@/lib/http';

export const GET = route(async (req) => json(toFramePlan(await getWeek(new URL(req.url).searchParams.get('date') || undefined))));

export const POST = route(async (req) => {
  const b = await body<{ date?: string }>(req);
  if (!(await frameEnabled())) return json({ error: 'Frame Dashboard is not connected: add it in Settings' }, 400);
  return json(await syncFrame(b.date));
});
