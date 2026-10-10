import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only (covered by the /api/admin middleware).
// Open: /api/admin/draft-probe            (current season, default 2027)
//       /api/admin/draft-probe?season=2027
// Read-only. Answers: who is teamId 1-10, what the draft looks like with
// names/positions, and whether ESPN's hockey player data carries ADP.

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;
const DEFAULT_SEASON = 2027;

// Guess only; confirm against the output (e.g. Makar should come out as D).
const POS_GUESS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };

function base(season: number) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;
}

const cookieHeader = () => `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`;

async function getJson(url: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { Cookie: cookieHeader(), ...extraHeaders },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, error: text.slice(0, 300) };
  try {
    return { ok: true as const, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: false as const, status: res.status, error: "Response was not JSON: " + text.slice(0, 200) };
  }
}

// Find any key that looks draft/ADP/rank related, anywhere in an object (depth-limited).
function findInterestingKeys(obj: any, path = "", out: Record<string, unknown> = {}, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (/adp|averagedraft|draft|rank|ownership|percowned|percentowned/i.test(k)) {
      out[p] = typeof v === "object" ? JSON.stringify(v).slice(0, 300) : v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      findInterestingKeys(v, p, out, depth + 1);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season")) || DEFAULT_SEASON;

  if (!ESPN_S2 || !ESPN_SWID) {
    return NextResponse.json({ error: "ESPN_S2 / ESPN_SWID are not configured." }, { status: 500 });
  }

  // 1) Draft + teams + settings in one call.
  const league = await getJson(`${base(season)}?view=mDraftDetail&view=mTeam&view=mSettings`);
  if (!league.ok) return NextResponse.json({ step: "league", ...league }, { status: 502 });
  const L = league.data;

  const draftDetail = L.draftDetail ?? {};
  const picks: any[] = draftDetail.picks ?? [];

  // 2) Teams and the ESPN members that own them.
  const members: Record<string, string> = {};
  for (const m of L.members ?? []) {
    members[m.id] = m.displayName ?? [m.firstName, m.lastName].filter(Boolean).join(" ");
  }
  const teams = (L.teams ?? []).map((t: any) => ({
    teamId: t.id,
    name: t.name ?? [t.location, t.nickname].filter(Boolean).join(" "),
    owners: (t.owners ?? []).map((o: string) => members[o] ?? o),
    ownerIds: t.owners ?? [],
  }));

  // 3) What the hub's own database already says about team -> manager for this season.
  let dbMapping: unknown = null;
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT mts.team_id, mts.team_name, m.name AS manager
      FROM manager_team_seasons mts
      LEFT JOIN managers m ON m.id = mts.manager_id
      WHERE mts.season = ${season}
      ORDER BY mts.team_id;
    `;
    dbMapping = rows;
  } catch (e) {
    dbMapping = { error: String(e).slice(0, 200) };
  }

  // 4) Player info for every drafted player (names, positions, injury, ownership/ADP fields).
  const ids = Array.from(new Set(picks.map((p) => p.playerId))).filter((x) => x != null);
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));

  // ESPN rejects "limit" without a sort, so every shape carries one. Shapes are
  // tried in order per chunk; the first that works wins and is reported.
  const statsFilter = { filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: [`00${season - 1}`, `00${season}`] } };
  const shapesFor = (chunk: number[]) => [
    {
      name: "ids + percOwned sort + stats",
      filter: { players: { filterIds: { value: chunk }, filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] }, ...statsFilter, sortPercOwned: { sortPriority: 1, sortAsc: false }, limit: chunk.length } },
    },
    {
      name: "ids + percOwned sort",
      filter: { players: { filterIds: { value: chunk }, filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] }, sortPercOwned: { sortPriority: 1, sortAsc: false }, limit: chunk.length } },
    },
    {
      name: "ids + draftRanks sort",
      filter: { players: { filterIds: { value: chunk }, filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] }, sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "STANDARD" }, limit: chunk.length } },
    },
  ];

  const shapeUsed: string[] = [];
  const playerResults: any[] = [];
  for (const chunk of chunks) {
    let last: any = null;
    for (const sh of shapesFor(chunk)) {
      const r: any = await getJson(`${base(season)}?view=kona_player_info`, { "x-fantasy-filter": JSON.stringify(sh.filter) });
      last = r;
      if (r.ok) {
        shapeUsed.push(sh.name);
        break;
      }
    }
    playerResults.push(last);
  }

  const playerErrors = playerResults.filter((r) => !r.ok).map((r: any) => ({ status: r.status, error: r.error }));
  const rawEntries: any[] = playerResults.flatMap((r: any) => (r.ok ? r.data?.players ?? [] : []));
  const byId = new Map<number, any>();
  for (const e of rawEntries) {
    const pl = e?.player ?? e?.playerPoolEntry?.player;
    if (pl?.id != null) byId.set(pl.id, { pl, entry: e });
  }

  const nameOf = (id: number) => {
    const p = byId.get(id)?.pl;
    return p ? `${p.fullName} (${POS_GUESS[p.defaultPositionId] ?? "pos" + p.defaultPositionId})` : `playerId ${id}`;
  };

  // 5) ADP verdict: does any drafted player carry a non-empty ADP-like value?
  let adpPopulated = 0;
  let ownershipPresent = 0;
  for (const { pl } of byId.values()) {
    const o = pl.ownership;
    if (o) ownershipPresent++;
    const adp = o?.averageDraftPosition;
    if (typeof adp === "number" && adp > 0) adpPopulated++;
  }

  const sampleIds = [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]].filter((x) => x != null);
  const samples = sampleIds.map((id) => {
    const rec = byId.get(id as number);
    return rec
      ? {
          playerId: id,
          name: rec.pl.fullName,
          playerKeys: Object.keys(rec.pl),
          entryKeys: Object.keys(rec.entry),
          ownership: rec.pl.ownership ?? null,
          draftRanksByRankType: rec.pl.draftRanksByRankType ?? null,
          injuryStatus: rec.pl.injuryStatus ?? null,
          injured: rec.pl.injured ?? null,
          interestingFields: findInterestingKeys({ ...rec.pl, entryLevel: { ...rec.entry, player: undefined } }),
        }
      : { playerId: id, note: "not returned by player pool" };
  });

  // 6) Compact pick list + order checks.
  const pickLines = picks
    .slice()
    .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    .map(
      (p) =>
        `#${p.overallPickNumber} R${p.roundId}.${p.roundPickNumber} T${p.teamId} ${nameOf(p.playerId)}` +
        (p.keeper ? " [KEEPER]" : "") +
        (p.autoDraftTypeId ? ` [AUTO type ${p.autoDraftTypeId}]` : "")
    );

  const orderForRound = (r: number) =>
    picks
      .filter((p) => p.roundId === r && !p.keeper)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
      .map((p) => p.teamId);

  const autoByTeam: Record<string, Record<string, number>> = {};
  for (const p of picks) {
    if (!p.autoDraftTypeId) continue;
    const t = String(p.teamId);
    autoByTeam[t] = autoByTeam[t] ?? {};
    autoByTeam[t][String(p.autoDraftTypeId)] = (autoByTeam[t][String(p.autoDraftTypeId)] ?? 0) + 1;
  }

  const s = L.settings ?? {};
  return NextResponse.json({
    season,
    draftSummary: {
      drafted: draftDetail.drafted ?? null,
      inProgress: draftDetail.inProgress ?? null,
      totalPickRecords: picks.length,
      keeperPicks: picks.filter((p) => p.keeper).length,
      regularPicks: picks.filter((p) => !p.keeper).length,
      draftSettings: s.draftSettings ?? null,
      round1Order: orderForRound(1),
      round2Order: orderForRound(2),
      round3Order: orderForRound(3),
      autoDraftByTeam: autoByTeam,
    },
    teams,
    dbTeamToManager: dbMapping,
    scheduleAndPlayoffs: {
      scheduleSettings: s.scheduleSettings ?? null,
      statusFirstScoringPeriod: L.status?.firstScoringPeriod ?? null,
      statusFinalScoringPeriod: L.status?.finalScoringPeriod ?? null,
    },
    adpVerdict: {
      playersRequested: ids.length,
      playersReturned: byId.size,
      withOwnershipObject: ownershipPresent,
      withPositiveAverageDraftPosition: adpPopulated,
      shapeUsedPerChunk: shapeUsed,
      withLastSeasonStatLine: Array.from(byId.values()).filter(({ pl }) => (pl.stats ?? []).some((x: any) => String(x.id) === `00${season - 1}` && x.statSourceId === 0)).length,
      playerPoolErrors: playerErrors,
    },
    playerSamples: samples,
    picks: pickLines,
  });
}
