import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, mergeAppearance } from '@/lib/appearance';
import { getAppearance, setAppearance } from '@/lib/appearanceStore';
import { fileStore, setStore, store } from '@/lib/store';

beforeEach(() => setStore(fileStore(path.join(mkdtempSync(path.join(tmpdir(), 'daybook-')), 'db.json'))));
afterEach(() => setStore(null));

describe('appearance', () => {
  it('starts as the Salon wall label', async () => {
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it('saves a patch and keeps the rest', async () => {
    await setAppearance({ palette: 'nocturne' });
    expect(await setAppearance({ style: 'notebook', eveningNocturne: true })).toEqual({ style: 'notebook', palette: 'nocturne', eveningNocturne: true });
    expect(await getAppearance()).toEqual({ style: 'notebook', palette: 'nocturne', eveningNocturne: true });
  });

  it('refuses values it does not know', () => {
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { style: 'brutal' })).toThrow(/style must be/);
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { palette: 'neon' })).toThrow(/palette must be/);
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { eveningNocturne: 'yes' })).toThrow(/must be true or false/);
  });

  it('falls back to the defaults when the stored value is from another version', async () => {
    await store().put('meta', 'appearance', { style: 'gone', palette: 'modern' });
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});
