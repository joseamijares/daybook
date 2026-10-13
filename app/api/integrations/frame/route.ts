// GET    /api/integrations/frame                  { connected, source, url }
// PUT    /api/integrations/frame  { url, writeKey }  check them against the Frame, then store them encrypted
// DELETE /api/integrations/frame                  forget them (owner only)
import { checkFrame } from '@/lib/frame';
import { body, json, route } from '@/lib/http';
import { getSecret, secretSource, setSecret } from '@/lib/secrets';

const pinned = () => Boolean(process.env.FRAME_DASHBOARD_URL || process.env.FRAME_DASHBOARD_WRITE_KEY);

export const GET = route(
  async () => {
    const [urlSource, keySource] = await Promise.all([secretSource('FRAME_DASHBOARD_URL'), secretSource('FRAME_DASHBOARD_WRITE_KEY')]);
    const connected = Boolean(urlSource && keySource);
    return json({ connected, source: pinned() ? 'env' : connected ? 'settings' : null, url: connected ? await getSecret('FRAME_DASHBOARD_URL') : null });
  },
  { owner: true },
);

export const PUT = route(
  async (req) => {
    if (pinned()) return json({ error: 'The Frame is set on the server (FRAME_DASHBOARD_*); change it there' }, 400);
    const b = await body<{ url?: string; writeKey?: string }>(req);
    if (!b.url?.trim() || !b.writeKey?.trim()) return json({ error: 'url and writeKey are required' }, 400);
    let checked: { url: string };
    try {
      checked = await checkFrame(b.url.trim(), b.writeKey.trim());
    } catch (err) {
      return json({ error: `Couldn't reach that Frame with that key: ${(err as Error).message}` }, 400);
    }
    await setSecret('FRAME_DASHBOARD_URL', checked.url);
    await setSecret('FRAME_DASHBOARD_WRITE_KEY', b.writeKey.trim());
    return json({ connected: true, source: 'settings', url: checked.url });
  },
  { owner: true },
);

export const DELETE = route(
  async () => {
    if (pinned()) return json({ error: 'The Frame is set on the server; remove it there' }, 400);
    await setSecret('FRAME_DASHBOARD_URL', null);
    await setSecret('FRAME_DASHBOARD_WRITE_KEY', null);
    return json({ connected: false });
  },
  { owner: true },
);
