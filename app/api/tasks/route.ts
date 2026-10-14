// GET  /api/tasks            the backlog
// POST /api/tasks            { text } quick-add ("Draft deck 45m #client"), or { title, date?, estimate?, tag?, notes? }
import { maybeSyncFrame } from '@/lib/actions';
import { addTask, type AddTaskInput, backlog } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

export const GET = route(async () => json({ backlog: await backlog() }));

export const POST = route(async (req) => {
  // Only what a person or agent writes. A task's Linear link (`source`) comes
  // from the Linear sync alone: ticking such a task closes that issue.
  const { title, text, date, estimate, tag, notes } = await body<AddTaskInput>(req);
  const task = await addTask({ title, text, date, estimate, tag, notes });
  const warnings = await maybeSyncFrame(task.date ?? undefined);
  return json({ task, warnings }, 201);
});
