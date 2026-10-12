import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";
import { getWeekLineups } from "@/lib/lineup-efficiency";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

// An audit of the Lineup Efficiency graphic: for every night a team left points on the bench it shows who
// should have started, who they should have replaced (or that a slot was empty), and the points lost.
// Also compares the lineup total to the real matchup score so a mismatch is easy to spot.
export default async function LineupCheckPage({ searchParams }: { searchParams: { week?: string } }) {
  const meta = await getLeagueMeta();
  const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);
  const week = Number(searchParams.week) || regularSeasonFinals(matchups).reduce((m, g) => Math.max(m, g.week), 0);
  const lineups = week > 0 ? await getWeekLineups(week, meta.season, meta.season) : null;
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const scoreOf = (teamId: number) => {
    const g = matchups.find((m) => m.week === week && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    return g ? (g.homeTeamId === teamId ? g.homeScore : g.awayScore) : null;
  };

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Lineup Efficiency Check</h1>
      <form className="text-sm flex items-center gap-2 mb-3">
        <span className="text-muted">Week</span>
        <input name="week" type="number" min={1} defaultValue={week || undefined} className="border border-ice-line px-3 py-2 w-24" />
        <button className="border border-ice-line px-3 py-2">Show</button>
      </form>
      <p className="text-muted mb-6 max-w-prose">
        Every night a team had a better lineup available than the one it set: a bench player who played and either filled an empty
        slot or outscored a starter the lineup could have swapped him for (same position, or a flex spot). Players on IR are not
        counted. &ldquo;Lineup total&rdquo; should match the team&apos;s real score for the week; if it doesn&apos;t, the difference shows.
      </p>
      {!lineups ? (
        <p>Couldn&apos;t load the daily lineups for week {week} from ESPN.</p>
      ) : (
        [...lineups.teams]
          .sort((a, b) => a.actual / (a.max || 1) - b.actual / (b.max || 1))
          .map((t) => {
            const real = scoreOf(t.teamId);
            const diff = real === null ? null : Math.round((t.actual - real) * 100) / 100;
            return (
              <div key={t.teamId} className="mb-8">
                <h2 className="font-display text-xl">
                  {name(t.teamId)} <span className="text-muted text-base">- {((t.actual / (t.max || 1)) * 100).toFixed(1)}%</span>
                </h2>
                <p className="text-sm mb-2">
                  Lineup total {pts(t.actual)} · best possible {pts(t.max)} · left on bench {pts(t.max - t.actual)}
                  {real !== null && (
                    <span className={diff === 0 ? "text-green-700" : "text-red-700"}>
                      {" "}
                      · real score {pts(real)} {diff === 0 ? "(matches)" : `(lineup total is ${diff! > 0 ? "+" : ""}${diff} off)`}
                    </span>
                  )}
                </p>
                {t.misses.length === 0 ? (
                  <p className="text-sm text-muted">No wasted nights: the lineup was optimal every day.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ice-line text-muted text-left">
                          <th className="py-1 pr-3 font-normal">Day</th>
                          <th className="py-1 pr-3 font-normal">Should have started</th>
                          <th className="py-1 pr-3 font-normal">Instead of</th>
                          <th className="py-1 pr-3 font-normal text-right">Lost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.misses.map((m) => (
                          <tr key={m.day} className="border-b border-ice-line align-top">
                            <td className="py-1 pr-3">{m.day}</td>
                            <td className="py-1 pr-3">
                              {m.swaps.map((s, i) => (
                                <div key={i}>
                                  {s.start.name} ({s.start.position}, {pts(s.start.points)})
                                </div>
                              ))}
                            </td>
                            <td className="py-1 pr-3">
                              {m.swaps.map((s, i) => (
                                <div key={i}>{s.over ? `${s.over.name} (${s.over.position}, ${pts(s.over.points)})` : "an empty slot"}</div>
                              ))}
                              {m.emptySlots > 0 && <div className="text-muted">{m.emptySlots} empty slot{m.emptySlots === 1 ? "" : "s"} that day</div>}
                            </td>
                            <td className="py-1 pr-3 text-right">{pts(m.max - m.actual)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}
