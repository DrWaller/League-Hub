// Draft ingestion helpers: pull picks + player info from ESPN, compute the
// keeper-adjusted expected pick, and store everything in draft_picks.
// Self-contained on purpose: it does not touch lib/espn.ts or lib/db.ts.

import { sql } from "@/lib/db";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

// ESPN teamId -> manager, per season. Keyed by season so a manager change
// (Lucas -> Dave in 2026) never leaks history across people.
export const DRAFT_MANAGERS: Record<number, Record<number, string>> = {
  2027: { 1: "Evan", 2: "Calder", 3: "Bobby", 4: "Dave", 5: "Dan", 6: "Tim", 7: "Sam", 8: "Richard", 9: "Matt", 10: "Vinny" },
};

const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };

const base = (season: number) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;

async function getJson(url: string, headers: Record<string, string> = {}) {
  if (!ESPN_S2 || !ESPN_SWID) throw new Error("ESPN_S2 / ESPN_SWID are not configured.");
  const res = await fetch(url, { headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`, ...headers }, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`ESPN ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
  return JSON.parse(text);
}

export interface DraftRow {
  season: number;
  source: string;
  overall_pick: number;
  round: number;
  round_pick: number;
  team_id: number;
  team_name: string;
  manager: string;
  player_id: number;
  player_name: string;
  position: string;
  pro_team_id: number;
  is_keeper: boolean;
  auto_draft_type: number;
  adp: number | null;
  std_rank: number | null;
  adp_rank: number | null; // rank by ADP among the drafted (non-keeper) players
  points_rank: number | null; // rank by last-season points among the same players
  expected_pick: number | null;
  value: number | null; // actual pick - expected pick; positive = steal, negative = reach
  last_season_points: number | null;
  has_last_season: boolean;
  is_rookie: boolean;
  injury_status: string;
  season_stats: Record<string, { points: number; avg: number; stats: Record<string, number> }>;
}

async function fetchPlayers(season: number, ids: number[]) {
  const STATUS = ["FREEAGENT", "WAIVERS", "ONTEAM"];
  const years = [season - 1, season - 2, season - 3].map((y) => `00${y}`);
  const out = new Map<number, any>();
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60);
    const sort = { sortPercOwned: { sortPriority: 1, sortAsc: false } };
    const shapes = [
      { players: { filterIds: { value: chunk }, filterStatus: { value: STATUS }, filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: years }, ...sort, limit: chunk.length } },
      { players: { filterIds: { value: chunk }, filterStatus: { value: STATUS }, filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: [years[0]] }, ...sort, limit: chunk.length } },
      { players: { filterIds: { value: chunk }, filterStatus: { value: STATUS }, ...sort, limit: chunk.length } },
    ];
    let data: any = null;
    let lastErr: unknown = null;
    for (const filter of shapes) {
      try {
        data = await getJson(`${base(season)}?view=kona_player_info`, { "x-fantasy-filter": JSON.stringify(filter) });
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw lastErr ?? new Error("Player pool request failed");
    for (const e of data.players ?? []) {
      const pl = e?.player ?? e?.playerPoolEntry?.player;
      if (pl?.id != null) out.set(pl.id, pl);
    }
  }
  return out;
}

function seasonStatsOf(pl: any, season: number) {
  const res: DraftRow["season_stats"] = {};
  for (const y of [season - 1, season - 2, season - 3]) {
    const s = (pl.stats ?? []).find(
      (x: any) => x.statSourceId === 0 && x.statSplitTypeId === 0 && String(x.id) === `00${y}`
    );
    if (s) res[String(y)] = { points: Number(s.appliedTotal) || 0, avg: Number(s.appliedAverage) || 0, stats: s.stats ?? {} };
  }
  return res;
}

// Steals and reaches are graded WITHIN each position. Ranking everyone on one
// list called nearly half the goalies reaches, because a league that must
// start 2 goalies per team drafts them earlier than any all-position
// ranking says. That timing is a real story (Goalie Panic), but it isn't a
// bad pick, so it's kept out of this score.
//
// For each position, among the players this league drafted (keepers
// excluded), we blend two ranks:
//   - ADP rank (ESPN consensus), and
//   - last-season fantasy-points rank under THIS league's scoring.
// Players with no last-season line (rookies) use ADP alone. The best-scoring
// player at a position is expected to go in the earliest slot that position
// was actually drafted in, the next-best in the next slot, and so on, so each
// position nets to zero. adp_rank / points_rank are stored as ranks within
// the player's position.
// value = actual pick - expected pick: positive = steal, negative = reach.
export const ADP_WEIGHT = 0.5;

