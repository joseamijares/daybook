// POST /api/import   { backup, replace? }  bring in a Daybook export (owner only).
// Merges by id; with replace: true this Daybook's tasks, days and weeks become the file's.
import { importData } from '@/lib/backup';
import { body, json, route } from '@/lib/http';

export const POST = route(
  async (req) => {
    const b = await body<{ backup?: unknown; replace?: boolean }>(req);
    return json(await importData(b.backup, b.replace ? 'replace' : 'merge'));
  },
  { owner: true },
);
