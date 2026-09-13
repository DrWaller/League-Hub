import { getRosters, getStandings } from "@/lib/espn";

export default async function RostersPage({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const [{ rosters, live }, { teams }] = await Promise.all([getRosters(), getStandings()]);
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
            className={`px-3 py-1.5 text-sm border ${
              t.id === selectedId
                ? "bg-rink text-ice border-rink"
                : "border-ice-line hover:border-rink-bright"
            }`}
          >
            {t.name}
          </a>
        ))}
      </div>

      {team && (
        <h2 className="font-display text-xl mb-4">{team.name}</h2>
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
