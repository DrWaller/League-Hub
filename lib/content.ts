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
import { hideEspnDataForSeasons, seasonsPlayedElsewhere } from "./played-elsewhere";
import { EMPTY_RULES, SeasonRules } from "./season-rules";
import {
  AwardCategory,
  WeeklyAward,
  MatchupContent,
  KeeperRecord,
  Manager,
  ManagerSeason,
  Trade,
  MonthlyPeriod,
  MonthlyAward,
  NewsletterIntro,
  NewsletterPeriodType,
  SeasonHistoryRecord,
  ManualTeam,
  Matchup,
} from "./types";

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
      ? await sql`SELECT id, manager_id, team_id, season, team_name, record_note, wins, losses, ties, points_for, points_against FROM manager_team_seasons WHERE manager_id = ${managerId} ORDER BY season;`
      : await sql`SELECT id, manager_id, team_id, season, team_name, record_note, wins, losses, ties, points_for, points_against FROM manager_team_seasons ORDER BY season, team_id;`;
    const mapped: ManagerSeason[] = rows.map((r) => ({
      id: r.id as number,
      managerId: (r.manager_id as number) ?? null,
      teamId: r.team_id as number,
      season: r.season as number,
      teamName: r.team_name as string,
      recordNote: (r.record_note as string) ?? null,
      wins: (r.wins as number) ?? null,
      losses: (r.losses as number) ?? null,
      ties: (r.ties as number) ?? null,
      pointsFor: (r.points_for as number) ?? null,
      pointsAgainst: (r.points_against as number) ?? null,
    }));
    // Seasons played on another platform never carry ESPN records.
    return hideEspnDataForSeasons(mapped, await getPlayedElsewhereSeasons());
  } catch (err) {
    console.error("getManagerSeasons failed (is Postgres connected?)", err);
    return [];
  }
}

// Assigns/reassigns which manager owned a team-season, and lets the admin
// set the display name / a free-text note. Deliberately does NOT touch the
// win/loss/points columns, so it's safe to run before or after a records
// import without clobbering either side's data.
export async function upsertManagerAssignment(
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

// Imports a real W-L record pulled from ESPN for one team-season. Creates
// the row if it doesn't exist yet (with no manager assigned -- that's a
// separate step via upsertManagerAssignment), or updates just the record
// fields (and the ESPN-sourced team name) if it does, leaving any existing
// manager assignment and record_note untouched.
export async function upsertHistoricalRecord(
  teamId: number,
  season: number,
  teamName: string,
  wins: number,
  losses: number,
  ties: number,
  pointsFor: number,
  pointsAgainst: number
) {
  await ensureSchema();
  await sql`
    INSERT INTO manager_team_seasons (team_id, season, team_name, wins, losses, ties, points_for, points_against)
    VALUES (${teamId}, ${season}, ${teamName}, ${wins}, ${losses}, ${ties}, ${pointsFor}, ${pointsAgainst})
    ON CONFLICT (team_id, season)
    DO UPDATE SET team_name = ${teamName}, wins = ${wins}, losses = ${losses}, ties = ${ties},
      points_for = ${pointsFor}, points_against = ${pointsAgainst};
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
      ? await sql`SELECT id, season, week, player_name, from_manager_id, to_manager_id, note FROM trades WHERE season = ${season} ORDER BY id DESC;`
      : await sql`SELECT id, season, week, player_name, from_manager_id, to_manager_id, note FROM trades ORDER BY season DESC, id DESC;`;
    return rows.map((r) => ({
      id: r.id as number,
      season: r.season as number,
      week: (r.week as number) ?? null,
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
  note: string | null,
  week: number | null = null
) {
  await ensureSchema();
  await sql`
    INSERT INTO trades (season, week, player_name, from_manager_id, to_manager_id, note)
    VALUES (${season}, ${week}, ${playerName}, ${fromManagerId}, ${toManagerId}, ${note});
  `;
}

export async function deleteTrade(id: number) {
  await ensureSchema();
  await sql`DELETE FROM trades WHERE id = ${id};`;
}

// --- Monthly periods ---

export async function getMonthlyPeriods(season?: number): Promise<MonthlyPeriod[]> {
  try {
    await ensureSchema();
    const { rows } = season
      ? await sql`SELECT id, season, label, start_week, end_week FROM monthly_periods WHERE season = ${season} ORDER BY start_week;`
      : await sql`SELECT id, season, label, start_week, end_week FROM monthly_periods ORDER BY season DESC, start_week;`;
    return rows.map((r) => ({
      id: r.id as number,
      season: r.season as number,
      label: r.label as string,
      startWeek: r.start_week as number,
      endWeek: r.end_week as number,
    }));
  } catch (err) {
    console.error("getMonthlyPeriods failed (is Postgres connected?)", err);
    return [];
  }
}

export async function addMonthlyPeriod(season: number, label: string, startWeek: number, endWeek: number) {
  await ensureSchema();
  await sql`
    INSERT INTO monthly_periods (season, label, start_week, end_week)
    VALUES (${season}, ${label}, ${startWeek}, ${endWeek})
    ON CONFLICT (season, label) DO UPDATE SET start_week = ${startWeek}, end_week = ${endWeek};
  `;
}

export async function deleteMonthlyPeriod(id: number) {
  await ensureSchema();
  await sql`DELETE FROM monthly_periods WHERE id = ${id};`;
}

// --- Monthly awards (player-level, mirrors weekly_awards) ---

export async function getMonthlyAwards(season: number, periodLabel: string): Promise<MonthlyAward[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT season, period_label, category, player_name, team_id, note
      FROM monthly_awards WHERE season = ${season} AND period_label = ${periodLabel};
    `;
    return rows.map((r) => ({
      season: r.season as number,
      periodLabel: r.period_label as string,
      category: r.category as AwardCategory,
      playerName: r.player_name as string,
      teamId: (r.team_id as number) ?? null,
      note: (r.note as string) ?? null,
    }));
  } catch (err) {
    console.error("getMonthlyAwards failed (is Postgres connected?)", err);
    return [];
  }
}

