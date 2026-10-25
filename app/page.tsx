import { Suspense } from "react";
import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";
import LastNight from "@/components/LastNight";
import { pts } from "@/lib/format";
import { getWeekGamesPlayed } from "@/lib/games-played";
import { projectMatchup } from "@/lib/win-probability";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ teams }, meta, logos, all] = await Promise.all([
    getStandings(),
    getLeagueMeta(),
    getTeamLogos(),
    getMatchups(),
  ]);
  const matchups = all.matchups.filter((m) => m.week === meta.currentWeek);
  // Win probability for each game (the same model the Matchups page uses; ESPN calls are cached for minutes).
  // If it can't load, the cards simply show no bar.
  const gamesPlayed = await getWeekGamesPlayed(meta.currentWeek, meta.season).catch(() => null);
  const projOf = (m: (typeof matchups)[number]) =>
    gamesPlayed ? projectMatchup(m.homeScore, m.awayScore, gamesPlayed[m.homeTeamId], gamesPlayed[m.awayTeamId]) : null;

  const top3 = teams.slice(0, 3);
  // Marquee matchup: early in the week (little scoring yet) the two best teams in the
  // standings; once a game has real points on the board, the closest game, with the better
  // teams breaking ties.
  const rankOf = (id: number) => {
    const i = teams.findIndex((t) => t.id === id);
    return i === -1 ? teams.length : i;
  };
  const strength = (m: (typeof matchups)[number]) => rankOf(m.homeTeamId) + rankOf(m.awayTeamId); // lower = better
  const margin = (m: (typeof matchups)[number]) => Math.abs(m.homeScore - m.awayScore);
  const hasData = (m: (typeof matchups)[number]) => m.isFinal || m.homeScore + m.awayScore >= 40;
  const live = matchups.filter(hasData);
  const marquee =
    live.length > 0
      ? [...live].sort((a, b) => margin(a) - margin(b) || strength(a) - strength(b))[0]
      : [...matchups].sort((a, b) => strength(a) - strength(b))[0];
  const teamById = (id: number) => teams.find((t) => t.id === id);

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Hero: scoreboard panel */}
      <section className="bg-rink text-ice rounded-sm overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="p-5 md:p-10">
            <p className="font-body text-xs md:text-sm uppercase tracking-widest text-ice/60 mb-1.5 md:mb-2">Week {meta.currentWeek}</p>
            <h1 className="font-display text-[1.7rem] md:text-5xl leading-tight mb-5 md:mb-4">
              This Week&apos;s Marquee Matchup
            </h1>
            {marquee ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 md:gap-3 font-tabular">
                {[
                  { id: marquee.homeTeamId, score: marquee.homeScore },
                  null,
                  { id: marquee.awayTeamId, score: marquee.awayScore },
                ].map((side, i) =>
                  side === null ? (
                    <div key={i} className="text-ice/40 font-display text-sm md:text-xl pt-5 md:pt-3 uppercase tracking-widest">
                      vs
                    </div>
                  ) : (
                    <div key={i} className="min-w-0 flex flex-col items-center text-center gap-2">
                      <div className="rounded-md ring-1 ring-ice/30 bg-white/5 p-1">
                        <TeamLogo url={logos[side.id]} name={teamById(side.id)?.name ?? ""} size={56} />
                      </div>
                      {/* Two lines tall on purpose, so a long name wrapping never pushes one score out of line with the other */}
                      <div className="font-body text-sm md:text-base leading-tight min-h-[2.25rem] md:min-h-[2.5rem] flex items-center justify-center">
                        {teamById(side.id)?.name}
                      </div>
                      <div className="font-display text-[2.5rem] md:text-4xl leading-none">
                        {marquee.isFinal || marquee.homeScore + marquee.awayScore > 0 ? pts(side.score) : "–"}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-ice/70">No matchups scheduled yet.</p>
            )}
            {marquee && projOf(marquee) && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-ice/60 mb-1.5 font-tabular">
                  <span>{projOf(marquee)!.homeWinPct}%</span>
                  <span>Win probability</span>
                  <span>{projOf(marquee)!.awayWinPct}%</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
                  <div className="h-full bg-ice" style={{ width: `${projOf(marquee)!.homeWinPct}%` }} />
                  <div className="h-full flex-1 bg-center-red" />
                </div>
              </div>
            )}
          </div>
          <div className="bg-rink-deep p-5 md:p-10">
            <div className="flex items-baseline justify-between mb-3 md:mb-4">
              <p className="font-body text-xs md:text-sm uppercase tracking-widest text-ice/60">Top of the Standings</p>
              <Link href="/standings" className="text-xs md:text-sm text-ice/70 hover:text-white">
                Full standings →
              </Link>
            </div>
            <ol className="divide-y divide-ice/10 md:divide-y-0 md:space-y-3 font-tabular">
              {top3.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 md:py-0">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-center-red flex items-center justify-center text-xs font-display">
                      {i + 1}
                    </span>
                    <TeamLogo url={logos[t.id]} name={t.name} size={24} />
                    <span className="font-body truncate">{t.name}</span>
                  </span>
                  <span className="text-ice/80 shrink-0 font-display text-lg md:text-base">
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Last night's big performances (renders nothing on a quiet night) */}
      <Suspense fallback={null}>
        <LastNight />
      </Suspense>

      {/* This week's games: every matchup, not just the marquee one */}
      {matchups.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3 md:mb-4">
            <h2 className="font-display text-xl md:text-2xl">Week {meta.currentWeek} Scoreboard</h2>
            <Link href="/matchups" className="text-sm text-rink hover:underline">
              All matchups →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matchups.map((m) => {
              const started = m.isFinal || m.homeScore + m.awayScore > 0;
              const homeWins = m.homeScore > m.awayScore;
              const proj = projOf(m);
              const close = started && !m.isFinal && Math.abs(m.homeScore - m.awayScore) <= 3;
              return (
                <div key={`${m.homeTeamId}-${m.awayTeamId}`} className="border border-ice-line rounded-sm bg-white px-3.5 py-2.5 md:px-4 md:py-3 space-y-1.5 md:space-y-2 font-tabular shadow-[0_1px_0_rgba(18,58,97,0.04)]">
                  {[
                    { id: m.homeTeamId, score: m.homeScore, lead: started && homeWins },
                    { id: m.awayTeamId, score: m.awayScore, lead: started && !homeWins && m.awayScore > m.homeScore },
                  ].map((side) => (
                    <div key={side.id} className="flex items-center justify-between gap-3">
                      <span className={`flex items-center gap-2 min-w-0 font-body ${side.lead ? "font-semibold" : started ? "text-muted" : ""}`}>
                        <TeamLogo url={logos[side.id]} name={teamById(side.id)?.name ?? ""} size={28} />
                        <span className="truncate">{teamById(side.id)?.name}</span>
                      </span>
                      <span className={`font-display text-xl md:text-lg ${side.lead ? "text-center-red" : ""}`}>{started ? pts(side.score) : "–"}</span>
                    </div>
                  ))}
                  {proj && (
                    <div className="pt-1">
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-ice-line">
                        <div className="h-full bg-rink-bright" style={{ width: `${proj.homeWinPct}%` }} />
                        <div className="h-full flex-1 bg-center-red" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted mt-1">
                        <span>{proj.homeWinPct}%</span>
                        {close ? <span className="rounded-full bg-gold/25 text-rink font-semibold uppercase tracking-widest px-2 py-px">Close</span> : <span className="uppercase tracking-widest">Win prob</span>}
                        <span>{proj.awayWinPct}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
