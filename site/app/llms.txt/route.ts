import { AGENTS_DOC_URL, DEPLOY_URL, FILM, FRAME_URL, HOWTO, MAC_DOWNLOAD_URL, MAC_URL, REPO_URL, SITE_URL } from '@site/lib/site';

// /llms.txt (also served at /.well-known/llms.txt and /llm.txt): what Daybook
// is, for AI assistants, with absolute links.
export function GET() {
  const body = `# Daybook

> Daybook is an open-source daily planner (MIT, 2026) that hangs one of 44 public-domain paintings beside your day. It runs in the browser with no account, or as your own Vercel deployment with a Mac app, an MCP server for AI agents, Linear and Samsung Frame sync.

## About
- [Daybook](${SITE_URL}/): the landing page, in English.
- [Daybook en español](${SITE_URL}/es): the same page in Spanish.
- [Source code](${REPO_URL}): Next.js app, MCP server, CLI and Mac app, MIT licensed.
- [The video](${SITE_URL}${FILM.landscape}): Daybook in 50 seconds (MP4, silent, English on-screen text).
- [How to use Daybook for Mac](${SITE_URL}${HOWTO.src}): a 2:29 walkthrough of one day (MP4, English voice and captions).

## What it does
- Today: one focus line, meetings, and a short list of tasks with time estimates against a 6-hour day. Unfinished tasks roll over and remember where they started.
- Plan the day, the week view, and Shut down in the evening (where each open task goes, plus one line for the journal).
- The painting of the day: 44 public-domain works (Monet, Hokusai, Hiroshige, Cézanne, Renoir, Sisley, Homer, Van Gogh and more) from Wikimedia Commons, in a fixed rotation shared with Frame Dashboard.

## For agents
- [Docs for agents](${AGENTS_DOC_URL}): MCP endpoint (/api/mcp, Streamable HTTP), the tool list, prompts ("plan my day", "shut down", "plan my week"), the REST API and the CLI.
- Clients: Claude, ChatGPT, Cursor, Codex, Grok, Gemini CLI, VS Code, Windsurf and any MCP client.

## Install
- [Download Daybook for Mac](${MAC_DOWNLOAD_URL}): a 4 MB disk image for macOS 14 or later (Apple silicon and Intel), signed with a Developer ID and notarized by Apple. Drag it to Applications, open it, then enter your Daybook's address and key. It updates itself from then on.
- In a browser: open Daybook and press Start (your days stay in that browser), then install it as an app (Chrome/Edge install icon, Safari File → Add to Dock, iPhone Share → Add to Home Screen).

## Products
- [Deploy your own on Vercel](${DEPLOY_URL}): free plans of Vercel and Upstash are enough.
- [Daybook for Mac](${MAC_URL}): the app in a window and today in the menu bar (macOS 14 or later).
- [Frame Dashboard](${FRAME_URL}): the sister app for the Samsung Frame TV, with two-way sync.

## Contact
- [Issues and pull requests](${REPO_URL}/issues) on GitHub.
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
