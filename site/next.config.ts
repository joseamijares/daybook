import type { NextConfig } from 'next';

// The landing page. Turbopack's root is the repo root (found from the pnpm
// lockfile), so lib/art.ts is shared with the app instead of copied.
const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Paintings are pre-sized WebP files (public/art and public/art-small) served
  // straight from the CDN, so they arrive with the entrance animation instead
  // of waiting on the on-demand image optimizer.
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/.well-known/llms.txt', destination: '/llms.txt' },
      { source: '/llm.txt', destination: '/llms.txt' },
    ];
  },
};

export default nextConfig;
