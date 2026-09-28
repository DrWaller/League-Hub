import { getStandings } from "@/lib/espn";
import ManagersManager from "@/components/ManagersManager";

export const dynamic = "force-dynamic";

export default async function AdminManagersPage() {
  const { teams } = await getStandings();
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Managers</h1>
      <p className="text-muted mb-8">
        Track each owner across team-name changes over the years.
      </p>
      <ManagersManager teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
