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
export function mergeAppearance(base: Appearance, patch: unknown): Appearance {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('appearance must be an object');
  const p = patch as Record<string, unknown>;
  const next = { ...base };
  if (p.style !== undefined) {
    if (!STYLES.includes(p.style as Style)) throw new Error(`style must be one of ${STYLES.join(', ')}`);
    next.style = p.style as Style;
  }
  if (p.palette !== undefined) {
    if (!PALETTES.includes(p.palette as Palette)) throw new Error(`palette must be one of ${PALETTES.join(', ')}`);
    next.palette = p.palette as Palette;
  }
  if (p.eveningNocturne !== undefined) {
    if (typeof p.eveningNocturne !== 'boolean') throw new Error('eveningNocturne must be true or false');
    next.eveningNocturne = p.eveningNocturne;
  }
  return next;
}
