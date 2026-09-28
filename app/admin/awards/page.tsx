import { getStandings, getLeagueMeta } from "@/lib/espn";
import AwardsForm from "@/components/AwardsForm";

export const dynamic = "force-dynamic";

export default async function AdminAwardsPage() {
  const [{ teams }, meta] = await Promise.all([getStandings(), getLeagueMeta()]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Weekly Awards</h1>
      <p className="text-muted mb-8">Pick a season and week, fill in what applies, and save.</p>
      <AwardsForm
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        defaultSeason={meta.season}
        defaultWeek={meta.currentWeek}
      />
    </div>
  );
}
