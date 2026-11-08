// Server-side only. Who really was a rookie in a season, straight from the NHL's own stats API (its rookie flag: the
// Calder-eligible list, which already applies the NHL's age and games-played rules). Saved to Postgres once per season
// (past seasons never change; the current one is refreshed a few times a day), so a page load doesn't call the NHL.

import { sql } from "./db";
import { nhlSeasonId } from "./season-import";

const REFRESH_CURRENT_MS = 6 * 3600 * 1000;

// Name + group (goalie or skater) is how an ESPN player is matched to the NHL's list: accents and punctuation ignored.
export const rookieKey = (name: string, position: string) =>
  `${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")}|${position === "G" ? "G" : "S"}`;

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS nhl_rookies (
      season INTEGER NOT NULL,
      name TEXT NOT NULL,
      grp TEXT NOT NULL,
      PRIMARY KEY (season, name, grp)
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS nhl_rookies_meta (season INTEGER PRIMARY KEY, fetched_at TIMESTAMPTZ NOT NULL);`;
}

async function fetchRookieNames(season: number): Promise<{ name: string; grp: "S" | "G" }[]> {
  const base = "https://api.nhle.com/stats/rest/en";
  const exp = encodeURIComponent(`gameTypeId=2 and seasonId=${nhlSeasonId(season)} and isRookie=1`);
  const get = async (path: string, field: string, grp: "S" | "G") => {
    const res = await fetch(`${base}/${path}?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${exp}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const json = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    return data.map((d) => ({ name: String(d[field] ?? ""), grp })).filter((x) => x.name);
  };
  const [sk, g] = await Promise.all([get("skater/summary", "skaterFullName", "S"), get("goalie/summary", "goalieFullName", "G")]);
  return [...sk, ...g];
}

// The season's rookie keys (see rookieKey), or null when the NHL's list can't be had (the Calder then falls back to its
// own games-played rules).
export async function loadNhlRookies(season: number, currentSeason: number): Promise<Set<string> | null> {
  await ensureTables();
  const meta = await sql`SELECT fetched_at FROM nhl_rookies_meta WHERE season = ${season};`;
  const at = meta.rows[0] ? new Date(meta.rows[0].fetched_at as string).getTime() : null;
  const stale = at === null || (season === currentSeason && Date.now() - at > REFRESH_CURRENT_MS);
  if (stale) {
    try {
      const names = await fetchRookieNames(season);
      if (names.length > 0) {
        const json = JSON.stringify(names);
        await sql`DELETE FROM nhl_rookies WHERE season = ${season};`;
        await sql`
          INSERT INTO nhl_rookies (season, name, grp)
          SELECT ${season}, r.name, r.grp FROM json_to_recordset(${json}::json) AS r(name text, grp text)
          ON CONFLICT DO NOTHING;
        `;
        await sql`INSERT INTO nhl_rookies_meta (season, fetched_at) VALUES (${season}, now()) ON CONFLICT (season) DO UPDATE SET fetched_at = now();`;
      }
    } catch {
      /* use whatever is already saved */
    }
  }
  const r = await sql`SELECT name, grp FROM nhl_rookies WHERE season = ${season};`;
  if (r.rows.length === 0) return null;
  return new Set(r.rows.map((x) => rookieKey(String(x.name), String(x.grp))));
}
