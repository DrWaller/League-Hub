import Link from "next/link";
import { getRosters, getStandings, getLeagueMeta, getHistoricalSeasonTeams } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import { getAvailableSeasons } from "@/lib/seasons";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function RostersPage({
  searchParams,
}: {
  searchParams: { team?: string; season?: string };
}) {
  const meta = await getLeagueMeta();
  const season = Number(searchParams.season) || meta.season;
  const isCurrentSeason = season === meta.season;

  const [logos, seasons] = await Promise.all([getTeamLogos(), getAvailableSeasons(meta.season)]);

  let rosters, live, teams: { id: number; name: string }[];

  if (isCurrentSeason) {
    const [rosterResult, standings] = await Promise.all([getRosters(), getStandings()]);
    rosters = rosterResult.rosters;
    live = rosterResult.live;
    teams = standings.teams;
  } else {
    const [rosterResult, historical] = await Promise.all([
      getRosters(season),
      getHistoricalSeasonTeams(season),
    ]);
    rosters = rosterResult.rosters;
    live = rosterResult.live && historical.ok;
    teams = historical.teams ?? [];
  }

  const selectedId = Number(searchParams.team) || teams[0]?.id;
  const roster = rosters.find((r) => r.teamId === selectedId);
  const team = teams.find((t) => t.id === selectedId);


  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Rosters</h1>

      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/rosters?season=${s}`}
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
            ? "Preview data — connect ESPN for live rosters."
            : `Couldn't load ${season} from ESPN.`}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {teams.map((t) => (
          <a
            key={t.id}
            href={`/rosters?season=${season}&team=${t.id}`}
            className={`px-3 py-1.5 text-sm border flex items-center gap-2 ${
              t.id === selectedId
                ? "bg-rink text-ice border-rink"
                : "border-ice-line hover:border-rink-bright"
            }`}
          >
            <TeamLogo url={logos[t.id]} name={t.name} size={18} />
            {t.name}
          </a>
        ))}
      </div>

      {team && (
        <h2 className="font-display text-xl mb-4 flex items-center gap-3">
          <TeamLogo url={logos[team.id]} name={team.name} size={32} />
          {team.name}
        </h2>
      )}

      <table className="w-full text-sm font-tabular border-collapse">
        <thead>
          <tr className="text-left text-muted border-b border-ice-line">
            <th className="py-2 pr-4 font-body font-normal">Player</th>
            <th className="py-2 pr-4 font-body font-normal">Pos</th>
            <th className="py-2 pr-4 font-body font-normal">NHL Team</th>
            <th className="py-2 pr-4 font-body font-normal text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {roster?.players.map((p) => (
            <tr key={p.id} className="border-b border-ice-line/60">
              <td className="py-3 pr-4 font-body">{p.name}</td>
              <td className="py-3 pr-4">{p.position}</td>
              <td className="py-3 pr-4">{p.proTeam}</td>
              <td className="py-3 pr-4 text-right">{p.points}</td>
            </tr>
          ))}
          {(!roster || roster.players.length === 0) && (
            <tr>
              <td colSpan={4} className="py-4 text-muted">
                No roster data for this team/season.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
