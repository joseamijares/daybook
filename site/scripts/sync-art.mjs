// Copies the 44 paintings from the app (public/art) into the site, so the
// repo keeps one copy of each scan. Runs before dev and build; no dependencies.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(site, '..', 'public', 'art');
const to = join(site, 'public', 'art');

if (!existsSync(from)) {
  console.error(`sync-art: ${from} is missing; the site needs the app's paintings.`);
  process.exit(1);
}
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log('sync-art: paintings copied to site/public/art');
