// How Daybook looks: one of three designs (the type and layout) and one of
// three palettes (the room around the painting). Pure, so the browser can use
// it; lib/appearanceStore.ts saves it once for the whole Daybook.

export const STYLES = ['wall', 'timetable', 'notebook'] as const;
export const PALETTES = ['salon', 'modern', 'nocturne'] as const;

export type Style = (typeof STYLES)[number];
export type Palette = (typeof PALETTES)[number];

export interface Appearance {
  style: Style; // wall: a museum label · timetable: wide numerals and blocks · notebook: a written list
  palette: Palette; // salon: bone and cobalt · modern: white and one red dot · nocturne: blue-black and gilt
  eveningNocturne: boolean; // turn to Nocturne once the day is shut down
}

export const DEFAULT_APPEARANCE: Appearance = { style: 'wall', palette: 'salon', eveningNocturne: false };

// Merge a patch onto the current appearance; unknown values are an error, not ignored.
export function mergeAppearance(base: Appearance, patch: Record<string, unknown>): Appearance {
  const next = { ...base };
  if (patch.style !== undefined) {
    if (!STYLES.includes(patch.style as Style)) throw new Error(`style must be one of ${STYLES.join(', ')}`);
    next.style = patch.style as Style;
  }
  if (patch.palette !== undefined) {
    if (!PALETTES.includes(patch.palette as Palette)) throw new Error(`palette must be one of ${PALETTES.join(', ')}`);
    next.palette = patch.palette as Palette;
  }
  if (patch.eveningNocturne !== undefined) {
    if (typeof patch.eveningNocturne !== 'boolean') throw new Error('eveningNocturne must be true or false');
    next.eveningNocturne = patch.eveningNocturne;
  }
  return next;
}
