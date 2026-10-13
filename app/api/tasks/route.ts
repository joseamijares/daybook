// GET  /api/tasks            the backlog
// POST /api/tasks            { text } quick-add ("Draft deck 45m #client"), or { title, date?, estimate?, tag?, notes? }
import { maybeSyncFrame } from '@/lib/actions';
import { addTask, type AddTaskInput, backlog } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

export const GET = route(async () => json({ backlog: await backlog() }));

export const POST = route(async (req) => {
  const task = await addTask(await body<AddTaskInput>(req));
  const warnings = await maybeSyncFrame(task.date ?? undefined);
  return json({ task, warnings }, 201);
});
