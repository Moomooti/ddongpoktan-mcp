import { BIDET_COST } from '../constants.js';
import { debitCoin, getPlayer, setFortune } from '../repository.js';
import type { FortuneState } from '../types.js';

export interface BidetResult {
  changed: boolean;
  fortune_state: FortuneState;
  message?: string;
}

export function useBidet(roomId: string, userId: string): BidetResult {
  const player = getPlayer(roomId, userId);

  if (player.fortune_state !== 'bad') {
    return { changed: false, fortune_state: player.fortune_state, message: '지금은 나쁜 운세 상태가 아닙니다.' };
  }
  if (player.coin < BIDET_COST) {
    return {
      changed: false,
      fortune_state: player.fortune_state,
      message: `비데 사용 비용이 부족합니다. (필요: ${BIDET_COST}, 보유: ${player.coin})`,
    };
  }

  debitCoin(roomId, userId, BIDET_COST, 'bidet_use');
  setFortune(roomId, userId, 'none');
  return { changed: true, fortune_state: 'none' };
}
