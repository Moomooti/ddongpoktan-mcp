import { COIN_REWARD, GOOD_FORTUNE_DURATION_MS } from '../constants.js';
import {
  addStack,
  applyDailyBonusIfNeeded,
  checkAndUnlockSkins,
  creditCoin,
  endRound,
  ensurePlayer,
  getPlayer,
  incrementDiamondLifetimeCount,
  incrementGoldenEventCount,
  incrementRainbowHitCount,
  recordDexHit,
  setFortune,
  setLastAttacker,
  startGoldenEvent,
} from '../repository.js';
import { pickRandomBasicSpeciesId, rollTier, SPECIAL_SPECIES_ID, SPECIES_BY_ID } from '../species.js';
import type { ThrowResult } from '../types.js';

export function throwPoop(roomId: string, thrower: string, targetNicknameInput?: string): ThrowResult {
  ensurePlayer(roomId, thrower);
  const throwerState = getPlayer(roomId, thrower);

  const target = targetNicknameInput ?? throwerState.last_attacker_id ?? undefined;
  if (!target) {
    return {
      error: 'NO_TARGET',
      message: '누구에게 던질지 말해주세요. (예: "영희한테 던져줘")',
    };
  }
  if (target === thrower) {
    return { error: 'SELF_TARGET', message: '자기 자신에게는 던질 수 없습니다.' };
  }
  ensurePlayer(roomId, target);

  const tier = rollTier();
  const speciesId = tier === 'basic' ? pickRandomBasicSpeciesId() : SPECIAL_SPECIES_ID[tier];
  const species = SPECIES_BY_ID[speciesId];

  recordDexHit(roomId, target, speciesId);
  creditCoin(roomId, thrower, COIN_REWARD.baseThrow, 'base_throw');
  const dailyBonus = applyDailyBonusIfNeeded(roomId, thrower);

  let targetNewStack = 0;
  let event: ThrowResult['event'];

  switch (tier) {
    case 'basic':
      targetNewStack = addStack(roomId, target, 1);
      break;
    case 'rainbow':
      targetNewStack = addStack(roomId, target, 1);
      setFortune(roomId, target, 'good', GOOD_FORTUNE_DURATION_MS);
      setFortune(roomId, thrower, 'good', GOOD_FORTUNE_DURATION_MS);
      creditCoin(roomId, target, COIN_REWARD.rainbowHit, 'rainbow_hit');
      incrementRainbowHitCount(roomId, target);
      event = 'rainbow';
      break;
    case 'bomb':
      endRound(roomId, thrower);
      targetNewStack = 0;
      event = 'bomb';
      break;
    case 'golden':
      targetNewStack = addStack(roomId, target, 1);
      startGoldenEvent(roomId, target);
      creditCoin(roomId, target, COIN_REWARD.goldenTrigger, 'golden_trigger');
      incrementGoldenEventCount(roomId, target);
      event = 'golden';
      break;
    case 'diamond':
      targetNewStack = addStack(roomId, target, 1);
      creditCoin(roomId, target, COIN_REWARD.diamondTrigger, 'diamond_trigger');
      incrementDiamondLifetimeCount(roomId, target);
      event = 'diamond';
      break;
  }

  setLastAttacker(roomId, target, thrower);
  const unlockedSkins = checkAndUnlockSkins(roomId, target);

  return {
    species_id: speciesId,
    species_name: species.name,
    tier,
    target,
    target_new_stack: targetNewStack,
    coin_earned: COIN_REWARD.baseThrow,
    daily_bonus: dailyBonus,
    event,
    unlocked_skins: unlockedSkins,
  };
}
