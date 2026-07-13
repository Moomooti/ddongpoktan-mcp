import { PERFUME_COST } from '../constants.js';
import { debitCoin, getPlayer, resetStack } from '../repository.js';

export interface PerfumeResult {
  success: boolean;
  new_stack: number;
  message?: string;
}

/** Guaranteed (non-probabilistic) alternative to flush_toilet - see constants.ts TBD #7 note. */
export function usePerfume(roomId: string, userId: string): PerfumeResult {
  const player = getPlayer(roomId, userId);

  if (player.coin < PERFUME_COST) {
    return {
      success: false,
      new_stack: player.stack,
      message: `방향제 비용이 부족합니다. (필요: ${PERFUME_COST}, 보유: ${player.coin})`,
    };
  }

  debitCoin(roomId, userId, PERFUME_COST, 'perfume_use');
  resetStack(roomId, userId);
  return { success: true, new_stack: 0 };
}
