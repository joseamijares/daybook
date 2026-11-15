// GET /tv/api/plan?week=YYYY-MM-DD   the week as one Frame Dashboard plan document
// PUT /tv/api/plan                   Frame Desk saves a whole week: what it changed applies to
//                                    Daybook (ticks, new or removed to-dos, focus lines)
import { body, json, route } from '@/lib/http';
import { saveTvPlan, tvPlan } from '@/lib/tv';

export const GET = route(async (req) => json(await tvPlan(new URL(req.url).searchParams.get('week') || undefined)));

export const PUT = route(async (req) => json(await saveTvPlan(await body(req))));
export const POST = PUT;
