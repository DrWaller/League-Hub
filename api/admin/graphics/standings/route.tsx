import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta, getPlayoffTeamCount } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getSeasonBundle } from "@/lib/season-data";
import { regularSeasonFinals } from "@/lib/luck";
import { teamsThroughWeek } from "@/lib/power-rankings";
import { renderStandings, StandingsRow } from "@/lib/standings-image";
import { isPortrait, renderPortraitStandings, seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { captionResponse, standingsCaption } from "@/lib/captions";

// Same order the Standings page uses for past seasons: wins minus losses, then points for.
const byRecord = (a: { wins: number; losses: number; pointsFor: number }, b: { wins: number; losses: number; pointsFor: number }) =>
  b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current season: ESPN's own standings order (same as the Standings page), or
// ?week=N for the table as of week N (wins minus losses, then points for).
// ?season=YYYY: a past season's final table.
export async function GET(req: NextRequest) {
  try {
    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;
    const weekParam = Number(req.nextUrl.searchParams.get("week")) || 0;

    let teams: { id: number; name: string; wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number; streak?: string }[];
    let subtitle: string;
    // Places each team moved since the previous week, by wins-minus-losses order (current season only).
    let changes: Map<number, number> | null = null;

    if (isPast) {
      const bundle = await getSeasonBundle(seasonParam);
      if (!bundle) {
        const elsewhere = (await getPlayedElsewhereSeasons()).has(seasonParam);
        return new Response(
          elsewhere ? `${seasonParam} was played on Fantrax and no standings have been entered for it yet.` : `Couldn't load season ${seasonParam} from ESPN.`,
          { status: 400 }
        );
      }
      teams = [...bundle.teams].sort(byRecord);
      subtitle = "Final standings";
    } else {
      const [standings, all] = await Promise.all([getStandings(), getMatchups()]);
      if (!standings.live) return new Response("ESPN isn't connected, so there are no standings to show.", { status: 400 });
      const latest = regularSeasonFinals(all.matchups).reduce((max, m) => Math.max(max, m.week), 0);
      if (latest === 0) return new Response("No completed games yet, so there are no standings to show.", { status: 400 });
      const asOf = weekParam && weekParam < latest ? weekParam : latest;
      if (asOf === weekParam && weekParam < latest) {
        teams = teamsThroughWeek(standings.teams, all.matchups, weekParam).sort(byRecord);
      } else {
        teams = standings.teams;
      }
      subtitle = `Through week ${asOf}`;
      if (asOf >= 2) {
        const rankMap = (w: number) => new Map(teamsThroughWeek(standings.teams, all.matchups, w).sort(byRecord).map((t, i) => [t.id, i + 1] as [number, number]));
        const now = rankMap(asOf);
        const before = rankMap(asOf - 1);
        changes = new Map(Array.from(now.entries()).map(([id, r]) => [id, (before.get(id) ?? r) - r] as [number, number]));
      }
    }

    const rows: StandingsRow[] = teams.map((t) => ({
      teamId: t.id,
      name: t.name,
      record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
      pf: t.pointsFor,
      pa: t.pointsAgainst,
      streak: t.streak,
      change: changes?.get(t.id),
    }));

    const logos = await loadLogoData(isPast);
    const cutoff = await getPlayoffTeamCount(isPast ? seasonParam : undefined);
    subtitle += isPast ? ` - top ${cutoff} made the playoffs` : ` - top ${cutoff} make the playoffs`;
    if (req.nextUrl.searchParams.get("caption")) {
      return captionResponse(standingsCaption(subtitle, rows, cutoff));
    }

    const title = isPast ? `Standings - ${seasonParam}` : "Standings";
    return isPortrait(req.nextUrl.searchParams.get("format"))
      ? await renderPortraitStandings({ rows, title, subtitle, cutoff, logos, footer: seasonFooter(meta.name, seasonParam) })
      : await renderStandings({ rows, title, subtitle, cutoff, logos });
  } catch (err) {
    console.error("Standings graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
