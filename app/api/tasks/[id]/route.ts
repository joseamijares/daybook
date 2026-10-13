// PATCH  /api/tasks/:id   { title?, date? ("backlog", "tomorrow", YYYY-MM-DD), estimate?, tag?, notes?, done?, order? }
// DELETE /api/tasks/:id
import { maybeSyncFrame, patchTask } from '@/lib/actions';
import { deleteTask, type TaskPatch } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { result, warnings } = await patchTask(id, await body<TaskPatch>(req));
  return json({ task: result, warnings: [...warnings, ...(await maybeSyncFrame(result.date ?? undefined))] });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await deleteTask(id);
  return json({ deleted: id });
});
