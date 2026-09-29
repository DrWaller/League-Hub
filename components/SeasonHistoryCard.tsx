import Link from "next/link";

// Show "(Manager)" after a team name only when it adds something -- not when
// the team is named after the manager already.
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export interface HistoryRow {
  teamId: number;
  name: string;
  managerName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface SeasonHistoryCardData {
  season: number;
  tags: string[];
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null; // playoff third-place finisher
  note: string | null;
  rows: HistoryRow[]; // empty when ESPN has no data for the season (e.g. played elsewhere)
}

function tagClass(tag: string) {
  return tag === "COVID-shortened" ? "border-center-red text-center-red" : "border-muted text-muted";
}

export default function SeasonHistoryCard({ data }: { data: SeasonHistoryCardData }) {
  const { season, tags, champion, runnerUp, thirdPlace, note, rows } = data;

  // The standings table (rows) knows each team's manager; champion/runner-up/
  // third are just typed team names, so look the manager up by matching name.
  const managerOf = (team: string) => rows.find((r) => norm(r.name) === norm(team))?.managerName ?? null;
  const podium = [
    { place: "Champion", team: champion, strong: true },
    { place: "Runner-up", team: runnerUp, strong: false },
    { place: "3rd Place", team: thirdPlace, strong: false },
  ].filter((p): p is { place: string; team: string; strong: boolean } => Boolean(p.team));

  // The best regular-season record, not the playoff result -- this is knowable
  // straight from the standings, so it's shown automatically rather than typed
  // in, and it's kept visually separate so it's never mistaken for the champion.
  const regularSeasonChampion = rows.length > 0 ? rows[0] : null;

  return (
    <li className="mb-10 ml-6">
      <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-rink border-2 border-ice" />
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <h2 className="font-display text-xl">{season}</h2>
        {tags.map((tag) => (
          <span key={tag} className={`inline-block text-xs px-2 py-0.5 border rounded-full ${tagClass(tag)}`}>
            {tag}
          </span>
        ))}
      </div>

      {podium.length > 0 ? (
        <dl className="text-sm grid sm:grid-cols-3 gap-x-6 gap-y-2 mb-2">
          {podium.map((p) => {
            const mgr = managerOf(p.team);
            return (
              <div key={p.place}>
                <dt className="text-muted">{p.place}</dt>
                <dd className={p.strong ? "font-body font-semibold" : "font-body"}>
                  {p.team}
                  {mgr && norm(mgr) !== norm(p.team) && <span className="text-muted"> ({mgr})</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-sm text-muted mb-2">No playoff results recorded for this season yet.</p>
      )}

      {regularSeasonChampion && (
        <p className="text-sm mb-3">
          <span className="text-muted">Regular season champion: </span>
          <span className="font-body font-medium">{regularSeasonChampion.name}</span>
          {regularSeasonChampion.managerName && norm(regularSeasonChampion.managerName) !== norm(regularSeasonChampion.name) && (
            <span className="text-muted"> ({regularSeasonChampion.managerName})</span>
          )}
        </p>
      )}

      {note && <p className="text-sm text-muted italic mb-2">{note}</p>}

      {rows.length > 0 && (
        <>
          <details className="mb-2 group">
            <summary className="text-sm text-rink cursor-pointer hover:underline select-none">
              Final standings
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm font-tabular border-collapse sm:min-w-[420px]">
                <thead>
                  <tr className="text-left text-muted border-b border-ice-line">
                    <th className="py-1.5 pr-3 font-body font-normal">#</th>
                    <th className="py-1.5 pr-3 font-body font-normal">Team</th>
                    <th className="py-1.5 pr-3 font-body font-normal text-right">Record</th>
                    <th className="hidden sm:table-cell py-1.5 pr-3 font-body font-normal text-right">PF</th>
                    <th className="hidden sm:table-cell py-1.5 font-body font-normal text-right">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.teamId} className="border-b border-ice-line/60">
                      <td className="py-2 pr-3 text-muted">{i + 1}</td>
                      <td className="py-2 pr-3 font-body">
                        {r.name}
                        {r.managerName && norm(r.managerName) !== norm(r.name) && (
                          <span className="text-muted"> ({r.managerName})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.wins}-{r.losses}
                        {r.ties ? `-${r.ties}` : ""}
                      </td>
                      <td className="hidden sm:table-cell py-2 pr-3 text-right">{Math.round(r.pointsFor)}</td>
                      <td className="hidden sm:table-cell py-2 text-right">{Math.round(r.pointsAgainst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted mt-2">Ranked by regular-season record, then points for.</p>
            </div>
          </details>
          <div className="flex gap-4 text-sm flex-wrap">
            <Link href={`/standings?season=${season}`} className="text-rink hover:underline">
              Standings
            </Link>
            <Link href={`/power-rankings?season=${season}#luck`} className="text-rink hover:underline">
              Luck Chart
            </Link>
            <Link href={`/matchups?season=${season}`} className="text-rink hover:underline">
              Matchups
            </Link>
          </div>
        </>
      )}
    </li>
  );
}
