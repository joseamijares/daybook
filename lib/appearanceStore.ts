// The appearance is stored once for the whole Daybook, so the browser, the Mac
// app's window and every device agree.

import { type Appearance, DEFAULT_APPEARANCE, mergeAppearance } from './appearance';
import { store } from './store';

export async function getAppearance(): Promise<Appearance> {
  const saved = await store().get<Partial<Appearance>>('meta', 'appearance');
  // A value written by an older or newer Daybook falls back field by field.
  try {
    return mergeAppearance(DEFAULT_APPEARANCE, saved || {});
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function setAppearance(patch: Record<string, unknown>): Promise<Appearance> {
  const next = mergeAppearance(await getAppearance(), patch);
  await store().put('meta', 'appearance', next);
  return next;
}
