// Where the page lives and where its links go. Every value can be set per
// deployment; see site/.env.example.

// The page lives under /daybook (joseamijares.com/daybook, proxied there by the
// portfolio's vercel.json). BASE_PATH is also next.config's basePath.
import { BASE_PATH } from './base';

export { BASE_PATH };

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// The origin alone (NEXT_PUBLIC_SITE_URL is an origin, no path).
export const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3218')).replace(/\/+$/, '');

// The page's own URL: canonical links, hreflang, the sitemap and llms.txt.
export const SITE_URL = `${ORIGIN}${BASE_PATH}`;

// A file in public/ as the browser asks for it. basePath covers next/link and
// Next's own assets, not <img>, <video> or next/image sources.
export const asset = (path: string) => `${BASE_PATH}${path}`;

export const REPO_URL = 'https://github.com/joseamijares/daybook';
export const DEPLOY_URL = 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjoseamijares%2Fdaybook';
export const FRAME_URL = 'https://github.com/joseamijares/frame-dashboard';
export const AGENTS_DOC_URL = `${REPO_URL}/blob/main/docs/agents.md`;
export const MAC_URL = `${REPO_URL}/tree/main/mac`;

// The Mac app's disk image: the latest GitHub release (mac/scripts/package-dmg.sh builds it).
export const MAC_DOWNLOAD_URL = process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL || `${REPO_URL}/releases/latest/download/Daybook.dmg`;

// A public Daybook to open "on this device". Without one, the page leads with
// "Deploy your own" instead of a button that goes nowhere.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null;

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null;
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || null;

// The 50-second video (made in jamak-launch-videos, JAM-4347; v3 2026-10-15): silent, so it
// can play muted inline. Phones in portrait get the 9:16 cut.
export const FILM = {
  landscape: asset('/film/daybook-film.mp4'),
  portrait: asset('/film/daybook-film-9x16.mp4'),
  poster: asset('/film/poster.webp'),
  posterPortrait: asset('/film/poster-9x16.webp'),
  portraitMedia: '(max-width: 700px) and (orientation: portrait)',
  duration: 'PT50S',
  published: '2026-10-15T12:00:00-06:00',
};

// The how-to walkthrough (jamak-launch-videos daybook-howto, JAM-4363): 16:9, with a voice (English) and burned-in
// captions. The app streams this same file from the site (components/Walkthrough.tsx).
export const HOWTO = {
  src: asset('/film/daybook-howto.mp4'),
  poster: asset('/film/howto-poster.webp'),
  duration: 'PT2M29S',
  published: '2026-10-20T12:00:00-06:00',
};
