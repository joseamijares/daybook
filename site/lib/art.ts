// The painting of the day comes from the app's own rotation, so the landing
// page, every Daybook and every Frame hang the same work on the same day.
import { artFor, type Artwork } from '../../lib/art';
import works from '../../lib/art.json';

export { artFor, type Artwork };

const bySlug = new Map((works as Artwork[]).map((w) => [w.slug, w]));

export function work(slug: string): Artwork {
  const w = bySlug.get(slug);
  if (!w) throw new Error(`Unknown painting: ${slug}`);
  return w;
}

export const ROTATION_LENGTH = works.length;

// Dates are plain "YYYY-MM-DD" strings, read as UTC days like lib/art.ts does.
export function addDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// How many days until this painting hangs again (0 = today).
export function daysUntil(slug: string, from: string): number {
  for (let i = 0; i < ROTATION_LENGTH; i++) if (artFor(addDays(from, i)).slug === slug) return i;
  return -1;
}

export function formatDay(ymd: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
}

// The scan as the site serves it (copied from the app's public/art).
export function src(a: Artwork): string {
  return `/${a.image}`;
}

// Fit a painting inside a box without cropping it.
export function contain(ratio: number, maxW: number, maxH: number): { w: number; h: number } {
  const w = Math.min(maxW, maxH * ratio);
  return { w: Math.round(w), h: Math.round(w / ratio) };
}
