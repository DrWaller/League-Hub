// Server-side only. Who was on whose roster, season by season: ESPN's roster is read for one day out of every seven
// (about one sample per week) and tallied per team and player, so a manager's "players owned the longest" can be shown.
// A Fantrax season (no day-by-day rosters) uses the end-of-season owner from the imported player list instead.

import { sql } from "./db";
import { base, getJson } from "./draft";
import { getManagers, getManagerSeasons, getSeasonHistory } from "./content";
import { seasonsPlayedElsewhere } from "./played-elsewhere";
import { getImportedSeason, listImportedSeasons } from "./imported-seasons";
import { norm } from "./lines";

const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const STEP = 7; // one roster look per week
const MIN_SAMPLES = 2; // a season counts as "owned" after about two weeks on the roster

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS roster_owned (
      season INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      samples INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'espn',
      PRIMARY KEY (season, team_id, player_id)
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS roster_owned_meta (season INTEGER PRIMARY KEY, periods INTEGER NOT NULL, source TEXT NOT NULL, saved_at TIMESTAMPTZ NOT NULL DEFAULT now());`;
}

export async function ownershipStatus(): Promise<{ season: number; periods: number; source: string; savedAt: string }[]> {
  await ensureTables();
  const r = await sql`SELECT season, periods, source, saved_at FROM roster_owned_meta ORDER BY season DESC;`;
  return r.rows.map((x) => ({ season: Number(x.season), periods: Number(x.periods), source: String(x.source), savedAt: new Date(x.saved_at as string).toISOString() }));
}

async function bulkInsert(season: number, rows: { team: number; id: number; name: string; pos: string; n: number }[], source: string) {
  for (let i = 0; i < rows.length; i += 25) {
    await Promise.all(
      rows.slice(i, i + 25).map(
        (r) => sql`
          INSERT INTO roster_owned (season, team_id, player_id, name, position, samples, source)
          VALUES (${season}, ${r.team}, ${r.id}, ${r.name}, ${r.pos}, ${r.n}, ${source})
          ON CONFLICT (season, team_id, player_id) DO UPDATE SET samples = ${r.n}, name = ${r.name}, position = ${r.pos}, source = ${source};
        `
      )
    );
  }
}

// Reads one season's rosters and saves the tally. Re-running a season replaces it (use it to refresh the current season).
export async function saveSeasonOwnership(season: number): Promise<{ saved: number; periods: number; note: string }> {
  await ensureTables();
  const elsewhere = seasonsPlayedElsewhere(await getSeasonHistory()).has(season);
  if (elsewhere) return saveFantraxOwnership(season);

  const status = await getJson(`${base(season)}?view=mStatus&view=mSettings`);
  const first = Number(status?.status?.firstScoringPeriod ?? 1);
  const last = Number(status?.status?.finalScoringPeriod ?? 0);
  const cur = Number(status?.scoringPeriodId ?? status?.status?.currentScoringPeriod ?? last);
  const end = Math.min(last || cur, cur || last);
  if (!Number.isFinite(first) || !Number.isFinite(end) || end < first) return { saved: 0, periods: 0, note: `ESPN gave no scoring periods for ${season}.` };

  const periods: number[] = [];
  for (let sp = first + 3; sp <= end; sp += STEP) periods.push(sp);
  if (periods.length === 0) periods.push(end);

  const tally = new Map<string, { team: number; id: number; name: string; pos: string; n: number }>();
  let okPeriods = 0;
  for (let i = 0; i < periods.length; i += 6) {
    const batch = await Promise.all(
      periods.slice(i, i + 6).map((sp) => getJson(`${base(season)}?view=mRoster&view=mTeam&scoringPeriodId=${sp}`).catch(() => null))
    );
    for (const data of batch) {
      if (!data?.teams) continue;
      okPeriods++;
      for (const t of data.teams) {
        for (const e of t.roster?.entries ?? []) {
          const pl = e.playerPoolEntry?.player;
          if (!pl) continue;
          const k = `${t.id}|${pl.id}`;
          const cur = tally.get(k) ?? { team: t.id, id: pl.id, name: String(pl.fullName ?? `playerId ${pl.id}`), pos: POS[pl.defaultPositionId] ?? "?", n: 0 };
          cur.n++;
          tally.set(k, cur);
        }
      }
    }
  }
  if (okPeriods === 0) return { saved: 0, periods: 0, note: `ESPN returned no rosters for ${season}.` };
  await sql`DELETE FROM roster_owned WHERE season = ${season};`;
  await bulkInsert(season, [...tally.values()], "espn");
  await sql`INSERT INTO roster_owned_meta (season, periods, source, saved_at) VALUES (${season}, ${okPeriods}, 'espn', now()) ON CONFLICT (season) DO UPDATE SET periods = ${okPeriods}, source = 'espn', saved_at = now();`;
  return { saved: tally.size, periods: okPeriods, note: okPeriods < periods.length ? `${periods.length - okPeriods} roster look(s) failed; counts are slightly low.` : "" };
}

// A season played on Fantrax: the imported player list names each player's owner at the end of the year.
async function saveFantraxOwnership(season: number): Promise<{ saved: number; periods: number; note: string }> {
  const imp = (await listImportedSeasons()).includes(season) ? await getImportedSeason(season) : null;
  if (!imp) return { saved: 0, periods: 0, note: `${season} was played off ESPN and no Fantrax player list is imported for it.` };
  const [managers, assignments] = await Promise.all([getManagers(), getManagerSeasons()]);
  const teams = assignments.filter((a) => a.season === season && a.managerId != null);
  const ownerKey = (owner: string) => {
    const o = norm(owner);
    if (!o) return null;
    return (
      teams.find((t) => {
        const mn = norm(managers.find((m) => m.id === t.managerId)?.name ?? "");
        const tn = norm(t.teamName);
        return o === mn || o === tn || (mn.length >= 3 && o.includes(mn)) || (tn.length >= 3 && tn.includes(o)) || (o.length >= 3 && mn.includes(o));
      })?.teamId ?? null
    );
  };
  const unmatched = new Map<string, number>();
  const rows: { team: number; id: number; name: string; pos: string; n: number }[] = [];
  imp.players.forEach((p, i) => {
    if (!p.owner || p.owner.toUpperCase() === "FA") return;
    const team = ownerKey(p.owner);
    if (team == null) {
      unmatched.set(p.owner, (unmatched.get(p.owner) ?? 0) + 1);
      return;
    }
    rows.push({ team, id: -(p.nhlId ?? 1_000_000_000 + i), name: p.name, pos: p.position, n: MIN_SAMPLES });
  });
  // Everyone drafted that year counts too (a player dropped or traded before the end of the year is missing from the owner list).
  let drafted = 0;
  try {
    const d = await sql`SELECT overall_pick, team_name, player_name, position FROM draft_picks WHERE season = ${season} AND source = 'fantrax';`;
    const have = new Set(rows.map((r) => `${r.team}|${norm(r.name)}`));
    for (const p of d.rows) {
      const team = ownerKey(String(p.team_name ?? ""));
      if (team == null) continue;
      const name = String(p.player_name ?? "");
      if (!name || have.has(`${team}|${norm(name)}`)) continue;
      have.add(`${team}|${norm(name)}`);
      rows.push({ team, id: -(1_500_000_000 + Number(p.overall_pick)), name, pos: String(p.position ?? "?"), n: MIN_SAMPLES });
      drafted++;
    }
  } catch {
    /* no draft saved for that season: owners alone */
  }
  if (rows.length === 0) return { saved: 0, periods: 0, note: `Could not match any Fantrax owner names (${[...unmatched.keys()].slice(0, 6).join(", ")}) to ${season}'s teams.` };
  await sql`DELETE FROM roster_owned WHERE season = ${season};`;
  await bulkInsert(season, rows, "fantrax");
  await sql`INSERT INTO roster_owned_meta (season, periods, source, saved_at) VALUES (${season}, 0, 'fantrax', now()) ON CONFLICT (season) DO UPDATE SET periods = 0, source = 'fantrax', saved_at = now();`;
  return { saved: rows.length, periods: 0, note: `${drafted} drafted player(s) added to the end-of-season owners.${unmatched.size ? ` Owner names not matched to a team: ${[...unmatched.entries()].map(([k, v]) => `${k} (${v})`).join(", ")}.` : ""}` };
}

