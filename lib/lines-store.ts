// Server-side only. Remembers each player's line and power-play unit so a CHANGE (promoted to L1, added
// to PP1, dropped from the lineup) can be spotted and shown. Compared whenever the pickup page loads
// (at most every 10 minutes) and once a day by the cron job.

import { sql } from "./db";
import { norm, type LineIndex } from "./lines";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS line_state (
      team TEXT NOT NULL,
      player TEXT NOT NULL,
      name TEXT NOT NULL,
      line TEXT,
      pp TEXT,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team, player)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS line_changes (
      id SERIAL PRIMARY KEY,
      team TEXT NOT NULL,
      player TEXT NOT NULL,
      name TEXT NOT NULL,
      from_line TEXT,
      to_line TEXT,
      from_pp TEXT,
      to_pp TEXT,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

export interface LineChange {
  team: string;
  player: string; // normalised name
  name: string;
  fromLine: string | null;
  toLine: string | null;
  fromPp: string | null;
  toPp: string | null;
  changedAt: string;
}

export function describeChange(c: LineChange): string {
  const parts: string[] = [];
  if (c.fromLine !== c.toLine) parts.push(c.toLine === null ? `out of the lineup (was ${c.fromLine})` : c.fromLine === null ? `into the lineup on ${c.toLine}` : `${c.fromLine} → ${c.toLine}`);
  if (c.fromPp !== c.toPp) parts.push(c.toPp === null ? `off ${c.fromPp}` : c.fromPp === null ? `added to ${c.toPp}` : `${c.fromPp} → ${c.toPp}`);
  return parts.join(", ");
}

// Compare the current lines with what was saved, record changes, save the new state. Teams whose lines
// couldn't be read this time are left alone.
export async function syncLines(index: LineIndex): Promise<number> {
  await ensureTables();
  const { rows: fresh } = await sql`SELECT 1 FROM line_state WHERE synced_at > now() - interval '10 minutes' LIMIT 1;`;
  if (fresh.length > 0) return 0;

  let changes = 0;
  for (const team of index.teamsOk) {
    const current = new Map(index.players.filter((p) => p.team === team).map((p) => [norm(p.name), p] as const));
    const { rows } = await sql`SELECT player, name, line, pp FROM line_state WHERE team = ${team};`;
    const saved = new Map((rows as any[]).map((r) => [r.player as string, r] as const));
    const firstTime = saved.size === 0;

    const record = async (player: string, name: string, fl: string | null, tl: string | null, fp: string | null, tp: string | null) => {
      await sql`INSERT INTO line_changes (team, player, name, from_line, to_line, from_pp, to_pp) VALUES (${team}, ${player}, ${name}, ${fl}, ${tl}, ${fp}, ${tp});`;
      changes++;
    };

    for (const [key, p] of Array.from(current.entries())) {
      const old = saved.get(key);
      if (!firstTime && ((old?.line ?? null) !== p.line || (old?.pp ?? null) !== p.pp)) {
        await record(key, p.name, old?.line ?? null, p.line, old?.pp ?? null, p.pp);
      }
      await sql`
        INSERT INTO line_state (team, player, name, line, pp, synced_at) VALUES (${team}, ${key}, ${p.name}, ${p.line}, ${p.pp}, now())
        ON CONFLICT (team, player) DO UPDATE SET name = EXCLUDED.name, line = EXCLUDED.line, pp = EXCLUDED.pp, synced_at = now();
      `;
    }
    for (const [key, old] of Array.from(saved.entries())) {
      if (current.has(key) || (old.line === null && old.pp === null)) continue;
      await record(key, old.name, old.line, null, old.pp, null);
      await sql`UPDATE line_state SET line = NULL, pp = NULL, synced_at = now() WHERE team = ${team} AND player = ${key};`;
    }
  }
  return changes;
}

export async function recentChanges(days = 3): Promise<LineChange[]> {
  await ensureTables();
  const { rows } = await sql`
    SELECT team, player, name, from_line, to_line, from_pp, to_pp, changed_at
    FROM line_changes WHERE changed_at > now() - make_interval(days => ${days}) ORDER BY changed_at DESC LIMIT 300;
  `;
  return (rows as any[]).map((r) => ({
    team: r.team,
    player: r.player,
    name: r.name,
    fromLine: r.from_line,
    toLine: r.to_line,
    fromPp: r.from_pp,
    toPp: r.to_pp,
    changedAt: new Date(r.changed_at).toISOString(),
  }));
}
