import { db } from './db.js';
import { COIN_REWARD, DIAMOND_SEIZURE_RATE, GOLDEN_TAX_AMOUNT, MAX_STACK } from './constants.js';
import { SPECIES } from './species.js';
import type { CoinLedgerEntry, DexEntry, FortuneState, PlayerRow, RoomRow } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

function todayKst(): string {
  // KST = UTC+9. Used only to key the once-a-day attendance bonus.
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function ensureRoom(roomId: string): void {
  db.prepare('INSERT INTO room_state (room_id) VALUES (?) ON CONFLICT(room_id) DO NOTHING').run(roomId);
}

/** Implicit registration: first tool call for a (room, user) pair auto-joins and grants the welcome bonus. */
export function ensurePlayer(roomId: string, userId: string): { isNew: boolean } {
  ensureRoom(roomId);
  const existing = db
    .prepare('SELECT 1 FROM user_room_state WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId);
  if (existing) return { isNew: false };

  db.prepare(
    'INSERT INTO user_room_state (room_id, user_id, welcome_bonus_given) VALUES (?, ?, 1)',
  ).run(roomId, userId);
  creditCoin(roomId, userId, COIN_REWARD.welcome, 'welcome');
  return { isNew: true };
}

export function getPlayer(roomId: string, userId: string): PlayerRow {
  ensurePlayer(roomId, userId);
  clearExpiredGoodFortune(roomId, userId);
  return db
    .prepare('SELECT * FROM user_room_state WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId) as PlayerRow;
}

export function getRoom(roomId: string): RoomRow {
  ensureRoom(roomId);
  return db.prepare('SELECT * FROM room_state WHERE room_id = ?').get(roomId) as RoomRow;
}

export function addStack(roomId: string, userId: string, delta: number): number {
  const player = getPlayer(roomId, userId);
  const newStack = Math.max(0, Math.min(MAX_STACK, player.stack + delta));
  db.prepare('UPDATE user_room_state SET stack = ? WHERE room_id = ? AND user_id = ?').run(
    newStack,
    roomId,
    userId,
  );
  if (newStack >= MAX_STACK) {
    setFortune(roomId, userId, 'bad');
  }
  return newStack;
}

export function resetStack(roomId: string, userId: string): void {
  db.prepare('UPDATE user_room_state SET stack = 0 WHERE room_id = ? AND user_id = ?').run(
    roomId,
    userId,
  );
}

export function setFortune(
  roomId: string,
  userId: string,
  state: FortuneState,
  durationMs?: number,
): void {
  const expiresAt = state === 'good' && durationMs ? new Date(Date.now() + durationMs).toISOString() : null;
  db.prepare(
    'UPDATE user_room_state SET fortune_state = ?, fortune_expires_at = ? WHERE room_id = ? AND user_id = ?',
  ).run(state, expiresAt, roomId, userId);
}

export function clearExpiredGoodFortune(roomId: string, userId: string): void {
  const row = db
    .prepare('SELECT fortune_state, fortune_expires_at FROM user_room_state WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId) as { fortune_state: FortuneState; fortune_expires_at: string | null } | undefined;
  if (
    row?.fortune_state === 'good' &&
    row.fortune_expires_at &&
    new Date(row.fortune_expires_at).getTime() < Date.now()
  ) {
    db.prepare(
      "UPDATE user_room_state SET fortune_state = 'none', fortune_expires_at = NULL WHERE room_id = ? AND user_id = ?",
    ).run(roomId, userId);
  }
}

/** Bad fortune blocks all coin gains (DESIGN.md §2.2). Returns the balance after the attempt. */
export function creditCoin(roomId: string, userId: string, amount: number, reason: string): number {
  ensureRoom(roomId);
  const row = db
    .prepare('SELECT coin, fortune_state FROM user_room_state WHERE room_id = ? AND user_id = ?')
    .get(roomId, userId) as { coin: number; fortune_state: FortuneState } | undefined;
  const currentCoin = row?.coin ?? 0;
  if (row?.fortune_state === 'bad') {
    return currentCoin;
  }
  const newCoin = currentCoin + amount;
  db.prepare('UPDATE user_room_state SET coin = ? WHERE room_id = ? AND user_id = ?').run(
    newCoin,
    roomId,
    userId,
  );
  db.prepare(
    'INSERT INTO coin_ledger (room_id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(roomId, userId, amount, reason, nowIso());
  return newCoin;
}

export function debitCoin(roomId: string, userId: string, amount: number, reason: string): boolean {
  const player = getPlayer(roomId, userId);
  if (player.coin < amount) return false;
  const newCoin = player.coin - amount;
  db.prepare('UPDATE user_room_state SET coin = ? WHERE room_id = ? AND user_id = ?').run(
    newCoin,
    roomId,
    userId,
  );
  db.prepare(
    'INSERT INTO coin_ledger (room_id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(roomId, userId, -amount, reason, nowIso());
  return true;
}

export interface DexHitResult {
  isNew: boolean;
  collectedCount: number;
}

export function recordDexHit(roomId: string, userId: string, speciesId: number): DexHitResult {
  ensurePlayer(roomId, userId);
  const existing = db
    .prepare('SELECT 1 FROM user_dex WHERE room_id = ? AND user_id = ? AND species_id = ?')
    .get(roomId, userId, speciesId);
  db.prepare(
    `INSERT INTO user_dex (room_id, user_id, species_id, hit_count, first_hit_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(room_id, user_id, species_id) DO UPDATE SET hit_count = hit_count + 1`,
  ).run(roomId, userId, speciesId, nowIso());
  const collectedCount = (
    db.prepare('SELECT COUNT(*) AS n FROM user_dex WHERE room_id = ? AND user_id = ?').get(roomId, userId) as {
      n: number;
    }
  ).n;
  return { isNew: !existing, collectedCount };
}

/** Resets to 1 on a new KST day, otherwise increments. Returns the count after this throw. */
export function incrementDailyThrowCount(roomId: string, userId: string): number {
  const player = getPlayer(roomId, userId);
  const today = todayKst();
  const count = player.daily_throw_date === today ? player.daily_throw_count + 1 : 1;
  db.prepare(
    'UPDATE user_room_state SET daily_throw_count = ?, daily_throw_date = ? WHERE room_id = ? AND user_id = ?',
  ).run(count, today, roomId, userId);
  return count;
}

/** Switches the caller's equipped toilet skin. lv0_worn is always allowed (default skin). */
export function setEquippedSkin(roomId: string, userId: string, skinId: string): boolean {
  if (skinId !== 'lv0_worn' && !getUnlockedSkins(roomId, userId).includes(skinId)) return false;
  ensurePlayer(roomId, userId);
  db.prepare('UPDATE user_room_state SET equipped_skin = ? WHERE room_id = ? AND user_id = ?').run(
    skinId,
    roomId,
    userId,
  );
  return true;
}

export function getDex(roomId: string, userId: string): DexEntry[] {
  return db
    .prepare(
      `SELECT ud.species_id, ud.hit_count, ud.first_hit_at, ps.name, ps.tier, ps.probability
       FROM user_dex ud JOIN poop_species ps ON ps.species_id = ud.species_id
       WHERE ud.room_id = ? AND ud.user_id = ?
       ORDER BY ud.species_id`,
    )
    .all(roomId, userId) as DexEntry[];
}

export function getRecentLedger(roomId: string, userId: string, limit = 10): CoinLedgerEntry[] {
  return db
    .prepare(
      'SELECT delta, reason, created_at FROM coin_ledger WHERE room_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(roomId, userId, limit) as CoinLedgerEntry[];
}

export function logEnhanceAttempt(
  roomId: string,
  userId: string,
  fromLevel: number,
  success: boolean,
  resetTriggered: boolean,
): void {
  db.prepare(
    'INSERT INTO enhance_log (room_id, user_id, from_level, success, reset_triggered, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(roomId, userId, fromLevel, success ? 1 : 0, resetTriggered ? 1 : 0, nowIso());
}

export function setEnhanceState(
  roomId: string,
  userId: string,
  newLevel: number,
  newFailStreak: number,
): void {
  db.prepare(
    'UPDATE user_room_state SET enhance_level = ?, enhance_fail_streak = ? WHERE room_id = ? AND user_id = ?',
  ).run(newLevel, newFailStreak, roomId, userId);
}

export function incrementRainbowHitCount(roomId: string, userId: string): void {
  db.prepare(
    'UPDATE user_room_state SET rainbow_hit_count = rainbow_hit_count + 1 WHERE room_id = ? AND user_id = ?',
  ).run(roomId, userId);
}

export function incrementGoldenEventCount(roomId: string, userId: string): void {
  db.prepare(
    'UPDATE user_room_state SET golden_event_count = golden_event_count + 1 WHERE room_id = ? AND user_id = ?',
  ).run(roomId, userId);
}

export function incrementDiamondLifetimeCount(roomId: string, userId: string): void {
  db.prepare(
    'UPDATE user_room_state SET diamond_lifetime_count = diamond_lifetime_count + 1 WHERE room_id = ? AND user_id = ?',
  ).run(roomId, userId);
}

export function getRoomMembers(roomId: string): string[] {
  return (
    db.prepare('SELECT user_id FROM user_room_state WHERE room_id = ?').all(roomId) as { user_id: string }[]
  ).map((r) => r.user_id);
}

export interface TaxEntry {
  userId: string;
  amount: number;
}

/** DESIGN.md §2.2 - golden poop tax: every other room member pays GOLDEN_TAX_AMOUNT
 *  (or their full balance if lower); the thrower collects the total. */
export function applyGoldenTax(roomId: string, throwerId: string): TaxEntry[] {
  const entries: TaxEntry[] = [];
  let total = 0;
  for (const memberId of getRoomMembers(roomId)) {
    if (memberId === throwerId) continue;
    const player = getPlayer(roomId, memberId);
    const amount = Math.min(GOLDEN_TAX_AMOUNT, player.coin);
    if (amount > 0) {
      debitCoin(roomId, memberId, amount, 'golden_tax');
      total += amount;
    }
    entries.push({ userId: memberId, amount });
  }
  if (total > 0) creditCoin(roomId, throwerId, total, 'golden_tax_collected');
  return entries;
}

/** Diamond poop "광역 자산 압류": every other room member loses DIAMOND_SEIZURE_RATE
 *  of their current balance; the thrower collects the total. */
export function applyDiamondSeizure(roomId: string, throwerId: string): TaxEntry[] {
  const entries: TaxEntry[] = [];
  let total = 0;
  for (const memberId of getRoomMembers(roomId)) {
    if (memberId === throwerId) continue;
    const player = getPlayer(roomId, memberId);
    const amount = Math.floor(player.coin * DIAMOND_SEIZURE_RATE);
    if (amount > 0) {
      debitCoin(roomId, memberId, amount, 'diamond_seizure');
      total += amount;
    }
    entries.push({ userId: memberId, amount });
  }
  if (total > 0) creditCoin(roomId, throwerId, total, 'diamond_seizure_collected');
  return entries;
}

export function setLastAttacker(roomId: string, targetId: string, attackerId: string): void {
  ensurePlayer(roomId, targetId);
  db.prepare('UPDATE user_room_state SET last_attacker_id = ? WHERE room_id = ? AND user_id = ?').run(
    attackerId,
    roomId,
    targetId,
  );
}

/** DESIGN.md §2.5 (TBD #4): a bomb ends the round - stack/fortune reset for everyone in the room,
 *  coin/enhance level/dex/skins persist. */
export function endRound(roomId: string, winnerId: string): void {
  ensureRoom(roomId);
  db.prepare(
    'UPDATE room_state SET round_no = round_no + 1, bomb_triggered_at = ?, bomb_winner_user_id = ? WHERE room_id = ?',
  ).run(nowIso(), winnerId, roomId);
  db.prepare(
    "UPDATE user_room_state SET stack = 0, fortune_state = 'none', fortune_expires_at = NULL WHERE room_id = ?",
  ).run(roomId);
}

/** Returns true (and credits the bonus) only the first time this is called for a given KST day. */
export function applyDailyBonusIfNeeded(roomId: string, userId: string): boolean {
  const player = getPlayer(roomId, userId);
  const today = todayKst();
  if (player.last_daily_bonus_date === today) return false;
  db.prepare(
    'UPDATE user_room_state SET last_daily_bonus_date = ? WHERE room_id = ? AND user_id = ?',
  ).run(today, roomId, userId);
  creditCoin(roomId, userId, COIN_REWARD.dailyFirstThrow, 'daily_first_throw');
  return true;
}

export function unlockSkin(roomId: string, userId: string, skinId: string): boolean {
  const result = db
    .prepare(
      'INSERT INTO user_skin (room_id, user_id, skin_id, unlocked_at) VALUES (?, ?, ?, ?) ON CONFLICT(room_id, user_id, skin_id) DO NOTHING',
    )
    .run(roomId, userId, skinId, nowIso());
  return result.changes > 0;
}

export function getUnlockedSkins(roomId: string, userId: string): string[] {
  return (
    db.prepare('SELECT skin_id FROM user_skin WHERE room_id = ? AND user_id = ?').all(roomId, userId) as {
      skin_id: string;
    }[]
  ).map((r) => r.skin_id);
}

const LEVEL_SKINS = ['lv1_white', 'lv2_stainless', 'lv3_marble', 'lv4_nanotech', 'lv5_throne'];

/** DESIGN.md §6 skin unlock mapping. Returns any newly-unlocked skin ids. */
export function checkAndUnlockSkins(roomId: string, userId: string): string[] {
  const player = getPlayer(roomId, userId);
  const newlyUnlocked: string[] = [];

  for (let lv = 1; lv <= player.enhance_level && lv <= 5; lv++) {
    if (unlockSkin(roomId, userId, LEVEL_SKINS[lv - 1])) newlyUnlocked.push(LEVEL_SKINS[lv - 1]);
  }
  if (player.rainbow_hit_count >= 50 && unlockSkin(roomId, userId, 'rainbow')) {
    newlyUnlocked.push('rainbow');
  }
  if (player.golden_event_count >= 15 && unlockSkin(roomId, userId, 'golden')) {
    newlyUnlocked.push('golden');
  }
  if (player.diamond_lifetime_count >= 1 && unlockSkin(roomId, userId, 'diamond')) {
    newlyUnlocked.push('diamond');
  }
  const dexCollected = getDex(roomId, userId).length;
  if (dexCollected >= SPECIES.length && unlockSkin(roomId, userId, 'allstar')) {
    newlyUnlocked.push('allstar');
  }
  return newlyUnlocked;
}
