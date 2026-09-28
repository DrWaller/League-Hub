import Link from "next/link";
import { getStandings, getMatchups } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import { calculatePowerRankings } from "@/lib/power-rankings";
import { computeLuck } from "@/lib/luck";
import TeamLogo from "@/components/TeamLogo";
import LuckTable from "@/components/LuckTable";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const [{ teams, live }, logos, { matchups }] = await Promise.all([
    getStandings(),
    getTeamLogos(),
    getMatchups(),
  ]);
  const rankings = calculatePowerRankings(teams);
  const teamById = (id: number) => teams.find((t) => t.id === id);
  const teamName = (id: number) => teamById(id)?.name ?? `Team ${id}`;

  // Luck Chart: only weeks with at least one final matchup count. Default
  // to the latest such week; ?week=N steps back through earlier ones.
  const latestFinalWeek = matchups.reduce((max, m) => (m.isFinal && m.week > max ? m.week : max), 0);
  const throughWeek = latestFinalWeek
    ? Math.min(Math.max(Number(searchParams.week) || latestFinalWeek, 1), latestFinalWeek)
    : 0;
  const luck = throughWeek ? computeLuck(matchups, throughWeek) : null;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Power Rankings</h1>
      <p className="text-muted mb-2">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live power rankings."}
      </p>
      <p className="text-sm text-muted mb-3 max-w-prose">
        Not ESPN&apos;s built-in rankings. This blends win percentage, point differential per
        game, and current streak — so a team quietly outscoring the league shows up here even
        before it shows up in the standings.
      </p>
      <p className="text-sm mb-8">
        <a href="#luck" className="text-rink hover:underline">
          Jump to the Luck Chart
        </a>
      </p>

      <ol className="space-y-2">
        {rankings.map((r) => {
          const team = teamById(r.teamId);
          if (!team) return null;
          return (
            <li
              key={r.teamId}
              className="flex items-center justify-between border border-ice-line px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-rink text-ice flex items-center justify-center font-display">
                  {r.rank}
                </span>
                <TeamLogo url={logos[team.id]} name={team.name} size={32} />
                <div>
                  <div className="font-body font-medium">{team.name}</div>
                  <div className="text-xs text-muted">
                    {team.wins}-{team.losses}
                    {team.ties ? `-${team.ties}` : ""} · {team.streak ?? "—"}
                  </div>
                </div>
              </div>
              <div className="font-tabular text-lg">{r.score.toFixed(2)}</div>
            </li>
          );
        })}
      </ol>

      <section id="luck" className="mt-16 scroll-mt-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="font-display text-2xl">Luck Chart</h2>
          {latestFinalWeek > 1 && (
            <div className="flex items-center gap-3 font-tabular text-sm">
              <Link
                href={`/power-rankings?week=${Math.max(1, throughWeek - 1)}#luck`}
                className="px-2 py-1 border border-ice-line hover:border-rink-bright"
              >
                ←
              </Link>
              <span>Through week {throughWeek}</span>
              <Link
                href={`/power-rankings?week=${Math.min(latestFinalWeek, throughWeek + 1)}#luck`}
                className="px-2 py-1 border border-ice-line hover:border-rink-bright"
              >
                →
              </Link>
            </div>
          )}
        </div>
        <p className="text-sm text-muted mb-6 max-w-prose">
          What each team&apos;s record would be if it played every other team every week
          (&ldquo;all-play&rdquo;), against the record it actually has. A positive diff means the
          schedule has been kind; negative means unlucky. Ties count as half a win.
        </p>

        {luck && luck.rows.length > 0 ? (
          <LuckTable rows={luck.rows} leagueMedian={luck.leagueMedian} teamName={teamName} logos={logos} />
        ) : (
          <p className="text-muted">No completed matchups yet — this fills in once the first week is final.</p>
        )}
      </section>
    </div>
  );
}
