// Server-side only. Draft tendencies per manager across every saved draft: the players and NHL teams each manager
// has drafted most. Past ESPN drafts are saved once (source 'history') by the admin page; the 2025 Fantrax draft
// comes from the paste tool (source 'fantrax'); a full draft recap save (source 'espn') is used when present.

import { sql } from "./db";
import { ensureDraftSchema, base, getJson, fetchPlayers, POS } from "./draft";
import { NHL_ABBREV } from "./best-available";
import { norm } from "./lines";
import { getImportedSeason } from "./imported-seasons";
import { getManagers, getManagerSeasons, getSeasonHistory } from "./content";
import { seasonsPlayedElsewhere } from "./played-elsewhere";

const key = (s: string) => norm(s);

// Saves one past ESPN season's draft as source 'history' (only picks, names, positions and NHL teams).
export async function saveHistoryDraft(season: number): Promise<{ saved: number; note: string }> {
  await ensureDraftSchema();
  if (seasonsPlayedElsewhere(await getSeasonHistory()).has(season)) return { saved: 0, note: `${season} was played off ESPN: use Paste a Draft.` };
  const league = await getJson(`${base(season)}?view=mDraftDetail&view=mTeam`);
  const picks: any[] = league.draftDetail?.picks ?? [];
  if (picks.length === 0) return { saved: 0, note: `ESPN has no ${season} draft.` };
  const teamName = new Map<number, string>((league.teams ?? []).map((t: any) => [t.id, t.name ?? [t.location, t.nickname].filter(Boolean).join(" ")]));
  const ids = Array.from(new Set(picks.map((p) => p.playerId))).filter((x) => x != null) as number[];
  const players = await fetchPlayers(season, ids).catch(() => new Map<number, any>());
  // Players ESPN no longer lists (retired) fall back to the names saved with the season stats.
  const names = new Map<number, string>();
  try {
    const r = await sql`SELECT player_id, name FROM pool_season_stats WHERE season = ${season};`;
    for (const x of r.rows) names.set(Number(x.player_id), String(x.name));
  } catch {
    /* table may not exist yet */
  }
  await sql`DELETE FROM draft_picks WHERE season = ${season} AND source = 'history';`;
  let unnamed = 0;
  const list = picks.slice().sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(
      list.slice(i, i + 20).map((p) => {
        const pl = players.get(p.playerId);
        const name = pl?.fullName ?? names.get(p.playerId) ?? null;
        if (!name) unnamed++;
        return sql`
          INSERT INTO draft_picks (season, source, overall_pick, round, round_pick, team_id, team_name, player_id, player_name, position, pro_team_id, is_keeper, auto_draft_type)
          VALUES (${season}, 'history', ${p.overallPickNumber}, ${p.roundId ?? null}, ${p.roundPickNumber ?? null}, ${p.teamId}, ${teamName.get(p.teamId) ?? `Team ${p.teamId}`},
                  ${p.playerId}, ${name ?? `playerId ${p.playerId}`}, ${pl ? POS[pl.defaultPositionId] ?? "?" : "?"}, ${pl?.proTeamId ?? 0}, ${!!p.keeper}, ${p.autoDraftTypeId ?? 0})
          ON CONFLICT (season, source, overall_pick) DO NOTHING;
        `;
      })
    );
  }
  return { saved: list.length, note: unnamed ? `${unnamed} pick(s) had no player name available.` : "" };
}

export async function savedDraftSeasons(): Promise<{ season: number; source: string; n: number }[]> {
  await ensureDraftSchema();
  const r = await sql`SELECT season, source, COUNT(*)::int AS n FROM draft_picks GROUP BY season, source ORDER BY season DESC;`;
  return r.rows.map((x) => ({ season: Number(x.season), source: String(x.source), n: Number(x.n) }));
}

export interface DraftedPlayer {
  name: string;
  position: string;
  times: number;
  kept: number;
  seasons: number[];
}
export interface DraftedTeam {
  team: string;
  picks: number;
  share: number;
}
export interface DraftTendencies {
  seasons: number[];
  picks: number; // non-keeper picks counted
  players: DraftedPlayer[];
  teams: DraftedTeam[];
  teamsKnown: number; // picks with a known NHL team
  positions: { position: string; picks: number; share: number }[];
  highestPick: { overall: number; name: string; season: number } | null;
  firstRounders: DraftedPlayer[]; // players taken in round 1 more than once
}

interface Pick { season: number; overall: number; round: number | null; name: string; position: string; nhl: string | null; keeper: boolean; teamId: number | null; teamName: string }