type Rankable = {
  is_keeper: boolean;
  position: string;
  adp: number | null;
  overall_pick: number;
  has_last_season: boolean;
  last_season_points: number | null;
  adp_rank: number | null;
  points_rank: number | null;
  expected_pick: number | null;
  value: number | null;
};

export function applyExpectedPicks<T extends Rankable>(rows: T[]) {
  for (const r of rows) {
    r.adp_rank = null;
    r.points_rank = null;
    r.expected_pick = null;
    r.value = null;
  }
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (r.is_keeper || r.adp == null) continue;
    const g = groups.get(r.position) ?? [];
    g.push(r);
    groups.set(r.position, g);
  }
  for (const g of Array.from(groups.values())) {
    [...g].sort((a, b) => (a.adp as number) - (b.adp as number)).forEach((r, i) => (r.adp_rank = i + 1));
    [...g]
      .filter((r) => r.has_last_season && r.last_season_points != null)
      .sort((a, b) => (b.last_season_points as number) - (a.last_season_points as number) || (a.adp_rank as number) - (b.adp_rank as number))
      .forEach((r, i) => (r.points_rank = i + 1));
    const score = (r: T) => (r.points_rank != null ? ADP_WEIGHT * (r.adp_rank as number) + (1 - ADP_WEIGHT) * r.points_rank : (r.adp_rank as number));
    const slots = g.map((r) => r.overall_pick).sort((a, b) => a - b);
    [...g]
      .sort((a, b) => score(a) - score(b) || (a.adp_rank as number) - (b.adp_rank as number))
      .forEach((r, i) => {
        r.expected_pick = slots[i];
        r.value = r.overall_pick - slots[i];
      });
  }
  return rows;
}

// Recompute ranks/values from the data already stored (the draft-time ADP
// snapshot and last-season points), without calling ESPN.
export async function recomputeStored(season: number, source = "espn") {
  await ensureDraftSchema();
  const { rows } = await sql`
    SELECT overall_pick, is_keeper, adp::float AS adp, player_name, position, manager, is_rookie, injury_status,
           has_last_season, last_season_points::float AS last_season_points
    FROM draft_picks WHERE season = ${season} AND source = ${source} ORDER BY overall_pick;
  `;
  const list = (rows as any[]).map((r) => ({ ...r, adp_rank: null as number | null, points_rank: null as number | null, expected_pick: null as number | null, value: null as number | null }));
  applyExpectedPicks(list);
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(
      list.slice(i, i + 20).map(
        (r) => sql`
          UPDATE draft_picks SET adp_rank = ${r.adp_rank}, points_rank = ${r.points_rank}, expected_pick = ${r.expected_pick}, value = ${r.value}
          WHERE season = ${season} AND source = ${source} AND overall_pick = ${r.overall_pick};
        `
      )
    );
  }
  return list;
}

