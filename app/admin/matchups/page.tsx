import { getLeagueMeta } from "@/lib/espn";
import MatchupBlurbForm from "@/components/MatchupBlurbForm";

export const dynamic = "force-dynamic";

export default async function AdminMatchupsPage() {
  const meta = await getLeagueMeta();

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Matchup Blurbs</h1>
      <p className="text-muted mb-8">Write a preview before the week, or a summary once it's final.</p>
      <MatchupBlurbForm defaultSeason={meta.season} defaultWeek={meta.currentWeek} />
    </div>
  );
}
