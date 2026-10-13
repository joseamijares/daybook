// Where the page lives and where its links go. Every value can be set per
// deployment; see site/.env.example.

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3218')).replace(
  /\/$/,
  '',
);

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
