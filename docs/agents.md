# Daybook for agents

Daybook has three surfaces that agents can use. They all call the same functions
in `lib/daybook.ts`, so they behave the same way.

- **MCP** at `/api/mcp`. Streamable HTTP and stateless: each POST carries one
  JSON-RPC message (or a batch) and gets a JSON reply, with no SSE stream.
  Protocol versions 2024-11-05 through 2025-11-25 are supported.
- **REST** under `/api/*`, in JSON.
- **CLI**: `node cli/daybook.mjs`. It has no dependencies and includes a
  stdio MCP relay.

## Authentication

There is one secret, `DAYBOOK_KEY`. Send it in one of these ways:

- `Authorization: Bearer <key>`, the preferred way;
- `?key=<key>`, for clients that can't set headers. The URL then works like a
  password, so don't paste it anywhere public;
- the browser's httpOnly session cookie, which is set after signing in once.

If `DAYBOOK_KEY` is unset, the API is open. That's fine on localhost; on
Vercel the app refuses to run that way.

## Client setup

`node cli/daybook.mjs setup` prints every snippet below, filled in with
`DAYBOOK_URL` and `DAYBOOK_KEY`. Add `--write` to merge them into the config
files. The original is kept as `<file>.daybook.bak`, and the config files end
up containing your key.

### Claude Code

```bash
claude mcp add --transport http daybook https://your-daybook.vercel.app/api/mcp \
  --header "Authorization: Bearer $DAYBOOK_KEY" --scope user
```

### Cursor (`~/.cursor/mcp.json`)

```json
{ "mcpServers": { "daybook": { "url": "https://your-daybook.vercel.app/api/mcp", "headers": { "Authorization": "Bearer <key>" } } } }
```

### Claude Desktop

You can add a remote connector (*Settings → Connectors → Add custom connector*
→ `https://your-daybook.vercel.app/api/mcp?key=<key>`) or use the stdio relay
in `claude_desktop_config.json`:

```json
{ "mcpServers": { "daybook": { "command": "node", "args": ["/path/to/daybook/cli/daybook.mjs", "mcp"],
  "env": { "DAYBOOK_URL": "https://your-daybook.vercel.app", "DAYBOOK_KEY": "<key>" } } } }
```

### Codex (`~/.codex/config.toml`) and Grok Build (`~/.grok/config.toml`)

```toml
[mcp_servers.daybook]
command = "node"
args = ["/path/to/daybook/cli/daybook.mjs", "mcp"]
startup_timeout_sec = 30

[mcp_servers.daybook.env]
DAYBOOK_URL = "https://your-daybook.vercel.app"
DAYBOOK_KEY = "<key>"
```

### ChatGPT (web and desktop)

You need a public HTTPS deployment. Go to *Settings → Apps & Connectors →
Advanced → Developer mode*, then *Create*:

- URL: `https://your-daybook.vercel.app/api/mcp?key=<key>`
- Authentication: none (the key is in the URL)

### Grok on the web, and Grok Bot

Add a custom MCP connector with the same URL as for ChatGPT.

### Meta Llama Stack

```python
client.toolgroups.register(
    toolgroup_id="mcp::daybook",
    provider_id="model-context-protocol",
    mcp_endpoint={"uri": "https://your-daybook.vercel.app/api/mcp?key=<key>"},
)
```

### Any other MCP client

Point it at `https://your-daybook.vercel.app/api/mcp` with the bearer header.
If the client only speaks stdio, run `node cli/daybook.mjs mcp` with
`DAYBOOK_URL` and `DAYBOOK_KEY` set.

## Tools

