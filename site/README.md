# Daybook site

Live at **https://daybooksalon.vercel.app** (Vercel project `daybook-site`).

The public landing page for Daybook: the salon hang. The painting of the day hangs
in a gilt frame under a picture lamp among the collection, with Daybook's own wall
label beside it. It is a separate Next.js app in this repo with its own Vercel
project, so the app can stay `noindex` while this page is indexed.

Design: the Paper file "DayBook", page "v4 · Site", artboard "C · The Salon Hang"
(desktop and mobile).

```bash
pnpm install                 # from the repo root (pnpm workspace)
pnpm site:dev                # http://localhost:3218
pnpm site:verify             # typecheck + production build
```

| Path | What |
| --- | --- |
| `app/(en)`, `app/(es)/es` | `/` and `/es`, each with its own root layout so `<html lang>` is right |
| `components/SalonHang.tsx` | The hero wall. Today's painting comes from the app's rotation (`lib/art.ts`) |
| `components/Film.tsx` | The video: the play button in today's frame, its lightbox, and the screening room under the hero |
| `public/film/` | The video for the web (see below) and its posters |
| `lib/hang.ts` | Where each work hangs, on a 1440 × 960 wall and a 390 × 520 phone wall |
| `lib/copy.ts` | Every word, in English and Spanish |
| `components/Motion.tsx` | Reveal on scroll, the Frame room's day-to-night, pointer parallax |
| `app/site.css` | Palette, layout and motion (the app's `light-up`, `settle`, `drift`, `rise`) |
| `scripts/sync-art.mjs` | Copies the 44 paintings from `../public/art` before `dev` and `build` |
| `scripts/make-thumbs.sh` | Makes `public/art-small` (longest side 640px) for the wall and ledges. Re-run when the collection changes |
| `art/` | Provenance of the one generated image |

The page is prerendered with the build day's painting and switches to the
visitor's own date in the browser, while the lamp comes on. Every animation
respects `prefers-reduced-motion`.

Images are served as static files (`images.unoptimized`): the full scans for the
painting of the day, the small copies for everything hung around it. The on-demand
optimizer made a cold first visit wait seconds for the wall.

## The video

`public/film/` holds web encodes of the Daybook showcase (49.5 s, silent), made in
`jamak-launch-videos` (JAM-4347): `DaybookShowcase16x9` and `DaybookShowcase9x16`.
The current cut is v3 (2026-10-15): it shows the one-Start welcome and ends on
this page. Re-encode from those renders when the video changes, and move
`FILM.published` in `lib/site.ts` to the new date:

```bash
ffmpeg -i daybook-16x9.mp4 -an -c:v libx264 -preset slow -tune animation -crf 23 \
  -maxrate 2500k -bufsize 5000k -pix_fmt yuv420p -movflags +faststart public/film/daybook-film.mp4
ffmpeg -i daybook-9x16.mp4 -an -vf scale=720:1280:flags=lanczos -c:v libx264 -preset slow \
  -tune animation -crf 23 -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -movflags +faststart \
  public/film/daybook-film-9x16.mp4
```

The posters are frame 470 ("02 · Today") of each cut, as WebP.

## Deploy

A Vercel project with **Root Directory `site`** (framework Next.js; Vercel runs the
pnpm install at the repo root). Environment variables are in `.env.example`.
