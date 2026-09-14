// Server-side only. Read/write helpers for the editorial content tables
// (logos, keepers, weekly awards, matchup blurbs). Public pages call the
// "get" functions; admin API routes call the "set/upsert" ones.
//
// "get" functions fail gracefully (return empty results) if Postgres isn't
// connected yet, so public pages never crash before you've set up Storage
// in Vercel -- they just show nothing for that section. "set/upsert/add"
// functions used by the admin area intentionally throw on failure, since
// the admin area should surface an error rather than silently lose an edit.

import { sql, ensureSchema } from "./db";
import { AwardCategory, WeeklyAward, MatchupContent, KeeperRecord, Manager, ManagerSeason, Trade } from "./types";

export async function getTeamLogos(): Promise<Record<number, string>> {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT team_id, logo_url FROM team_logos;`;
    const map: Record<number, string> = {};
    for (const row of rows) map[row.team_id as number] = row.logo_url as string;
    return map;
  } catch (err) {
    console.error("getTeamLogos failed (is Postgres connected?)", err);
    return {};
  }
}

export async function setTeamLogo(teamId: number, logoUrl: string) {
  await ensureSchema();
  await sql`
    INSERT INTO team_logos (team_id, logo_url, updated_at)
    VALUES (${teamId}, ${logoUrl}, now())
    ON CONFLICT (team_id) DO UPDATE SET logo_url = ${logoUrl}, updated_at = now();
  `;
}

export async function getKeepers(season?: number): Promise<KeeperRecord[]> {
  try {
    await ensureSchema();
    const { rows } = season
      ? await sql`SELECT id, season, team_id, player_name, note FROM keepers WHERE season = ${season} ORDER BY team_id;`
      : await sql`SELECT id, season, team_id, player_name, note FROM keepers ORDER BY season DESC, team_id;`;
    return rows.map((r) => ({
      id: r.id as number,
      season: r.season as number,
      teamId: r.team_id as number,
      playerName: r.player_name as string,
      note: (r.note as string) ?? null,
    }));
  } catch (err) {
    console.error("getKeepers failed (is Postgres connected?)", err);
    return [];
  }
}

export async function addKeeper(season: number, teamId: number, playerName: string, note: string | null) {
  await ensureSchema();
  await sql`
    INSERT INTO keepers (season, team_id, player_name, note)
    VALUES (${season}, ${teamId}, ${playerName}, ${note});
  `;
}

export async function deleteKeeper(id: number) {
  await ensureSchema();
  await sql`DELETE FROM keepers WHERE id = ${id};`;
}

export async function getWeeklyAwards(season: number, week: number): Promise<WeeklyAward[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT season, week, category, player_name, team_id, note
      FROM weekly_awards WHERE season = ${season} AND week = ${week};
    `;
    return rows.map((r) => ({
      season: r.season as number,
      week: r.week as number,
      category: r.category as AwardCategory,
      playerName: r.player_name as string,
      teamId: (r.team_id as number) ?? null,
      note: (r.note as string) ?? null,
    }));
  } catch (err) {
    console.error("getWeeklyAwards failed (is Postgres connected?)", err);
    return [];
  }
}

export async function upsertWeeklyAward(
  season: number,
  week: number,
  category: AwardCategory,
  playerName: string,
  teamId: number | null,
  note: string | null
) {
  await ensureSchema();
  await sql`
    INSERT INTO weekly_awards (season, week, category, player_name, team_id, note, updated_at)
    VALUES (${season}, ${week}, ${category}, ${playerName}, ${teamId}, ${note}, now())
    ON CONFLICT (season, week, category)
    DO UPDATE SET player_name = ${playerName}, team_id = ${teamId}, note = ${note}, updated_at = now();
  `;
}

