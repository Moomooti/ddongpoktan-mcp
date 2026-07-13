import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// After build, this file lives in dist/assets.js and the assets/ folder is
// copied alongside dist/ (see Dockerfile), so both sit under the same parent.
const ASSETS_ROOT = path.join(__dirname, '..', 'assets');

export interface ImageAsset {
  data: string;
  mimeType: string;
}

const cache = new Map<string, ImageAsset | null>();

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function loadFile(fullPath: string): ImageAsset | undefined {
  if (cache.has(fullPath)) return cache.get(fullPath) ?? undefined;
  if (!fs.existsSync(fullPath)) {
    cache.set(fullPath, null);
    return undefined;
  }
  const ext = path.extname(fullPath).slice(1).toLowerCase();
  const result: ImageAsset = { data: fs.readFileSync(fullPath).toString('base64'), mimeType: MIME_TYPES[ext] ?? 'image/png' };
  cache.set(fullPath, result);
  return result;
}

/** Species art lives at assets/species/{speciesId}.(jpg|png). */
export function speciesImage(speciesId: number): ImageAsset | undefined {
  for (const ext of ['jpg', 'png']) {
    const found = loadFile(path.join(ASSETS_ROOT, 'species', `${speciesId}.${ext}`));
    if (found) return found;
  }
  return undefined;
}

/** Toilet skin art lives at assets/skins/{skinId}/{base|overflow|max_overflow}.jpg,
 *  one per toilet-stack state (0 = base, 1-9 = overflow, 10 = max_overflow). */
export function skinStateImage(skinId: string, stack: number): ImageAsset | undefined {
  const state = stack <= 0 ? 'base' : stack >= 10 ? 'max_overflow' : 'overflow';
  for (const ext of ['jpg', 'png']) {
    const found = loadFile(path.join(ASSETS_ROOT, 'skins', skinId, `${state}.${ext}`));
    if (found) return found;
  }
  return undefined;
}

/** Misc effect art (bidet/perfume/flush) lives at assets/effects/{name}.(jpg|png). */
export function effectImage(name: string): ImageAsset | undefined {
  for (const ext of ['jpg', 'png']) {
    const found = loadFile(path.join(ASSETS_ROOT, 'effects', `${name}.${ext}`));
    if (found) return found;
  }
  return undefined;
}
