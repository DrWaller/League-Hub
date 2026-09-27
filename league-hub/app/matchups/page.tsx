import Link from "next/link";
import { getMatchups, getStandings, getLeagueMeta, getHistoricalSeasonTeams } from "@/lib/espn";
import { getTeamLogos, getMatchupContent, getManagerSeasons } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: { week?: string; season?: string };
}) {
  const meta = await getLeagueMeta();
  const season = Number(searchParams.season) || meta.season;
  const isCurrentSeason = season === meta.season;
  const week = Number(searchParams.week) || (isCurrentSeason ? meta.currentWeek : 1);

  const [logos, content, allManagerSeasons] = await Promise.all([
    getTeamLogos(),
    getMatchupContent(season, week),
    getManagerSeasons(),
  ]);

  let matchups, live, teamById: (id: number) => { name: string } | undefined;

  if (isCurrentSeason) {
    const [matchupResult, standings] = await Promise.all([getMatchups(week), getStandings()]);
    matchups = matchupResult.matchups;
    live = matchupResult.live;
    teamById = (id) => standings.teams.find((t) => t.id === id);
  } else {
    const [matchupResult, historical] = await Promise.all([
      getMatchups(week, season),
      getHistoricalSeasonTeams(season),
    ]);
    matchups = matchupResult.matchups;
    live = matchupResult.live && historical.ok;
    teamById = (id) => historical.teams?.find((t) => t.id === id);
  }

  const contentFor = (homeId: number, awayId: number) =>
    content.find((c) => c.homeTeamId === homeId && c.awayTeamId === awayId);

  // Known seasons for the selector: every season with a manager record on
  // file, plus the current live one.
  const seasons = Array.from(new Set([meta.season, ...allManagerSeasons.map((s) => s.season)])).sort(
    (a, b) => b - a
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-3xl">Matchups</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link
            href={`/matchups?season=${season}&week=${Math.max(1, week - 1)}`}
            className="px-2 py-1 border border-ice-line hover:border-rink-bright"
          >
            ←
          </Link>
          <span>Week {week}</span>
          <Link
            href={`/matchups?season=${season}&week=${week + 1}`}
            className="px-2 py-1 border border-ice-line hover:border-rink-bright"
          >
            →
          </Link>
        </div>
      </div>

      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/matchups?season=${s}`}
              className={`px-3 py-1.5 text-sm border ${
                s === season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      <p className="text-muted mb-8">
        {live
          ? isCurrentSeason
            ? "Live from ESPN."
            : `From ESPN's ${season} records.`
          : isCurrentSeason
            ? "Preview data — connect ESPN for live scores."
            : `Couldn't load ${season} from ESPN.`}
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
