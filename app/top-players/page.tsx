import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import { getWeekVor } from "@/lib/vor";
import TeamLogo from "@/components/TeamLogo";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Top Players" };

const SHOWN = 25;

export default async function TopPlayersPage({ searchParams }: { searchParams: { week?: string } }) {
  const meta = await getLeagueMeta();
  const week = Number(searchParams.week) || meta.currentWeek;

  const [vor, standings, logos] = await Promise.all([
    getWeekVor(week, meta.season, meta.season).catch(() => null),
    getStandings(),
    getTeamLogos(),
  ]);
  const teamName = (id: number) => standings.teams.find((t) => t.id === id)?.name ?? String(id);
  const top = vor?.players.slice(0, SHOWN) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-3xl">Top Players</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link href={`/top-players?week=${Math.max(1, week - 1)}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            ←
          </Link>
          <span>Week {week}</span>
          <Link href={`/top-players?week=${week + 1}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            →
          </Link>
        </div>
      </div>

      <p className="text-muted mb-2 max-w-prose">
        Value over replacement: each player&apos;s fantasy points for the week minus the score of the last player who would be
        starting at his position if every team started its best. It puts a goalie and a forward on one scale.
      </p>
      <p className="mb-4 text-sm">
        <Link href="/top-players/records" className="text-rink hover:underline">
          Season records: biggest weeks &amp; months →
        </Link>
      </p>
      {vor && (
        <p className="text-xs text-muted mb-6 max-w-prose font-tabular">
          Replacement level this week: C {pts(vor.replacement.C)} · LW {pts(vor.replacement.LW)} · RW {pts(vor.replacement.RW)} · D{" "}
          {pts(vor.replacement.D)} · G {pts(vor.replacement.G)}. Counts every point a rostered player scored, started or benched.
        </p>
      )}

      {!vor || top.length === 0 ? (
        <p className="text-muted">No player stats for week {week} yet.</p>
      ) : (
        <div className="border border-ice-line overflow-x-auto">
          <table className="w-full text-sm font-tabular">
            <thead>
              <tr className="text-left text-muted border-b border-ice-line">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-right">Repl.</th>
                <th className="px-3 py-2 text-right">VOR</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <tr key={p.id} className="border-b border-ice-line last:border-0">
                  <td className="px-3 py-2 text-muted">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-body font-semibold">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <TeamLogo url={logos[p.teamId]} name={teamName(p.teamId)} size={14} />
                      {teamName(p.teamId)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{p.position}</td>
                  <td className="px-3 py-2 text-right">{pts(p.points)}</td>
                  <td className="px-3 py-2 text-right text-muted">{pts(p.replacement)}</td>
                  <td className="px-3 py-2 text-right font-display text-base">{p.vor >= 0 ? "+" : ""}{pts(p.vor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
