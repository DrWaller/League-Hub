import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos, getMonthlyPeriods } from "@/lib/content";
import { syncSeasonVor, getBiggestWeeks, getBiggestMonths, getWeeklyLeaders, getStoredWeekCount } from "@/lib/vor-store";
import TeamLogo from "@/components/TeamLogo";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biggest Weeks & Months" };

const signed = (n: number) => `${n >= 0 ? "+" : ""}${pts(n)}`;

export default async function VorRecordsPage() {
  const meta = await getLeagueMeta();
  const season = meta.season;

  let error: string | null = null;
  let waiting = 0;
  let weeks: Awaited<ReturnType<typeof getBiggestWeeks>> = [];
  let months: Awaited<ReturnType<typeof getBiggestMonths>> = [];
  let leaders: Awaited<ReturnType<typeof getWeeklyLeaders>> = [];
  let stored = 0;

  try {
    const sync = await syncSeasonVor(season, meta.currentWeek);
    waiting = sync.waiting;
    const periods = await getMonthlyPeriods(season);
    [weeks, months, leaders, stored] = await Promise.all([
      getBiggestWeeks(season, 10),
      getBiggestMonths(season, periods, 10),
      getWeeklyLeaders(season),
      getStoredWeekCount(season),
    ]);
  } catch (err) {
    console.error("VOR records failed", err);
    error = err instanceof Error ? err.message : String(err);
  }

  const [standings, logos] = await Promise.all([getStandings(), getTeamLogos()]);
  const teamName = (id: number) => standings.teams.find((t) => t.id === id)?.name ?? String(id);
  const team = (id: number) => (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <TeamLogo url={logos[id]} name={teamName(id)} size={14} />
      {teamName(id)}
    </span>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-3xl">Biggest Weeks &amp; Months</h1>
        <Link href="/top-players" className="text-sm text-rink hover:underline">
          ← This week&apos;s top players
        </Link>
      </div>
      <p className="text-muted mb-6 max-w-prose">
        The season&apos;s best value-over-replacement performances: single weeks, and whole months (a player&apos;s weekly VOR added up
        across a Monthly Period). Only finished weeks count.
      </p>

      {error ? (
        <p className="text-muted">Couldn&apos;t load the records: {error}</p>
      ) : stored === 0 ? (
        <p className="text-muted">No finished weeks yet{waiting > 0 ? " — loading them now, refresh in a moment." : "."}</p>
      ) : (
        <div className="space-y-10">
          {waiting > 0 && <p className="text-xs text-muted">{waiting} more finished week{waiting === 1 ? "" : "s"} still loading. Refresh to include them.</p>}

          <section>
            <h2 className="font-display text-xl mb-3">Biggest single weeks</h2>
            <div className="border border-ice-line overflow-x-auto">
              <table className="w-full text-sm font-tabular">
                <thead>
                  <tr className="text-left text-muted border-b border-ice-line">
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2">Wk</th>
                    <th className="px-3 py-2">Pos</th>
                    <th className="px-3 py-2 text-right">Pts</th>
                    <th className="px-3 py-2 text-right">VOR</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((p, i) => (
                    <tr key={`${p.week}-${p.playerId}`} className="border-b border-ice-line last:border-0">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-body font-semibold">{p.name}</div>
                        {team(p.teamId)}
                      </td>
                      <td className="px-3 py-2">{p.week}</td>
                      <td className="px-3 py-2">{p.position}</td>
                      <td className="px-3 py-2 text-right">{pts(p.points)}</td>
                      <td className="px-3 py-2 text-right font-display text-base">{signed(p.vor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl mb-3">Biggest months</h2>
            {months.length === 0 ? (
              <p className="text-muted text-sm">No Monthly Periods with finished weeks yet. Set them up under Monthly Periods in the admin.</p>
            ) : (
              <div className="border border-ice-line overflow-x-auto">
                <table className="w-full text-sm font-tabular">
                  <thead>
                    <tr className="text-left text-muted border-b border-ice-line">
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Pos</th>
                      <th className="px-3 py-2 text-right">Pts</th>
                      <th className="px-3 py-2 text-right">VOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m, i) => (
                      <tr key={`${m.periodLabel}-${m.playerId}`} className="border-b border-ice-line last:border-0">
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-body font-semibold">{m.name}</div>
                          {team(m.teamId)}
                        </td>
                        <td className="px-3 py-2">
                          {m.periodLabel}
                          {!m.complete && <div className="text-xs text-muted">through week {m.throughWeek}</div>}
                        </td>
                        <td className="px-3 py-2">{m.position}</td>
                        <td className="px-3 py-2 text-right">{pts(m.points)}</td>
                        <td className="px-3 py-2 text-right font-display text-base">{signed(m.vor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl mb-3">Week-by-week leaders</h2>
            <div className="border border-ice-line overflow-x-auto">
              <table className="w-full text-sm font-tabular">
                <tbody>
                  {leaders.map((p) => (
                    <tr key={p.week} className="border-b border-ice-line last:border-0">
                      <td className="px-3 py-2 text-muted w-16">Wk {p.week}</td>
                      <td className="px-3 py-2">
                        <div className="font-body font-semibold">
                          {p.name} <span className="text-muted font-normal">({p.position})</span>
                        </div>
                        {team(p.teamId)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted">{pts(p.points)} pts</td>
                      <td className="px-3 py-2 text-right font-display text-base">{signed(p.vor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
