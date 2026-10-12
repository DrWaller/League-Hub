import { NextRequest } from "next/server";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";
import { getWeekLineups } from "@/lib/lineup-efficiency";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitAwards, seasonFooter, type AwardCard } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pts = (n: number) => n.toFixed(2);

// The week's awards, from the final scores plus each team's lineup efficiency (current season).
export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });
    const meta = await getLeagueMeta();
    const [{ teams }, { matchups }, lineups] = await Promise.all([getStandings(), getMatchups(), getWeekLineups(week, meta.season, meta.season).catch(() => null)]);
    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;

    const awards: AwardCard[] = [];

    // Lineup awards (need the daily lineups).
    const eff = (lineups?.teams ?? []).filter((t) => t.max > 0).map((t) => ({ ...t, pct: t.actual / t.max, left: t.max - t.actual }));
    if (eff.length >= 2) {
      const best = [...eff].sort((a, b) => b.pct - a.pct)[0];
      const worst = [...eff].sort((a, b) => a.pct - b.pct)[0];
      awards.push({ label: "BEST MANAGER", teamId: best.teamId, teamName: name(best.teamId), big: `${(best.pct * 100).toFixed(1)}%`, bigUnit: "OF MAX", sub: `${pts(best.actual)} of ${pts(best.max)} max pts`, tone: "good" });
      awards.push({ label: "WORST MANAGER", teamId: worst.teamId, teamName: name(worst.teamId), big: `${(worst.pct * 100).toFixed(1)}%`, bigUnit: "OF MAX", sub: `${pts(worst.actual)} of ${pts(worst.max)} max pts`, tone: "bad" });
    }

    // Matchup awards (final games only).
    const games = regularSeasonFinals(matchups).filter((m) => m.week === week && m.homeScore !== m.awayScore);
    const results = games.map((m) => {
      const homeWon = m.homeScore > m.awayScore;
      return {
        winner: homeWon ? m.homeTeamId : m.awayTeamId,
        loser: homeWon ? m.awayTeamId : m.homeTeamId,
        winScore: Math.max(m.homeScore, m.awayScore),
        loseScore: Math.min(m.homeScore, m.awayScore),
        margin: Math.abs(m.homeScore - m.awayScore),
      };
    });
    if (results.length > 0) {
      const hiLoss = [...results].sort((a, b) => b.loseScore - a.loseScore)[0];
      const loWin = [...results].sort((a, b) => a.winScore - b.winScore)[0];
      const blowout = [...results].sort((a, b) => b.margin - a.margin)[0];
      const narrow = [...results].sort((a, b) => a.margin - b.margin)[0];
      awards.push({ label: "HIGHEST PTS IN A LOSS", teamId: hiLoss.loser, teamName: name(hiLoss.loser), big: pts(hiLoss.loseScore), bigUnit: "PTS", sub: `lost to ${name(hiLoss.winner)} (${pts(hiLoss.winScore)})`, tone: "bad" });
      awards.push({ label: "LOWEST PTS IN A WIN", teamId: loWin.winner, teamName: name(loWin.winner), big: pts(loWin.winScore), bigUnit: "PTS", sub: `beat ${name(loWin.loser)} (${pts(loWin.loseScore)})`, tone: "good" });
      awards.push({ label: "BIGGEST BLOWOUT", teamId: blowout.winner, teamName: name(blowout.winner), big: `+${pts(blowout.margin)}`, bigUnit: "MARGIN", sub: `${pts(blowout.winScore)} vs ${name(blowout.loser)} ${pts(blowout.loseScore)}`, tone: "neutral" });
      awards.push({ label: "NARROWEST VICTORY", teamId: narrow.winner, teamName: name(narrow.winner), big: `+${pts(narrow.margin)}`, bigUnit: "MARGIN", sub: `${pts(narrow.winScore)} vs ${name(narrow.loser)} ${pts(narrow.loseScore)}`, tone: "neutral" });
    }

    // Bench awards.
    if (lineups) {
      const benchers = lineups.teams.flatMap((t) => t.bench.map((b) => ({ ...b, teamId: t.teamId })));
      const top = benchers.sort((a, b) => b.benchPoints - a.benchPoints)[0];
      if (top && top.benchPoints > 0) {
        awards.push({ label: "TOP BENCHWARMER", title: top.name, teamId: top.teamId, teamName: name(top.teamId), big: pts(top.benchPoints), bigUnit: "PTS ON BENCH", tone: "bad" });
      }
      const left = [...eff].sort((a, b) => b.left - a.left)[0];
      if (left && left.left > 0) {
        awards.push({ label: "MOST LEFT ON BENCH", teamId: left.teamId, teamName: name(left.teamId), big: pts(left.left), bigUnit: "PTS", sub: "scored below the best possible lineup", tone: "bad" });
      }
    }

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = awards.map((a) => `${a.label}: ${a.title ? `${a.title} (${a.teamName})` : a.teamName} - ${a.big} ${a.bigUnit ?? ""}${a.sub ? ` (${a.sub})` : ""}`.replace(/\s+\(/, " ("));
      return captionResponse(["LEAGUE AWARDS", `Week ${week}`, "", ...lines, "", "#FantasyHockey"].join("\n"));
    }

    const logos = await loadLogoData(false);
    return await renderPortraitAwards({ week, awards, logos, footer: seasonFooter(meta.name, meta.season) });
  } catch (err) {
    console.error("League awards graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
