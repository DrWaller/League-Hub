import { getRosters, getStandings } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function RostersPage({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const [{ rosters, live }, { teams }, logos] = await Promise.all([
    getRosters(),
    getStandings(),
    getTeamLogos(),
  ]);
  const selectedId = Number(searchParams.team) || teams[0]?.id;
  const roster = rosters.find((r) => r.teamId === selectedId);
  const team = teams.find((t) => t.id === selectedId);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Rosters</h1>
      <p className="text-muted mb-8">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live rosters."}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {teams.map((t) => (
          <a
            key={t.id}
            href={`/rosters?team=${t.id}`}
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
        </tbody>
      </table>
    </div>
  );
}
