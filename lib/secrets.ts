// Integration secrets (Linear key, Frame URL and key) set from the Settings
// page. They are stored encrypted (AES-256-GCM) with a key derived from
// DAYBOOK_SECRET, or DAYBOOK_KEY when that isn't set. An environment variable
// with the same name always wins, so a deployment can still pin them.
// Rotating DAYBOOK_KEY without DAYBOOK_SECRET means reconnecting in Settings.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { store } from './store';

export type SecretName = 'LINEAR_API_KEY' | 'FRAME_DASHBOARD_URL' | 'FRAME_DASHBOARD_WRITE_KEY';

const keyMaterial = () =>
  createHash('sha256')
    .update(`daybook-secrets:${process.env.DAYBOOK_SECRET || process.env.DAYBOOK_KEY || 'local-development'}`)
    .digest();

export function seal(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyMaterial(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv, data, cipher.getAuthTag()].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function unseal(sealed: string): string | null {
  try {
    const [v, iv, data, tag] = sealed.split('.');
    if (v !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key (DAYBOOK_KEY rotated) or tampered
  }
}

const slot = (name: SecretName) => `secret:${name}`;

export async function getSecret(name: SecretName): Promise<string | undefined> {
  const env = process.env[name];
  if (env) return env;
  const sealed = await store().get<string>('meta', slot(name));
  return (sealed && unseal(sealed)) || undefined;
}

export async function setSecret(name: SecretName, value: string | null): Promise<void> {
  if (value) await store().put('meta', slot(name), seal(value));
  else await store().del('meta', slot(name));
}

/** Where a secret comes from: the server environment, Settings, or nowhere. */
export async function secretSource(name: SecretName): Promise<'env' | 'settings' | null> {
  if (process.env[name]) return 'env';
  const sealed = await store().get<string>('meta', slot(name));
  return sealed && unseal(sealed) ? 'settings' : null;
}
