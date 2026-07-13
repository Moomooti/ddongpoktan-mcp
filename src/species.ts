import type { SpeciesDef, Tier } from './types.js';
import { TIER_PROBABILITY } from './constants.js';

const BASIC_NAMES: string[] = [
  '꽃향기가 가득한 똥',
  '파리들이 쫓아다니는 똥',
  '설사',
  '토끼가 싼 똥',
  '강아지가 싼 똥',
  '쇠똥구리가 굴린 똥',
  '일반 기본 똥',
  '누가 내 머리에 똥 쌌어',
  '새가 싼 똥',
  '하트 모양 똥',
  '개발자들이 좋아하는 C언어 똥',
  '음식물이 낀 똥',
  '식약처 승인 대기 중 똥',
  '카레맛 똥',
  '똥으로 만든 다발',
  '알람 5번 끄고 지각한 똥',
  '줌 회의 음소거 안 하고 욕한 똥',
  '로또 한 자리 차이로 놓친 똥',
  '상대방 카톡 1이 안 없어져서 초조한 똥',
  '방귀인 줄 알았는데 진짜였던 똥',
  '급똥인데 엘베가 만원인 똥',
  '휴지 없어서 세상 무너진 똥',
  '정품인증 스티커 붙은 똥',
  '자기계발서 다섯 권 읽고도 그대로인 똥',
];

// species_id 1~24: basic tier, uniformly likely within the tier.
// species_id 25~28: single-species special tiers.
export const SPECIES: SpeciesDef[] = [
  ...BASIC_NAMES.map((name, i) => ({
    speciesId: i + 1,
    tier: 'basic' as Tier,
    name,
    probability: TIER_PROBABILITY.basic / BASIC_NAMES.length,
  })),
  { speciesId: 25, tier: 'rainbow', name: '무지개 똥', probability: TIER_PROBABILITY.rainbow },
  { speciesId: 26, tier: 'bomb', name: '폭탄 똥', probability: TIER_PROBABILITY.bomb },
  { speciesId: 27, tier: 'golden', name: '황금 똥', probability: TIER_PROBABILITY.golden },
  { speciesId: 28, tier: 'diamond', name: '다이아 똥', probability: TIER_PROBABILITY.diamond },
];

export const SPECIES_BY_ID: Record<number, SpeciesDef> = Object.fromEntries(
  SPECIES.map((s) => [s.speciesId, s]),
);

export const SPECIAL_SPECIES_ID: Record<Exclude<Tier, 'basic'>, number> = {
  rainbow: 25,
  bomb: 26,
  golden: 27,
  diamond: 28,
};

const BASIC_SPECIES_IDS = SPECIES.filter((s) => s.tier === 'basic').map((s) => s.speciesId);

export function rollTier(): Tier {
  const r = Math.random();
  let acc = 0;
  for (const tier of ['basic', 'rainbow', 'bomb', 'golden', 'diamond'] as Tier[]) {
    acc += TIER_PROBABILITY[tier];
    if (r < acc) return tier;
  }
  return 'diamond'; // floating point safety net
}

export function pickRandomBasicSpeciesId(): number {
  const idx = Math.floor(Math.random() * BASIC_SPECIES_IDS.length);
  return BASIC_SPECIES_IDS[idx];
}
