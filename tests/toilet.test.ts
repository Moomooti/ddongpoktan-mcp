import { describe, expect, it } from 'vitest';
import { BIDET_COST, COIN_REWARD, ENHANCE_TABLE, MAX_STACK, PERFUME_COST } from '../src/constants.js';
import { creditCoin, getPlayer } from '../src/repository.js';
import { enhanceToilet } from '../src/logic/enhanceToilet.js';
import { flushToilet } from '../src/logic/flushToilet.js';
import { useBidet } from '../src/logic/useBidet.js';
import { usePerfume } from '../src/logic/usePerfume.js';
import { newRoom, rigRandom, setPlayerState } from './helpers.js';

describe('first contact', () => {
  it('auto-registers a new player with the welcome bonus', () => {
    const room = newRoom();
    expect(getPlayer(room, 'a').coin).toBe(COIN_REWARD.welcome);
  });

  it('keeps state separate per room', () => {
    const r1 = newRoom();
    const r2 = newRoom();
    setPlayerState(r1, 'a', { coin: 9999 });
    getPlayer(r1, 'a');
    expect(getPlayer(r2, 'a').coin).toBe(COIN_REWARD.welcome);
  });
});

describe('flush_toilet', () => {
  it('clears the stack on success', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { stack: 7 });
    rigRandom(0); // 0 < 0.6 -> success
    expect(flushToilet(room, 'a')).toEqual({ success: true, new_stack: 0 });
  });

  it('adds 1-3 poop on failure', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { stack: 2 });
    rigRandom(0.99, 0.99); // fail, then max penalty (3)
    expect(flushToilet(room, 'a')).toEqual({ success: false, new_stack: 5 });
  });

  it('uses the enhanced flush rate (Lv.5 = 85%)', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { enhance_level: 5, stack: 3 });
    rigRandom(0.84); // would fail at Lv.0 (60%), succeeds at Lv.5
    expect(flushToilet(room, 'a').success).toBe(true);
  });

  it('caps the stack at MAX_STACK and turns fortune bad, which blocks coin gains', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { stack: MAX_STACK - 1 });
    rigRandom(0.99, 0.99);
    expect(flushToilet(room, 'a').new_stack).toBe(MAX_STACK);
    const before = getPlayer(room, 'a');
    expect(before.fortune_state).toBe('bad');
    expect(creditCoin(room, 'a', 100, 'test')).toBe(before.coin);
  });
});

describe('enhance_toilet', () => {
  it('levels up and spends the cost on success', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { coin: 1000 });
    rigRandom(0);
    const result = enhanceToilet(room, 'a');
    expect(result).toMatchObject({ success: true, new_level: 1, coin_spent: ENHANCE_TABLE[0].cost });
    expect(result.unlocked_skins).toContain('lv1_white');
    expect(getPlayer(room, 'a').coin).toBe(1000 - ENHANCE_TABLE[0].cost);
  });

  it('refuses without enough coin and charges nothing', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { coin: 10 });
    const result = enhanceToilet(room, 'a');
    expect(result).toMatchObject({ success: false, coin_spent: 0, new_level: 0 });
    expect(getPlayer(room, 'a').coin).toBe(10);
  });

  it('never resets on failures below Lv.3', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { coin: 100_000, enhance_level: 1 });
    rigRandom(0.99);
    enhanceToilet(room, 'a');
    const second = enhanceToilet(room, 'a');
    expect(second).toMatchObject({ success: false, new_level: 1, reset_triggered: false });
  });

  it('resets to Lv.0 after two straight failures when aiming for Lv.3+', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { coin: 100_000, enhance_level: 3 });
    rigRandom(0.99);
    expect(enhanceToilet(room, 'a')).toMatchObject({ new_level: 3, reset_triggered: false });
    expect(enhanceToilet(room, 'a')).toMatchObject({ new_level: 0, reset_triggered: true });
  });

  it('stops at Lv.5', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { coin: 100_000, enhance_level: 5 });
    expect(enhanceToilet(room, 'a')).toMatchObject({ success: false, new_level: 5, coin_spent: 0 });
  });
});

describe('bidet and perfume', () => {
  it('bidet clears bad fortune for BIDET_COST', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { fortune_state: 'bad', coin: 100 });
    expect(useBidet(room, 'a')).toEqual({ changed: true, fortune_state: 'none' });
    expect(getPlayer(room, 'a').coin).toBe(100 - BIDET_COST);
  });

  it('bidet does nothing (and charges nothing) when fortune is not bad', () => {
    const room = newRoom();
    const coin = getPlayer(room, 'a').coin;
    expect(useBidet(room, 'a').changed).toBe(false);
    expect(getPlayer(room, 'a').coin).toBe(coin);
  });

  it('perfume always clears the stack for PERFUME_COST', () => {
    const room = newRoom();
    getPlayer(room, 'a');
    setPlayerState(room, 'a', { stack: 9, coin: 500 });
    expect(usePerfume(room, 'a')).toEqual({ success: true, new_stack: 0 });
    expect(getPlayer(room, 'a').coin).toBe(500 - PERFUME_COST);
  });
});
