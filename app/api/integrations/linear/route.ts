// GET    /api/integrations/linear            { connected, source, viewer?, syncedAt }
// PUT    /api/integrations/linear  { apiKey }  check the key with Linear, then store it encrypted
// DELETE /api/integrations/linear            forget the stored key (owner only)
import { body, json, route } from '@/lib/http';
import { linearSyncedAt, linearViewer } from '@/lib/linear';
import { secretSource, setSecret } from '@/lib/secrets';

export const GET = route(
  async () => {
    const source = await secretSource('LINEAR_API_KEY');
    const viewer = source ? await linearViewer().catch(() => null) : null;
    return json({ connected: Boolean(source), source, viewer, error: source && !viewer ? 'Linear rejected the saved key' : null, syncedAt: await linearSyncedAt() });
  },
  { owner: true },
);

export const PUT = route(
  async (req) => {
    if (process.env.LINEAR_API_KEY) return json({ error: 'LINEAR_API_KEY is set on the server; change it there' }, 400);
    const { apiKey } = await body<{ apiKey?: string }>(req);
    const key = apiKey?.trim();
    if (!key) return json({ error: 'apiKey is required' }, 400);
    const viewer = await linearViewer(key).catch(() => null);
    if (!viewer) return json({ error: 'Linear rejected that key. Create a personal API key in Linear → Settings → Security & access.' }, 400);
    await setSecret('LINEAR_API_KEY', key);
    return json({ connected: true, source: 'settings', viewer });
  },
  { owner: true },
);

export const DELETE = route(
  async () => {
    if (process.env.LINEAR_API_KEY) return json({ error: 'LINEAR_API_KEY is set on the server; remove it there' }, 400);
    await setSecret('LINEAR_API_KEY', null);
    return json({ connected: false });
  },
  { owner: true },
);
