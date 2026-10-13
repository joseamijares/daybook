// Agent tokens: one per connection (Cursor, ChatGPT, the Mac app…), so each
// can be revoked on its own and the master DAYBOOK_KEY never has to leave the
// server. A token is shown once; only its SHA-256 is stored, and it is also
// the record's id, so checking a token is a single lookup.

import { createHash, randomBytes } from 'node:crypto';
import { store } from './store';

export interface AgentToken {
  id: string; // sha256 of the token
  name: string;
  client: string; // "cursor", "chatgpt", "claude", … or "other"
  prefix: string; // "dbk_3f9a" — enough to recognise it in a list
  createdAt: string;
  lastUsedAt: string | null;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export const looksLikeToken = (s: string | null | undefined): s is string => !!s && /^dbk_[A-Za-z0-9_-]{24,}$/.test(s);

export async function createToken(name: string, client = 'other'): Promise<{ token: string; record: AgentToken }> {
  const clean = name.trim().slice(0, 60) || 'Agent';
  const token = `dbk_${randomBytes(24).toString('base64url')}`;
  const record: AgentToken = {
    id: hash(token),
    name: clean,
    client: client.replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'other',
    prefix: token.slice(0, 8),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await store().put('tokens', record.id, record);
  return { token, record };
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!looksLikeToken(token)) return false;
  const record = await store().get<AgentToken>('tokens', hash(token));
  if (!record) return false;
  // Note use at most once an hour, to keep writes (and Upstash commands) low.
  const last = record.lastUsedAt ? Date.parse(record.lastUsedAt) : 0;
  if (Date.now() - last > 3600_000) {
    await store().put('tokens', record.id, { ...record, lastUsedAt: new Date().toISOString() });
  }
  return true;
}

export async function listTokens(): Promise<AgentToken[]> {
  return Object.values(await store().all<AgentToken>('tokens')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeToken(id: string): Promise<boolean> {
  if (!(await store().get<AgentToken>('tokens', id))) return false;
  await store().del('tokens', id);
  return true;
}
