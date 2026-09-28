import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getKeepers, getTeamLogos, getManagers, getManagerSeasons, getTrades } from "@/lib/content";
import { buildManagerTimeline } from "@/lib/manager-helpers";
import TeamLogo from "@/components/TeamLogo";
import ManagerTimelineView from "@/components/ManagerTimelineView";

export const dynamic = "force-dynamic";

export default async function KeepersPage({
  searchParams,
}: {
  searchParams: { view?: string; season?: string; manager?: string };
}) {
  const view = searchParams.view === "team" ? "team" : "season";
  const meta = await getLeagueMeta();
  const [{ teams: liveTeams }, logos, allKeepers, managers, allManagerSeasons, allTrades] = await Promise.all([
    getStandings(),
    getTeamLogos(),
    getKeepers(),
    getManagers(),
    getManagerSeasons(),
    getTrades(),
  ]);

  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "—");

  const viewToggle = (
    <div className="flex gap-2 mb-6">
      <Link
        href="/keepers?view=season"
        className={`px-3 py-1.5 text-sm border ${view === "season" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        By Season
      </Link>
      <Link
        href="/keepers?view=team"
        className={`px-3 py-1.5 text-sm border ${view === "team" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
      >
        By Team
      </Link>
    </div>
  );

  if (view === "team") {
    const selectedManagerId = Number(searchParams.manager) || managers[0]?.id;
    const selectedManager = managers.find((m) => m.id === selectedManagerId);
    const timeline = selectedManagerId
      ? buildManagerTimeline(selectedManagerId, allManagerSeasons, allKeepers, allTrades)
      : null;

    return (
      <div>
        <h1 className="font-display text-3xl mb-1">Keepers</h1>
        <p className="text-muted mb-6">Who each team protected, and the trades along the way.</p>
        {viewToggle}

        {managers.length === 0 ? (
          <p className="text-muted">No managers added yet — add some in the admin area first.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-8">
              {managers.map((m) => (
                <Link
                  key={m.id}
                  href={`/keepers?view=team&manager=${m.id}`}
                  className={`px-3 py-1.5 text-sm border ${
                    m.id === selectedManagerId ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
                  }`}
                >
                  {m.name}
                </Link>
              ))}
            </div>
            {selectedManager && timeline && (
              <>
                <h2 className="font-display text-xl mb-4">{selectedManager.name}</h2>
                <ManagerTimelineView
                  seasons={timeline.seasons}
                  keepersBySeason={timeline.keepersBySeason}
                  tradesBySeason={timeline.tradesBySeason}
                  managerName={managerName}
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // --- Season view ---
  const seasonsWithData = new Set<number>([
    meta.season,
    ...allKeepers.map((k) => k.season),
    ...allManagerSeasons.map((s) => s.season),
  ]);
  const seasons = Array.from(seasonsWithData).sort((a, b) => b - a);
  const season = Number(searchParams.season) || seasons[0] || meta.season;

  // Team id -> display name for the selected season: live ESPN data for
  // the current season, hand-entered manager_team_seasons for past ones.
  const teamNameForSeason = new Map<number, string>();
  if (season === meta.season) {
    for (const t of liveTeams) teamNameForSeason.set(t.id, t.name);
  } else {
    for (const s of allManagerSeasons.filter((s) => s.season === season)) {
      teamNameForSeason.set(s.teamId, s.teamName);
    }
  }

  const keepersThisSeason = allKeepers.filter((k) => k.season === season);
  const teamIdsThisSeason = Array.from(new Set(keepersThisSeason.map((k) => k.teamId)));
  // Include teams with no keepers logged but a known name that season, too.
  for (const id of teamNameForSeason.keys()) {
    if (!teamIdsThisSeason.includes(id)) teamIdsThisSeason.push(id);
  }

  const tradesThisSeason = allTrades.filter((t) => t.season === season);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Keepers</h1>
      <p className="text-muted mb-6">Who each team protected, and the trades along the way.</p>
      {viewToggle}

      {seasons.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/keepers?view=season&season=${s}`}
              className={`px-3 py-1.5 text-sm border ${
                s === season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {teamIdsThisSeason.length === 0 ? (
        <p className="text-muted">No keepers logged for {season} yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {teamIdsThisSeason.map((teamId) => {
            const name = teamNameForSeason.get(teamId) ?? `Team ${teamId}`;
            const keepers = keepersThisSeason.filter((k) => k.teamId === teamId);
            if (keepers.length === 0) return null;
            return (
              <div key={teamId} className="border border-ice-line p-5">
                <div className="flex items-center gap-3 mb-3">
                  <TeamLogo url={logos[teamId]} name={name} size={28} />
                  <h2 className="font-display text-lg">{name}</h2>
                </div>
                <ul className="text-sm space-y-1">
                  {keepers.map((k) => (
                    <li key={k.id} className="flex justify-between gap-2">
                      <span className="font-body">{k.playerName}</span>
                      {k.note && <span className="text-muted">{k.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {tradesThisSeason.length > 0 && (
        <div>
          <h2 className="font-display text-xl mb-3">Trades — {season}</h2>
          <ul className="text-sm space-y-1">
            {tradesThisSeason.map((t) => (
              <li key={t.id} className="text-muted">
                <span className="font-body text-board">{t.playerName}</span>: {managerName(t.fromManagerId)} →{" "}
                {managerName(t.toManagerId)}
                {t.note && ` — ${t.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
