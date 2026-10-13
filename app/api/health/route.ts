// GET /api/health   public: deployed commit and which integrations are on. No data, no secrets.
import { connection } from 'next/server';
import { frameEnabled } from '@/lib/frame';
import { linearEnabled } from '@/lib/linear';
import { storageKind } from '@/lib/store';

export async function GET() {
  await connection();
  return Response.json(
    {
      ok: true,
      sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || 'dev',
      storage: storageKind(),
      linear: await linearEnabled(),
      frame: await frameEnabled(),
      mcp: '/api/mcp',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