export async function upsertMonthlyAward(
  season: number,
  periodLabel: string,
  category: AwardCategory,
  playerName: string,
  teamId: number | null,
  note: string | null
) {
  await ensureSchema();
  await sql`
    INSERT INTO monthly_awards (season, period_label, category, player_name, team_id, note, updated_at)
    VALUES (${season}, ${periodLabel}, ${category}, ${playerName}, ${teamId}, ${note}, now())
    ON CONFLICT (season, period_label, category)
    DO UPDATE SET player_name = ${playerName}, team_id = ${teamId}, note = ${note}, updated_at = now();
  `;
}

// --- Newsletter intros ---

export async function getNewsletterIntro(
  season: number,
  periodType: NewsletterPeriodType,
  periodKey: string
): Promise<NewsletterIntro | null> {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT season, period_type, period_key, intro_text FROM newsletter_intros
      WHERE season = ${season} AND period_type = ${periodType} AND period_key = ${periodKey};
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      season: r.season as number,
      periodType: r.period_type as NewsletterPeriodType,
      periodKey: r.period_key as string,
      introText: r.intro_text as string,
    };
  } catch (err) {
    console.error("getNewsletterIntro failed (is Postgres connected?)", err);
    return null;
  }
}

export async function upsertNewsletterIntro(
  season: number,
  periodType: NewsletterPeriodType,
  periodKey: string,
  introText: string
) {
  await ensureSchema();
  await sql`
    INSERT INTO newsletter_intros (season, period_type, period_key, intro_text, updated_at)
    VALUES (${season}, ${periodType}, ${periodKey}, ${introText}, now())
    ON CONFLICT (season, period_type, period_key)
    DO UPDATE SET intro_text = ${introText}, updated_at = now();
  `;
}


// --- League History entries ---

