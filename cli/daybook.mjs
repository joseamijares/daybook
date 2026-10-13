#!/usr/bin/env node
// Daybook CLI. Zero dependencies, Node 18+.
//
//   daybook mcp                      stdio MCP server that relays to your Daybook (for clients without remote MCP)
//   daybook setup [client] [--write] print (or write) the MCP config for Claude, Cursor, Codex, Grok, ChatGPT…
//   daybook today | week | backlog   read your plan
//   daybook add "Draft deck 45m #client" [--date tomorrow]
//   daybook done <id>
//
// Reads DAYBOOK_URL (default http://localhost:3000) and DAYBOOK_KEY from the environment.

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const URL_ = (process.env.DAYBOOK_URL || 'http://localhost:3000').replace(/\/+$/, '');
const KEY = process.env.DAYBOOK_KEY || '';
const SELF = fileURLToPath(import.meta.url);
const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...(KEY && { Authorization: `Bearer ${KEY}` }) };

async function call(method, route, body) {
  const res = await fetch(`${URL_}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

// ---- stdio ↔ HTTP relay -----------------------------------------------------
// Newline-delimited JSON-RPC on stdin/stdout (the MCP stdio transport). Each
// message is POSTed to /api/mcp; replies go back on stdout. Logs go to stderr.
function relay() {
  const rl = createInterface({ input: process.stdin });
  const out = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  let pending = Promise.resolve();
  rl.on('line', (line) => {
    if (!line.trim()) return;
    pending = pending.then(async () => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }
      try {
        const res = await fetch(`${URL_}/api/mcp`, { method: 'POST', headers, body: line });
        if (res.status === 202 || res.status === 204) return;
        const text = await res.text();
        if (!text) return;
        const reply = JSON.parse(text);
        for (const r of Array.isArray(reply) ? reply : [reply]) out(r);
      } catch (err) {
        if (msg && msg.id !== undefined && msg.id !== null) {
          out({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: `Daybook at ${URL_} is not reachable: ${err.message}` } });
        }
        process.stderr.write(`daybook: ${err.message}\n`);
      }
    });
  });
  rl.on('close', () => pending.then(() => process.exit(0)));
}

// ---- setup ------------------------------------------------------------------
const home = homedir();
const mcpUrl = `${URL_}/api/mcp`;
const stdio = { command: 'node', args: [SELF, 'mcp'], env: { DAYBOOK_URL: URL_, DAYBOOK_KEY: KEY || '<your DAYBOOK_KEY>' } };
const keyOrPlaceholder = KEY || '<your DAYBOOK_KEY>';
const claudeDesktopPath =
  platform() === 'darwin'
    ? path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json')
    : platform() === 'win32'
      ? path.join(process.env.APPDATA || home, 'Claude/claude_desktop_config.json')
      : path.join(home, '.config/Claude/claude_desktop_config.json');

const toml = (env) =>
  `[mcp_servers.daybook]\ncommand = "node"\nargs = [${JSON.stringify(SELF)}, "mcp"]\nstartup_timeout_sec = 30\n\n[mcp_servers.daybook.env]\n${Object.entries(env)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
    .join('\n')}\n`;

const CLIENTS = {
  'claude-code': {
    name: 'Claude Code',
    how: `Run:\n  claude mcp add --transport http daybook ${mcpUrl} --header "Authorization: Bearer ${keyOrPlaceholder}" --scope user`,
  },
  cursor: {
    name: 'Cursor',
    file: path.join(home, '.cursor/mcp.json'),
    json: { url: mcpUrl, headers: { Authorization: `Bearer ${keyOrPlaceholder}` } },
  },
  'claude-desktop': {
    name: 'Claude Desktop',
    file: claudeDesktopPath,
    json: stdio,
    note: 'Or, with a public HTTPS deployment: Settings → Connectors → Add custom connector → the ChatGPT URL below.',
  },
  codex: {
    name: 'Codex (ChatGPT’s coding agent)',
    file: path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'config.toml'),
    toml: toml(stdio.env),
  },
  grok: {
    name: 'Grok Build',
    file: path.join(process.env.GROK_HOME || path.join(home, '.grok'), 'config.toml'),
    toml: toml(stdio.env),
    note: 'Grok on the web / Grok Bot: add a custom MCP connector with the remote URL shown for ChatGPT.',
  },
  chatgpt: {
    name: 'ChatGPT (web and desktop)',
    how: `Needs a public HTTPS deployment. Settings → Apps & Connectors → Advanced → Developer mode on → Create:\n  URL: ${mcpUrl}?key=${keyOrPlaceholder}\n  Authentication: none (the key is in the URL — treat that URL like a password)`,
  },
  meta: {
    name: 'Meta Llama Stack',
    how: `Register Daybook as an MCP tool group (Python):\n  client.toolgroups.register(toolgroup_id="mcp::daybook", provider_id="model-context-protocol",\n      mcp_endpoint={"uri": "${mcpUrl}?key=${keyOrPlaceholder}"})`,
  },
};

function writeConfig(id, c) {
  mkdirSync(path.dirname(c.file), { recursive: true });
  if (existsSync(c.file)) copyFileSync(c.file, `${c.file}.daybook.bak`);
  if (c.json) {
    const current = existsSync(c.file) ? JSON.parse(readFileSync(c.file, 'utf8') || '{}') : {};
    current.mcpServers = { ...(current.mcpServers || {}), daybook: c.json };
    writeFileSync(c.file, `${JSON.stringify(current, null, 2)}\n`);
  } else {
    const current = existsSync(c.file) ? readFileSync(c.file, 'utf8') : '';
    if (/^\[mcp_servers\.daybook\]/m.test(current)) {
      console.log(`  ${c.file} already has [mcp_servers.daybook]; left it alone.`);
      return;
    }
    writeFileSync(c.file, `${current.replace(/\s*$/, current ? '\n\n' : '')}${c.toml}`);
  }
  console.log(`  wrote ${c.file}${existsSync(`${c.file}.daybook.bak`) ? ` (backup: ${path.basename(c.file)}.daybook.bak)` : ''}`);
}

function setup(args) {
  const write = args.includes('--write');
  const pick = args.filter((a) => !a.startsWith('--'));
  const ids = pick.length && pick[0] !== 'all' ? pick : Object.keys(CLIENTS);
  if (!KEY) console.log('Tip: set DAYBOOK_KEY (and DAYBOOK_URL) first so the snippets are complete.\n');
  for (const id of ids) {
    const c = CLIENTS[id];
    if (!c) {
      console.log(`Unknown client "${id}". One of: ${Object.keys(CLIENTS).join(', ')}`);
      continue;
    }
    console.log(`\n${c.name}`);
    if (c.how) console.log(c.how);
    if (c.file) {
      if (write) writeConfig(id, c);
      else console.log(`Add to ${c.file}:\n${c.json ? JSON.stringify({ mcpServers: { daybook: c.json } }, null, 2) : c.toml}`);
    }
    if (c.note) console.log(c.note);
  }
  if (!write) console.log('\nRun with --write to merge these into the config files (a .daybook.bak backup is kept). The files will contain your key.');
}

// ---- plain commands -----------------------------------------------------------
const fmt = (t) => `${t.done ? '✓' : '○'} ${t.title}${t.estimate ? `  ${t.estimate}m` : ''}${t.source ? `  ${t.source.key}` : t.tag ? `  #${t.tag}` : ''}  [${t.id}]`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest.splice(i, 2)[1] : undefined;
  };
  switch (cmd) {
    case 'mcp':
      return relay();
    case 'setup':
      return setup(rest);
    case 'today':
    case undefined: {
      const d = await call('GET', '/api/day');
      console.log(`${d.date}${d.focus ? ` — ${d.focus}` : ''}\n${d.tasks.map(fmt).join('\n') || '(nothing planned)'}`);
      return;
    }
    case 'week': {
      const w = await call('GET', '/api/week');
      console.log(`Week of ${w.weekOf}${w.focus ? ` — ${w.focus}` : ''}`);
      for (const d of w.days) if (d.tasks.length || d.focus) console.log(`\n${d.date}${d.focus ? ` — ${d.focus}` : ''}\n${d.tasks.map(fmt).join('\n')}`);
      return;
    }
    case 'backlog': {
      const b = await call('GET', '/api/tasks');
      console.log(b.backlog.map(fmt).join('\n') || '(empty)');
      return;
    }
    case 'add': {
      const date = flag('date');
      const r = await call('POST', '/api/tasks', { text: rest.join(' '), ...(date && { date }) });
      console.log(`added ${fmt(r.task)}`);
      return;
    }
    case 'done': {
      const r = await call('PATCH', `/api/tasks/${rest[0]}`, { done: true });
      console.log(fmt(r.task));
      for (const w of r.warnings || []) console.log(`! ${w}`);
      return;
    }
    default:
      console.log(readFileSync(SELF, 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
}

main().catch((err) => {
  console.error(`daybook: ${err.message}`);
  process.exit(1);
});
