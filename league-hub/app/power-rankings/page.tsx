import { getStandings } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import { calculatePowerRankings } from "@/lib/power-rankings";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage() {
  const [{ teams, live }, logos] = await Promise.all([getStandings(), getTeamLogos()]);
  const rankings = calculatePowerRankings(teams);
  const teamById = (id: number) => teams.find((t) => t.id === id);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Power Rankings</h1>
      <p className="text-muted mb-2">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live power rankings."}
      </p>
      <p className="text-sm text-muted mb-8 max-w-prose">
        Not ESPN&apos;s built-in rankings. This blends win percentage, point differential per
        game, and current streak — so a team quietly outscoring the league shows up here even
        before it shows up in the standings.
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
    </div>
  );
}
