// GET /api/cron/sync   Vercel Cron: sync with Frame Dashboard and Linear on a
// schedule, so the TV stays current even when no Mac app or browser is open.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; DAYBOOK_KEY works too.
import { sameKey } from '@/lib/auth';
import { frameEnabled, syncFrame } from '@/lib/frame';
import { json } from '@/lib/http';
import { linearEnabled, syncLinear } from '@/lib/linear';

export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const secret = process.env.CRON_SECRET;
  if (!(secret && token === secret) && !sameKey(token)) return json({ error: 'missing or wrong secret' }, 401);
  const result: Record<string, unknown> = {};
  if (linearEnabled()) result.linear = await syncLinear().catch((e: Error) => ({ error: e.message }));
  if (frameEnabled()) result.frame = await syncFrame().catch((e: Error) => ({ error: e.message }));
  return json({ ok: true, ...result });
}
