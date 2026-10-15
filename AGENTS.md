# AGENTS.md — Daybook

A super simple, agent-friendly daily planner: a small, open-source take on Sunsama with a painting of the
day. Next.js (App Router) on Vercel, Upstash Redis, its own MCP server, and Linear and Frame Dashboard
integrations. MIT.

This file is for coding agents working **on** Daybook. To use Daybook **from** an agent (MCP, REST, CLI),
read [docs/agents.md](docs/agents.md). Humans start at [README.md](README.md).

## Map

- `lib/daybook.ts` is the domain and the only place that changes data: tasks, days, weeks, rollover,
  planning, shutdown. The REST routes (`app/api/*`), the MCP tools (`lib/mcp.ts`) and the UI all go
  through it, or through `lib/actions.ts` for operations that touch integrations.
- `lib/storage.ts` is the store interface the domain imports (no Node or browser imports, so the domain
  runs in both). `lib/store.ts` registers the server's store: Redis hashes per kind (`tasks`, `days`,
  `weeks`, `meta`), one field per record, or `.data/daybook.json` without Upstash env vars. Server entry
  points import `lib/store` (via `lib/http.ts` and `lib/mcp.ts`).
- "On this device": `lib/localStore.ts` (the store in localStorage) and `lib/localApi.ts` (the same routes
  and JSON as `app/api`, answered in the browser). `components/client.tsx` `api()` sends requests there
  when `daybook.mode` is `local`. A route the browser should answer on this device needs an entry in
  `localApi.ts` too. `components/Welcome.tsx` starts on this device (a quiet link opens a cloud Daybook with its key);
  `lib/backup.ts` is the export/import file, and `lib/copyReminder.ts` decides when Today asks for a copy.
- `lib/mcp.ts` is a hand-rolled, stateless MCP server (JSON-RPC over POST). Adding a tool means one entry
  in `tools`, using the same function the REST route uses.
- `components/` are client components. `Salon.tsx` is the shared shell (painting, nav, placard slot,
  sign-in). Each screen polls its resource every minute so agent changes show up.
- `lib/art.ts` picks the painting of the day with Frame Dashboard's rotation. Keep it in sync with
  frame-dashboard's `lib/art.js` so both show the same painting.
- `cli/daybook.mjs` must stay dependency-free; it runs straight from a clone.
- `mac/` is the SwiftUI Mac app (window = the web app in a WKWebView; menu bar popover = native, reading
  `/api/session` and `/api/week`). Mirror API shape changes in `mac/DaybookPackage/Sources/DaybookFeature/Models.swift`
  and run `swift test --package-path mac/DaybookPackage`. The window tells the page the app's version and updates
  (`window.daybookMac`, `components/mac.ts`), and only your Daybook's own page can ask it to check, or say
  it's `ready` (signed in and painted) so the window's launch scene (`LaunchScene.swift`) gives way to it.
- `components/updates.tsx` is the small "Update" mark by the Settings gear: a newer Mac app (from the window),
  or a newer deploy than the open page (its build commit, `NEXT_PUBLIC_DAYBOOK_SHA`, vs `/api/health`'s).
- Motion lives in `app/globals.css` (section "Motion") and must respect `prefers-reduced-motion`.
- `lib/secrets.ts` stores integration keys set in Settings, encrypted, and env vars win. `lib/tokens.ts` holds
  agent tokens (hashed). `lib/auth.ts`: `authorized()` accepts the master key, tokens or the session cookie;
  `isOwner()` (cookie or master key only) guards token and integration management.
- `lib/appearance.ts` (pure) and `lib/appearanceStore.ts` hold the design and palette; `components/Masthead.tsx` and
  `components/day.tsx` draw the parts that differ by design (heading, schedule, workload).
- `lib/clients.ts` is the catalog behind Settings → AI agents (steps + snippets per client). Keep it in sync with
  docs/agents.md.
- `site/` is the public landing page, a separate Next.js app (pnpm workspace) with its own Vercel project and
  Root Directory `site`. It imports `lib/art.ts` for the painting of the day; its copy lives in `site/lib/copy.ts`
  (English and Spanish), not in `lib/i18n.ts`. `pnpm verify` builds it too.
- `lib/frame.ts` is a three-way merge with Frame Dashboard (see docs/agents.md); change its rules only with a
  test in `test/frame.test.ts`.

## Rules

- Never commit to `main`. Branch, open a PR, squash-merge.
- Never read, print or commit secrets (`.env*`, provider dashboards). Env names live in `.env.example`.
- Every route checks auth through `route()` in `lib/http.ts` (or `authorized()` directly). `/api/health`
  and `GET /api/session` are the only public routes, and they must never return user data (tasks, notes, keys).
- UI strings live in `lib/i18n.ts`, in English and Spanish. No literal copy in components.
- Colours, type and spacing come from the maintainer's Paper file "DayBook" (pages "v3 · Placard",
  "v3 · Rituals", "v3 · Planning", "v3 · Palettes"; not public) through `app/globals.css`. Three designs (`data-style`: wall, timetable,
  notebook) and three palettes (`data-palette`: salon, modern, nocturne) are set on `<html>`; every colour is a
  palette variable, never a literal. Design new screens in Paper first, in all three designs (contributors
  without the file: match the existing screens, in all three designs, and say so in the PR).
- When you change a tool, a route or an env var, update `docs/agents.md`, `public/llms.txt` and
  `.env.example` in the same change.
- Run `pnpm verify` (lint, typecheck, tests, build) before opening a PR.

## Definition of done

- Behaviour, docs and the MCP tool descriptions agree.
- `pnpm verify` passes.
- Anything you couldn't verify (a real Linear workspace, a real Frame TV) is called out in the PR.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
