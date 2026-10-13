// GET /api/export   every task, day and week plus the appearance, as one JSON file (owner only)
import { exportData } from '@/lib/backup';
import { route } from '@/lib/http';

export const GET = route(
  async () =>
    new Response(JSON.stringify(await exportData(), null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="daybook-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    }),
  { owner: true },
);