export async function loadDraftTendencies(managerId: number, currentSeason: number): Promise<DraftTendencies | null> {
  await ensureDraftSchema();
  const [rows, managers, assignments] = await Promise.all([
    sql`SELECT season, source, overall_pick, round, team_id, team_name, manager, player_name, position, pro_team_id, nhl_team, is_keeper FROM draft_picks WHERE season < ${currentSeason} ORDER BY season, overall_pick;`,
    getManagers(),
    getManagerSeasons(),
  ]);
  const myName = managers.find((m) => m.id === managerId)?.name ?? "";
  // One source per season: the full recap, else the saved history, else the pasted Fantrax draft.
  const rank: Record<string, number> = { espn: 0, history: 1, fantrax: 2 };
  const best = new Map<number, string>();
  for (const r of rows.rows) {
    const s = Number(r.season);
    const src = String(r.source);
    if (!best.has(s) || (rank[src] ?? 9) < (rank[best.get(s)!] ?? 9)) best.set(s, src);
  }

  const mine: Pick[] = [];
  const seasonsSeen = new Set<number>();
  for (const season of Array.from(best.keys())) {
    const src = best.get(season)!;
    const seasonRows = rows.rows.filter((r) => Number(r.season) === season && String(r.source) === src);
    const teamsThatYear = assignments.filter((a) => a.season === season);
    const mineThatYear = teamsThatYear.filter((a) => a.managerId === managerId);
    if (mineThatYear.length === 0) continue;
    const myTeamIds = new Set(mineThatYear.map((a) => a.teamId));
    const myTeamNames = new Set(mineThatYear.map((a) => key(a.teamName)));
    const imported = src === "fantrax" ? await getImportedSeason(season).catch(() => null) : null;
    const nhlByName = new Map((imported?.players ?? []).map((p) => [key(p.name), p.team] as const));
    for (const r of seasonRows) {
      const byId = r.team_id != null && myTeamIds.has(Number(r.team_id));
      const label = key(String(r.team_name ?? ""));
      const byName = r.team_id == null && label !== "" && (myTeamNames.has(label) || (myName !== "" && label.includes(key(myName))));
      if (!byId && !byName) continue;
      const proId = Number(r.pro_team_id ?? 0);
      const name = String(r.player_name ?? "");
      mine.push({
        season,
        overall: Number(r.overall_pick),
        round: r.round == null ? null : Number(r.round),
        name,
        position: String(r.position ?? ""),
        nhl: proId > 0 ? NHL_ABBREV[proId] ?? null : r.nhl_team ? String(r.nhl_team) : (nhlByName.get(key(name)) as string | undefined)?.split(",")[0]?.trim() || null,
        keeper: Boolean(r.is_keeper),
        teamId: r.team_id == null ? null : Number(r.team_id),
        teamName: String(r.team_name ?? ""),
      });
      seasonsSeen.add(season);
    }
  }
  if (mine.length === 0) return null;

  const real = mine.filter((p) => !p.keeper && !/^playerId \d+$/.test(p.name));
  const byPlayer = new Map<string, DraftedPlayer>();
  for (const p of mine) {
    if (/^playerId \d+$/.test(p.name)) continue;
    const k = key(p.name);
    const e = byPlayer.get(k) ?? { name: p.name, position: p.position, times: 0, kept: 0, seasons: [] };
    if (p.keeper) e.kept++;
    else e.times++;
    e.seasons.push(p.season);
    byPlayer.set(k, e);
  }
  const players = [...byPlayer.values()].filter((p) => p.times >= 2).sort((a, b) => b.times - a.times || b.kept - a.kept || a.name.localeCompare(b.name)).slice(0, 5);

  const withTeam = real.filter((p) => p.nhl);
  const byTeam = new Map<string, number>();
  for (const p of withTeam) byTeam.set(p.nhl!, (byTeam.get(p.nhl!) ?? 0) + 1);
  const teams = [...byTeam.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([team, picks]) => ({ team, picks, share: picks / (withTeam.length || 1) }));

  const byPos = new Map<string, number>();
  for (const p of real) if (p.position && p.position !== "?") byPos.set(p.position, (byPos.get(p.position) ?? 0) + 1);
  const posTotal = [...byPos.values()].reduce((a, b) => a + b, 0) || 1;
  const positions = [...byPos.entries()].sort((a, b) => b[1] - a[1]).map(([position, picks]) => ({ position, picks, share: picks / posTotal }));

  const hp = [...real].sort((a, b) => a.overall - b.overall)[0];
  const r1 = new Map<string, DraftedPlayer>();
  for (const p of real.filter((x) => x.round === 1)) {
    const k = key(p.name);
    const e = r1.get(k) ?? { name: p.name, position: p.position, times: 0, kept: 0, seasons: [] };
    e.times++;
    e.seasons.push(p.season);
    r1.set(k, e);
  }

  return {
    seasons: [...seasonsSeen].sort((a, b) => a - b),
    picks: real.length,
    players,
    teams,
    teamsKnown: withTeam.length,
    positions,
    highestPick: hp ? { overall: hp.overall, name: hp.name, season: hp.season } : null,
    firstRounders: [...r1.values()].filter((p) => p.times >= 2).sort((a, b) => b.times - a.times).slice(0, 3),
  };
}
