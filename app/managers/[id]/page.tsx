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
import { loadFranchisePlayers, loadAllTimeTeam, type FranchiseEntry, type AllTimeSpot } from "@/lib/franchise-player";
import AllTimeTeamView from "@/components/AllTimeTeamView";
import ManagerTabs from "@/components/ManagerTabs";
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
    playoffs = buildPlayoffReport(managerId, r.managers, r.recSeasons);
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
  let allTime: AllTimeSpot[] = [];
  try {
    allTime = await loadAllTimeTeam(managerId);
  } catch (e) {
    console.error("all-time team failed", e);
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

      <ManagerTabs
        tabs={[
          { id: "career", label: "Career", content: history ? <ManagerHistoryView h={history} /> : null },
          { id: "playoffs", label: "Playoffs", content: playoffs ? <PlayoffsView r={playoffs} /> : null },
          { id: "rivalries", label: "Rivalries", content: history ? <RivalriesView h={history} activeIds={activeIds} /> : null },
          {
            id: "luck",
            label: "Luck",
            content: (
              <>
                {luck && <AllPlayView r={luck} activeIds={activeIds} />}
                {luck && <LuckView r={luck} />}
                {history && <HeartbreakersView h={history} luck={luck?.me ?? null} />}
              </>
            ),
          },
          {
            id: "drafts",
            label: "Drafts",
            content: (
              <>
                {drafts && <DraftTendenciesView d={drafts} />}
                {draftValue && <DraftValueView d={draftValue} />}
              </>
            ),
          },
          { id: "players", label: "Players", content: owned ? <OwnedPlayersView players={owned.players} seasons={owned.seasons} franchise={franchise}><AllTimeTeamView team={allTime} /></OwnedPlayersView> : null },
          {
            id: "seasons",
            label: "Team by team",
            content: <ManagerTimelineView seasons={seasons} keepersBySeason={keepersBySeason} tradesBySeason={tradesBySeason} managerName={managerName} />,
          },
        ].filter((t) => t.content != null)}
      />
    </div>
  );
}
