// GET    /api/session   { authorized, needsKey, locale, linear, frame, today }
// POST   /api/session   { key }  sign the browser in (httpOnly cookie)
// DELETE /api/session   sign out
import { connection } from 'next/server';
import { artFor } from '@/lib/art';
import { authorized, COOKIE, isOwner, sameKey, sessionValue, TOKEN_COOKIE } from '@/lib/auth';
import { looksLikeToken, verifyToken } from '@/lib/tokens';
import { capacity } from '@/lib/daybook';
import { frameEnabled } from '@/lib/frame';
import { body, json } from '@/lib/http';
import { linearEnabled, linearSyncedAt } from '@/lib/linear';
import { storageKind, store } from '@/lib/store';
import { today, tzName } from '@/lib/time';

export async function GET(req: Request) {
  await connection();
  const [ok, owner, linear, frame] = await Promise.all([authorized(req), isOwner(req), linearEnabled(), frameEnabled()]);
  return json({
    authorized: ok,
    needsKey: Boolean(process.env.DAYBOOK_KEY),
    misconfigured: !process.env.DAYBOOK_KEY && Boolean(process.env.VERCEL),
    locale: process.env.DAYBOOK_LOCALE === 'es' ? 'es' : 'en',
    today: today(),
    tz: tzName(),
    capacity: capacity(),
    owner,
    storage: storageKind(),
    linear,
    frame,
    frameAutoSync: frame && process.env.FRAME_AUTO_SYNC === 'true',
    art: artFor(today()),
    ...(ok && {
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
