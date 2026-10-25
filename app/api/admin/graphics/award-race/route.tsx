import { NextRequest } from "next/server";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals, computeLuck } from "@/lib/luck";
import { getAllStored } from "@/lib/vor-store";
import { buildTandems, getSleepingBeauty } from "@/lib/season-awards";
import { loadPoolStats, buildTrendAwards } from "@/lib/player-trends";
import { fetchLineupSlots } from "@/lib/vor";
import { loadAgeLookup } from "@/lib/trend-ages";
import { addedLabel } from "@/lib/roster-moves";
import { getPickupLog } from "@/lib/best-pickup";
import { getMonsterCounts, getBiggestNights, getBiggestTeamNights } from "@/lib/nightly-store";
import { getBiggestWeeks, getBiggestMonths } from "@/lib/vor-store";
import { getMonthlyPeriods } from "@/lib/content";
import { prettyDate } from "@/lib/nightly-blurbs";
import { biggestTeamWeeks, biggestTeamMonths } from "@/lib/manager-bests";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitRace, type RaceRow } from "@/lib/race-image";
import { seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pts = (n: number) => n.toFixed(2);

const RACES = ["presidents", "points", "hardluck", "jennings", "sleeping", "pickup", "breakout", "bounce", "improved", "calder", "monster", "night", "week", "month", "mgrnight", "mgrweek", "mgrmonth"] as const;

// One graphic per remaining season-long race (the player races use award-watch, lineup efficiency uses
// lineup-season). Reads only what is already saved (no ESPN syncing), so making a graphic costs one render:
// open the Award Races page first if the numbers look stale.
export async function GET(req: NextRequest) {
  try {
    const race = (req.nextUrl.searchParams.get("race") || "").toLowerCase();
    if (!(RACES as readonly string[]).includes(race)) return new Response(`race must be one of: ${RACES.join(", ")}`, { status: 400 });

    const meta = await getLeagueMeta();
    const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);
    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week))).sort((a, b) => a - b);
    const lastWeek = finished[finished.length - 1] ?? 0;

    let title = "";
    let tagline = "";
    let rows: RaceRow[] = [];
    let empty = "";

    const teamRow = (id: number, rank: number, extra: Omit<RaceRow, "rank" | "name" | "teamId" | "teamName">): RaceRow => ({ rank, name: name(id), teamId: id, teamName: name(id), ...extra });
    const record = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;

    if (race === "presidents") {
      title = "Presidents' Trophy";
      tagline = "Best regular-season record";
      rows = [...teams]
        .sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor)
        .slice(0, 5)
        .map((t, i) => teamRow(t.id, i + 1, { sub: `${pts(t.pointsFor)} PF`, value: record(t), gap: i === 0 ? "leader" : "" }));
    } else if (race === "points") {
      title = "Most Points Scored";
      tagline = "Total regular-season points for";
      const sorted = [...teams].sort((a, b) => b.pointsFor - a.pointsFor).slice(0, 5);
      rows = sorted.map((t, i) => teamRow(t.id, i + 1, { sub: record(t), value: pts(t.pointsFor), gap: i === 0 ? "leader" : `-${pts(sorted[0].pointsFor - t.pointsFor)}` }));
    } else if (race === "hardluck") {
      title = "Hard Luck Manager";
      tagline = "Actual wins vs. expected wins (all-play)";
      empty = "No finished weeks yet.";
      if (lastWeek > 0) {
        const list = computeLuck(matchups, lastWeek)
          .rows.map((r) => {
            const games = r.actW + r.actL + r.actT;
            const expected = r.expWinPct * games;
            return { ...r, expected, gap: r.actW + r.actT * 0.5 - expected };
          })
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 5);
        rows = list.map((r, i) =>
          teamRow(r.teamId, i + 1, {
            sub: `${r.actW}-${r.actL}${r.actT ? `-${r.actT}` : ""} actual, ${r.expected.toFixed(1)} expected`,
            value: `${r.gap >= 0 ? "+" : "-"}${r.expected > 0 ? Math.abs((r.gap / r.expected) * 100).toFixed(0) : "0"}%`,
            gap: i === 0 ? "most unlucky" : `${(r.gap - list[0].gap).toFixed(1)} wins back`,
          })
        );
      }
    } else if (race === "jennings") {
      title = "William M. Jennings";
      tagline = "Best goaltending tandem";
      empty = "No finished weeks saved yet.";
      const tandems = buildTandems(await getAllStored(meta.season));
      rows = tandems.map((t) => teamRow(t.teamId, t.rank, { sub: t.goalies.map((g) => `${g.name} ${pts(g.points)}`).join(" / "), value: pts(t.points), gap: t.rank === 1 ? "leader" : `-${pts(tandems[0].points - t.points)}` }));
    } else if (race === "sleeping") {
      title = "Sleeping Beauty";
      tagline = "Biggest draft-pick out-performer";
      empty = "Needs the draft saved and at least one finished week.";
      const sleepers = await getSleepingBeauty(meta.season);
      rows = sleepers.map((p) => ({ rank: p.rank, name: p.name, playerId: p.id, sub: `${p.position} - ${name(p.teamId)} - drafted #${p.pick}, now #${p.finish}`, value: `+${p.margin}`, gap: "spots up" }));
    } else if (race === "monster") {
      title = "Fantasy Monster";
      tagline = "Most Monster Nights this season";
      empty = "No Monster Nights saved yet this season.";
      const list = (await getMonsterCounts(meta.season)).slice(0, 5);
      rows = list.map((m, i) => ({
        rank: i + 1, name: m.name, playerId: m.playerId,
        sub: `${m.position} - ${m.teamName || name(m.teamId)} - best night ${pts(m.best)}`,
        value: `${m.nights}`, gap: i === 0 ? `night${m.nights === 1 ? "" : "s"} - ${pts(m.total)} pts` : `-${list[0].nights - m.nights}`,
      }));
    } else if (race === "night") {
      title = "Biggest Night";
      tagline = "Biggest single-night fantasy score";
      empty = "No nights saved yet.";
      const list = await getBiggestNights(meta.season, 5);
      rows = list.map((n, i) => ({
        rank: i + 1, name: n.name, playerId: n.playerId,
        sub: `${n.position} - ${n.teamName || name(n.teamId)} - ${prettyDate(n.date)}${n.statLine ? ` - ${n.statLine}` : ""}`,
        value: pts(n.points), gap: i === 0 ? "pts - record" : `-${pts(list[0].points - n.points)}`,
      }));
    } else if (race === "week") {
      title = "Biggest Week";
      tagline = "Biggest single-week VOR";
      empty = "No finished weeks saved yet. Open Award Races once so the weeks are saved.";
      const list = await getBiggestWeeks(meta.season, 5);
      rows = list.map((w, i) => ({
        rank: i + 1, name: w.name, playerId: w.playerId,
        sub: `${w.position} - ${name(w.teamId)} - Week ${w.week}`,
        value: `${w.vor >= 0 ? "+" : ""}${pts(w.vor)}`, gap: i === 0 ? `VOR - ${pts(w.points)} pts` : `-${pts(list[0].vor - w.vor)}`,
      }));
    } else if (race === "month") {
      title = "Biggest Month";
      tagline = "Biggest monthly VOR";
      empty = "Needs Monthly Periods set up and at least one finished week.";
      const list = await getBiggestMonths(meta.season, await getMonthlyPeriods(meta.season), 5);
      rows = list.map((m, i) => ({
        rank: i + 1, name: m.name, playerId: m.playerId,
        sub: `${m.position} - ${name(m.teamId)} - ${m.periodLabel}${m.complete ? "" : " (in progress)"}`,
        value: `${m.vor >= 0 ? "+" : ""}${pts(m.vor)}`, gap: i === 0 ? `VOR - ${pts(m.points)} pts` : `-${pts(list[0].vor - m.vor)}`,
      }));
    } else if (race === "mgrnight") {
      title = "Manager's Biggest Night";
      tagline = "Highest single-night team score";
      empty = "No team nights saved yet. Run the season backfill on the admin Big Night Cards page.";
      const list = await getBiggestTeamNights(meta.season, 5);
      rows = list.map((n, i) =>
        teamRow(n.teamId, i + 1, { sub: prettyDate(n.date), value: pts(n.points), gap: i === 0 ? "record" : `-${pts(list[0].points - n.points)}` })
      );
    } else if (race === "mgrweek") {
      title = "Manager's Biggest Week";
      tagline = "Highest single-week team score";
      empty = "No finished weeks yet.";
      const list = biggestTeamWeeks(matchups, 5);
      rows = list.map((w, i) =>
        teamRow(w.teamId, i + 1, {
          sub: `Week ${w.week} - ${w.score > w.oppScore ? "beat" : w.score < w.oppScore ? "lost to" : "tied"} ${name(w.oppId)} ${pts(w.oppScore)}`,
          value: pts(w.score),
          gap: i === 0 ? "record" : `-${pts(list[0].score - w.score)}`,
        })
      );
    } else if (race === "mgrmonth") {
      title = "Manager's Biggest Month";
      tagline = "Most points across a Monthly Period";
      empty = "Needs Monthly Periods set up and at least one finished week.";
      const list = biggestTeamMonths(matchups, await getMonthlyPeriods(meta.season), 5);
      rows = list.map((m, i) =>
        teamRow(m.teamId, i + 1, {
          sub: `${m.periodLabel} - ${m.weeks} week${m.weeks === 1 ? "" : "s"}${m.complete ? "" : " (in progress)"}`,
          value: pts(m.points),
          gap: i === 0 ? "record" : `-${pts(list[0].points - m.points)}`,
        })
      );
    } else if (race === "pickup") {
      title = "Best Pickup";
      tagline = "Best free-agent add of the season";
      empty = "No pickup has scored yet. Open Award Races once so the adds are saved.";
      const list = ((await getPickupLog(meta.season)) ?? []).slice(0, 5);
      rows = list.map((p) => ({
        rank: p.rank, name: p.name, playerId: p.playerId,
        sub: `${p.position} - ${name(p.teamId)} - added ${addedLabel(p.addedAt)} - ${p.started} start${p.started === 1 ? "" : "s"}${p.benched ? `, ${p.benched} benched` : ""}${p.droppedAt ? ` - dropped ${addedLabel(p.droppedAt)}` : ""}`,
        value: `${p.vor >= 0 ? "+" : ""}${pts(p.vor)}`, gap: p.rank === 1 ? `VOR - ${pts(p.pointsCounted)} pts` : `-${pts(list[0].vor - p.vor)}`,
      }));
    } else {
      empty = "Nothing qualifies yet. Early in the season few players have enough games.";
      const poolRows = await loadPoolStats(meta.season);
      const slots = await fetchLineupSlots(meta.season).catch(() => null);
      const award = buildTrendAwards(poolRows, meta.season, 5, { counts: slots, teamCount: teams.length }).find((a) => a.key === race);
      const ageOf = await loadAgeLookup(meta.season);
      title = award?.title ?? race;
      tagline = { breakout: "Biggest jump into the Good tier or better", bounce: "Biggest rebound after a down year", improved: "Biggest gain on last season", calder: "Best rookie" }[race] ?? "";
      rows = (award?.entries ?? []).map((e) => {
        const age = ageOf(e.name, e.position, meta.season);
        return { rank: e.rank, name: e.name, playerId: e.id, sub: `${e.position}${age ? ` - age ~${age}` : ""} - ${e.detail}`, value: e.value, gap: "" };
      });
    }

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = rows.map((r) => `${r.rank}) ${r.name} - ${r.value} (${r.sub})`);
      return captionResponse([title.toUpperCase(), tagline, "", ...lines, "", "#FantasyHockey"].join("\n"));
    }
    if (rows.length === 0) return new Response(empty || "Nothing to show yet.", { status: 400 });

    const playerIds = rows.flatMap((r) => (r.playerId != null ? [r.playerId] : []));
    const [logos, headshots] = await Promise.all([rows.some((r) => r.teamId != null) ? loadLogoData(false) : Promise.resolve({}), playerIds.length ? checkHeadshots(playerIds) : Promise.resolve(new Set<number>())]);
    return await renderPortraitRace({
      title,
      subtitle: lastWeek > 0 ? `${tagline} - through week ${lastWeek}` : tagline,
      footer: seasonFooter(meta.name, meta.season),
      rows,
      logos,
      headshots,
    });
  } catch (err) {
    console.error("Award race graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
