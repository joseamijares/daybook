import type { MetadataRoute } from 'next';

// Installed web app (Android, Samsung Galaxy, desktop Chrome/Edge). Icons come from brand/build-logo.py.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Daybook',
    short_name: 'Daybook',
    description: 'A simple daily planner with a painting of the day.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111613',
    theme_color: '#111613',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
    ],
  };
}
