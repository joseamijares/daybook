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
  it('starts as the Salon wall label, finished tasks to the bottom', async () => {
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it('saves a patch and keeps the rest', async () => {
    await setAppearance({ palette: 'nocturne' });
    const saved = { style: 'notebook', palette: 'nocturne', eveningNocturne: true, doneToBottom: false };
    expect(await setAppearance({ style: 'notebook', eveningNocturne: true, doneToBottom: false })).toEqual(saved);
    expect(await getAppearance()).toEqual(saved);
  });

  it('refuses values it does not know', () => {
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { style: 'brutal' })).toThrow(/style must be/);
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { palette: 'neon' })).toThrow(/palette must be/);
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { eveningNocturne: 'yes' })).toThrow(/must be true or false/);
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, { doneToBottom: 1 })).toThrow(/doneToBottom must be true or false/);
  });

  it('falls back field by field when the stored value is from another version', async () => {
    await store().put('meta', 'appearance', { style: 'gone', palette: 'modern' });
    expect(await getAppearance()).toEqual({ ...DEFAULT_APPEARANCE, palette: 'modern' });
  });

  it('rejects a body that is not an object', () => {
    expect(() => mergeAppearance(DEFAULT_APPEARANCE, null)).toThrow(/must be an object/);
  });
});
