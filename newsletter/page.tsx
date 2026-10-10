import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta, getManagerMonthSummary } from "@/lib/espn";
import {
  getWeeklyAwards,
  getMatchupContent,
  getTrades,
  getMonthlyPeriods,
  getMonthlyAwards,
  getManagers,
  getTeamLogos,
  getNewsletterIntro,
} from "@/lib/content";
import { AWARD_LABELS, AwardCategory } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";
import PowerRankingsList from "@/components/PowerRankingsList";
import LuckTable from "@/components/LuckTable";
import { calculatePowerRankingsWithMovement } from "@/lib/power-rankings";
import { computeLuck, regularSeasonFinals } from "@/lib/luck";
import { pts, ptsComma } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: { view?: string; week?: string; season?: string; period?: string };
}) {
  const view = searchParams.view === "month" ? "month" : "week";
  const meta = await getLeagueMeta();
  const season = Number(searchParams.season) || meta.season;
  const [{ teams }, logos, managers] = await Promise.all([getStandings(), getTeamLogos(), getManagers()]);
  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "a free agent");

  const viewToggle = (
    <div className="flex gap-2 mb-6">
      <Link
        href="/newsletter?view=week"
        className={`px-3 py-1.5 text-sm border ${view === "week" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        Weekly Recap
      </Link>
      <Link
        href="/newsletter?view=month"
        className={`px-3 py-1.5 text-sm border ${view === "month" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        Monthly Wrap-up
      </Link>
    </div>
  );

  if (view === "month") {
    const periods = await getMonthlyPeriods(season);
    const periodLabel = searchParams.period || periods[0]?.label;
    const period = periods.find((p) => p.label === periodLabel);

    const [introData, monthlyAwards, trades, monthSummary] = await Promise.all([
      period ? getNewsletterIntro(season, "month", period.label) : Promise.resolve(null),
      period ? getMonthlyAwards(season, period.label) : Promise.resolve([]),
      getTrades(season),
      period ? getManagerMonthSummary(period.startWeek, period.endWeek, season) : Promise.resolve({ teams: [], live: false }),
    ]);
    const introText = introData?.introText ?? "";

    const periodTrades = period ? trades.filter((t) => t.week !== null && t.week >= period.startWeek && t.week <= period.endWeek) : [];
    const ranked = [...monthSummary.teams].sort(
      (a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor
    );

    return (
      <div>
        <h1 className="font-display text-3xl mb-1">Newsletter</h1>
        {viewToggle}

        {periods.length > 1 && (
          <div className="flex gap-2 mb-8 flex-wrap">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={`/newsletter?view=month&season=${season}&period=${encodeURIComponent(p.label)}`}
                className={`px-3 py-1.5 text-sm border ${p.label === periodLabel ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        )}

        {!period ? (
          <p className="text-muted">No monthly periods defined yet.</p>
        ) : (
          <div className="space-y-10">
            <h2 className="font-display text-2xl">{period.label} Wrap-up</h2>
            {introText && <p className="whitespace-pre-line leading-relaxed">{introText}</p>}

            <div>
              <h3 className="font-display text-lg mb-3">Standings This Period</h3>
              <ol className="text-sm space-y-1">
                {ranked.map((t, i) => (
                  <li key={t.teamId} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TeamLogo url={logos[t.teamId]} name={teamName(t.teamId)} size={20} />
                      {i + 1}. {teamName(t.teamId)}
                    </span>
                    <span className="font-tabular text-muted">
                      {t.wins}-{t.losses}
                      {t.ties ? `-${t.ties}` : ""} · {pts(t.pointsFor)} pts
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {monthlyAwards.length > 0 && (
              <div>
                <h3 className="font-display text-lg mb-3">Monthly Awards</h3>
                <ul className="text-sm space-y-1">
                  {monthlyAwards.map((a) => (
                    <li key={a.category}>
                      <span className="text-muted">{AWARD_LABELS[a.category as AwardCategory]}:</span> {a.playerName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {periodTrades.length > 0 && (
              <div>
                <h3 className="font-display text-lg mb-3">Trades</h3>
                <ul className="text-sm space-y-1 text-muted">
                  {periodTrades.map((t) => (
                    <li key={t.id}>
                      {t.playerName}: {managerName(t.fromManagerId)} → {managerName(t.toManagerId)}
                      {t.note && ` — ${t.note}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Weekly view ---
  const week = Number(searchParams.week) || meta.currentWeek;
  const [{ matchups }, awards, blurbs, allTrades] = await Promise.all([
    getMatchups(week, season),
    getWeeklyAwards(season, week),
    getMatchupContent(season, week),
    getTrades(season),
  ]);
  const weekTrades = allTrades.filter((t) => t.week === week);

  // Power rankings and the luck chart "as of" this week. Current season only
  // (they're built from this season's live standings and results).
  let ranking: ReturnType<typeof calculatePowerRankingsWithMovement> | null = null;
  let luck: ReturnType<typeof computeLuck> | null = null;
  if (season === meta.season) {
    const all = await getMatchups();
    const finalsThrough = regularSeasonFinals(all.matchups).filter((m) => m.week <= week);
    if (finalsThrough.length > 0) {
      ranking = calculatePowerRankingsWithMovement(teams, all.matchups, week);
      luck = computeLuck(all.matchups, ranking.throughWeek);
    }
  }
  const introData = await getNewsletterIntro(season, "week", String(week));
  const introText = introData?.introText ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl">Newsletter</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link href={`/newsletter?week=${Math.max(1, week - 1)}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            ←
          </Link>
          <span>Week {week}</span>
          <Link href={`/newsletter?week=${week + 1}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            →
          </Link>
        </div>
      </div>
      {viewToggle}

      <div className="space-y-10">
        <h2 className="font-display text-2xl">Week {week} Recap</h2>
        {introText && <p className="whitespace-pre-line leading-relaxed">{introText}</p>}

        <div>
          <h3 className="font-display text-lg mb-3">Scores</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {matchups.map((m, i) => {
              const blurb = blurbs.find((c) => c.homeTeamId === m.homeTeamId && c.awayTeamId === m.awayTeamId);
              return (
                <div key={i} className="border border-ice-line p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <TeamLogo url={logos[m.homeTeamId]} name={teamName(m.homeTeamId)} size={18} />
                      {teamName(m.homeTeamId)}
                    </span>
                    <span className="font-tabular">{pts(m.homeScore)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="flex items-center gap-2">
                      <TeamLogo url={logos[m.awayTeamId]} name={teamName(m.awayTeamId)} size={18} />
                      {teamName(m.awayTeamId)}
                    </span>
                    <span className="font-tabular">{pts(m.awayScore)}</span>
                  </div>
                  {blurb?.summary && <p className="text-muted mt-2 pt-2 border-t border-ice-line">{blurb.summary}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {awards.length > 0 && (
          <div>
            <h3 className="font-display text-lg mb-3">Weekly Awards</h3>
            <ul className="text-sm space-y-1">
              {awards.map((a) => (
                <li key={a.category}>
                  <span className="text-muted">{AWARD_LABELS[a.category as AwardCategory]}:</span> {a.playerName}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ranking && (
          <div>
            <h3 className="font-display text-lg mb-1">Power Rankings</h3>
            <p className="text-xs text-muted mb-3">
              Through week {ranking.throughWeek}
              {ranking.throughWeek > 1 ? `. Arrows show movement since week ${ranking.throughWeek - 1}.` : "."}
            </p>
            <PowerRankingsList rankings={ranking.rankings} teams={ranking.teams} logos={logos} />
          </div>
        )}

        {luck && luck.rows.length > 0 && (
          <div>
            <h3 className="font-display text-lg mb-1">Luck Chart</h3>
            <p className="text-xs text-muted mb-3 max-w-prose">
              Actual record vs. the record each team would have if it played every other team every week, through
              week {ranking?.throughWeek}. Green is lucky, red is unlucky.
            </p>
            <LuckTable rows={luck.rows} leagueMedian={luck.leagueMedian} teamName={teamName} logos={logos} />
          </div>
        )}

        {weekTrades.length > 0 && (
          <div>
            <h3 className="font-display text-lg mb-3">Trades</h3>
            <ul className="text-sm space-y-1 text-muted">
              {weekTrades.map((t) => (
                <li key={t.id}>
                  {t.playerName}: {managerName(t.fromManagerId)} → {managerName(t.toManagerId)}
                  {t.note && ` — ${t.note}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
