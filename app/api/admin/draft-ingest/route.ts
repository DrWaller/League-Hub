import { NextRequest, NextResponse } from "next/server";
import { buildDraftRows, countStored, storeRows, recomputeStored } from "@/lib/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only (covered by the /api/admin middleware).
//   /api/admin/draft-ingest              preview only, nothing is written
//   /api/admin/draft-ingest?run=1        store the draft (refuses if already stored)
//   /api/admin/draft-ingest?run=1&replace=1   wipe and re-store (ADP snapshot changes)
//   /api/admin/draft-ingest?recompute=1  recalculate steal/reach values from the stored ADP snapshot
// Optional: &season=2027
// The first stored run is the ADP snapshot; later runs never overwrite it
// unless you pass replace=1.

const DEFAULT_SEASON = 2027;
const BIG_SWING = 15;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const season = Number(q.get("season")) || DEFAULT_SEASON;
  const run = q.get("run") === "1";
  const replace = q.get("replace") === "1";

  try {
    if (q.get("recompute") === "1") {
      const list = await recomputeStored(season);
      const reg = list.filter((r) => !r.is_keeper && r.value != null);
      const isGamble = (r: (typeof list)[number]) => r.is_rookie || r.injury_status !== "ACTIVE";
      const f = (r: (typeof list)[number]) => ({ pick: r.overall_pick, player: r.player_name, pos: r.position, manager: r.manager, adpRank: r.adp_rank, pointsRank: r.points_rank, expectedPick: r.expected_pick, value: r.value, rookie: r.is_rookie, injury: r.injury_status });
      const flag = reg.filter((r) => Math.abs(r.value as number) >= BIG_SWING);
      const clean = flag.filter((r) => !isGamble(r));
      const byPos = (arr: typeof flag) => arr.reduce((m: Record<string, number>, r) => ((m[r.position] = (m[r.position] ?? 0) + 1), m), {});
      return NextResponse.json({
        mode: "recomputed (ADP + last-season points blend)",
        season,
        regularPicks: reg.length,
        netValue: reg.reduce((t, r) => t + (r.value as number), 0),
        flaggedCount: { steals: clean.filter((r) => (r.value as number) > 0).length, reaches: clean.filter((r) => (r.value as number) < 0).length, gamblesExcluded: flag.length - clean.length, threshold: BIG_SWING },
        flaggedByPosition: { steals: byPos(clean.filter((r) => (r.value as number) > 0)), reaches: byPos(clean.filter((r) => (r.value as number) < 0)) },
        bigStealsTop10: clean.filter((r) => (r.value as number) > 0).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 10).map(f),
        bigReachesTop10: clean.filter((r) => (r.value as number) < 0).sort((a, b) => (a.value as number) - (b.value as number)).slice(0, 10).map(f),
        gambles: flag.filter(isGamble).sort((a, b) => Math.abs(b.value as number) - Math.abs(a.value as number)).slice(0, 8).map(f),
      });
    }
    const rows = await buildDraftRows(season);
    const regular = rows.filter((r) => !r.is_keeper);

    const fmt = (r: (typeof rows)[number]) => ({
      pick: r.overall_pick,
      player: r.player_name,
      pos: r.position,
      manager: r.manager,
      adp: r.adp,
      expectedPick: r.expected_pick,
      value: r.value,
      rookie: r.is_rookie,
      injury: r.injury_status,
    });
    const flaggable = regular.filter((r) => r.value != null && Math.abs(r.value as number) >= BIG_SWING);
    const steals = flaggable.filter((r) => (r.value as number) > 0).sort((a, b) => (b.value as number) - (a.value as number));
    const reaches = flaggable.filter((r) => (r.value as number) < 0).sort((a, b) => (a.value as number) - (b.value as number));

    const preview = {
      season,
      rows: rows.length,
      keepers: rows.filter((r) => r.is_keeper).length,
      regularPicks: regular.length,
      missingAdp: rows.filter((r) => r.adp == null).map((r) => r.player_name),
      noLastSeasonLine: rows.filter((r) => !r.has_last_season).map((r) => `${r.player_name} (${r.is_keeper ? "keeper" : "#" + r.overall_pick})`),
      unmappedManagers: Array.from(new Set(rows.filter((r) => r.manager.startsWith("Team ")).map((r) => r.team_id))),
      positionCounts: rows.reduce((m: Record<string, number>, r) => ((m[r.position] = (m[r.position] ?? 0) + 1), m), {}),
      bigStealsTop10: steals.slice(0, 10).map(fmt),
      bigReachesTop10: reaches.slice(0, 10).map(fmt),
      flaggedCount: { steals: steals.length, reaches: reaches.length, threshold: BIG_SWING },
    };

    if (!run) return NextResponse.json({ mode: "preview (nothing written)", ...preview });

    const existing = await countStored(season);
    if (existing > 0 && !replace) {
      return NextResponse.json({
        mode: "skipped",
        message: `${existing} rows already stored for ${season}. The stored ADP is the draft-time snapshot. Add &replace=1 to wipe and re-store.`,
      });
    }
    const written = await storeRows(rows, replace);
    return NextResponse.json({ mode: replace ? "replaced" : "stored", written, ...preview });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, { status: 500 });
  }
}
