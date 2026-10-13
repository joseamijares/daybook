// GET /api/frame/settings          the Frame's design and the designs it offers
// PUT /api/frame/settings  { layout } switch the Frame's design ("bleed", "salon", "painting")
import { frameEnabled, frameSettings, setFrameDesign } from '@/lib/frame';
import { body, json, route } from '@/lib/http';

const off = () => json({ error: 'Set FRAME_DASHBOARD_URL and FRAME_DASHBOARD_WRITE_KEY to connect your Frame' }, 400);

export const GET = route(async () => (frameEnabled() ? json(await frameSettings()) : off()));

export const PUT = route(async (req) => {
  if (!frameEnabled()) return off();
  const { layout } = await body<{ layout?: string }>(req);
  if (!layout) return json({ error: 'layout is required' }, 400);
  return json(await setFrameDesign(layout));
});
