import { getStandings } from "@/lib/espn";

export default async function StandingsPage() {
  const { teams, live } = await getStandings();
  const playoffLine = 6; // adjust to your league's playoff cutoff

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Standings</h1>
      <p className="text-muted mb-8">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live standings."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-tabular border-collapse">
          <thead>
            <tr className="text-left text-muted border-b border-ice-line">
              <th className="py-2 pr-4 font-body font-normal">#</th>
              <th className="py-2 pr-4 font-body font-normal">Team</th>
              <th className="py-2 pr-4 font-body font-normal text-right">W</th>
              <th className="py-2 pr-4 font-body font-normal text-right">L</th>
              <th className="py-2 pr-4 font-body font-normal text-right">T</th>
              <th className="py-2 pr-4 font-body font-normal text-right">PF</th>
              <th className="py-2 pr-4 font-body font-normal text-right">PA</th>
              <th className="py-2 pr-4 font-body font-normal text-right">Streak</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr
                key={t.id}
                className={`border-b border-ice-line/60 ${
                  i === playoffLine - 1 ? "border-b-2 border-b-center-red" : ""
                }`}
              >
                <td className="py-3 pr-4 text-muted">{i + 1}</td>
                <td className="py-3 pr-4 font-body">{t.name}</td>
                <td className="py-3 pr-4 text-right">{t.wins}</td>
                <td className="py-3 pr-4 text-right">{t.losses}</td>
                <td className="py-3 pr-4 text-right">{t.ties}</td>
                <td className="py-3 pr-4 text-right">{t.pointsFor}</td>
                <td className="py-3 pr-4 text-right">{t.pointsAgainst}</td>
                <td className="py-3 pr-4 text-right">{t.streak ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-4">Red line marks the playoff cutoff.</p>
    </div>
  );
}
