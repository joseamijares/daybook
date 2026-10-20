import type { NextConfig } from "next";

// The Mac app's own copy (mac/scripts/build-web.sh), or the Windows app's
// (DAYBOOK_DEVICE=windows, windows/README.md): the pages alone, as static
// files, with no server behind them. Every request is answered on the device
// (lib/localApi.ts), so the route handlers (route.ts) and the manifest stay out.
const windows = process.env.DAYBOOK_DEVICE === "windows";
const device = process.env.DAYBOOK_DEVICE === "1" || windows;

const nextConfig: NextConfig = {
  ...(device ? { output: "export" as const, distDir: windows ? ".next-windows" : ".next-device", pageExtensions: ["tsx"] } : {}),
  // The commit this build is from, as /api/health reports the live one: the page
  // compares them to show "Update" when a newer deploy is out (components/updates.tsx).
  env: {
    NEXT_PUBLIC_DAYBOOK_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || "dev",
    NEXT_PUBLIC_DAYBOOK_DEVICE: windows ? "windows" : device ? "1" : "",
  },
  // No dev badge over the painting (and none in screenshots).
  devIndicators: false,
  // Static export has no partial prerendering: the device copy builds without it.
  cacheComponents: !device,
  partialPrefetching: !device,
  // Every page renders in the browser once the session loads (components/Salon.tsx),
  // so none is asked to navigate instantly from the server.
  experimental: { instantInsights: { validationLevel: "manual-warning" } },
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
