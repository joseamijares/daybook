import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The commit this build is from, as /api/health reports the live one: the page
  // compares them to show "Update" when a newer deploy is out (components/updates.tsx).
  env: {
    NEXT_PUBLIC_DAYBOOK_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || "dev",
  },
  // No dev badge over the painting (and none in screenshots).
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
