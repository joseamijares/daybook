// POST /api/linear   pull open assigned issues into the backlog
import { body, json, route } from '@/lib/http';
import { linearEnabled, syncLinear } from '@/lib/linear';

export const POST = route(async (req) => {
  await body(req);
  if (!linearEnabled()) return json({ error: 'Linear is not connected: set LINEAR_API_KEY' }, 400);
  return json(await syncLinear());
});
