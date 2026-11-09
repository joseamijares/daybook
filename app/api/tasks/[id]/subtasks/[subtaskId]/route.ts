// PATCH  /api/tasks/:id/subtasks/:subtaskId   { title?, done? }   returns the task
// DELETE /api/tasks/:id/subtasks/:subtaskId                       returns the task
import { deleteSubtask, type SubtaskPatch, updateSubtask } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string; subtaskId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id, subtaskId } = await params;
  const { title, done } = await body<SubtaskPatch>(req);
  return json({ task: await updateSubtask(id, subtaskId, { title, done }) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id, subtaskId } = await params;
  return json({ task: await deleteSubtask(id, subtaskId) });
});
