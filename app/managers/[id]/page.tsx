import { notFound } from "next/navigation";
import { getManagers, getManagerSeasons, getKeepers, getTrades } from "@/lib/content";
import { buildManagerTimeline } from "@/lib/manager-helpers";
import ManagerTimelineView from "@/components/ManagerTimelineView";

export const dynamic = "force-dynamic";

export default async function ManagerProfilePage({ params }: { params: { id: string } }) {
  const managerId = Number(params.id);
  const [managers, allSeasons, allKeepers, allTrades] = await Promise.all([
    getManagers(),
    getManagerSeasons(),
    getKeepers(),
    getTrades(),
  ]);

  const manager = managers.find((m) => m.id === managerId);
  if (!manager) notFound();

  const { seasons, keepersBySeason, tradesBySeason } = buildManagerTimeline(
    managerId,
    allSeasons,
    allKeepers,
    allTrades
  );
  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "—");

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">{manager.name}</h1>
      <p className="text-muted mb-8">{manager.notes || "\u00A0"}</p>
      <ManagerTimelineView
        seasons={seasons}
        keepersBySeason={keepersBySeason}
        tradesBySeason={tradesBySeason}
        managerName={managerName}
      />
    </div>
  );
}
