import { ENHANCE_TABLE } from '../constants.js';
import {
  checkAndUnlockSkins,
  debitCoin,
  getPlayer,
  logEnhanceAttempt,
  setEnhanceState,
} from '../repository.js';

export interface EnhanceResult {
  success: boolean;
  new_level: number;
  reset_triggered: boolean;
  coin_spent: number;
  unlocked_skins: string[];
  message?: string;
}

export function enhanceToilet(roomId: string, userId: string): EnhanceResult {
  const player = getPlayer(roomId, userId);

  if (player.enhance_level >= 5) {
    return {
      success: false,
      new_level: 5,
      reset_triggered: false,
      coin_spent: 0,
      unlocked_skins: [],
      message: '이미 변기가 만렙(Lv.5)입니다.',
    };
  }

  const nextLevel = player.enhance_level + 1;
  const spec = ENHANCE_TABLE[player.enhance_level];

  if (player.coin < spec.cost) {
    return {
      success: false,
      new_level: player.enhance_level,
      reset_triggered: false,
      coin_spent: 0,
      unlocked_skins: [],
      message: `강화에 필요한 코인이 부족합니다. (필요: ${spec.cost}, 보유: ${player.coin})`,
    };
  }

  debitCoin(roomId, userId, spec.cost, 'enhance_spend');

  const success = Math.random() < spec.successRate;
  let newLevel = player.enhance_level;
  let newFailStreak = player.enhance_fail_streak;
  let resetTriggered = false;

  if (success) {
    newLevel = nextLevel;
    newFailStreak = 0;
  } else if (nextLevel >= 3) {
    // DESIGN.md §2.3: only attempts to reach Lv.3-5 carry the full-reset risk.
    newFailStreak = player.enhance_fail_streak + 1;
    if (newFailStreak >= 2) {
      newLevel = 0;
      resetTriggered = true;
      newFailStreak = 0;
    }
  }

  setEnhanceState(roomId, userId, newLevel, newFailStreak);
  logEnhanceAttempt(roomId, userId, player.enhance_level, success, resetTriggered);
  const unlockedSkins = checkAndUnlockSkins(roomId, userId);

  return {
    success,
    new_level: newLevel,
    reset_triggered: resetTriggered,
    coin_spent: spec.cost,
    unlocked_skins: unlockedSkins,
  };
}
