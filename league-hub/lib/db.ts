// Server-side only. Talks to Postgres via Neon's serverless driver.
//
// Works once you install a Postgres integration in Vercel (Storage tab ->
// Marketplace -> Neon is the standard choice) and connect it to this
// project -- that injects DATABASE_URL (and, for compatibility,
// POSTGRES_URL) automatically. No manual setup needed on your end.
//
// Tables are created automatically the first time any admin page runs a
// query (see ensureSchema below) -- there's no SQL to type in yourself.

import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, true> | null = null;

function getClient(): NeonQueryFunction<false, true> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database connection string found (DATABASE_URL / POSTGRES_URL). Connect a Postgres integration to this project in Vercel's Storage tab."
    );
  }
  if (!cached) {
    cached = neon(url, { fullResults: true });
  }
  return cached;
}

// Tagged-template wrapper so call sites keep writing `sql\`SELECT ...\``
// exactly like before, while the actual client is created lazily (so a
// missing connection string only throws when a query actually runs, not
// at import time / build time).
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS team_logos (
      team_id INTEGER PRIMARY KEY,
      logo_url TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS keepers (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS weekly_awards (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      category TEXT NOT NULL,
      player_name TEXT NOT NULL,
      team_id INTEGER,
      note TEXT,
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(season, week, category)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS matchup_content (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      preview TEXT,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(season, week, home_team_id, away_team_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS managers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manager_team_seasons (
      id SERIAL PRIMARY KEY,
      manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL,
      season INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      record_note TEXT,
      UNIQUE(team_id, season)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      season INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      from_manager_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
      to_manager_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  schemaReady = true;
}
