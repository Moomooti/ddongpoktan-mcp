import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SPECIES } from './species.js';

const DB_PATH = process.env.DB_PATH ?? './data/game.db';

const dir = path.dirname(DB_PATH);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS poop_species (
  species_id   INTEGER PRIMARY KEY,
  tier         TEXT NOT NULL,
  name         TEXT NOT NULL,
  probability  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS room_state (
  room_id             TEXT PRIMARY KEY,
  round_no            INTEGER NOT NULL DEFAULT 1,
  bomb_triggered_at   TEXT,
  bomb_winner_user_id TEXT,
  golden_holder_id    TEXT,
  golden_expires_at   TEXT
);

CREATE TABLE IF NOT EXISTS user_room_state (
  room_id                TEXT NOT NULL,
  user_id                TEXT NOT NULL,
  stack                  INTEGER NOT NULL DEFAULT 0,
  coin                   INTEGER NOT NULL DEFAULT 0,
  enhance_level          INTEGER NOT NULL DEFAULT 0,
  enhance_fail_streak    INTEGER NOT NULL DEFAULT 0,
  fortune_state          TEXT NOT NULL DEFAULT 'none',
  fortune_expires_at     TEXT,
  last_attacker_id       TEXT,
  last_daily_bonus_date  TEXT,
  welcome_bonus_given    INTEGER NOT NULL DEFAULT 0,
  diamond_lifetime_count INTEGER NOT NULL DEFAULT 0,
  golden_event_count     INTEGER NOT NULL DEFAULT 0,
  rainbow_hit_count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_dex (
  room_id      TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  species_id   INTEGER NOT NULL REFERENCES poop_species(species_id),
  hit_count    INTEGER NOT NULL DEFAULT 0,
  first_hit_at TEXT,
  PRIMARY KEY (room_id, user_id, species_id)
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enhance_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  from_level      INTEGER NOT NULL,
  success         INTEGER NOT NULL,
  reset_triggered INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_skin (
  room_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  skin_id     TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id, skin_id)
);
`);

const seedCount = db.prepare('SELECT COUNT(*) AS n FROM poop_species').get() as { n: number };
if (seedCount.n === 0) {
  const insert = db.prepare(
    'INSERT INTO poop_species (species_id, tier, name, probability) VALUES (?, ?, ?, ?)',
  );
  const seedAll = db.transaction(() => {
    for (const s of SPECIES) {
      insert.run(s.speciesId, s.tier, s.name, s.probability);
    }
  });
  seedAll();
}
