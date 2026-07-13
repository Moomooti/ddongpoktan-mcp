import { addStack, ensurePlayer, getActiveGoldenHolder } from '../repository.js';

export interface GoldenGuardResult {
  blocked: boolean;
  message?: string;
}

/**
 * DESIGN.md §2.4 / §3 golden-event penalty. PlayMCP only forwards explicit tool
 * calls (not free chat), so "silence" is enforced by penalizing any tool call
 * made by someone other than the golden holder while the event is active.
 */
export function checkGoldenPenalty(roomId: string, callerNickname: string): GoldenGuardResult {
  ensurePlayer(roomId, callerNickname);
  const holder = getActiveGoldenHolder(roomId);
  if (holder && holder !== callerNickname) {
    addStack(roomId, callerNickname, 1);
    return {
      blocked: true,
      message:
        '황금 변기의 신이 강림했습니다. 모두 침묵하십시오! (침묵을 깨서 똥 스택 +1 페널티를 받았습니다)',
    };
  }
  return { blocked: false };
}
