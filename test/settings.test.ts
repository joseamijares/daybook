import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authorized, isOwner } from '@/lib/auth';
import { getSecret, seal, secretSource, setSecret, unseal } from '@/lib/secrets';
import { fileStore, setStore } from '@/lib/store';
import { createToken, listTokens, revokeToken, verifyToken } from '@/lib/tokens';

const req = (headers: Record<string, string> = {}, url = 'http://localhost/api/day') => new Request(url, { headers });

beforeEach(() => {
  setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json')));
  process.env.DAYBOOK_KEY = 'master';
  delete process.env.LINEAR_API_KEY;
});
afterEach(() => {
  delete process.env.DAYBOOK_KEY;
  setStore(null);
});

describe('secrets', () => {
  it('round-trips and refuses a different key', () => {
    const s = seal('lin_api_123');
    expect(s).not.toContain('lin_api_123');
    expect(unseal(s)).toBe('lin_api_123');
    process.env.DAYBOOK_KEY = 'rotated';
    expect(unseal(s)).toBeNull();
  });

  it('prefers the environment over Settings', async () => {
    await setSecret('LINEAR_API_KEY', 'from-settings');
    expect(await getSecret('LINEAR_API_KEY')).toBe('from-settings');
    expect(await secretSource('LINEAR_API_KEY')).toBe('settings');
    process.env.LINEAR_API_KEY = 'from-env';
    expect(await getSecret('LINEAR_API_KEY')).toBe('from-env');
    expect(await secretSource('LINEAR_API_KEY')).toBe('env');
    delete process.env.LINEAR_API_KEY;
    await setSecret('LINEAR_API_KEY', null);
    expect(await secretSource('LINEAR_API_KEY')).toBeNull();
  });
});

describe('agent tokens', () => {
  it('work as bearer or ?key=, until revoked', async () => {
    const { token, record } = await createToken('Cursor', 'cursor');
    expect(token.startsWith('dbk_')).toBe(true);
    expect(JSON.stringify(await listTokens())).not.toContain(token);
    expect(await authorized(req({ authorization: `Bearer ${token}` }))).toBe(true);
    expect(await authorized(req({}, `http://localhost/api/mcp?key=${token}`))).toBe(true);
    expect(await revokeToken(record.id)).toBe(true);
    expect(await verifyToken(token)).toBe(false);
    expect(await authorized(req({ authorization: `Bearer ${token}` }))).toBe(false);
  });

  it("can't manage tokens or secrets: only the owner can", async () => {
    const { token } = await createToken('ChatGPT', 'chatgpt');
    expect(await isOwner(req({ authorization: `Bearer ${token}` }))).toBe(false);
    expect(await isOwner(req({ authorization: 'Bearer master' }))).toBe(true);
  });

  it('a browser signed in with a token can use Daybook but is not the owner', async () => {
    const { token } = await createToken('Daybook for Mac', 'mac');
    const browser = req({ cookie: `daybook_token=${token}` });
    expect(await authorized(browser)).toBe(true);
    expect(await isOwner(browser)).toBe(false);
  });

  it('rejects made-up tokens', async () => {
    expect(await authorized(req({ authorization: 'Bearer dbk_notarealtokennotarealtoken' }))).toBe(false);
  });
});
