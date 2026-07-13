import { getPlayer, getUnlockedSkins, setEquippedSkin } from '../repository.js';

// DESIGN.md §6 "변기 번호 리스트" - 0-indexed to match the reference UI (0 = default Lv.0 skin).
export const SKIN_ORDER = [
  'lv0_worn',
  'lv1_white',
  'lv2_stainless',
  'lv3_marble',
  'lv4_nanotech',
  'lv5_throne',
  'rainbow',
  'allstar',
  'golden',
  'diamond',
];

export interface SkinListEntry {
  index: number;
  skin_id: string;
  unlocked: boolean;
  equipped: boolean;
}

export interface SelectSkinResult {
  listed: boolean;
  list?: SkinListEntry[];
  success?: boolean;
  skin_id?: string;
  message?: string;
}

function resolveSkinId(input: string): string | undefined {
  const trimmed = input.trim();
  const asIndex = Number(trimmed);
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < SKIN_ORDER.length) {
    return SKIN_ORDER[asIndex];
  }
  return SKIN_ORDER.includes(trimmed) ? trimmed : undefined;
}

export function selectSkin(roomId: string, userId: string, skinInput?: string): SelectSkinResult {
  const player = getPlayer(roomId, userId);
  const unlocked = new Set(['lv0_worn', ...getUnlockedSkins(roomId, userId)]);

  if (!skinInput) {
    const list: SkinListEntry[] = SKIN_ORDER.map((skinId, index) => ({
      index,
      skin_id: skinId,
      unlocked: unlocked.has(skinId),
      equipped: player.equipped_skin === skinId,
    }));
    return { listed: true, list };
  }

  const skinId = resolveSkinId(skinInput);
  if (!skinId) {
    return {
      listed: false,
      success: false,
      message: '알 수 없는 변기예요. 번호(0~9)나 이름으로 다시 입력해주세요.',
    };
  }
  if (!unlocked.has(skinId)) {
    return { listed: false, success: false, message: '선택하신 변기는 현재 굳게 잠겨 있습니다.' };
  }
  setEquippedSkin(roomId, userId, skinId);
  return { listed: false, success: true, skin_id: skinId };
}
