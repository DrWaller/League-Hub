import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { getSeasonRules, getSeasonsWithRules, setGameExcluded, setPlayoffStartWeek } from "@/lib/content";
import { getHistorySeasons } from "@/lib/seasons";
import { getSeasonBundleRaw } from "@/lib/season-data";
import { applyRules, summarizeRules } from "@/lib/season-rules";

export const dynamic = "force-dynamic";

// GET            -> every finished season with its current rulings + what they add up to
// GET ?season=N  -> that season's games (with the rulings applied) so single games can be marked
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));

  if (!season) {
    const meta = await getLeagueMeta();
    const seasons = (await getHistorySeasons(meta.season)).filter((s) => s !== meta.season);
    const withRules = await getSeasonsWithRules();
    const out = await Promise.all(
      seasons.map(async (s) => {
        const raw = await getSeasonBundleRaw(s);
        if (!raw || raw.matchups.length === 0) return null;
        const rules = await getSeasonRules(s);
        return { season: s, source: raw.source, ...summarizeRules(applyRules(raw.matchups, rules)), playoffStartWeek: withRules.get(s)?.playoffStartWeek ?? null, excludedCount: withRules.get(s)?.excludedCount ?? 0 };
      })
    );
    return NextResponse.json({ seasons: out.filter(Boolean) });
  }

  const raw = await getSeasonBundleRaw(season);
  if (!raw) return NextResponse.json({ error: "No games found for that season." }, { status: 404 });
  const rules = await getSeasonRules(season);
  const applied = applyRules(raw.matchups, rules);
  const name = (id: number) => raw.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const flagged = raw.matchups.filter((m) => m.isPlayoff).map((m) => m.week);
  return NextResponse.json({
    season,
    source: raw.source,
    rules,
    summary: summarizeRules(applied),
    // where the data itself says the playoffs begin (ESPN's flags / the pasted ",playoff" lines), if it does
    dataPlayoffStartWeek: flagged.length ? Math.min(...flagged) : null,
    games: applied.map((m) => ({
      week: m.week,
      homeId: m.homeTeamId,
      homeName: name(m.homeTeamId),
      homeScore: m.homeScore,
      awayId: m.awayTeamId,
      awayName: name(m.awayTeamId),
      awayScore: m.awayScore,
      isPlayoff: Boolean(m.isPlayoff),
      isExcluded: Boolean(m.isExcluded),
    })),
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const season = Number(b.season);
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });

  if (b.action === "playoffWeek") {
    const week = b.week === null || b.week === "" ? null : Number(b.week);
    if (week !== null && (!Number.isInteger(week) || week < 1)) return NextResponse.json({ error: "Enter a week number, or leave it blank." }, { status: 400 });
    await setPlayoffStartWeek(season, week);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "exclude") {
    await setGameExcluded(season, Number(b.week), Number(b.teamA), Number(b.teamB), Boolean(b.excluded));
    return NextResponse.json({ ok: true });
  }
  if (b.action === "excludeWeek") {
    const raw = await getSeasonBundleRaw(season);
    const games = (raw?.matchups ?? []).filter((m) => m.week === Number(b.week));
    for (const m of games) await setGameExcluded(season, m.week, m.homeTeamId, m.awayTeamId, Boolean(b.excluded));
    return NextResponse.json({ ok: true, games: games.length });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