export async function getSeasonHistory(): Promise<SeasonHistoryRecord[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT season, champion, runner_up, third_place, tags, note
      FROM season_history ORDER BY season DESC;
    `;
    return rows.map((r) => ({
      season: r.season as number,
      champion: (r.champion as string) || null,
      runnerUp: (r.runner_up as string) || null,
      thirdPlace: (r.third_place as string) || null,
      tags: r.tags ? (r.tags as string).split("|").filter(Boolean) : [],
      note: (r.note as string) || null,
    }));
  } catch (err) {
    console.error("getSeasonHistory failed (is Postgres connected?)", err);
    return [];
  }
}

export async function upsertSeasonHistory(h: SeasonHistoryRecord) {
  await ensureSchema();
  const tags = h.tags.join("|");
  await sql`
    INSERT INTO season_history (season, champion, runner_up, third_place, tags, note, updated_at)
    VALUES (${h.season}, ${h.champion}, ${h.runnerUp}, ${h.thirdPlace}, ${tags}, ${h.note}, now())
    ON CONFLICT (season) DO UPDATE SET
      champion = ${h.champion}, runner_up = ${h.runnerUp}, third_place = ${h.thirdPlace},
      tags = ${tags}, note = ${h.note}, updated_at = now();
  `;
}

export async function deleteSeasonHistory(season: number) {
  await ensureSchema();
  await sql`DELETE FROM season_history WHERE season = ${season};`;
}


// Seasons tagged "Played on Fantrax" -- ESPN data for these must never be shown.
export async function getPlayedElsewhereSeasons(): Promise<Set<number>> {
  return seasonsPlayedElsewhere(await getSeasonHistory());
}


// --- Seasons played on another platform, entered by hand ---

export async function getManualSeasons(): Promise<number[]> {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT DISTINCT season FROM manual_teams ORDER BY season DESC;`;
    return rows.map((r) => r.season as number);
  } catch (err) {
    console.error("getManualSeasons failed (is Postgres connected?)", err);
    return [];
  }
}

export async function getManualSeasonData(season: number): Promise<{ teams: ManualTeam[]; matchups: Matchup[] }> {
  try {
    await ensureSchema();
    const t = await sql`SELECT id, season, name, manager_id FROM manual_teams WHERE season = ${season} ORDER BY name;`;
    const m = await sql`
      SELECT week, home_team_id, home_score, away_team_id, away_score, is_playoff
      FROM manual_matchups WHERE season = ${season} ORDER BY week, id;
    `;
    return {
      teams: t.rows.map((r) => ({
        id: r.id as number,
        season: r.season as number,
        name: r.name as string,
        managerId: (r.manager_id as number) ?? null,
      })),
      matchups: m.rows.map((r) => ({
        week: r.week as number,
        homeTeamId: r.home_team_id as number,
        homeScore: Number(r.home_score),
        awayTeamId: r.away_team_id as number,
        awayScore: Number(r.away_score),
        isFinal: true, // hand-entered games are results
        isPlayoff: Boolean(r.is_playoff),
      })),
    };
  } catch (err) {
    console.error("getManualSeasonData failed (is Postgres connected?)", err);
    return { teams: [], matchups: [] };
  }
}

// Replaces a season's hand-entered games with a fresh set (re-pasting is how
// you correct a mistake). Teams already there keep their manager assignment;
// teams no longer mentioned are removed.
export async function replaceManualSeason(
  season: number,
  games: { week: number; home: string; homeScore: number; away: string; awayScore: number; playoff: boolean }[]
) {
  await ensureSchema();
  const names = Array.from(new Set(games.flatMap((g) => [g.home, g.away])));

  for (const name of names) {
    await sql`INSERT INTO manual_teams (season, name) VALUES (${season}, ${name}) ON CONFLICT (season, name) DO NOTHING;`;
  }
  const { rows } = await sql`SELECT id, name FROM manual_teams WHERE season = ${season};`;
  const idByName = new Map(rows.map((r) => [r.name as string, r.id as number]));

  await sql`DELETE FROM manual_matchups WHERE season = ${season};`;
  for (const g of games) {
    await sql`
      INSERT INTO manual_matchups (season, week, home_team_id, home_score, away_team_id, away_score, is_playoff)
      VALUES (${season}, ${g.week}, ${idByName.get(g.home)!}, ${g.homeScore}, ${idByName.get(g.away)!}, ${g.awayScore}, ${g.playoff});
    `;
  }
  for (const [name, id] of idByName) {
    if (!names.includes(name)) await sql`DELETE FROM manual_teams WHERE id = ${id};`;
  }
}

