import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getWeeklyAwards, getTeamLogos } from "@/lib/content";
import { AwardCategory, AWARD_LABELS } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function AwardsPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const meta = await getLeagueMeta();
  const week = Number(searchParams.week) || meta.currentWeek;
  const [{ teams }, logos, awards] = await Promise.all([
    getStandings(),
    getTeamLogos(),
    getWeeklyAwards(meta.season, week),
  ]);

  const byCategory = (cat: AwardCategory) => awards.find((a) => a.category === cat);
  const teamById = (id: number | null) => (id ? teams.find((t) => t.id === id) : undefined);

  function AwardRow({ cat }: { cat: AwardCategory }) {
    const award = byCategory(cat);
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

  const hasAnyAwards = awards.length > 0;

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
      <p className="text-muted mb-8">Three Stars and the week&apos;s top performers by position.</p>

      {!hasAnyAwards ? (
        <p className="text-muted">Nothing posted for week {week} yet.</p>
      ) : (
        <div className="space-y-10">
          <div>
            <h2 className="font-display text-xl mb-2">Three Stars</h2>
            <div>
              <AwardRow cat="star1" />
              <AwardRow cat="star2" />
              <AwardRow cat="star3" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Forward</h2>
            <div>
              <AwardRow cat="forward" />
              <AwardRow cat="forward_runner_up" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Defenseman</h2>
            <div>
              <AwardRow cat="defense" />
              <AwardRow cat="defense_runner_up" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Goalie</h2>
            <div>
              <AwardRow cat="goalie" />
              <AwardRow cat="goalie_runner_up" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
