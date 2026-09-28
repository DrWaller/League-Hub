import Link from "next/link";
import { PodiumEntry } from "@/lib/history-podium";

// Show "(Manager)" after a team name only when it adds something -- not when
// the team is named after the manager already.
const showManager = (team: string, manager: string | null) =>
  Boolean(manager) && manager!.trim().toLowerCase() !== team.trim().toLowerCase();

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
  podium: PodiumEntry[]; // regular-season 1st / 2nd / 3rd (from the standings, or the 1st-place override)
  note: string | null;
  rows: HistoryRow[]; // empty when ESPN has no data for the season (e.g. played elsewhere)
}

function tagClass(tag: string) {
  return tag === "COVID-shortened" ? "border-center-red text-center-red" : "border-muted text-muted";
}

export default function SeasonHistoryCard({ data }: { data: SeasonHistoryCardData }) {
  const { season, tags, champion, runnerUp, podium, note, rows } = data;
  const ordinals = ["1st", "2nd", "3rd"];

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

      {champion || runnerUp ? (
        <dl className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
          {champion && (
            <div>
              <dt className="text-muted">Season champion</dt>
              <dd className="font-body font-semibold">{champion}</dd>
            </div>
          )}
          {runnerUp && (
            <div>
              <dt className="text-muted">Runner-up</dt>
              <dd className="font-body">{runnerUp}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-muted mb-3">No champion recorded for this season yet.</p>
      )}

      {podium.length > 0 && (
        <div className="mb-3">
          <div className="text-sm text-muted mb-1">Regular-season finish</div>
          <ol className="text-sm grid sm:grid-cols-3 gap-x-6 gap-y-1">
            {podium.map((p, i) => (
              <li key={`${p.name}-${i}`}>
                <span className="text-muted font-tabular">{ordinals[i]}</span>{" "}
                <span className="font-body">{p.name}</span>
                {showManager(p.name, p.managerName) && <span className="text-muted"> ({p.managerName})</span>}
              </li>
            ))}
          </ol>
        </div>
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
                        {showManager(r.name, r.managerName) && <span className="text-muted"> ({r.managerName})</span>}
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