export async function getMatchupContent(season: number, week: number): Promise<MatchupContent[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT season, week, home_team_id, away_team_id, preview, summary
      FROM matchup_content WHERE season = ${season} AND week = ${week};
    `;
    return rows.map((r) => ({
      season: r.season as number,
      week: r.week as number,
      homeTeamId: r.home_team_id as number,
      awayTeamId: r.away_team_id as number,
      preview: (r.preview as string) ?? null,
      summary: (r.summary as string) ?? null,
    }));
  } catch (err) {
    console.error("getMatchupContent failed (is Postgres connected?)", err);
    return [];
  }
}

export async function upsertMatchupContent(
  season: number,
  week: number,
  homeTeamId: number,
  awayTeamId: number,
  preview: string | null,
  summary: string | null
) {
  await ensureSchema();
  await sql`
    INSERT INTO matchup_content (season, week, home_team_id, away_team_id, preview, summary, updated_at)
    VALUES (${season}, ${week}, ${homeTeamId}, ${awayTeamId}, ${preview}, ${summary}, now())
    ON CONFLICT (season, week, home_team_id, away_team_id)
    DO UPDATE SET preview = ${preview}, summary = ${summary}, updated_at = now();
  `;
}

// --- Managers ---

export async function getManagers(): Promise<Manager[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT id, name, notes FROM managers ORDER BY name;`;
    return rows.map((r) => ({ id: r.id as number, name: r.name as string, notes: (r.notes as string) ?? null }));
  } catch (err) {
    console.error("getManagers failed (is Postgres connected?)", err);
    return [];
  }
}

export async function addManager(name: string, notes: string | null): Promise<number> {
  await ensureSchema();
  const { rows } = await sql`
    INSERT INTO managers (name, notes) VALUES (${name}, ${notes}) RETURNING id;
  `;
  return rows[0].id as number;
}

export async function deleteManager(id: number) {
  await ensureSchema();
  await sql`DELETE FROM managers WHERE id = ${id};`;
}

export async function getManagerSeasons(managerId?: number): Promise<ManagerSeason[]> {
  try {
    await ensureSchema();
    const { rows } = managerId
      ? await sql`SELECT id, manager_id, team_id, season, team_name, record_note FROM manager_team_seasons WHERE manager_id = ${managerId} ORDER BY season;`
      : await sql`SELECT id, manager_id, team_id, season, team_name, record_note FROM manager_team_seasons ORDER BY season, team_id;`;
    return rows.map((r) => ({
      id: r.id as number,
      managerId: r.manager_id as number,
      teamId: r.team_id as number,
      season: r.season as number,
      teamName: r.team_name as string,
      recordNote: (r.record_note as string) ?? null,
    }));
  } catch (err) {
    console.error("getManagerSeasons failed (is Postgres connected?)", err);
    return [];
  }
}

export async function upsertManagerSeason(
  managerId: number,
  teamId: number,
  season: number,
  teamName: string,
  recordNote: string | null
) {
  await ensureSchema();
  await sql`
    INSERT INTO manager_team_seasons (manager_id, team_id, season, team_name, record_note)
    VALUES (${managerId}, ${teamId}, ${season}, ${teamName}, ${recordNote})
    ON CONFLICT (team_id, season)
    DO UPDATE SET manager_id = ${managerId}, team_name = ${teamName}, record_note = ${recordNote};
  `;
}

export async function deleteManagerSeason(id: number) {
  await ensureSchema();
  await sql`DELETE FROM manager_team_seasons WHERE id = ${id};`;
}

// --- Trades ---

export async function getTrades(season?: number): Promise<Trade[]> {
  try {
    await ensureSchema();
    const { rows } = season
      ? await sql`SELECT id, season, player_name, from_manager_id, to_manager_id, note FROM trades WHERE season = ${season} ORDER BY id DESC;`
      : await sql`SELECT id, season, player_name, from_manager_id, to_manager_id, note FROM trades ORDER BY season DESC, id DESC;`;
    return rows.map((r) => ({
      id: r.id as number,
      season: r.season as number,
      playerName: r.player_name as string,
      fromManagerId: (r.from_manager_id as number) ?? null,
      toManagerId: (r.to_manager_id as number) ?? null,
      note: (r.note as string) ?? null,
    }));
  } catch (err) {
    console.error("getTrades failed (is Postgres connected?)", err);
    return [];
  }
}

export async function addTrade(
  season: number,
  playerName: string,
  fromManagerId: number | null,
  toManagerId: number | null,
  note: string | null
) {
  await ensureSchema();
  await sql`
    INSERT INTO trades (season, player_name, from_manager_id, to_manager_id, note)
    VALUES (${season}, ${playerName}, ${fromManagerId}, ${toManagerId}, ${note});
  `;
}

export async function deleteTrade(id: number) {
  await ensureSchema();
  await sql`DELETE FROM trades WHERE id = ${id};`;
}
