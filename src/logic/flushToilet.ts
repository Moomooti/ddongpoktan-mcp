import { addStack, getPlayer, resetStack } from '../repository.js';
import { BASE_FLUSH_RATE, ENHANCE_TABLE, FLUSH_FAIL_MAX, FLUSH_FAIL_MIN } from '../constants.js';

export interface FlushResult {
  success: boolean;
  new_stack: number;
}

export function flushToilet(roomId: string, userId: string): FlushResult {
  const player = getPlayer(roomId, userId);
  const flushRate =
    player.enhance_level === 0 ? BASE_FLUSH_RATE : ENHANCE_TABLE[player.enhance_level - 1].flushRate;
  const success = Math.random() < flushRate;

  if (success) {
    resetStack(roomId, userId);
    return { success: true, new_stack: 0 };
  }

  const penalty = Math.floor(Math.random() * (FLUSH_FAIL_MAX - FLUSH_FAIL_MIN + 1)) + FLUSH_FAIL_MIN;
  const newStack = addStack(roomId, userId, penalty);
  return { success: false, new_stack: newStack };
}
