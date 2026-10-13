# Security

Daybook holds your plans and, if you connect them, keys for Linear and Frame
Dashboard. Please report vulnerabilities privately through GitHub's
**Security → Report a vulnerability** on this repository, not in a public
issue.

## What to know when self-hosting

- `DAYBOOK_KEY` grants full read and write access, to the web app, the REST
  API and MCP. Generate it with `openssl rand -hex 24` and treat it like a
  password. On Vercel, Daybook refuses to run without it.
- A URL of the form `/api/mcp?key=…`, used by ChatGPT and Grok connectors,
  contains the key. Don't share it.
- `CRON_SECRET` only allows `/api/cron/sync`.
- Linear and Frame keys stay on the server and are never sent to the browser
  or to agents.
- `/api/health` is the only public route, and it returns no data.
