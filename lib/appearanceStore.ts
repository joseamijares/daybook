// The appearance is stored once for the whole Daybook, so the browser, the Mac
// app's window and every device agree.

import { type Appearance, DEFAULT_APPEARANCE, mergeAppearance } from './appearance';
import { store } from './storage';

export async function getAppearance(): Promise<Appearance> {
  const saved = await store().get<Record<string, unknown>>('meta', 'appearance');
  // A value written by an older or newer Daybook falls back field by field.
  let look = DEFAULT_APPEARANCE;
  for (const key of ['style', 'palette', 'eveningNocturne', 'doneToBottom'] as const) {
    try {
      look = mergeAppearance(look, { [key]: saved?.[key] });
    } catch {
      // keep the default for this field
    }
  }
  return look;
}

export async function setAppearance(patch: unknown): Promise<Appearance> {
  const next = mergeAppearance(await getAppearance(), patch);
  await store().put('meta', 'appearance', next);
  return next;
}
