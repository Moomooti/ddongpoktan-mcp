import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Every test file gets a fresh in-memory SQLite DB (db.ts reads DB_PATH at import time),
    // so tests never touch ./data/game.db and never leak state into each other.
    env: { DB_PATH: ':memory:' },
    isolate: true,
    restoreMocks: true,
  },
});
