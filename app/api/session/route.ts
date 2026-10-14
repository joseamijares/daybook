// GET    /api/session   { cloud, authorized, needsKey, locale, today, tz, capacity, art, ... } (public: no user data)
// POST   /api/session   { key }  sign the browser in (httpOnly cookie)
// DELETE /api/session   sign out
import { connection } from 'next/server';
import { getAppearance } from '@/lib/appearanceStore';
import { artFor } from '@/lib/art';
import { authorized, COOKIE, isOwner, openWithoutKey, sameKey, sessionValue, TOKEN_COOKIE } from '@/lib/auth';
import { looksLikeToken, verifyToken } from '@/lib/tokens';
import { capacity, getDayMeta } from '@/lib/daybook';
import { frameArt, frameEnabled } from '@/lib/frame';
import { body, json } from '@/lib/http';
import { linearEnabled, linearSyncedAt } from '@/lib/linear';
import { storageKind, storageReady, store } from '@/lib/store';
import { addDays, mondayOf, today, tzName } from '@/lib/time';

export async function GET(req: Request) {
  await connection();
  const day = today();
  const sunday = addDays(mondayOf(day), 6);
  // "Cloud" works when this server can keep data and is locked with a key (or
  // is `next dev` on your own machine). A server without either still serves
  // the app, for use on this device only.
  const cloud = storageReady() && (Boolean(process.env.DAYBOOK_KEY) || openWithoutKey());
  const base = {
    cloud,
    needsKey: Boolean(process.env.DAYBOOK_KEY),
    locale: process.env.DAYBOOK_LOCALE === 'es' ? 'es' : 'en',
    today: day,
    tz: tzName(),
    capacity: capacity(),
    art: artFor(day),
    weekArt: artFor(addDays(mondayOf(day), -1)),
  };
  if (!cloud) return json({ ...base, authorized: false, owner: false, linear: false, frame: false });

  const [ok, owner, linear, frame, appearance] = await Promise.all([authorized(req), isOwner(req), linearEnabled(), frameEnabled(), getAppearance()]);
  // The Frame's paintings (so both walls match) are looked up only for a signed-in browser.
  const [tvArt, tvWeekArt] = ok ? await Promise.all([frameArt(day), frameArt(sunday)]) : [null, null];
  return json({
    ...base,
    authorized: ok,
    owner,
    storage: storageKind(),
    linear,
    frame,
    frameAutoSync: frame && process.env.FRAME_AUTO_SYNC === 'true',
    // The painting of the day: the Frame's when one is connected, so they match.
    art: tvArt ?? base.art,
    // The Week screen hangs a different one (the week's Sunday on the Frame).
    weekArt: tvWeekArt ?? base.weekArt,
    // The design and palette (no user data, so the sign-in screen wears them too).
    appearance,
    ...(ok && {
      closedToday: Boolean((await getDayMeta(day)).shutdownAt),
      linearSyncedAt: await linearSyncedAt(),
      frameSentAt: await store().get<string>('meta', 'frameSentAt'),
    }),
  });
}

export async function POST(req: Request) {
  const { key } = await body<{ key?: string }>(req);
  const secure = process.env.VERCEL ? '; Secure' : '';
  // The master key signs the browser in as the owner; an agent token (the Mac
  // app's window) signs it in for everyday use, without owner rights.
  if (sameKey(key)) {
    const res = json({ ok: true, owner: true });
    res.headers.append('Set-Cookie', `${COOKIE}=${sessionValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
    return res;
  }
  if (looksLikeToken(key) && (await verifyToken(key))) {
    const res = json({ ok: true, owner: false });
    res.headers.append('Set-Cookie', `${TOKEN_COOKIE}=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
    return res;
  }
  return json({ error: 'That key does not match DAYBOOK_KEY or an agent token' }, 401);
}

export function DELETE() {
  const res = json({ ok: true });
  res.headers.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.headers.append('Set-Cookie', `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
