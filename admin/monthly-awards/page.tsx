import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getMonthlyPeriods } from "@/lib/content";
import MonthlyAwardsForm from "@/components/MonthlyAwardsForm";

export const dynamic = "force-dynamic";

export default async function AdminMonthlyAwardsPage() {
  const [{ teams }, meta, periods] = await Promise.all([getStandings(), getLeagueMeta(), getMonthlyPeriods()]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Monthly Awards</h1>
      <p className="text-muted mb-8">Player awards you pick, plus an automatic Manager of the Month.</p>
      <MonthlyAwardsForm teams={teams.map((t) => ({ id: t.id, name: t.name }))} periods={periods} defaultSeason={meta.season} />
    </div>
  );
}
