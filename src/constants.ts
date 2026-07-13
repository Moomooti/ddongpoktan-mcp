import type { Tier } from './types.js';

// DESIGN.md §1.3 / §0 TBD table - values marked TBD are our own defaults, pending
// confirmation from the original 기획서 author. Kept as named constants so they
// can be tuned in one place without touching game logic.

export const TIER_PROBABILITY: Record<Tier, number> = {
  basic: 0.75,
  rainbow: 0.12,
  bomb: 0.08,
  golden: 0.04,
  diamond: 0.01,
};

export interface EnhanceSpec {
  level: number;
  cost: number;
  successRate: number;
  flushRate: number;
  resetRisk: boolean;
}

// Index 0 => attempt to reach Lv.1, index 4 => attempt to reach Lv.5.
export const ENHANCE_TABLE: EnhanceSpec[] = [
  { level: 1, cost: 850, successRate: 0.55, flushRate: 0.65, resetRisk: false },
  { level: 2, cost: 1600, successRate: 0.5, flushRate: 0.7, resetRisk: false },
  { level: 3, cost: 2500, successRate: 0.45, flushRate: 0.75, resetRisk: true },
  { level: 4, cost: 3700, successRate: 0.4, flushRate: 0.8, resetRisk: true },
  { level: 5, cost: 5400, successRate: 0.35, flushRate: 0.85, resetRisk: true },
];

export const BASE_FLUSH_RATE = 0.6; // Lv.0

export const COIN_REWARD = {
  welcome: 500,
  baseThrow: 30,
  rainbowHit: 150,
  goldenTrigger: 450,
  diamondTrigger: 750,
  dailyFirstThrow: 300,
};

export const BIDET_COST = 15;
export const MAX_STACK = 10;
export const GOLDEN_EVENT_DURATION_SEC = 60;

// TBD #7 (DESIGN.md): perfume cost/scope wasn't specified in the 기획서.
// Chosen as a guaranteed (non-probabilistic) alternative to flush_toilet,
// priced above BIDET_COST since it's a stronger, certain effect.
export const PERFUME_COST = 100;

// TBD #6 (DESIGN.md): flush failure penalty - chosen mode is "+1~3 random",
// the other documented option ("double the stack") was not selected.
export const FLUSH_FAIL_MIN = 1;
export const FLUSH_FAIL_MAX = 3;

// TBD #5 (DESIGN.md): good fortune duration - simplified to a fixed time
// window (the 기획서 also mentioned "or next 5 throws", not implemented here).
export const GOOD_FORTUNE_DURATION_MS = 30 * 60 * 1000;