export interface OwnedPlayer {
  name: string;
  position: string;
  seasons: number[];
  weeks: number; // roughly, from the weekly looks (Fantrax seasons add nothing here)
}

// A manager's players by number of seasons on their roster.
export async function loadOwnedPlayers(managerId: number, top = 6): Promise<{ players: OwnedPlayer[]; seasons: number[] } | null> {
  await ensureTables();
  const [rows, assignments] = await Promise.all([
    sql`SELECT season, team_id, player_id, name, position, samples, source FROM roster_owned;`,
    getManagerSeasons(),
  ]);
  if (rows.rows.length === 0) return null;
  const mine = new Set(assignments.filter((a) => a.managerId === managerId).map((a) => `${a.season}|${a.teamId}`));
  const byPlayer = new Map<string, OwnedPlayer & { seen: Set<number> }>();
  const seasons = new Set<number>();
  for (const r of rows.rows) {
    if (!mine.has(`${r.season}|${r.team_id}`)) continue;
    if (Number(r.samples) < MIN_SAMPLES) continue;
    const season = Number(r.season);
    seasons.add(season);
    // Match across seasons by name (ids differ between ESPN and Fantrax).
    const k = norm(String(r.name));
    const e = byPlayer.get(k) ?? { name: String(r.name), position: String(r.position), seasons: [], weeks: 0, seen: new Set<number>() };
    if (!e.seen.has(season)) {
      e.seen.add(season);
      e.seasons.push(season);
    }
    if (String(r.source) === "espn") e.weeks += Number(r.samples);
    byPlayer.set(k, e);
  }
  if (byPlayer.size === 0) return null;
  const players = [...byPlayer.values()]
    .map(({ seen: _s, ...p }) => ({ ...p, seasons: p.seasons.sort((a, b) => a - b) }))
    .sort((a, b) => b.seasons.length - a.seasons.length || b.weeks - a.weeks || a.name.localeCompare(b.name))
    .slice(0, top);
  return { players, seasons: [...seasons].sort((a, b) => a - b) };
}
