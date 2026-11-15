// GET /tv/api/settings   { packs, enabled, layout, layouts }: the TV's art packs and design
// PUT /tv/api/settings   { packs?, layout? }: the fields sent change, the others stay
import { body, json, route } from '@/lib/http';
import { getTvSettings, setTvSettings, TV_LAYOUTS, TV_PACKS } from '@/lib/tv';

const view = (s: { packs: string[]; layout: string }) => ({ packs: TV_PACKS, enabled: s.packs, layout: s.layout, layouts: TV_LAYOUTS });

export const GET = route(async () => json(view(await getTvSettings())), { screen: true });

export const PUT = route(async (req) => json({ ok: true, ...view(await setTvSettings(await body(req))) }));
export const POST = PUT;
