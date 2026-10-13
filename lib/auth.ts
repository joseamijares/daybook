// One secret, DAYBOOK_KEY. Agents send it as `Authorization: Bearer <key>`
// (or `?key=` for clients that can't set headers, like ChatGPT connectors);
// the browser gets it as an httpOnly cookie after signing in once.
// With no key set the app is open — fine on localhost, refused on Vercel.

import { createHash, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'daybook_session';

const digest = (s: string) => createHash('sha256').update(s).digest();

export function sameKey(given: string | null | undefined) {
  const key = process.env.DAYBOOK_KEY;
  if (!key || !given) return false;
  return timingSafeEqual(digest(given), digest(key));
}

// The cookie holds a hash of the key, not the key itself.
export const sessionValue = () => createHash('sha256').update(`daybook:${process.env.DAYBOOK_KEY}`).digest('hex');

export function authorized(req: Request): boolean {
  if (!process.env.DAYBOOK_KEY) return !process.env.VERCEL;
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Bearer ') && sameKey(header.slice(7))) return true;
  const url = new URL(req.url);
  if (sameKey(url.searchParams.get('key'))) return true;
  const cookie = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (cookie) {
    const value = cookie.slice(COOKIE.length + 1);
    const expected = sessionValue();
    return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  }
  return false;
}
