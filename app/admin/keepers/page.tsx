import { getStandings, getLeagueMeta } from "@/lib/espn";
import KeepersManager from "@/components/KeepersManager";

export const dynamic = "force-dynamic";

export default async function AdminKeepersPage() {
  const [{ teams }, meta] = await Promise.all([getStandings(), getLeagueMeta()]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Keepers</h1>
      <p className="text-muted mb-8">Log who each team kept, one season at a time.</p>
      <KeepersManager teams={teams.map((t) => ({ id: t.id, name: t.name }))} defaultSeason={meta.season} />
    </div>
  );
}
