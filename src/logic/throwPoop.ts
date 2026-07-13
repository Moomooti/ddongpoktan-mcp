import { COIN_REWARD, GOOD_FORTUNE_DURATION_MS } from '../constants.js';
import {
  addStack,
  applyDailyBonusIfNeeded,
  applyDiamondSeizure,
  applyGoldenTax,
  checkAndUnlockSkins,
  creditCoin,
  endRound,
  ensurePlayer,
  getPlayer,
  incrementDailyThrowCount,
  incrementDiamondLifetimeCount,
  incrementGoldenEventCount,
  incrementRainbowHitCount,
  recordDexHit,
  setFortune,
  setLastAttacker,
} from '../repository.js';
import { pickRandomBasicSpeciesId, rollTier, SPECIAL_SPECIES_ID, SPECIES, SPECIES_BY_ID } from '../species.js';
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

  const dexHit = recordDexHit(roomId, thrower, speciesId);
  creditCoin(roomId, thrower, COIN_REWARD.baseThrow, 'base_throw');
  const dailyBonus = applyDailyBonusIfNeeded(roomId, thrower);
  const todayThrowCount = incrementDailyThrowCount(roomId, thrower);

  let targetNewStack = 0;
  let event: ThrowResult['event'];
  let roomTax: ThrowResult['room_tax'];

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
    case 'golden': {
      targetNewStack = addStack(roomId, target, 1);
      creditCoin(roomId, thrower, COIN_REWARD.goldenTrigger, 'golden_trigger');
      const taxEntries = applyGoldenTax(roomId, thrower);
      incrementGoldenEventCount(roomId, thrower);
      event = 'golden';
      roomTax = {
        label: '세금 강제 조공',
        entries: taxEntries,
        total: taxEntries.reduce((sum, e) => sum + e.amount, 0),
      };
      break;
    }
    case 'diamond': {
      targetNewStack = addStack(roomId, target, 1);
      creditCoin(roomId, thrower, COIN_REWARD.diamondTrigger, 'diamond_trigger');
      const seizureEntries = applyDiamondSeizure(roomId, thrower);
      incrementDiamondLifetimeCount(roomId, thrower);
      event = 'diamond';
      roomTax = {
        label: '지분 강제 차감',
        entries: seizureEntries,
        total: seizureEntries.reduce((sum, e) => sum + e.amount, 0),
      };
      break;
    }
  }

  setLastAttacker(roomId, target, thrower);
  const unlockedSkins = [...checkAndUnlockSkins(roomId, target), ...checkAndUnlockSkins(roomId, thrower)];

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
    room_tax: roomTax,
    is_new_discovery: dexHit.isNew,
    dex_collected: dexHit.collectedCount,
    dex_total: SPECIES.length,
    today_throw_count: todayThrowCount,
  };
}
