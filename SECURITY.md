# Security

Daybook holds your plans and, if you connect them, keys for Linear and Frame
Dashboard. Please report vulnerabilities privately through GitHub's
**Security → Report a vulnerability** on this repository, not in a public
issue.

## What to know when self-hosting

- `DAYBOOK_KEY` grants full read and write access, to the web app, the REST
  API and MCP. Generate it with `openssl rand -hex 24` and treat it like a
  password. On Vercel, a cloud Daybook needs it: without it (or without
  Upstash) the deploy only serves "on this device", and the server keeps no
  data.
- A URL of the form `/api/mcp?key=…`, used by ChatGPT and Grok connectors,
  contains the key. Don't share it.
- `CRON_SECRET` only allows `/api/cron/sync`.
- Linear and Frame keys stay on the server and are never sent to the browser
  or to agents.
- Two routes answer without a key, and neither returns tasks, notes or keys:
  `/api/health` (commit, storage kind, which integrations are on) and
  `/api/session` (whether this server has a cloud Daybook, today's date, time
  zone, capacity, the painting and the appearance, so the sign-in screen can
  be drawn).
- "On this device" keeps everything in the browser's localStorage. The server
  never sees it; anyone with access to that browser profile does.
- `/api/export` and `/api/import` are owner only (the master key's cookie),
  not available to agent tokens.
