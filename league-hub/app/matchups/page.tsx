import Link from "next/link";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos, getMatchupContent } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const meta = await getLeagueMeta();
  const week = Number(searchParams.week) || meta.currentWeek;
  const [{ matchups, live }, { teams }, logos, content] = await Promise.all([
    getMatchups(week),
    getStandings(),
    getTeamLogos(),
    getMatchupContent(meta.season, week),
  ]);
  const teamById = (id: number) => teams.find((t) => t.id === id);
  const contentFor = (homeId: number, awayId: number) =>
    content.find((c) => c.homeTeamId === homeId && c.awayTeamId === awayId);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl">Matchups</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link
            href={`/matchups?week=${Math.max(1, week - 1)}`}
            className="px-2 py-1 border border-ice-line hover:border-rink-bright"
          >
            ←
          </Link>
          <span>Week {week}</span>
          <Link
            href={`/matchups?week=${week + 1}`}
            className="px-2 py-1 border border-ice-line hover:border-rink-bright"
          >
            →
          </Link>
        </div>
      </div>
      <p className="text-muted mb-8">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live scores."}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {matchups.map((m, i) => {
          const home = teamById(m.homeTeamId);
          const away = teamById(m.awayTeamId);
          const homeWinning = m.homeScore > m.awayScore;
          const blurb = contentFor(m.homeTeamId, m.awayTeamId);
          const text = m.isFinal ? blurb?.summary : blurb?.preview;
          return (
            <div key={i} className="border border-ice-line p-5">
              <div className="flex items-center justify-between font-tabular">
                <span className={`font-body flex items-center gap-2 ${homeWinning ? "font-semibold" : "text-muted"}`}>
                  <TeamLogo url={logos[m.homeTeamId]} name={home?.name ?? String(m.homeTeamId)} size={22} />
                  {home?.name ?? m.homeTeamId}
                </span>
                <span className="font-display text-xl">{m.homeScore}</span>
              </div>
              <div className="rule-center my-3 opacity-40" />
              <div className="flex items-center justify-between font-tabular">
                <span className={`font-body flex items-center gap-2 ${!homeWinning ? "font-semibold" : "text-muted"}`}>
                  <TeamLogo url={logos[m.awayTeamId]} name={away?.name ?? String(m.awayTeamId)} size={22} />
                  {away?.name ?? m.awayTeamId}
                </span>
                <span className="font-display text-xl">{m.awayScore}</span>
              </div>
              <p className="text-xs text-muted mt-3">{m.isFinal ? "Final" : "In progress"}</p>
              {text && <p className="text-sm mt-3 border-t border-ice-line pt-3">{text}</p>}
            </div>
          );
        })}
        {matchups.length === 0 && <p className="text-muted">No matchups for week {week}.</p>}
      </div>
    </div>
  );
}