| Tool | What it does |
| --- | --- |
| `get_today` | A day (default today): focus, tasks, planned vs capacity, meetings (from Frame), journal, shut down or not |
| `get_week` | The week: its focus, every day, and the backlog |
| `list_backlog` | Unscheduled tasks, including Linear issues |
| `add_task` | Add to a day or the backlog. The title can use quick-add: `"Draft deck 45m #client"` |
| `update_task` | Change the title, estimate, tag or notes, or move the task (`date: "backlog"` unschedules it) |
| `complete_task` | Mark done or undone. For a Linear-linked task, this completes the issue too |
| `delete_task` | Delete a task (agents are told to ask first) |
| `set_focus` | The focus line for a day, or for the week with `scope: "week"` |
| `plan_day` | Put these task ids on the day in this order and set the focus. Warns when the day is over capacity |
| `shutdown_day` | Unfinished tasks go to tomorrow, the backlog, or stay; saves the journal line; returns a one-line recap |
| `sync_linear` | Pull open assigned Linear issues into the backlog. Listed only when `LINEAR_API_KEY` is set |
| `send_to_frame` | Two-way sync with Frame Dashboard: pull what changed there, merge, push. Listed only when the Frame settings are set |
| `frame_design` | Get the TV's design, or switch it: `bleed` (painting by day, salon at night), `salon` (framed on the wall all day), `painting` (full screen day and night) |

Dates accept `today`, `tomorrow`, a weekday name, `YYYY-MM-DD` or `backlog`.
The configured `DAYBOOK_TZ` decides what "today" means, not the agent's clock.

## Prompts

These are the rituals, packaged as MCP prompts. They show up as slash commands
in clients that support prompts.

- `plan_my_day`: review what rolled over, sync Linear, propose a focus and
  tasks that fit capacity, then plan once you say yes.
- `shut_down`: read back the day, decide where each unfinished task goes,
  write one journal line, then shut down.
- `plan_my_week`: set a week focus, then a focus and tasks for each weekday,
  and offer to send the week to the Frame.

## REST

| Method and path | Body / query |
| --- | --- |
| `GET /api/day?date=` | The day. Unfinished tasks from past days roll into today |
| `PUT /api/day` | `{ date, focus?, note? }` |
| `GET /api/week?date=` | The week containing `date`, with the backlog and, when Frame is connected, `events` by day |
| `PUT /api/week` | `{ date, focus }` |
| `GET /api/tasks` | The backlog |
| `POST /api/tasks` | `{ text }` (quick-add) or `{ title, date?, estimate?, tag?, notes? }` |
| `PATCH /api/tasks/:id` | `{ title?, date?, estimate?, tag?, notes?, done?, order? }` |
| `DELETE /api/tasks/:id` | Deletes the task |
| `POST /api/shutdown` | `{ date?, note?, carry?: { [id]: "tomorrow" \| "backlog" \| "keep" } }` |
| `POST /api/linear` | Sync Linear |
| `GET /api/frame?date=` / `POST /api/frame` | Preview the Frame Dashboard plan, or run a two-way sync |
| `GET /api/frame/settings` / `PUT /api/frame/settings` | The Frame's design and the designs it offers / `{ layout }` to switch |
| `GET /api/health` | Public: commit, storage and which integrations are on |

## Frame Dashboard

Daybook syncs the week with Frame Dashboard in both directions, so the TV and
its Mac app, Frame Desk, stay in step with Daybook. A sync (`POST /api/frame`,
the `send_to_frame` tool, the web app's "Sync with Frame" button, or the
Daybook Mac app every two minutes) has three steps:

1. **Pull** Frame's plan for the week (`GET /api/plan`).
2. **Merge** it with Daybook. The base is the plan Daybook pushed last time.
   Tasks match by text within their day.
   - A to-do ticked or unticked on Frame applies to Daybook, unless Daybook
     changed it too; then Daybook wins.
   - A to-do added on Frame is added to Daybook.
   - A to-do removed on Frame moves to Daybook's backlog. It is never deleted.
   - A focus edited on Frame applies, unless Daybook edited it too.
   - On the first sync there's no base yet: Frame's to-dos that Daybook lacks
     are imported, and done only goes from false to true.
3. **Push** the merged week (`PUT /api/plan`):
   - a Monday `weekOf`;
   - for each day with a focus or tasks, that day's focus and up to 20 tasks
     (unfinished first), each `{ text, done, tag }`;
   - texts of 200 characters at most.

   The tag is the Linear key when there is one. Frame's own per-day notes are
   kept.

Set `FRAME_AUTO_SYNC=true` to sync after every change, once the response has
been sent. Meetings stay in Frame's calendar feeds and are never copied into
the plan. Daybook reads them from Frame's `/api/week` and shows them on Today.
