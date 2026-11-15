// POST /api/tasks/:id/subtasks   { title } or { titles: [...] }   adds subtasks at the end, returns the task
import { addSubtasks } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { title, titles } = await body<{ title?: string; titles?: string[] }>(req);
  return json({ task: await addSubtasks(id, titles ?? (title === undefined ? [] : [title])) }, 201);
});
