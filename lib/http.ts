import { authorized, isOwner, screenAuthorized } from './auth';
import './store'; // registers the server's store for the domain
import { NotFound } from './daybook';

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

// Wraps a route handler: auth, JSON errors, 400 for bad input, 404 for missing.
// `screen` also lets the TV's read-only key in.
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>, opts: { owner?: boolean; screen?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    const allowed = opts.owner ? isOwner : opts.screen ? screenAuthorized : authorized;
    if (!(await allowed(req))) {
      return json({ error: opts.owner ? 'only the signed-in owner can change this' : 'missing or wrong key' }, 401);
    }
    try {
      return await fn(req, ctx);
    } catch (err) {
      const message = (err as Error).message || 'something went wrong';
      if (err instanceof NotFound) return json({ error: message }, 404);
      const status = /must|required|cannot|longer than|can't read|Set /.test(message) ? 400 : 500;
      if (status === 500) console.error(err);
      return json({ error: message }, status);
    }
  };
}
