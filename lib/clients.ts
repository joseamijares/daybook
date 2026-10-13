// How to connect each AI client to Daybook's MCP server. Pure data: the
// Settings page renders it with the server's URL and a fresh agent token.
// Cloud apps (ChatGPT, Claude.ai, Grok) reach Daybook from their servers, so
// they need a public HTTPS deployment; local apps can use localhost.

import type { Locale } from './i18n';

export interface Snippet {
  kind: 'link' | 'command' | 'json' | 'toml' | 'url' | 'python';
  label: string;
  value: string;
  href?: string; // for one-click install links
}

export interface Client {
  id: string;
  name: string;
  where: 'cloud' | 'local';
  tagline: Record<Locale, string>;
  steps: Record<Locale, string[]>;
  snippets: (mcpUrl: string, token: string) => Snippet[];
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const withKey = (mcpUrl: string, token: string) => `${mcpUrl}?key=${token}`;
const b64 = (s: string) => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64'));
// For clients that only start local (stdio) servers: mcp-remote bridges to Daybook's URL.
const remote = (mcpUrl: string, token: string) => ({ command: 'npx', args: ['-y', 'mcp-remote', mcpUrl, '--header', `Authorization: Bearer ${token}`] });

export const CLIENTS: Client[] = [
  {
    id: 'mac',
    name: 'Daybook for Mac',
    where: 'local',
    tagline: { en: 'The Mac app', es: 'La app de Mac' },
    steps: {
      en: ['Open the Mac app → Settings.', 'Daybook URL: this site’s address. Key: the token below.', 'Save. The window and the menu bar fill in.'],
      es: ['Abre la app de Mac → Settings.', 'Daybook URL: la dirección de este sitio. Key: el token de abajo.', 'Guarda. La ventana y la barra de menús se llenan.'],
    },
    snippets: (u, t) => [
      { kind: 'url', label: 'Daybook URL', value: u.replace(/\/api\/mcp$/, '') },
      { kind: 'command', label: 'Key', value: t },
    ],
  },
  {
    id: 'claude',
    name: 'Claude',
    where: 'cloud',
    tagline: { en: 'Claude.ai and the Claude apps', es: 'Claude.ai y las apps de Claude' },
    steps: {
      en: ['Open Settings → Connectors → Add custom connector.', 'Name it Daybook and paste the URL below.', 'Start a chat and ask: “plan my day”.'],
      es: ['Abre Settings → Connectors → Add custom connector.', 'Ponle Daybook y pega la URL de abajo.', 'Abre un chat y pide: “planea mi día”.'],
    },
    snippets: (u, t) => [
      { kind: 'url', label: 'Connector URL', value: withKey(u, t) },
      { kind: 'json', label: 'Or Claude Desktop config (claude_desktop_config.json)', value: JSON.stringify({ mcpServers: { daybook: remote(u, t) } }, null, 2) },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    where: 'cloud',
    tagline: { en: 'Web and desktop, developer mode', es: 'Web y escritorio, modo desarrollador' },
    steps: {
      en: ['Settings → Apps & Connectors → Advanced → turn on Developer mode.', 'Create a connector: name Daybook, paste the URL, authentication None.', 'In a chat, enable Daybook from the tools menu.'],
      es: ['Settings → Apps & Connectors → Advanced → activa Developer mode.', 'Crea un conector: nombre Daybook, pega la URL, autenticación None.', 'En un chat, activa Daybook desde el menú de herramientas.'],
    },
    snippets: (u, t) => [{ kind: 'url', label: 'MCP server URL', value: withKey(u, t) }],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    where: 'local',
    tagline: { en: 'One click', es: 'Un clic' },
    steps: {
      en: ['Click “Add to Cursor” and confirm.', 'Or paste the JSON into ~/.cursor/mcp.json.'],
      es: ['Haz clic en “Add to Cursor” y confirma.', 'O pega el JSON en ~/.cursor/mcp.json.'],
    },
    snippets: (u, t) => {
      const config = { url: u, headers: auth(t) };
      return [
        { kind: 'link', label: 'Add to Cursor', value: 'Add to Cursor', href: `cursor://anysphere.cursor-deeplink/mcp/install?name=daybook&config=${encodeURIComponent(b64(JSON.stringify(config)))}` },
        { kind: 'json', label: '~/.cursor/mcp.json', value: JSON.stringify({ mcpServers: { daybook: config } }, null, 2) },
      ];
    },
  },
  {
    id: 'grok',
    name: 'Grok',
    where: 'cloud',
    tagline: { en: 'Grok Bot and grok.com', es: 'Grok Bot y grok.com' },
    steps: {
      en: ['In Grok Bot (or grok.com), add a custom MCP connector.', 'Name it Daybook and paste the URL below.', 'Grok Build (CLI): use the Codex-style config under “Codex”.'],
      es: ['En Grok Bot (o grok.com), agrega un conector MCP personalizado.', 'Ponle Daybook y pega la URL de abajo.', 'Grok Build (CLI): usa la configuración de “Codex”.'],
    },
    snippets: (u, t) => [{ kind: 'url', label: 'Connector URL', value: withKey(u, t) }],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    where: 'local',
    tagline: { en: 'One command', es: 'Un comando' },
    steps: { en: ['Run this in a terminal.', 'Then /mcp in Claude Code shows daybook.'], es: ['Corre esto en una terminal.', 'Luego /mcp en Claude Code muestra daybook.'] },
    snippets: (u, t) => [{ kind: 'command', label: 'Terminal', value: `claude mcp add --transport http daybook ${u} --header "Authorization: Bearer ${t}" --scope user` }],
  },
  {
    id: 'codex',
    name: 'Codex',
    where: 'local',
    tagline: { en: 'OpenAI’s coding agent, and Grok Build', es: 'El agente de código de OpenAI, y Grok Build' },
    steps: {
      en: ['Add this to ~/.codex/config.toml (Grok Build: ~/.grok/config.toml).', 'Needs Node.js for npx.'],
      es: ['Agrega esto a ~/.codex/config.toml (Grok Build: ~/.grok/config.toml).', 'Necesita Node.js para npx.'],
    },
    snippets: (u, t) => [
      {
        kind: 'toml',
        label: 'config.toml',
        value: `[mcp_servers.daybook]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${u}", "--header", "Authorization: Bearer ${t}"]\nstartup_timeout_sec = 30\n`,
      },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    where: 'local',
    tagline: { en: 'Google’s terminal agent', es: 'El agente de terminal de Google' },
    steps: { en: ['Add this to ~/.gemini/settings.json.'], es: ['Agrega esto a ~/.gemini/settings.json.'] },
    snippets: (u, t) => [{ kind: 'json', label: '~/.gemini/settings.json', value: JSON.stringify({ mcpServers: { daybook: { httpUrl: u, headers: auth(t) } } }, null, 2) }],
  },
  {
    id: 'vscode',
    name: 'VS Code',
    where: 'local',
    tagline: { en: 'Copilot agent mode, one click', es: 'Modo agente de Copilot, un clic' },
    steps: { en: ['Click “Add to VS Code” and confirm.', 'Or add it to .vscode/mcp.json.'], es: ['Haz clic en “Add to VS Code” y confirma.', 'O agrégalo a .vscode/mcp.json.'] },
    snippets: (u, t) => {
      const server = { name: 'daybook', type: 'http', url: u, headers: auth(t) };
      return [
        { kind: 'link', label: 'Add to VS Code', value: 'Add to VS Code', href: `vscode:mcp/install?${encodeURIComponent(JSON.stringify(server))}` },
        { kind: 'json', label: '.vscode/mcp.json', value: JSON.stringify({ servers: { daybook: { type: 'http', url: u, headers: auth(t) } } }, null, 2) },
      ];
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    where: 'local',
    tagline: { en: 'Cascade', es: 'Cascade' },
    steps: { en: ['Add this to ~/.codeium/windsurf/mcp_config.json, then refresh MCP servers.'], es: ['Agrega esto a ~/.codeium/windsurf/mcp_config.json y recarga los servidores MCP.'] },
    snippets: (u, t) => [{ kind: 'json', label: 'mcp_config.json', value: JSON.stringify({ mcpServers: { daybook: { serverUrl: u, headers: auth(t) } } }, null, 2) }],
  },
  {
    id: 'meta',
    name: 'Meta Llama',
    where: 'local',
    tagline: { en: 'Llama Stack tool group', es: 'Grupo de herramientas de Llama Stack' },
    steps: { en: ['Register Daybook as an MCP tool group in your Llama Stack app.'], es: ['Registra Daybook como grupo de herramientas MCP en tu app de Llama Stack.'] },
    snippets: (u, t) => [
      {
        kind: 'python',
        label: 'Python',
        value: `client.toolgroups.register(\n    toolgroup_id="mcp::daybook",\n    provider_id="model-context-protocol",\n    mcp_endpoint={"uri": "${withKey(u, t)}"},\n)`,
      },
    ],
  },
  {
    id: 'other',
    name: 'Any MCP client',
    where: 'local',
    tagline: { en: 'URL and a bearer header', es: 'URL y un encabezado bearer' },
    steps: {
      en: ['Streamable HTTP at the URL below, with the Authorization header.', 'Clients without headers can use ?key= in the URL; stdio-only clients can use mcp-remote.'],
      es: ['Streamable HTTP en la URL de abajo, con el encabezado Authorization.', 'Los clientes sin encabezados pueden usar ?key= en la URL; los de solo stdio pueden usar mcp-remote.'],
    },
    snippets: (u, t) => [
      { kind: 'url', label: 'URL', value: u },
      { kind: 'command', label: 'Header', value: `Authorization: Bearer ${t}` },
    ],
  },
];
