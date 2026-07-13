import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// After build, this file lives in dist/assets.js and the assets/ folder is
// copied alongside dist/ (see Dockerfile), so both sit under the same parent.
// index.ts serves this same folder statically at /assets.
const ASSETS_ROOT = path.join(__dirname, '..', 'assets');

function resolveRelativePath(...pathParts: string[]): string | undefined {
  const dir = pathParts.slice(0, -1);
  const base = pathParts[pathParts.length - 1];
  for (const ext of ['jpg', 'png']) {
    const rel = [...dir, `${base}.${ext}`].join('/');
    if (fs.existsSync(path.join(ASSETS_ROOT, rel))) return rel;
  }
  return undefined;
}

/** Species art lives at assets/species/{speciesId}.(jpg|png). Returns the path relative to /assets. */
export function speciesImagePath(speciesId: number): string | undefined {
  return resolveRelativePath('species', String(speciesId));
}

/** Toilet skin art lives at assets/skins/{skinId}/{base|overflow|max_overflow}.jpg,
 *  one per toilet-stack state (0 = base, 1-9 = overflow, 10 = max_overflow). */
export function skinStateImagePath(skinId: string, stack: number): string | undefined {
  const state = stack <= 0 ? 'base' : stack >= 10 ? 'max_overflow' : 'overflow';
  return resolveRelativePath('skins', skinId, state);
}

/** Misc effect art (bidet/perfume/flush) lives at assets/effects/{name}.(jpg|png). */
export function effectImagePath(name: string): string | undefined {
  return resolveRelativePath('effects', name);
}
