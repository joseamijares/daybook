// GET /api/appearance   { style, palette, eveningNocturne }
// PUT /api/appearance   { style?: "wall" | "timetable" | "notebook", palette?: "salon" | "modern" | "nocturne", eveningNocturne?: boolean }
import { getAppearance, setAppearance } from '@/lib/appearanceStore';
import { body, json, route } from '@/lib/http';

export const GET = route(async () => json(await getAppearance()));

export const PUT = route(async (req) => json(await setAppearance(await body(req))));
