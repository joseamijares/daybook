// Who may use Daybook:
// - DAYBOOK_KEY, the master key: `Authorization: Bearer <key>` or `?key=`;
// - agent tokens (dbk_…) created in Settings, one per connection, revocable;
// - the browser's httpOnly session cookie, set after signing in once.
// With no DAYBOOK_KEY the app is open — fine on localhost, refused on Vercel.

import { createHash, timingSafeEqual } from 'node:crypto';
import { looksLikeToken, verifyToken } from './tokens';

export const COOKIE = 'daybook_session';

const digest = (s: string) => createHash('sha256').update(s).digest();

export function sameKey(given: string | null | undefined) {
  const key = process.env.DAYBOOK_KEY;
  if (!key || !given) return false;
  return timingSafeEqual(digest(given), digest(key));
}

// The cookie holds a hash of the key, not the key itself.
export const sessionValue = () => createHash('sha256').update(`daybook:${process.env.DAYBOOK_KEY}`).digest('hex');

function credentials(req: Request) {
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const query = new URL(req.url).searchParams.get('key');
  const cookie = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return { bearer, query, cookie: cookie ? cookie.slice(COOKIE.length + 1) : null };
}

export async function authorized(req: Request): Promise<boolean> {
  if (!process.env.DAYBOOK_KEY) return !process.env.VERCEL;
  const { bearer, query, cookie } = credentials(req);
  if (sameKey(bearer) || sameKey(query)) return true;
  if (cookie) {
    const expected = sessionValue();
    if (cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))) return true;
  }
  for (const t of [bearer, query]) if (looksLikeToken(t) && (await verifyToken(t))) return true;
  return false;
}

/** The browser session (or master key) only: managing tokens and secrets isn't for agents. */
export async function isOwner(req: Request): Promise<boolean> {
  if (!process.env.DAYBOOK_KEY) return !process.env.VERCEL;
  const { bearer, query, cookie } = credentials(req);
  if (sameKey(bearer) || sameKey(query)) return true;
  const expected = sessionValue();
  return !!cookie && cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
