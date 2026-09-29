import { getLeagueMeta } from "@/lib/espn";
import { getSeasonBundle } from "@/lib/season-data";
import { getSeasonHistory, getManagers, getManagerSeasons } from "@/lib/content";
import { getHistorySeasons } from "@/lib/seasons";
import { seasonsPlayedElsewhere } from "@/lib/played-elsewhere";
import SeasonHistoryCard, { HistoryRow, SeasonHistoryCardData } from "@/components/SeasonHistoryCard";

export const dynamic = "force-dynamic";

const byRecord = (a: HistoryRow, b: HistoryRow) =>
  b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor;

export default async function HistoryPage() {
  const meta = await getLeagueMeta();
  const [available, curated, managers, managerSeasons] = await Promise.all([
    getHistorySeasons(meta.season),
    getSeasonHistory(),
    getManagers(),
    getManagerSeasons(),
  ]);

  // History is about finished seasons: leave out the one in progress unless
  // the commissioner has already written an entry for it.
  const elsewhere = seasonsPlayedElsewhere(curated);
  const seasons = available.filter((s) => s !== meta.season || curated.some((c) => c.season === s));

  const managerFor = (season: number, teamId: number) => {
    const ms = managerSeasons.find((m) => m.season === season && m.teamId === teamId);
    return ms?.managerId ? managers.find((m) => m.id === ms.managerId)?.name ?? null : null;
  };

  const cards: SeasonHistoryCardData[] = await Promise.all(
    seasons.map(async (season) => {
      const entry = curated.find((c) => c.season === season);
      // From ESPN, or -- for a season played on Fantrax -- worked out from the
      // weekly scores entered by hand. (A Fantrax season never uses ESPN.)
      const bundle = await getSeasonBundle(season);

      let rows: HistoryRow[] = [];
      if (bundle) {
        rows = bundle.teams.map((t) => ({
          teamId: t.id,
          name: t.name,
          managerName: managers.find((m) => m.id === t.managerId)?.name ?? null,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          pointsFor: t.pointsFor,
          pointsAgainst: t.pointsAgainst,
        }));
      } else if (!elsewhere.has(season)) {
        // ESPN couldn't answer: fall back to any records previously imported.
        rows = managerSeasons
          .filter((m) => m.season === season && m.wins !== null)
          .map((m) => ({
            teamId: m.teamId,
            name: m.teamName,
            managerName: managerFor(season, m.teamId),
            wins: m.wins ?? 0,
            losses: m.losses ?? 0,
            ties: m.ties ?? 0,
            pointsFor: m.pointsFor ?? 0,
            pointsAgainst: m.pointsAgainst ?? 0,
          }));
      }
      rows.sort(byRecord);

      return {
        season,
        tags: entry?.tags ?? [],
        champion: entry?.champion ?? null,
        runnerUp: entry?.runnerUp ?? null,
        thirdPlace: entry?.thirdPlace ?? null,
        note: entry?.note ?? null,
        rows,
      };
    })
  );

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">League History</h1>
      <p className="text-sm text-muted mb-10 max-w-prose">
        Every past season, newest first. Final standings come straight from ESPN; champions and
        notes on the odd seasons are added by the commissioner.
      </p>

      {cards.length === 0 ? (
        <p className="text-muted">
          No past seasons found yet. They appear here automatically once ESPN is connected.
        </p>
      ) : (
        <ol className="relative border-l border-ice-line ml-2">
          {cards.map((c) => (
            <SeasonHistoryCard key={c.season} data={c} />
          ))}
        </ol>
      )}
    </div>
  );
}
