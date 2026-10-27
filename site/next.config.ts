import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// The Mac app's version, for the structured data, read from its build settings
// so it can't drift from the release (empty if the file isn't there).
function macVersion() {
  try {
    const xcconfig = readFileSync(path.resolve(process.cwd(), '..', 'mac/Config/Shared.xcconfig'), 'utf8');
    return xcconfig.match(/^MARKETING_VERSION\s*=\s*(\S+)/m)?.[1] ?? '';
  } catch {
    return '';
  }
}

// The landing page. Turbopack's root is the repo root (found from the pnpm
// lockfile), so lib/art.ts is shared with the app instead of copied.
const nextConfig: NextConfig = {
  devIndicators: false,
  env: { MAC_VERSION: macVersion() },
  poweredByHeader: false,
  // Paintings are pre-sized WebP files (public/art and public/art-small) served
  // straight from the CDN, so they arrive with the entrance animation instead
  // of waiting on the on-demand image optimizer.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/.well-known/llms.txt', destination: '/llms.txt' },
      { source: '/llm.txt', destination: '/llms.txt' },
    ];
  },
};

export default nextConfig;
