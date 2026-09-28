import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ teams, live }, meta, logos] = await Promise.all([
    getStandings(),
    getLeagueMeta(),
    getTeamLogos(),
  ]);
  const { matchups } = await getMatchups(meta.currentWeek);

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
                        {marquee.isFinal || marquee.homeScore + marquee.awayScore > 0 ? side.score : "–"}
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
            <p className="font-body text-sm text-ice/70 mb-4">Top of the Standings</p>
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

      {/* Quick links */}
      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { href: "/standings", label: "Full Standings", desc: "Every team, every stat." },
          { href: "/matchups", label: "Matchups", desc: "Scores, previews, and recaps." },
          { href: "/power-rankings", label: "Power Rankings", desc: "Beyond the win-loss record." },
          { href: "/awards", label: "Weekly Awards", desc: "3 Stars, and the week's best." },
          { href: "/newsletter", label: "Newsletter", desc: "Weekly recaps and monthly wrap-ups." },
          { href: "/keepers", label: "Keepers", desc: "Who's protected, season by season." },
          { href: "/managers", label: "Managers", desc: "The people behind the teams, across every rename." },
          { href: "/history", label: "League History", desc: "Champions, season by season." },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-ice-line p-5 hover:border-rink-bright transition-colors"
          >
            <h2 className="font-display text-lg mb-1">{card.label}</h2>
            <p className="text-sm text-muted">{card.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
