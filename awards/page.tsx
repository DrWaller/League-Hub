import Link from "next/link";
import { getStandings, getLeagueMeta, getManagerMonthSummary } from "@/lib/espn";
import { getWeeklyAwards, getTeamLogos, getMonthlyPeriods, getMonthlyAwards, getManagers, getManagerSeasons } from "@/lib/content";
import { AwardCategory, AWARD_LABELS } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";
import { pts, ptsComma } from "@/lib/format";

export const dynamic = "force-dynamic";

function AwardRow({
  cat,
  awards,
  teamById,
  logos,
}: {
  cat: AwardCategory;
  awards: { category: string; playerName: string; teamId: number | null; note: string | null }[];
  teamById: (id: number | null) => { id: number; name: string } | undefined;
  logos: Record<number, string>;
}) {
  const award = awards.find((a) => a.category === cat);
  if (!award) return null;
  const team = teamById(award.teamId);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-ice-line/60 last:border-b-0">
      <div className="w-40 text-sm text-muted shrink-0">{AWARD_LABELS[cat]}</div>
      {team && <TeamLogo url={logos[team.id]} name={team.name} size={24} />}
      <div>
        <div className="font-body font-medium">{award.playerName}</div>
        <div className="text-xs text-muted">
          {team && team.name}
          {team && award.note && " · "}
          {award.note}
        </div>
      </div>
    </div>
  );
}

function AwardGroups({
  awards,
  teamById,
  logos,
}: {
  awards: { category: string; playerName: string; teamId: number | null; note: string | null }[];
  teamById: (id: number | null) => { id: number; name: string } | undefined;
  logos: Record<number, string>;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-xl mb-2">Three Stars</h2>
        <div>
          <AwardRow cat="star1" awards={awards} teamById={teamById} logos={logos} />
          <AwardRow cat="star2" awards={awards} teamById={teamById} logos={logos} />
          <AwardRow cat="star3" awards={awards} teamById={teamById} logos={logos} />
        </div>
      </div>
      <div>
        <h2 className="font-display text-xl mb-2">Forward</h2>
        <div>
          <AwardRow cat="forward" awards={awards} teamById={teamById} logos={logos} />
          <AwardRow cat="forward_runner_up" awards={awards} teamById={teamById} logos={logos} />
        </div>
      </div>
      <div>
        <h2 className="font-display text-xl mb-2">Defenseman</h2>
        <div>
          <AwardRow cat="defense" awards={awards} teamById={teamById} logos={logos} />
          <AwardRow cat="defense_runner_up" awards={awards} teamById={teamById} logos={logos} />
        </div>
      </div>
      <div>
        <h2 className="font-display text-xl mb-2">Goalie</h2>
        <div>
          <AwardRow cat="goalie" awards={awards} teamById={teamById} logos={logos} />
          <AwardRow cat="goalie_runner_up" awards={awards} teamById={teamById} logos={logos} />
        </div>
      </div>
    </div>
  );
}

export default async function AwardsPage({
  searchParams,
}: {
  searchParams: { view?: string; week?: string; season?: string; period?: string };
}) {
  const view = searchParams.view === "month" ? "month" : "week";
  const meta = await getLeagueMeta();
  const season = Number(searchParams.season) || meta.season;
  const [{ teams }, logos] = await Promise.all([getStandings(), getTeamLogos()]);
  const teamById = (id: number | null) => (id ? teams.find((t) => t.id === id) : undefined);

  const viewToggle = (
    <div className="flex gap-2 mb-6">
      <Link
        href="/awards?view=week"
        className={`px-3 py-1.5 text-sm border ${view === "week" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        Weekly
      </Link>
      <Link
        href="/awards?view=month"
        className={`px-3 py-1.5 text-sm border ${view === "month" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        Monthly
      </Link>
    </div>
  );

  if (view === "month") {
    const periods = await getMonthlyPeriods(season);
    const periodLabel = searchParams.period || periods[0]?.label;
    const period = periods.find((p) => p.label === periodLabel);

    const [awards, managers, managerSeasons, monthSummary] = await Promise.all([
      period ? getMonthlyAwards(season, period.label) : Promise.resolve([]),
      getManagers(),
      getManagerSeasons(),
      period ? getManagerMonthSummary(period.startWeek, period.endWeek, season) : Promise.resolve({ teams: [], live: false }),
    ]);

    const managerNameForTeam = (teamId: number) => {
      const ms = managerSeasons.find((s) => s.teamId === teamId && s.season === season);
      return ms?.managerId ? managers.find((m) => m.id === ms.managerId)?.name : undefined;
    };

    const ranked = [...monthSummary.teams].sort(
      (a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor
    );

    return (
      <div>
        <h1 className="font-display text-3xl mb-1">Monthly Awards</h1>
        {viewToggle}

        {periods.length > 1 && (
          <div className="flex gap-2 mb-8 flex-wrap">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={`/awards?view=month&season=${season}&period=${encodeURIComponent(p.label)}`}
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
          <>
            <div className="border border-ice-line p-5 mb-10">
              <h2 className="font-display text-xl mb-3">Manager of the Month</h2>
              {ranked.length === 0 ? (
                <p className="text-muted text-sm">No final matchups in this period yet.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {ranked.slice(0, 3).map((t, i) => {
                    const team = teamById(t.teamId);
                    const managerName = managerNameForTeam(t.teamId);
                    return (
                      <li key={t.teamId} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {team && <TeamLogo url={logos[team.id]} name={team.name} size={22} />}
                          <span className="font-body">
                            {i + 1}. {team?.name ?? `Team ${t.teamId}`}
                            {managerName ? ` — ${managerName}` : ""}
                          </span>
                        </span>
                        <span className="font-tabular text-muted">
                          {t.wins}-{t.losses}
                          {t.ties ? `-${t.ties}` : ""} · {pts(t.pointsFor)} pts
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {awards.length === 0 ? (
              <p className="text-muted">No player awards posted for {period.label} yet.</p>
            ) : (
              <AwardGroups awards={awards} teamById={teamById} logos={logos} />
            )}
          </>
        )}
      </div>
    );
  }

  // --- Weekly view ---
  const week = Number(searchParams.week) || meta.currentWeek;
  const awards = await getWeeklyAwards(meta.season, week);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl">Weekly Awards</h1>
        <div className="flex items-center gap-3 font-tabular text-sm">
          <Link href={`/awards?week=${Math.max(1, week - 1)}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            ←
          </Link>
          <span>Week {week}</span>
          <Link href={`/awards?week=${week + 1}`} className="px-2 py-1 border border-ice-line hover:border-rink-bright">
            →
          </Link>
        </div>
      </div>
      {viewToggle}
      <p className="text-muted mb-8">Three Stars and the week&apos;s top performers by position.</p>

      {awards.length === 0 ? (
        <p className="text-muted">Nothing posted for week {week} yet.</p>
      ) : (
        <AwardGroups awards={awards} teamById={teamById} logos={logos} />
      )}
    </div>
  );
}