export async function setManualTeamManager(teamId: number, managerId: number | null) {
  await ensureSchema();
  await sql`UPDATE manual_teams SET manager_id = ${managerId} WHERE id = ${teamId};`;
}

export async function deleteManualSeason(season: number) {
  await ensureSchema();
  await sql`DELETE FROM excluded_games WHERE season = ${season};`;
  await sql`DELETE FROM manual_matchups WHERE season = ${season};`;
  await sql`DELETE FROM manual_teams WHERE season = ${season};`;
}

// Links a manager to one team-season WITHOUT touching its saved name, note
// or records (unlike upsertManagerAssignment, which rewrites those).
export async function assignManagerToTeamSeason(managerId: number, teamId: number, season: number, teamName: string) {
  await ensureSchema();
  await sql`
    INSERT INTO manager_team_seasons (manager_id, team_id, season, team_name)
    VALUES (${managerId}, ${teamId}, ${season}, ${teamName})
    ON CONFLICT (team_id, season) DO UPDATE SET manager_id = ${managerId};
  `;
}


// --- Per-season rulings: when the playoffs start, and games that don't count ---

export async function getSeasonRules(season: number): Promise<SeasonRules> {
  try {
    await ensureSchema();
    const r = await sql`SELECT playoff_start_week FROM season_rules WHERE season = ${season};`;
    const g = await sql`SELECT week, team_a, team_b FROM excluded_games WHERE season = ${season} ORDER BY week, team_a, team_b;`;
    return {
      playoffStartWeek: r.rows.length ? ((r.rows[0].playoff_start_week as number) ?? null) : null,
      excluded: g.rows.map((x) => ({ week: x.week as number, teamA: x.team_a as number, teamB: x.team_b as number })),
    };
  } catch (err) {
    console.error("getSeasonRules failed (is Postgres connected?)", err);
    return EMPTY_RULES;
  }
}

export async function setPlayoffStartWeek(season: number, week: number | null) {
  await ensureSchema();
  await sql`
    INSERT INTO season_rules (season, playoff_start_week) VALUES (${season}, ${week})
    ON CONFLICT (season) DO UPDATE SET playoff_start_week = ${week};
  `;
}

export async function setGameExcluded(season: number, week: number, teamA: number, teamB: number, excluded: boolean) {
  await ensureSchema();
  const a = Math.min(teamA, teamB);
  const b = Math.max(teamA, teamB);
  if (excluded) {
    await sql`INSERT INTO excluded_games (season, week, team_a, team_b) VALUES (${season}, ${week}, ${a}, ${b}) ON CONFLICT DO NOTHING;`;
  } else {
    await sql`DELETE FROM excluded_games WHERE season = ${season} AND week = ${week} AND team_a = ${a} AND team_b = ${b};`;
  }
}

// Every season that has any ruling, for the overview list.
export async function getSeasonsWithRules(): Promise<Map<number, { playoffStartWeek: number | null; excludedCount: number }>> {
  const out = new Map<number, { playoffStartWeek: number | null; excludedCount: number }>();
  try {
    await ensureSchema();
    const r = await sql`SELECT season, playoff_start_week FROM season_rules;`;
    const g = await sql`SELECT season, COUNT(*) AS n FROM excluded_games GROUP BY season;`;
    for (const x of r.rows) out.set(x.season as number, { playoffStartWeek: (x.playoff_start_week as number) ?? null, excludedCount: 0 });
    for (const x of g.rows) {
      const cur = out.get(x.season as number) ?? { playoffStartWeek: null, excludedCount: 0 };
      out.set(x.season as number, { ...cur, excludedCount: Number(x.n) });
    }
  } catch (err) {
    console.error("getSeasonsWithRules failed (is Postgres connected?)", err);
  }
  return out;
}

// Un-links a manager from one team-season (the team-season row itself stays).
export async function clearManagerFromTeamSeason(teamId: number, season: number) {
  await ensureSchema();
  await sql`UPDATE manager_team_seasons SET manager_id = NULL WHERE team_id = ${teamId} AND season = ${season};`;
}
