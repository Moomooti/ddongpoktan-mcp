import { describe, expect, it } from 'vitest';
import { DIAMOND_SEIZURE_RATE, GOLDEN_TAX_AMOUNT } from '../src/constants.js';
import { getPlayer, getRoom } from '../src/repository.js';
import { throwPoop } from '../src/logic/throwPoop.js';
import { newRoom, rigRandom, setPlayerState } from './helpers.js';

// rollTier boundaries (see species.test.ts): first Math.random() picks the tier,
// the second (basic only) picks which of the 24 basic species.
const BASIC = 0;
const RAINBOW = 0.8;
const BOMB = 0.9;
const GOLDEN = 0.97;
const DIAMOND = 0.995;

describe('throw_poop', () => {
  it('asks for a target when none is given and nobody has attacked yet', () => {
    const room = newRoom();
    expect(throwPoop(room, 'a')).toMatchObject({ error: 'NO_TARGET' });
  });

  it('refuses to throw at yourself', () => {
    const room = newRoom();
    expect(throwPoop(room, 'a', 'a')).toMatchObject({ error: 'SELF_TARGET' });
  });

  it('stacks one poop on the target for a basic throw', () => {
    const room = newRoom();
    rigRandom(BASIC, 0);
    const result = throwPoop(room, 'a', 'b');
    expect(result).toMatchObject({ tier: 'basic', target: 'b', target_new_stack: 1, species_id: 1 });
    expect(getPlayer(room, 'b').stack).toBe(1);
  });

  it('retaliates against the last attacker when target is omitted', () => {
    const room = newRoom();
    rigRandom(BASIC, 0);
    throwPoop(room, 'a', 'b');
    expect(throwPoop(room, 'b')).toMatchObject({ target: 'a' });
  });

  it('records dex discoveries only once per species', () => {
    const room = newRoom();
    rigRandom(BASIC, 0);
    expect(throwPoop(room, 'a', 'b')).toMatchObject({ is_new_discovery: true, dex_collected: 1 });
    expect(throwPoop(room, 'a', 'b')).toMatchObject({ is_new_discovery: false, dex_collected: 1 });
  });

  it('rainbow gives both players good fortune', () => {
    const room = newRoom();
    rigRandom(RAINBOW);
    expect(throwPoop(room, 'a', 'b').event).toBe('rainbow');
    expect(getPlayer(room, 'a').fortune_state).toBe('good');
    expect(getPlayer(room, 'b').fortune_state).toBe('good');
  });

  it('bomb ends the round: every stack in the room is cleared', () => {
    const room = newRoom();
    getPlayer(room, 'c');
    setPlayerState(room, 'c', { stack: 8 });
    const roundBefore = getRoom(room).round_no;
    rigRandom(BOMB);
    expect(throwPoop(room, 'a', 'b').event).toBe('bomb');
    expect(getPlayer(room, 'c').stack).toBe(0);
    expect(getRoom(room).round_no).toBe(roundBefore + 1);
  });

  it('golden taxes every other member (capped at their balance) and pays the thrower', () => {
    const room = newRoom();
    for (const u of ['a', 'b', 'c']) getPlayer(room, u);
    setPlayerState(room, 'b', { coin: 100 });
    setPlayerState(room, 'c', { coin: 5 });
    rigRandom(GOLDEN);
    const result = throwPoop(room, 'a', 'b');
    expect(result.event).toBe('golden');
    expect(result.room_tax?.total).toBe(GOLDEN_TAX_AMOUNT + 5);
    expect(getPlayer(room, 'b').coin).toBe(100 - GOLDEN_TAX_AMOUNT);
    expect(getPlayer(room, 'c').coin).toBe(0);
  });

  it('diamond seizes a share of every other member\'s coins', () => {
    const room = newRoom();
    for (const u of ['a', 'b']) getPlayer(room, u);
    setPlayerState(room, 'b', { coin: 1000 });
    rigRandom(DIAMOND);
    const result = throwPoop(room, 'a', 'b');
    expect(result.event).toBe('diamond');
    expect(result.room_tax?.total).toBe(Math.floor(1000 * DIAMOND_SEIZURE_RATE));
    expect(getPlayer(room, 'a').diamond_lifetime_count).toBe(1);
  });
});
