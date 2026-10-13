# Daybook

A super simple daily planner with a painting of the day. Plan the morning,
shut down in the evening, and let your AI agents do the typing.

![Today: the painting of the day beside a museum placard with your day](docs/img/today.jpg)

Daybook is a small, open-source take on [Sunsama](https://www.sunsama.com/)'s
rituals. It shares its look and its 44 public-domain paintings with
[Frame Dashboard](https://github.com/joseamijares/frame-dashboard), and the
same painting hangs in both on the same day.

- **Today.** One focus line, a short list of tasks with time estimates, and
  how much you've planned against your capacity (6 hours by default).
  Unfinished tasks roll over to the next day and remember where they started.
- **Plan the day.** Pull tasks in from the backlog and Linear, reorder them by
  dragging, and set the focus.
- **Week.** One card with a column per day, Sunsama style. Drag backlog items
  onto a day, and each day turns amber when it's over capacity.
- **Shut down.** The same painting at dusk. You see what got done, choose
  where unfinished work goes (tomorrow, the backlog, or stay), and write one
  line for the journal.
- **Agents first.** A built-in MCP server works with Claude, Cursor, Codex,
  ChatGPT, Grok and any other MCP client. It has tools for every action and
  prompts for the morning, evening and Monday rituals. There's also a REST
  API and a small CLI.
- **Linear.** Your open assigned issues land in the backlog. Finishing one in
  Daybook completes it in Linear.
- **Frame Dashboard.** Send the week to your TV with one click, or keep it
  synced automatically.

| Week | Shut down |
| --- | --- |
| ![Week: the days as columns on one card](docs/img/week.jpg) | ![Shut down: the day's painting at dusk with a recap](docs/img/shutdown.jpg) |

## Run it

```bash
pnpm install
cp .env.example .env.local      # optional locally: works with no key and stores data in .data/
pnpm dev                        # http://localhost:3000
```

The UI is in English or Spanish (`DAYBOOK_LOCALE=en|es`), and the time zone
that decides "today" is `DAYBOOK_TZ`.

## Deploy (Vercel + Upstash)

1. Import the repo in Vercel. Under *Storage → Create Database → Upstash for
   Redis* (the free plan is enough), connect it to the project. That sets
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. Set `DAYBOOK_KEY` (`openssl rand -hex 24`), `DAYBOOK_TZ`, and optionally
   `LINEAR_API_KEY`, `FRAME_DASHBOARD_URL` and `FRAME_DASHBOARD_WRITE_KEY`.
   [.env.example](.env.example) explains each one.
3. Deploy, open the site, and enter your key once in each browser you use.

Daybook refuses to run without `DAYBOOK_KEY` on Vercel. Anyone with the key
can read and change your plan, so treat it like a password.

## Connect your agents

The MCP endpoint is `https://<your-daybook>/api/mcp` (Streamable HTTP, JSON
responses). Agents authenticate with `Authorization: Bearer <DAYBOOK_KEY>`.
For clients that can't send headers, such as ChatGPT connectors, use
`?key=<DAYBOOK_KEY>` instead.

```bash
DAYBOOK_URL=https://your-daybook.vercel.app DAYBOOK_KEY=… node cli/daybook.mjs setup           # print every snippet
DAYBOOK_URL=… DAYBOOK_KEY=… node cli/daybook.mjs setup cursor codex --write                    # write configs (with backups)
```

| Client | How |
| --- | --- |
| Claude Code | `claude mcp add --transport http daybook <url>/api/mcp --header "Authorization: Bearer <key>"` |
| Cursor | `~/.cursor/mcp.json` → `{ "url": "<url>/api/mcp", "headers": { "Authorization": "Bearer <key>" } }` |
| Claude Desktop | stdio relay `node cli/daybook.mjs mcp`, or *Settings → Connectors* with the URL |
| Codex | `~/.codex/config.toml` → `[mcp_servers.daybook]` using the stdio relay |
| ChatGPT | *Developer mode → Create connector* with `<url>/api/mcp?key=<key>`, no auth |
| Grok | Grok Build: `~/.grok/config.toml` like Codex. Grok on the web / Grok Bot: a custom connector with the URL |
| Meta Llama Stack | Register a `model-context-protocol` tool group with the URL |

See [docs/agents.md](docs/agents.md) for the full setup, the tool list and the
REST API. Then ask your agent to "plan my day".

## CLI

```bash
node cli/daybook.mjs today
node cli/daybook.mjs add "Draft deck 45m #client" --date tomorrow
node cli/daybook.mjs done <id>
node cli/daybook.mjs mcp          # stdio MCP relay for clients without remote MCP
```

## Development

```bash
pnpm verify     # lint, typecheck, tests, production build
```

| Path | What |
| --- | --- |
| `app/` | The four screens (`/`, `/week`, `/backlog`, `/shutdown`) and the API under `app/api/` |
| `components/` | The salon shell, the placards, and task rows |
| `lib/daybook.ts` | The domain: tasks, days, weeks, rollover, planning, shutdown |
| `lib/mcp.ts` | The MCP server: tools, prompts, JSON-RPC |
| `lib/linear.ts`, `lib/frame.ts` | The integrations |
| `lib/store.ts` | Upstash Redis, or a JSON file locally |
| `cli/daybook.mjs` | The CLI and stdio relay (no dependencies) |

The design lives in Paper: tokens, Today, Week, Shut down and Mobile, all on
the "v2 · Salon" page. The colours in `app/globals.css` come from it.

## Art and fonts

The 44 paintings are in the public domain. They are scans from
[Wikimedia Commons](https://commons.wikimedia.org/), shared with Frame
Dashboard and resized to WebP in `public/art/`. Each painting's source page is
in `lib/art.json`, and the credit on screen links to it.
[Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and
[Geist](https://fonts.google.com/specimen/Geist) are under the SIL Open Font
License.

## License

MIT for the code.
