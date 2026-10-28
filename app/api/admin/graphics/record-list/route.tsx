import { NextRequest } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { buildRecords, GameRecord, SeasonRow } from "@/lib/records";
import { getAllTimeNights } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { ptsComma } from "@/lib/format";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitRecordList, type RecordRow } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

type Ctx = { logoOf: (managerId: number | null) => string | undefined; current: number };

const seasonRows = (rows: SeasonRow[], x: Ctx, showPoints?: boolean): RecordRow[] =>
  rows.map((r) => ({
    logo: x.logoOf(r.managerId),
    isNew: r.season === x.current,
    name: r.managerName,
    sub: `${r.season} · ${r.teamName}`,
    value: showPoints ? `${ptsComma(r.pointsFor)} pts` : rec(r.wins, r.losses, r.ties),
    note: showPoints ? undefined : pct(r.winPct),
  }));

const gameRows = (rows: GameRecord[], kind: "score" | "margin", x: Ctx): RecordRow[] =>
  rows.map((g) => ({
    logo: x.logoOf(g.managerId),
    isNew: g.season === x.current,
    name: g.managerName ?? g.teamName,
    sub: `${g.season}, week ${g.week} · vs ${g.oppName}`,
    value: kind === "score" ? g.score.toFixed(2) : `${g.score.toFixed(2)}-${g.oppScore.toFixed(2)}`,
    note: kind === "margin" ? `by ${g.margin.toFixed(2)}` : g.margin === 0 ? "Tied" : `${g.margin > 0 ? "Won" : "Lost"} by ${Math.abs(g.margin).toFixed(2)}`,
  }));

// One Records list as a portrait card: ?list=high|low|blowouts|close|best|worst|scoring|night-players|night-teams
// and optionally &from=2021 (the same cutoff as the Records page's "2021 on" switch).
export async function GET(req: NextRequest) {
  try {
    const list = req.nextUrl.searchParams.get("list") ?? "";
    const fromYear = Number(req.nextUrl.searchParams.get("from")) || null;
    const meta = await getLeagueMeta();
    const { records, managers, recSeasons, currentGames } = await loadRecords(meta.season);
    const cut = fromYear
      ? buildRecords(managers, recSeasons.filter((r) => r.season >= fromYear), currentGames && currentGames.season >= fromYear ? [currentGames] : [])
      : records;

    // A manager's logo is their CURRENT team's (past seasons' team slots may belong to someone else now).
    const logos = await loadLogoData(false);
    const teamOfManager = new Map<number, number>();
    for (const t of currentGames?.teams ?? []) if (t.managerId != null) teamOfManager.set(t.managerId, t.id);
    const x: Ctx = { current: meta.season, logoOf: (id) => (id != null && teamOfManager.has(id) ? logos[teamOfManager.get(id)!] : undefined) };

    let title = "";
    let tone: "good" | "bad" = "good";
    let rows: RecordRow[] = [];
    let scope = fromYear ? `${fromYear} on` : "All seasons";
    switch (list) {
      case "high": title = "Highest Scores"; rows = gameRows(cut.highScores, "score", x); break;
      case "low": title = "Lowest Scores"; tone = "bad"; rows = gameRows(cut.lowScores, "score", x); break;
      case "blowouts": title = "Biggest Blowouts"; rows = gameRows(cut.biggestWins, "margin", x); break;
      case "close": title = "Closest Finishes"; tone = "bad"; rows = gameRows(cut.closestGames, "margin", x); break;
      case "best": title = "Best Records"; rows = seasonRows(cut.bestSeasons, x); break;
      case "worst": title = "Worst Records"; tone = "bad"; rows = seasonRows(cut.worstSeasons, x); break;
      case "scoring": title = "Most Points"; rows = seasonRows(cut.highScoringSeasons, x, true); break;
      case "night-players":
      case "night-teams": {
        const pos = req.nextUrl.searchParams.get("pos");
        const nights = await getAllTimeNights(5, list === "night-players" ? pos : null);
        const posName: Record<string, string> = { G: "Goalie", D: "Defense", F: "Forward", C: "Center", LW: "Left Wing", RW: "Right Wing" };
        scope = list === "night-players" && pos && posName[pos] ? `Single-night records · ${posName[pos]}s` : "Single-night records";
        if (list === "night-players") {
          title = pos && posName[pos] ? `Biggest ${posName[pos]} Nights` : "Biggest Player Nights";
          rows = nights.players.map((n) => ({ name: n.name, sub: `${prettyDate(n.date)} ${n.date.slice(0, 4)} · ${n.teamName}`, value: n.points.toFixed(2) }));
        } else {
          title = "Biggest Team Nights";
          rows = nights.teams.map((n) => ({ name: n.teamName, sub: `${prettyDate(n.date)} ${n.date.slice(0, 4)}`, value: n.points.toFixed(2) }));
        }
        break;
      }
      default:
        return new Response("Unknown list", { status: 400 });
    }

    return await renderPortraitRecordList({ title, subtitle: list.startsWith("night") ? scope : `${scope} · regular season`, rows, tone, footer: `${meta.name.toUpperCase()} · RECORD BOOK` });
  } catch (err) {
    console.error("Record list graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
