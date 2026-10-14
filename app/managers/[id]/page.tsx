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
import AllPlayView from "@/components/AllPlayView";
import PlayoffsView from "@/components/PlayoffsView";
import { buildPlayoffReport, type PlayoffReport } from "@/lib/manager-playoffs";
import { loadFranchisePlayers, type FranchiseEntry } from "@/lib/franchise-player";
import StyleTagsView from "@/components/StyleTagsView";
import { buildStyleTags, type StyleTag } from "@/lib/manager-style";
import ErasView from "@/components/ErasView";
import HeartbreakersView from "@/components/HeartbreakersView";
import DraftValueView from "@/components/DraftValueView";
import { loadDraftValue, type DraftValue } from "@/lib/draft-value";
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
  let seasonNow = new Date().getFullYear();
  let luck: ManagerLuckReport | null = null;
  let playoffs: PlayoffReport | null = null;
  let styleTags: StyleTag[] = [];
  try {
    const meta = await getLeagueMeta();
    seasonNow = meta.season;
    const r = await loadRecords(meta.season);
    history = buildManagerHistory(managerId, r.managers, r.recSeasons);
    activeIds = activeManagerIds(allSeasons, meta.season, r.recSeasons);
    luck = buildManagerLuck(managerId, r.managers, r.recSeasons);
    playoffs = await buildPlayoffReport(managerId, r.managers, r.recSeasons).catch((e) => {
      console.error("playoffs failed", e);
      return null;
    });
    styleTags = buildStyleTags(managerId, r.managers, r.recSeasons, playoffs);
  } catch (e) {
    console.error("manager history failed", e);
  }
  let drafts: DraftTendencies | null = null;
  try {
    drafts = await loadDraftTendencies(managerId, (await getLeagueMeta()).season);
  } catch (e) {
    console.error("draft tendencies failed", e);
  }
  let draftValue: DraftValue | null = null;
  try {
    draftValue = await loadDraftValue(managerId, (await getLeagueMeta()).season);
  } catch (e) {
    console.error("draft value failed", e);
  }
  let franchise: FranchiseEntry[] = [];
  try {
    franchise = await loadFranchisePlayers(managerId);
  } catch (e) {
    console.error("franchise player failed", e);
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

      {/* Overview: the card beside the style labels and the finish-by-year chart. */}
      <div className="grid gap-10 lg:grid-cols-[22rem_1fr] mb-10">
        {history?.career && history.career.wins + history.career.losses + history.career.ties > 0 && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated image, cached at the CDN */}
            <img src={`/api/cards/manager-card?managerId=${managerId}`} alt={`${manager.name} manager card`} loading="lazy" width={525} height={735} className="w-full max-w-sm rounded-xl shadow-lg" />
            <a href={`/api/cards/manager-card?managerId=${managerId}`} download={`${manager.name}-manager-card.png`} className="mt-3 inline-block text-sm underline">Download the card</a>
          </div>
        )}
        <div>
          <StyleTagsView tags={styleTags} />
          {history && <ErasView h={history} currentSeason={seasonNow} />}
        </div>
      </div>

      <nav aria-label="On this page" className="mb-10 flex flex-wrap gap-x-6 gap-y-2 text-sm border-y border-ice-line py-3">
        <a href="#career" className="underline">Career</a>
        <a href="#playoffs" className="underline">Playoffs</a>
        <a href="#rivalries" className="underline">Rivalries</a>
        <a href="#luck" className="underline">All-play and luck</a>
        <a href="#drafts" className="underline">Drafts</a>
        <a href="#players" className="underline">Players</a>
        <a href="#seasons" className="underline">Team by team</a>
      </nav>

      <div id="career" className="scroll-mt-20">{history && <ManagerHistoryView h={history} />}</div>
      <div id="playoffs" className="scroll-mt-20">{playoffs && <PlayoffsView r={playoffs} />}</div>
      <div id="rivalries" className="scroll-mt-20">{history && <RivalriesView h={history} activeIds={activeIds} />}</div>
      <div id="luck" className="scroll-mt-20">
        {luck && <AllPlayView r={luck} activeIds={activeIds} />}
        {luck && <LuckView r={luck} />}
        {history && <HeartbreakersView h={history} luck={luck?.me ?? null} />}
      </div>
      <div id="drafts" className="scroll-mt-20">
        {drafts && <DraftTendenciesView d={drafts} />}
        {draftValue && <DraftValueView d={draftValue} />}
      </div>
      <div id="players" className="scroll-mt-20">{owned && <OwnedPlayersView players={owned.players} seasons={owned.seasons} franchise={franchise} />}</div>
      <h2 id="seasons" className="font-display text-2xl mb-4 scroll-mt-20">Team by team</h2>
      <ManagerTimelineView
        seasons={seasons}
        keepersBySeason={keepersBySeason}
        tradesBySeason={tradesBySeason}
        managerName={managerName}
      />
    </div>
  );
}
