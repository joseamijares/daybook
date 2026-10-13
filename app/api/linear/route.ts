// POST /api/linear   pull open assigned issues into the backlog
import { body, json, route } from '@/lib/http';
import { linearEnabled, syncLinear } from '@/lib/linear';

export const POST = route(async (req) => {
  await body(req);
  if (!(await linearEnabled())) return json({ error: 'Linear is not connected: add your API key in Settings' }, 400);
  return json(await syncLinear());
});
