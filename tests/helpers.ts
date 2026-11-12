import { vi } from 'vitest';
import { db } from '../src/db.js';

/**
 * Makes Math.random() return the given values in order (then repeat the last one).
 * Game rules are probabilistic, so tests pin the dice instead of retrying until lucky.
 */
export function rigRandom(...values: number[]): void {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

/** Directly sets columns on a player's row, to put them in a specific state before an action. */
export function setPlayerState(roomId: string, userId: string, fields: Record<string, string | number | null>): void {
  const cols = Object.keys(fields);
  const assignments = cols.map((c) => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE user_room_state SET ${assignments} WHERE room_id = @roomId AND user_id = @userId`).run({
    ...fields,
    roomId,
    userId,
  });
}

let counter = 0;
/** A fresh room id per test, so tests sharing the in-memory DB never see each other's players. */
export function newRoom(): string {
  counter += 1;
  return `test-room-${counter}`;
}
