import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { getSeasonBundle } from "@/lib/season-data";
import { getTeamLogos, getPlayedElsewhereSeasons } from "@/lib/content";
import PlayedElsewhereNotice from "@/components/PlayedElsewhereNotice";
import { getAvailableSeasons } from "@/lib/seasons";
import { calculatePowerRankingsWithMovement } from "@/lib/power-rankings";
import { computeLuck, regularSeasonFinals } from "@/lib/luck";
import PowerRankingsList from "@/components/PowerRankingsList";
import LuckTable from "@/components/LuckTable";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: { week?: string; season?: string };
}) {
  const meta = await getLeagueMeta();
  const [{ teams: standingsTeams, live }, logos, availableSeasons, currentMatchups] = await Promise.all([
    getStandings(),
    getTeamLogos(),
    getAvailableSeasons(meta.season),
    getMatchups(),
  ]);
  const { rankings, teams, throughWeek: rankThroughWeek } = calculatePowerRankingsWithMovement(
    standingsTeams,
    currentMatchups.matchups
  );
  const teamById = (id: number) => teams.find((t) => t.id === id);

  // --- Luck Chart: current season by default, any past season on request ---
  const luckSeason = Number(searchParams.season) || meta.season;
  const isPast = luckSeason !== meta.season;
  const elsewhereSeasons = await getPlayedElsewhereSeasons();

  let luckMatchups;
  let luckLive: boolean;
  let luckTeamName: (id: number) => string;
  if (isPast) {
    // From ESPN, or -- for a season played on Fantrax -- the scores entered by hand.
    const bundle = await getSeasonBundle(luckSeason);
    luckMatchups = bundle?.matchups ?? [];
    luckLive = bundle !== null;
    luckTeamName = (id) => bundle?.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  } else {
    luckMatchups = currentMatchups.matchups;
    luckLive = live;
    luckTeamName = (id) => teamById(id)?.name ?? `Team ${id}`;
  }

  const luckElsewhere = isPast && !luckLive && elsewhereSeasons.has(luckSeason);

  // Only completed regular-season weeks count. Default to the latest one
  // (for a past season, that's its end-of-season chart); ?week=N steps back.
  const latestFinalWeek = regularSeasonFinals(luckMatchups).reduce((max, m) => Math.max(max, m.week), 0);
  const throughWeek = latestFinalWeek
    ? Math.min(Math.max(Number(searchParams.week) || latestFinalWeek, 1), latestFinalWeek)
    : 0;
  const luck = throughWeek ? computeLuck(luckMatchups, throughWeek) : null;

  const luckSeasons = Array.from(new Set([...availableSeasons, luckSeason])).sort((a, b) => b - a);

  const luckHref = (season: number, week?: number) =>
    `/power-rankings?${season !== meta.season ? `season=${season}` : ""}${
      week ? `${season !== meta.season ? "&" : ""}week=${week}` : ""
    }#luck`;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Power Rankings</h1>
      <p className="text-muted mb-2">
        {live ? "Live from ESPN." : "Preview data — connect ESPN for live power rankings."}
      </p>
      <p className="text-sm text-muted mb-3 max-w-prose">
        Not ESPN&apos;s built-in rankings. This blends win percentage, point differential per
        game, and current streak — so a team quietly outscoring the league shows up here even
        before it shows up in the standings.
      </p>
      {rankThroughWeek > 1 && (
        <p className="text-xs text-muted mb-3 max-w-prose">
          Through week {rankThroughWeek}. Arrows show movement since week {rankThroughWeek - 1}.
        </p>
      )}
      <p className="text-sm mb-8">
        <a href="#luck" className="text-rink hover:underline">
          Jump to the Luck Chart
        </a>
      </p>

      <PowerRankingsList rankings={rankings} teams={teams} logos={logos} />

      <section id="luck" className="mt-16 scroll-mt-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-display text-2xl">
            Luck Chart{isPast ? ` — ${luckSeason}` : ""}
          </h2>
          {latestFinalWeek > 1 && (
            <div className="flex items-center gap-3 font-tabular text-sm">
              <Link
                href={luckHref(luckSeason, Math.max(1, throughWeek - 1))}
                className="px-2 py-1 border border-ice-line hover:border-rink-bright"
              >
                ←
              </Link>
              <span>
                {isPast && throughWeek === latestFinalWeek ? "Final" : `Through week ${throughWeek}`}
              </span>
              <Link
                href={luckHref(luckSeason, Math.min(latestFinalWeek, throughWeek + 1))}
                className="px-2 py-1 border border-ice-line hover:border-rink-bright"
              >
                →
              </Link>
            </div>
          )}
        </div>

        {luckSeasons.length > 1 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {luckSeasons.map((s) => (
              <Link
                key={s}
                href={luckHref(s)}
                className={`px-3 py-1.5 text-sm border ${
                  s === luckSeason ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        )}

        <p className="text-sm text-muted mb-6 max-w-prose">
          What each team&apos;s record would be if it played every other team every week
          (&ldquo;all-play&rdquo;), against the record it actually has. <span className="font-semibold" style={{ color: "#1F7A4D" }}>Green</span> means
          lucky (won more than the schedule-proof record says), <span className="font-semibold" style={{ color: "#C41E3A" }}>red</span> means
          unlucky. Regular season only; ties count as half a win.
        </p>

        {luckElsewhere ? (
          <PlayedElsewhereNotice season={luckSeason} />
        ) : !luckLive && isPast ? (
          <p className="text-muted">Couldn&apos;t load {luckSeason} from ESPN.</p>
        ) : luck && luck.rows.length > 0 ? (
          <LuckTable
            rows={luck.rows}
            leagueMedian={luck.leagueMedian}
            teamName={luckTeamName}
            logos={isPast ? {} : logos}
          />
        ) : (
          <p className="text-muted">
            {isPast
              ? `No completed regular-season games found for ${luckSeason}.`
              : "No completed matchups yet — this fills in once the first week is final."}
          </p>
        )}
      </section>
    </div>
  );
}
