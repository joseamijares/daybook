import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/mcp/route';
import { fileStore, setStore } from '@/lib/store';

const rpc = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));

beforeEach(() => {
  setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json')));
  delete process.env.DAYBOOK_KEY;
  delete process.env.LINEAR_API_KEY;
});

describe('MCP endpoint', () => {
  it('negotiates the protocol version', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    const body = await res.json();
    expect(body.result.protocolVersion).toBe('2025-03-26');
    expect(body.result.serverInfo.name).toBe('daybook');
  });

  it('answers notifications with 202', async () => {
    expect((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
  });

  it('hides integrations that are not configured', async () => {
    const body = await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('plan_day');
    expect(names).not.toContain('sync_linear');
  });

  it('adds and reads tasks through tools', async () => {
    await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'add_task', arguments: { title: 'Draft deck 45m #client' } } });
    const body = await (await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_today', arguments: {} } })).json();
    const day = JSON.parse(body.result.content[0].text);
    expect(day.tasks[0]).toMatchObject({ title: 'Draft deck', estimate_minutes: 45, tag: 'client' });
  });

  it('reports tool errors in the result, not as protocol errors', async () => {
    const body = await (await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'complete_task', arguments: { id: 'nope' } } })).json();
    expect(body.result.isError).toBe(true);
  });

  it('requires the key when one is set', async () => {
    process.env.DAYBOOK_KEY = 'secret';
    expect((await rpc({ jsonrpc: '2.0', id: 6, method: 'ping' })).status).toBe(401);
    expect((await rpc({ jsonrpc: '2.0', id: 7, method: 'ping' }, { authorization: 'Bearer secret' })).status).toBe(200);
    const viaQuery = await POST(new Request('http://localhost/api/mcp?key=secret', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'ping' }) }));
    expect(viaQuery.status).toBe(200);
  });
});
