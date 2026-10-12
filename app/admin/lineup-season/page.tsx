import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";
import { syncSeasonLineups, getStoredLineups, summarizeSeason } from "@/lib/lineup-store";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// The season-long Best Manager race: every finished regular-season week, points scored vs. the best lineup
// that was available each night. Finished weeks are saved to the database a few at a time as the page loads.
export default async function LineupSeasonPage() {
  const meta = await getLeagueMeta();
  const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);
  const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week))).sort((a, b) => a - b);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;

  let sync: Awaited<ReturnType<typeof syncSeasonLineups>> | null = null;
  let error = "";
  try {
    sync = await syncSeasonLineups(meta.season, finished);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  let rows: Awaited<ReturnType<typeof getStoredLineups>> = [];
  try {
    rows = await getStoredLineups(meta.season);
  } catch (e) {
    error = error || (e instanceof Error ? e.message : String(e));
  }
  const { teams: table, weeks } = summarizeSeason(rows);
  const pending = sync ? sync.waiting + sync.failed.length : 0;
  const th = "py-2 pr-4 font-normal text-right whitespace-nowrap";
  const td = "py-2 pr-4 text-right whitespace-nowrap";

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Best Manager Race</h1>
      <p className="text-muted mb-4 max-w-prose">
        Season-long lineup efficiency, regular season only: all the points a team scored divided by all the points its best possible
        lineup would have scored, night by night. The team with the highest percentage at the end of the season is the Best Manager.
        Weeks are saved as they finish, so this stays fast.
      </p>
      {error && <p className="text-red-700 mb-3">Problem: {error}</p>}
      {pending > 0 && (
        <p className="text-sm mb-3">
          {sync!.saved > 0 ? `Saved ${sync!.saved} more week(s). ` : ""}
          {pending} finished week(s) still to load: refresh this page to continue.
        </p>
      )}
      {table.length === 0 ? (
        <p>No finished weeks saved yet.</p>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">Through week {weeks[weeks.length - 1]} ({weeks.length} week{weeks.length === 1 ? "" : "s"} counted).</p>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ice-line text-muted">
                  <th className="py-2 pr-4 font-normal text-left">#</th>
                  <th className="py-2 pr-4 font-normal text-left">Team</th>
                  <th className={th}>Efficiency</th>
                  <th className={th}>Points</th>
                  <th className={th}>Best possible</th>
                  <th className={th}>Left on bench</th>
                  <th className={th}>Costly nights</th>
                  <th className={th}>Best week</th>
                  <th className={th}>Worst week</th>
                </tr>
              </thead>
              <tbody>
                {table.map((t, i) => (
                  <tr key={t.teamId} className="border-b border-ice-line">
                    <td className="py-2 pr-4 font-display">{i + 1}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{name(t.teamId)}</td>
                    <td className={`${td} font-bold`}>{pct(t.pct)}</td>
                    <td className={td}>{pts(t.actual)}</td>
                    <td className={td}>{pts(t.max)}</td>
                    <td className={td}>{pts(t.left)}</td>
                    <td className={td}>{t.missDays}</td>
                    <td className={td}>{t.best ? `${pct(t.best.pct)} (wk ${t.best.week})` : "-"}</td>
                    <td className={td}>{t.worst ? `${pct(t.worst.pct)} (wk ${t.worst.week})` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-display text-xl mb-1">Week by week</h2>
          <p className="text-muted text-sm mb-3">Each week&apos;s efficiency, in the same order as the table above.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ice-line text-muted">
                  <th className="py-2 pr-4 font-normal text-left">Team</th>
                  {weeks.map((w) => (
                    <th key={w} className={th}>Wk {w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((t) => (
                  <tr key={t.teamId} className="border-b border-ice-line">
                    <td className="py-2 pr-4 whitespace-nowrap">{name(t.teamId)}</td>
                    {weeks.map((w) => (
                      <td key={w} className={td}>{t.weeks.has(w) ? pct(t.weeks.get(w)!) : "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
