import { authorized } from './auth';
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
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    if (!authorized(req)) return json({ error: 'missing or wrong key' }, 401);
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
