import { notFound } from "next/navigation";
import { getManagers, getManagerSeasons, getKeepers, getTrades } from "@/lib/content";
import { buildManagerTimeline } from "@/lib/manager-helpers";
import ManagerTimelineView from "@/components/ManagerTimelineView";
import { getTeamBanners } from "@/lib/banners";
import BannerRafters from "@/components/BannerRafters";
import ManagerHistoryView, { DraftTendenciesView, OwnedPlayersView } from "@/components/ManagerHistoryView";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { loadOwnedPlayers } from "@/lib/ownership";
import { loadDraftTendencies, type DraftTendencies } from "@/lib/draft-history";
import { buildManagerHistory, type ManagerHistory } from "@/lib/manager-history";

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
  const banners = (await getTeamBanners().catch(() => [])).filter((b) => b.managerId === managerId);
  // Career stats come from the same finished-season games as the Records page; if that load fails the
  // timeline below still shows.
  let history: ManagerHistory | null = null;
  try {
    const meta = await getLeagueMeta();
    const r = await loadRecords(meta.season);
    history = buildManagerHistory(managerId, r.managers, r.recSeasons);
  } catch (e) {
    console.error("manager history failed", e);
  }
  let drafts: DraftTendencies | null = null;
  try {
    drafts = await loadDraftTendencies(managerId, (await getLeagueMeta()).season);
  } catch (e) {
    console.error("draft tendencies failed", e);
  }
  let owned: Awaited<ReturnType<typeof loadOwnedPlayers>> = null;
  try {
    owned = await loadOwnedPlayers(managerId);
  } catch (e) {
    console.error("owned players failed", e);
  }
  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "—");

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">{manager.name}</h1>
      <p className="text-muted mb-8">{manager.notes || "\u00A0"}</p>
      <BannerRafters banners={banners} />
      {history && <ManagerHistoryView h={history} />}
      {owned && <OwnedPlayersView players={owned.players} seasons={owned.seasons} />}
      {drafts && <DraftTendenciesView d={drafts} />}
      <h2 className="font-display text-2xl mb-3">Team history</h2>
      <ManagerTimelineView
        seasons={seasons}
        keepersBySeason={keepersBySeason}
        tradesBySeason={tradesBySeason}
        managerName={managerName}
      />
    </div>
  );
}
