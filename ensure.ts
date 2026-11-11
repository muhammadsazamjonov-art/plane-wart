import { pool } from "@/db";

// Creates the tables on first use, so a fresh Render / Neon database works
// without running any migration command.
let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!ready) {
    ready = pool
      .query(`
        CREATE TABLE IF NOT EXISTS scores (
          id serial PRIMARY KEY,
          name text NOT NULL,
          score integer NOT NULL,
          mode text NOT NULL,
          map text NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rooms (
          code text PRIMARY KEY,
          map text NOT NULL,
          host text NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_players (
          code text NOT NULL,
          pid text NOT NULL,
          name text NOT NULL,
          state jsonb NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL,
          PRIMARY KEY (code, pid)
        );
      `)
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}
