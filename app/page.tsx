import { Suspense } from "react";
import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";
import PlayersOfTheWeek from "@/components/PlayersOfTheWeek";
import { calculatePowerRankingsWithMovement } from "@/lib/power-rankings";
import { regularSeasonFinals } from "@/lib/luck";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ teams, live }, meta, logos, all] = await Promise.all([
    getStandings(),
    getLeagueMeta(),
    getTeamLogos(),
    getMatchups(), // every week: this week's games, plus what the power rankings and "players of the week" need
  ]);
  const matchups = all.matchups.filter((m) => m.week === meta.currentWeek);
  const latestFinalWeek = regularSeasonFinals(all.matchups).reduce((max, m) => Math.max(max, m.week), 0);
  const power = latestFinalWeek > 0 ? calculatePowerRankingsWithMovement(teams, all.matchups) : null;
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name])) as Record<number, string>;

  const top3 = teams.slice(0, 3);
  const marquee = matchups[0];
  const teamById = (id: number) => teams.find((t) => t.id === id);

  return (
    <div className="space-y-12">
      {!live && (
        <div className="bg-ice-panel border border-ice-line text-sm text-muted px-4 py-3 rounded">
          Showing preview data. Add ESPN_S2 and ESPN_SWID to your deployment's environment variables
          to pull live standings and scores.
        </div>
      )}

      {/* Hero: scoreboard panel */}
      <section className="bg-rink text-ice rounded-sm overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="p-8 md:p-10">
            <p className="font-body text-sm text-ice/70 mb-2">Week {meta.currentWeek}</p>
            <h1 className="font-display text-4xl md:text-5xl leading-tight mb-4">
              This Week&apos;s Marquee Matchup
            </h1>
            {marquee ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 font-tabular">
                {[
                  { id: marquee.homeTeamId, score: marquee.homeScore },
                  null,
                  { id: marquee.awayTeamId, score: marquee.awayScore },
                ].map((side, i) =>
                  side === null ? (
                    <div key={i} className="text-ice/50 font-display text-xl pt-3">
                      vs
                    </div>
                  ) : (
                    <div key={i} className="min-w-0 flex flex-col items-center text-center gap-2">
                      <div className="rounded-sm ring-1 ring-ice/40">
                        <TeamLogo url={logos[side.id]} name={teamById(side.id)?.name ?? ""} size={44} />
                      </div>
                      {/* Two lines tall on purpose, so a long name wrapping never pushes one score out of line with the other */}
                      <div className="font-body text-base leading-tight min-h-[2.5rem] flex items-center justify-center">
                        {teamById(side.id)?.name}
                      </div>
                      <div className="font-display text-4xl">
                        {marquee.isFinal || marquee.homeScore + marquee.awayScore > 0 ? pts(side.score) : "–"}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-ice/70">No matchups scheduled yet.</p>
            )}
          </div>
          <div className="bg-rink-deep p-8 md:p-10">
            <div className="flex items-baseline justify-between mb-4">
              <p className="font-body text-sm text-ice/70">Top of the Standings</p>
              <Link href="/standings" className="text-sm text-ice/70 hover:text-white">
                Full standings →
              </Link>
            </div>
            <ol className="space-y-3 font-tabular">
              {top3.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-center-red flex items-center justify-center text-xs font-display">
                      {i + 1}
                    </span>
                    <TeamLogo url={logos[t.id]} name={t.name} size={24} />
                    <span className="font-body">{t.name}</span>
                  </span>
                  <span className="text-ice/80">
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* This week's games: every matchup, not just the marquee one */}
      {matchups.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Week {meta.currentWeek} Scoreboard</h2>
            <Link href="/matchups" className="text-sm text-rink hover:underline">
              All matchups →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matchups.map((m) => {
              const started = m.isFinal || m.homeScore + m.awayScore > 0;
              const homeWins = m.homeScore > m.awayScore;
              return (
                <div key={`${m.homeTeamId}-${m.awayTeamId}`} className="border border-ice-line px-4 py-3 space-y-2 font-tabular">
                  {[
                    { id: m.homeTeamId, score: m.homeScore, lead: started && homeWins },
                    { id: m.awayTeamId, score: m.awayScore, lead: started && !homeWins && m.awayScore > m.homeScore },
                  ].map((side) => (
                    <div key={side.id} className="flex items-center justify-between gap-3">
                      <span className={`flex items-center gap-2 min-w-0 font-body ${side.lead ? "font-semibold" : started ? "text-muted" : ""}`}>
                        <TeamLogo url={logos[side.id]} name={teamById(side.id)?.name ?? ""} size={22} />
                        <span className="truncate">{teamById(side.id)?.name}</span>
                      </span>
                      <span className={`font-display text-lg ${side.lead ? "text-center-red" : ""}`}>{started ? pts(side.score) : "–"}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Power rankings snapshot */}
      {power && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Power Rankings</h2>
            <Link href="/power-rankings" className="text-sm text-rink hover:underline">
              Full rankings →
            </Link>
          </div>
          <ol className="grid md:grid-cols-2 gap-x-10 divide-y md:divide-y-0 divide-ice-line border-y md:border-y-0 border-ice-line">
            {power.rankings.slice(0, 6).map((r) => {
              const team = power.teams.find((t) => t.id === r.teamId);
              if (!team) return null;
              const moved = r.previousRank !== undefined ? r.previousRank - r.rank : 0;
              return (
                <li key={r.teamId} className="flex items-center gap-3 py-3 md:border-b md:border-ice-line">
                  <span className="w-7 h-7 rounded-full bg-rink text-ice flex items-center justify-center font-display text-sm shrink-0">{r.rank}</span>
                  <TeamLogo url={logos[team.id]} name={team.name} size={26} />
                  <span className="font-body truncate flex-1">{team.name}</span>
                  {moved !== 0 ? (
                    <span className="text-xs font-tabular font-semibold" style={{ color: moved > 0 ? "#1F7A4D" : "#C41E3A" }}>
                      {moved > 0 ? "▲" : "▼"} {Math.abs(moved)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* The week's best players, and a player card (streams in after the rest of the page) */}
      {latestFinalWeek > 0 && (
        <Suspense fallback={<div className="h-72 bg-ice-panel animate-pulse rounded-sm" />}>
          <PlayersOfTheWeek week={latestFinalWeek} teamNames={teamNames} />
        </Suspense>
      )}
    </div>
  );
}
