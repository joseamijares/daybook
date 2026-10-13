# Daybook site

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
| `lib/hang.ts` | Where each work hangs, on a 1440 × 960 wall and a 390 × 520 phone wall |
| `lib/copy.ts` | Every word, in English and Spanish |
| `components/Motion.tsx` | Reveal on scroll, the Frame room's day-to-night, pointer parallax |
| `app/site.css` | Palette, layout and motion (the app's `light-up`, `settle`, `drift`, `rise`) |
| `scripts/sync-art.mjs` | Copies the 44 paintings from `../public/art` before `dev` and `build` |
| `art/` | Provenance of the one generated image |

The page is prerendered with the build day's painting and switches to the
visitor's own date in the browser, while the lamp comes on. Every animation
respects `prefers-reduced-motion`.

## Deploy

A Vercel project with **Root Directory `site`** (framework Next.js; Vercel runs the
pnpm install at the repo root). Environment variables are in `.env.example`.
