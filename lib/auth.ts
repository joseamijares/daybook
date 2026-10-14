// Who may use Daybook:
// - DAYBOOK_KEY, the master key: `Authorization: Bearer <key>` or `?key=`;
// - agent tokens (dbk_…) created in Settings, one per connection, revocable;
// - the browser's httpOnly session cookie, set after signing in once.
// With no DAYBOOK_KEY only `next dev` is open (your own machine while you
// develop). Any other server without a key, on Vercel or anywhere else, has no
// cloud Daybook: it offers only "on this device".

import { createHash, timingSafeEqual } from 'node:crypto';
import { looksLikeToken, verifyToken } from './tokens';

export const COOKIE = 'daybook_session';
/** A browser signed in with an agent token (the Mac app's window): full use, not owner. */
export const TOKEN_COOKIE = 'daybook_token';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Compares in constant time; an unset secret matches nothing. */
export function sameSecret(given: string | null | undefined, secret: string | undefined) {
  if (!secret || !given) return false;
  return timingSafeEqual(digest(given), digest(secret));
}

export const sameKey = (given: string | null | undefined) => sameSecret(given, process.env.DAYBOOK_KEY);

/** No key and a development server: everyone is let in. */
export const openWithoutKey = () => !process.env.DAYBOOK_KEY && process.env.NODE_ENV !== 'production';

// The cookie holds a hash of the key, not the key itself.
export const sessionValue = () => createHash('sha256').update(`daybook:${process.env.DAYBOOK_KEY}`).digest('hex');

function credentials(req: Request) {
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const query = new URL(req.url).searchParams.get('key');
  const jar = (req.headers.get('cookie') || '').split(/;\s*/);
  const read = (name: string) => jar.find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
  return { bearer, query, cookie: read(COOKIE), tokenCookie: read(TOKEN_COOKIE) };
}

export async function authorized(req: Request): Promise<boolean> {
  if (!process.env.DAYBOOK_KEY) return openWithoutKey();
  const { bearer, query, cookie, tokenCookie } = credentials(req);
  if (sameKey(bearer) || sameKey(query)) return true;
  if (cookie) {
    const expected = sessionValue();
    if (cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))) return true;
  }
  for (const t of [bearer, query, tokenCookie]) if (looksLikeToken(t) && (await verifyToken(t))) return true;
  return false;
}

/** The browser session (or master key) only: managing tokens and secrets isn't for agents. */
export async function isOwner(req: Request): Promise<boolean> {
  if (!process.env.DAYBOOK_KEY) return openWithoutKey();
  const { bearer, query, cookie } = credentials(req);
  if (sameKey(bearer) || sameKey(query)) return true;
  const expected = sessionValue();
  return !!cookie && cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