export async function buildDraftRows(season: number): Promise<DraftRow[]> {
  const league = await getJson(`${base(season)}?view=mDraftDetail&view=mTeam`);
  const picks: any[] = league.draftDetail?.picks ?? [];
  if (!league.draftDetail?.drafted) throw new Error(`The ${season} draft is not marked complete yet.`);

  const teamName = new Map<number, string>();
  for (const t of league.teams ?? []) teamName.set(t.id, t.name ?? [t.location, t.nickname].filter(Boolean).join(" "));
  const managers = DRAFT_MANAGERS[season] ?? {};

  const ids = Array.from(new Set(picks.map((p) => p.playerId))).filter((x) => x != null);
  const players = await fetchPlayers(season, ids);

  const rows: DraftRow[] = picks
    .slice()
    .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    .map((p) => {
      const pl = players.get(p.playerId);
      const ss = pl ? seasonStatsOf(pl, season) : {};
      const last = ss[String(season - 1)];
      return {
        season,
        source: "espn",
        overall_pick: p.overallPickNumber,
        round: p.roundId,
        round_pick: p.roundPickNumber,
        team_id: p.teamId,
        team_name: teamName.get(p.teamId) ?? `Team ${p.teamId}`,
        manager: managers[p.teamId] ?? `Team ${p.teamId}`,
        player_id: p.playerId,
        player_name: pl?.fullName ?? `playerId ${p.playerId}`,
        position: pl ? POS[pl.defaultPositionId] ?? `pos${pl.defaultPositionId}` : "?",
        pro_team_id: pl?.proTeamId ?? 0,
        is_keeper: !!p.keeper,
        auto_draft_type: p.autoDraftTypeId ?? 0,
        adp: typeof pl?.ownership?.averageDraftPosition === "number" ? pl.ownership.averageDraftPosition : null,
        std_rank: pl?.draftRanksByRankType?.STANDARD?.rank ?? null,
        adp_rank: null,
        points_rank: null,
        expected_pick: null,
        value: null,
        last_season_points: last ? last.points : null,
        has_last_season: !!last,
        is_rookie: !last,
        injury_status: pl?.injuryStatus ?? "UNKNOWN",
        season_stats: ss,
      };
    });
  return applyExpectedPicks(rows);
}

export async function ensureDraftSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS draft_picks (
      season INT NOT NULL,
      source TEXT NOT NULL DEFAULT 'espn',
      overall_pick INT NOT NULL,
      round INT,
      round_pick INT,
      team_id INT,
      team_name TEXT,
      manager TEXT,
      player_id BIGINT,
      player_name TEXT,
      position TEXT,
      pro_team_id INT,
      is_keeper BOOLEAN NOT NULL DEFAULT false,
      auto_draft_type INT NOT NULL DEFAULT 0,
      adp NUMERIC,
      std_rank INT,
      expected_pick NUMERIC,
      value NUMERIC,
      last_season_points NUMERIC,
      has_last_season BOOLEAN NOT NULL DEFAULT false,
      is_rookie BOOLEAN NOT NULL DEFAULT false,
      injury_status TEXT,
      season_stats JSONB,
      pick_time TIMESTAMPTZ,
      snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (season, source, overall_pick)
    );
  `;
  await sql`ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS adp_rank INT;`;
  await sql`ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS points_rank INT;`;
}

export async function countStored(season: number, source = "espn"): Promise<number> {
  await ensureDraftSchema();
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM draft_picks WHERE season = ${season} AND source = ${source};`;
  return Number((rows as any[])[0]?.n ?? 0);
}

export async function storeRows(rows: DraftRow[], replace: boolean) {
  await ensureDraftSchema();
  if (rows.length === 0) return 0;
  const { season, source } = rows[0];
  if (replace) await sql`DELETE FROM draft_picks WHERE season = ${season} AND source = ${source};`;
  for (let i = 0; i < rows.length; i += 20) {
    await Promise.all(
      rows.slice(i, i + 20).map(
        (r) => sql`
          INSERT INTO draft_picks (
            season, source, overall_pick, round, round_pick, team_id, team_name, manager,
            player_id, player_name, position, pro_team_id, is_keeper, auto_draft_type,
            adp, std_rank, adp_rank, points_rank, expected_pick, value, last_season_points, has_last_season,
            is_rookie, injury_status, season_stats
          ) VALUES (
            ${r.season}, ${r.source}, ${r.overall_pick}, ${r.round}, ${r.round_pick}, ${r.team_id}, ${r.team_name}, ${r.manager},
            ${r.player_id}, ${r.player_name}, ${r.position}, ${r.pro_team_id}, ${r.is_keeper}, ${r.auto_draft_type},
            ${r.adp}, ${r.std_rank}, ${r.adp_rank}, ${r.points_rank}, ${r.expected_pick}, ${r.value}, ${r.last_season_points}, ${r.has_last_season},
            ${r.is_rookie}, ${r.injury_status}, ${JSON.stringify(r.season_stats)}::jsonb
          )
          ON CONFLICT (season, source, overall_pick) DO NOTHING;
        `
      )
    );
  }
  return rows.length;
}
