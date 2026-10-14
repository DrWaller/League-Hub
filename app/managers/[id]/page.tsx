import { notFound } from "next/navigation";
import { getManagers, getManagerSeasons, getKeepers, getTrades, getTeamLogos } from "@/lib/content";
import { buildManagerTimeline } from "@/lib/manager-helpers";
import ManagerTimelineView from "@/components/ManagerTimelineView";
import { getTeamBanners } from "@/lib/banners";
import BannerRafters from "@/components/BannerRafters";
import ManagerHero from "@/components/ManagerHero";
import ManagerHistoryView, { DraftTendenciesView, OwnedPlayersView } from "@/components/ManagerHistoryView";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { loadOwnedPlayers } from "@/lib/ownership";
import { loadDraftTendencies, type DraftTendencies } from "@/lib/draft-history";
import { buildManagerHistory, type ManagerHistory } from "@/lib/manager-history";
import { activeManagerIds } from "@/lib/active-managers";
import RivalriesView from "@/components/RivalriesView";
import LuckView from "@/components/LuckView";
import { buildManagerLuck, type ManagerLuckReport } from "@/lib/manager-luck";

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
  let activeIds = new Set<number>();
  let luck: ManagerLuckReport | null = null;
  try {
    const meta = await getLeagueMeta();
    const r = await loadRecords(meta.season);
    history = buildManagerHistory(managerId, r.managers, r.recSeasons);
    activeIds = activeManagerIds(allSeasons, meta.season, r.recSeasons);
    luck = buildManagerLuck(managerId, r.managers, r.recSeasons);
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
  const logos = await getTeamLogos().catch(() => ({} as Record<number, string>));
  const latest = seasons[0]; // newest first
  const c = history?.career ?? null;
  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "—");

  return (
    <div>
      <ManagerHero
        d={{
          name: manager.name,
          team: latest?.teamName ?? null,
          logoUrl: latest ? logos[latest.teamId] : undefined,
          first: seasons.length ? seasons[seasons.length - 1].season : null,
          last: latest?.season ?? null,
          notes: manager.notes,
          wins: c?.wins ?? 0,
          losses: c?.losses ?? 0,
          ties: c?.ties ?? 0,
          winPct: c?.winPct ?? 0,
          titles: c?.titles ?? 0,
          runnerUps: c?.runnerUps ?? 0,
          seasons: c?.seasons ?? 0,
          hasRecord: !!c && c.wins + c.losses + c.ties > 0,
        }}
      />
      <BannerRafters banners={banners} />
      {history?.career && history.career.wins + history.career.losses + history.career.ties > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-2xl mb-4">Manager card</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated image, cached at the CDN */}
          <img src={`/api/cards/manager-card?managerId=${managerId}`} alt={`${manager.name} manager card`} loading="lazy" width={525} height={735} className="w-full max-w-sm rounded-xl shadow-lg" />
          <a href={`/api/cards/manager-card?managerId=${managerId}`} download={`${manager.name}-manager-card.png`} className="mt-3 inline-block text-sm underline">Download the card</a>
        </section>
      )}
      {history && <ManagerHistoryView h={history} />}
      {history && <RivalriesView h={history} activeIds={activeIds} />}
      {luck && <LuckView r={luck} />}
      {owned && <OwnedPlayersView players={owned.players} seasons={owned.seasons} />}
      {drafts && <DraftTendenciesView d={drafts} />}
      <h2 className="font-display text-2xl mb-4">Team by team</h2>
      <ManagerTimelineView
        seasons={seasons}
        keepersBySeason={keepersBySeason}
        tradesBySeason={tradesBySeason}
        managerName={managerName}
      />
    </div>
  );
}
