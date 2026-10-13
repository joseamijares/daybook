# Contributing to Daybook

Thanks for helping. Daybook is meant to stay small: a focus line, a short list
of tasks, two rituals, and a painting. A change that keeps it simple is more
likely to land than one that adds a mode.

## Getting started

You need Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000, no key and no services needed
pnpm verify         # lint, typecheck, tests, production build: run before a PR
```

The Mac app:

```bash
open mac/Daybook.xcworkspace                 # macOS 14+, Xcode 16+
swift test --package-path mac/DaybookPackage
```

## Where things live

[AGENTS.md](AGENTS.md) maps the code (it's written for coding agents, but it
reads fine for people). [docs/agents.md](docs/agents.md) documents the MCP
tools and the REST API.

## Ground rules

- All data changes go through `lib/daybook.ts`. The REST routes, the MCP tools
  and the UI are thin layers over it.
- Changes to the Frame merge (`lib/frame.ts`) need a test in
  `test/frame.test.ts`.
- UI copy goes in `lib/i18n.ts`, in English and Spanish.
- Screens come in three designs and three palettes: test a UI change in each
  design (Settings → Appearance), and use palette variables, never colour
  literals. The maintainer draws new screens in a private Paper file first;
  you don't need it, just match the existing screens.
- Anything the browser does must also work "on this device": a new route the
  UI calls needs an answer in `lib/localApi.ts` too.
- Motion respects `prefers-reduced-motion`.
- If you change a tool, a route or an environment variable, update
  `docs/agents.md`, `public/llms.txt` and `.env.example` in the same PR.
- Never commit secrets or personal data. Demo data stays generic.

## Pull requests

Branch from `main` and keep PRs focused. Describe what you changed, how you
checked it, and anything you couldn't check (a real Linear workspace, a real
Frame TV). CI runs lint, types, tests, the build, and a secret scan.

## Paintings

The bundled paintings are public domain, from the Wikimedia Commons scans used
by [Frame Dashboard](https://github.com/joseamijares/frame-dashboard). Keep
`lib/art.json` in step with its rotation so both show the same painting.
