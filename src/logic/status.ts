import { MAX_STACK } from '../constants.js';
import { getDex, getPlayer, getRecentLedger, getUnlockedSkins } from '../repository.js';
import { SPECIES } from '../species.js';
import type { CoinLedgerEntry, DexEntry, FortuneState } from '../types.js';

export interface StatusResult {
  stack: number;
  max_stack: number;
  enhance_level: number;
  fortune_state: FortuneState;
  coin_balance: number;
  coin_recent: CoinLedgerEntry[];
  unlocked_skins: string[];
  equipped_skin: string;
}

export function buildStatus(roomId: string, userId: string): StatusResult {
  const player = getPlayer(roomId, userId);
  return {
    stack: player.stack,
    max_stack: MAX_STACK,
    enhance_level: player.enhance_level,
    fortune_state: player.fortune_state,
    coin_balance: player.coin,
    coin_recent: getRecentLedger(roomId, userId),
    unlocked_skins: getUnlockedSkins(roomId, userId),
    equipped_skin: player.equipped_skin,
  };
}

export interface DexResult {
  collected: DexEntry[];
  total: number;
  collected_count: number;
}

export function buildDex(roomId: string, userId: string): DexResult {
  const collected = getDex(roomId, userId);
  return { collected, total: SPECIES.length, collected_count: collected.length };
}
