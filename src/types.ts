export type Tier = 'basic' | 'rainbow' | 'bomb' | 'golden' | 'diamond';

export type FortuneState = 'none' | 'good' | 'bad';

export interface SpeciesDef {
  speciesId: number;
  tier: Tier;
  name: string;
  probability: number;
}

export interface PlayerRow {
  room_id: string;
  user_id: string;
  stack: number;
  coin: number;
  enhance_level: number;
  enhance_fail_streak: number;
  fortune_state: FortuneState;
  fortune_expires_at: string | null;
  last_attacker_id: string | null;
  last_daily_bonus_date: string | null;
  welcome_bonus_given: number;
  diamond_lifetime_count: number;
  golden_event_count: number;
  rainbow_hit_count: number;
  equipped_skin: string;
  daily_throw_count: number;
  daily_throw_date: string | null;
}

export interface RoomRow {
  room_id: string;
  round_no: number;
  bomb_triggered_at: string | null;
  bomb_winner_user_id: string | null;
  golden_holder_id: string | null;
  golden_expires_at: string | null;
}

export interface CoinLedgerEntry {
  delta: number;
  reason: string;
  created_at: string;
}

export interface DexEntry {
  species_id: number;
  hit_count: number;
  first_hit_at: string;
  name: string;
  tier: Tier;
  probability: number;
}

export interface RoomTax {
  label: string;
  entries: { userId: string; amount: number }[];
  total: number;
}

export interface ThrowResult {
  error?: 'NO_TARGET' | 'SELF_TARGET';
  message?: string;
  species_id?: number;
  species_name?: string;
  tier?: Tier;
  target?: string;
  target_new_stack?: number;
  coin_earned?: number;
  daily_bonus?: boolean;
  event?: 'rainbow' | 'bomb' | 'golden' | 'diamond';
  unlocked_skins?: string[];
  room_tax?: RoomTax;
  is_new_discovery?: boolean;
  dex_collected?: number;
  dex_total?: number;
  today_throw_count?: number;
}
