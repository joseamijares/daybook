// GET  /tv/api/version?k=<screen key>   { version, build }: version moves on every change to
//      the plan, build on every deploy. The TV polls it, refetches the week on a new version
//      and reloads itself on a new build.
// POST /tv/api/version                  bump the version: "refresh the screens now"
import { json, route } from '@/lib/http';
import { planVersion, store, VERSION } from '@/lib/storage';

const BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

export const GET = route(async () => json({ version: await planVersion(), build: BUILD }), { screen: true });

export const POST = route(async () => {
  const version = String(Date.now());
  await store().put('meta', VERSION, version);
  return json({ version, build: BUILD });
});
