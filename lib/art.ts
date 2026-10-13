// Painting of the day. Same 44 public-domain works and the same rotation as
// Frame Dashboard's built-in pack, so the app and the TV hang the same picture.

import works from './art.json';

export interface Artwork {
  slug: string;
  artist: string;
  title: string;
  date: string;
  medium: string;
  kind: string;
  collection: string | null;
  ratio: number;
  image: string;
  source: string;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const rotation = (works as Artwork[]).slice().sort((a, b) => hash(a.slug) - hash(b.slug));

export function artFor(ymd: string): Artwork {
  const n = Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400000);
  return rotation[((n % rotation.length) + rotation.length) % rotation.length];
}

export function credit(a: Artwork) {
  return [`${a.artist}, ${a.date}`, a.collection].filter(Boolean).join(' · ');
}
