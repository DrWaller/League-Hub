import { NextRequest, NextResponse } from "next/server";
import {
  fetchNhlSeason,
  fitScoring,
  GOALIE_KEYS,
  matchPlayers,
  parseFantraxCsv,
  SKATER_KEYS,
  toEspnStats,
  toScoringItems,
} from "@/lib/season-import";
import { saveImportedSeason, type ImportedPlayer } from "@/lib/imported-seasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { season, text, apply? } -- analyze a Fantrax player-pool CSV for `season` against the NHL's raw
// stats and report how well the two line up. With apply: true the result is also saved.
export async function POST(req: NextRequest) {
  const { season, text, apply } = await req.json();
  const seasonNum = Number(season);
  if (!seasonNum || typeof text !== "string" || text.length < 50) {
    return NextResponse.json({ error: "Give a season and the contents of the Fantrax CSV." }, { status: 400 });
  }

  const csv = parseFantraxCsv(text);
  if (csv.problems.length) return NextResponse.json({ error: `The file doesn't look like a Fantrax player export. ${csv.problems.join("; ")}`, header: csv.header }, { status: 400 });
  const played = csv.rows.filter((r) => r.gp > 0);

  const nhl = await fetchNhlSeason(seasonNum);
  if (nhl.skaters.length === 0 && nhl.goalies.length === 0) {
    return NextResponse.json({ error: `The NHL stats service returned no players for ${seasonNum}.`, nhlErrors: nhl.errors, fieldsSeen: nhl.fieldsSeen }, { status: 502 });
  }

  const m = matchPlayers(csv.rows, [...nhl.skaters, ...nhl.goalies]);
  const gpMismatch = m.matched.filter((x) => Math.abs(x.nhl.gp - x.fx.gp) > 3);
  const forwardMatches = m.matched.filter((x) => x.nhl.group === "F");
  const defenseMatches = m.matched.filter((x) => x.nhl.group === "D");
  const goalieMatches = m.matched.filter((x) => x.nhl.group === "G");

  // Forwards, defensemen and goalies are fitted separately: a league can score them differently.
  const forwardFit = fitScoring(forwardMatches, SKATER_KEYS);
  const defenseFit = fitScoring(defenseMatches, SKATER_KEYS);
  const goalieFit = fitScoring(goalieMatches, GOALIE_KEYS);

  const scoring = {
    forwards: forwardFit ? toScoringItems(forwardFit.weights, "skater") : [],
    defensemen: defenseFit ? toScoringItems(defenseFit.weights, "skater") : [],
    goalies: goalieFit ? toScoringItems(goalieFit.weights, "goalie") : [],
  };

  let saved = false;
  if (apply) {
    const players: ImportedPlayer[] = [
      ...m.matched.map((x) => ({
        nhlId: x.nhl.nhlId,
        fid: x.fx.fid,
        name: x.fx.name,
        team: x.nhl.team,
        position: x.fx.position,
        positionId: x.fx.positionId,
        owner: x.fx.owner,
        age: x.fx.age,
        rank: x.fx.rank,
        gp: x.nhl.gp,
        appliedTotal: x.fx.fpts,
        stats: toEspnStats(x.nhl),
      })),
      // On the Fantrax list but not found in the NHL data: keep them for points ranks only.
      ...m.unmatched.map((r) => ({
        nhlId: null,
        fid: r.fid,
        name: r.name,
        team: r.team,
        position: r.position,
        positionId: r.positionId,
        owner: r.owner,
        age: r.age,
        rank: r.rank,
        gp: r.gp,
        appliedTotal: r.fpts,
        stats: { "34": r.gp },
      })),
    ];
    await saveImportedSeason({
      season: seasonNum,
      importedAt: new Date().toISOString(),
      scoringItems: scoring,
      fit: { forwardsR2: forwardFit?.r2 ?? null, defensemenR2: defenseFit?.r2 ?? null, goaliesR2: goalieFit?.r2 ?? null },
      players,
    });
    saved = true;
  }

  const brief = (r: { name: string; position: string; team: string; fpts: number; gp: number }) => `${r.name} (${r.position}, ${r.team}) ${r.fpts} pts, ${r.gp} GP`;
  return NextResponse.json({
    season: seasonNum,
    saved,
    csv: { rows: csv.rows.length, withGames: played.length, forwards: played.filter((r) => r.group === "F").length, defensemen: played.filter((r) => r.group === "D").length, goalies: played.filter((r) => r.group === "G").length },
    nhl: { skaters: nhl.skaters.length, goalies: nhl.goalies.length, errors: nhl.errors, fieldsSeen: nhl.fieldsSeen },
    match: {
      matched: m.matched.length,
      unmatched: m.unmatched.length,
      ambiguous: m.ambiguous.length,
      nameVariants: m.variants.map((v) => `${v.fantrax} = ${v.nhl}`),
      gamesPlayedDisagree: gpMismatch.length,
      unmatchedTop: m.unmatched.sort((a, b) => b.fpts - a.fpts).slice(0, 12).map(brief),
      disagreeTop: gpMismatch.slice(0, 8).map((x) => `${x.fx.name}: Fantrax ${x.fx.gp} GP vs NHL ${x.nhl.gp} GP`),
    },
    fit: { forwards: forwardFit, defensemen: defenseFit, goalies: goalieFit },
    scoring,
  });
}
