// POST /api/shutdown   { date?, note?, carry?: { [taskId]: "tomorrow" | "backlog" | "keep" } }
import { maybeSyncFrame } from '@/lib/actions';
import { type Carry, shutdown } from '@/lib/daybook';
import { body, json, route } from '@/lib/http';

export const POST = route(async (req) => {
  const b = await body<{ date?: string; note?: string; carry?: Record<string, Carry> }>(req);
  const result = await shutdown(b.date, { note: b.note, carry: b.carry });
  return json({ ...result, warnings: await maybeSyncFrame(result.date) });
});
