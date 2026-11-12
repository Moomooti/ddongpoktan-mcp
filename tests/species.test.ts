import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIER_PROBABILITY } from '../src/constants.js';
import { SPECIES, SPECIAL_SPECIES_ID, rollTier } from '../src/species.js';
import { SKIN_ORDER } from '../src/logic/selectSkin.js';
import { skinStateImagePath, speciesImagePath } from '../src/assets.js';
import { rigRandom } from './helpers.js';

describe('species table', () => {
  it('has 28 species with unique ids 1..28', () => {
    const ids = SPECIES.map((s) => s.speciesId).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it('tier probabilities sum to 1, and per-species probabilities match them', () => {
    const tierSum = Object.values(TIER_PROBABILITY).reduce((a, b) => a + b, 0);
    expect(tierSum).toBeCloseTo(1, 10);
    const speciesSum = SPECIES.reduce((a, s) => a + s.probability, 0);
    expect(speciesSum).toBeCloseTo(1, 10);
  });

  it('maps each special tier to a species of that tier', () => {
    for (const [tier, id] of Object.entries(SPECIAL_SPECIES_ID)) {
      expect(SPECIES.find((s) => s.speciesId === id)?.tier).toBe(tier);
    }
  });
});

describe('rollTier', () => {
  // Cumulative boundaries: basic < .75 <= rainbow < .87 <= bomb < .95 <= golden < .99 <= diamond
  it.each([
    [0, 'basic'],
    [0.7499, 'basic'],
    [0.75, 'rainbow'],
    [0.8699, 'rainbow'],
    [0.87, 'bomb'],
    [0.9499, 'bomb'],
    [0.95, 'golden'],
    [0.9899, 'golden'],
    [0.99, 'diamond'],
    [0.999999, 'diamond'],
  ])('random %f -> %s', (r, tier) => {
    rigRandom(r);
    expect(rollTier()).toBe(tier);
  });
});

// The README and DESIGN.md promise an illustration for every species and every
// skin state. A missing file would silently drop the image from tool responses,
// so this check fails the build instead.
describe('assets', () => {
  const assetsRoot = path.join(import.meta.dirname, '..', 'assets');

  it.each(SPECIES.map((s) => s.speciesId))('species %i has an image', (id) => {
    const rel = speciesImagePath(id);
    expect(rel).toBeDefined();
    expect(fs.existsSync(path.join(assetsRoot, rel!))).toBe(true);
  });

  it.each(SKIN_ORDER)('skin %s has base / overflow / max_overflow images', (skinId) => {
    for (const stack of [0, 5, 10]) {
      expect(skinStateImagePath(skinId, stack)).toBeDefined();
    }
  });

  it('keeps every image small enough to send by URL quickly (< 150 KB)', () => {
    const tooBig: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (fs.statSync(full).size > 150 * 1024) tooBig.push(path.relative(assetsRoot, full));
      }
    };
    walk(assetsRoot);
    expect(tooBig).toEqual([]);
  });
});
