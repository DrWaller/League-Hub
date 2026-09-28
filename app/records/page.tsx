import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { luckColor } from "@/lib/luck";
import { GameRecord, SeasonRow } from "@/lib/records";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const range = (s: number[]) => (s.length === 0 ? "" : s[0] === s[s.length - 1] ? `${s[0]}` : `${s[0]}–${s[s.length - 1]}`);

function SeasonTable({ title, rows, showPoints }: { title: string; rows: SeasonRow[]; showPoints?: boolean }) {
  return (
    <div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <table className="w-full text-sm font-tabular border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.season}-${r.managerId}`} className="border-b border-ice-line/60 align-top">
              <td className="py-2 pr-2 text-muted">{i + 1}</td>
              <td className="py-2 pr-2 font-body">
                {r.managerName}
                <div className="text-xs text-muted">
                  {r.season} · {r.teamName}
                </div>
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                {showPoints ? `${Math.round(r.pointsFor)} pts` : `${rec(r.wins, r.losses, r.ties)} · ${pct(r.winPct)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameList({ title, rows, kind }: { title: string; rows: GameRecord[]; kind: "score" | "margin" }) {
  return (
    <div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <table className="w-full text-sm font-tabular border-collapse">
        <tbody>
          {rows.map((g, i) => (
            <tr key={i} className="border-b border-ice-line/60 align-top">
              <td className="py-2 pr-2 text-muted">{i + 1}</td>
              <td className="py-2 pr-2 font-body">
                {g.managerName ?? g.teamName}
                <div className="text-xs text-muted">
                  {g.season}, week {g.week} · vs {g.oppName}
                </div>
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                {kind === "score"
                  ? g.score.toFixed(1)
                  : `${g.score.toFixed(1)}–${g.oppScore.toFixed(1)}`}
                {kind === "margin" && <div className="text-xs text-muted">by {g.margin.toFixed(1)}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RecordsPage() {
  const meta = await getLeagueMeta();
  const { records, seasonsUsed, seasonsSkipped, managerCount } = await loadRecords(meta.season);
  const nameOf = new Map(records.careers.map((c) => [c.managerId, c.name]));
  const hasData = records.careers.length > 0;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Records</h1>
      <p className="text-sm text-muted mb-4 max-w-prose">
        All-time numbers across every finished season{seasonsUsed.length ? ` (${range(seasonsUsed)}, ${seasonsUsed.length} seasons)` : ""}, ESPN
        and Fantrax together. Regular season only; championships come from League History.
      </p>

      {seasonsSkipped.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          Not included yet: {seasonsSkipped.join(", ")} (no weekly scores available).
        </p>
      )}
      {records.unlinked.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          {records.unlinked.length} team-season{records.unlinked.length === 1 ? "" : "s"} aren&apos;t linked to a manager yet, so they&apos;re
          left out of the totals.
        </p>
      )}
      {records.unmatchedChampions.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          Couldn&apos;t match {records.unmatchedChampions.map((u) => `${u.season} ${u.role} “${u.name}”`).join("; ")} to a manager&apos;s team, so
          those titles aren&apos;t counted. The name must match that season&apos;s team name.
        </p>
      )}

      {!hasData ? (
        <p className="text-muted mt-8 max-w-prose">
          {managerCount === 0
            ? "No managers have been added yet. The commissioner needs to add managers and link them to their teams before this page can total anything up."
            : "No team has been linked to a manager yet, so there's nothing to total. The commissioner can do that from the admin area."}
        </p>
      ) : (
        <div className="space-y-14 mt-8">
          <section>
            <h2 className="font-display text-2xl mb-4">All-time standings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-tabular border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b-2 border-rink">
                    <th className="py-2 pr-3 font-body font-normal">#</th>
                    <th className="py-2 pr-3 font-body font-normal">Manager</th>
                    <th className="hidden sm:table-cell py-2 pr-3 font-body font-normal text-right">Seasons</th>
                    <th className="py-2 pr-3 font-body font-normal text-right">Record</th>
                    <th className="py-2 pr-3 font-body font-normal text-right">Win%</th>
                    <th className="hidden sm:table-cell py-2 pr-3 font-body font-normal text-right">PF</th>
                    <th className="hidden sm:table-cell py-2 pr-3 font-body font-normal text-right">PA</th>
                    <th className="py-2 pr-3 font-body font-normal text-right">Titles</th>
                    <th className="hidden sm:table-cell py-2 pr-3 font-body font-normal text-right">Runner-up</th>
                    <th className="hidden sm:table-cell py-2 font-body font-normal text-right">1st place</th>
                  </tr>
                </thead>
                <tbody>
                  {records.careers.map((c, i) => (
                    <tr key={c.managerId} className="border-b border-ice-line/60">
                      <td className="py-3 pr-3 text-muted">{i + 1}</td>
                      <td className="py-3 pr-3 font-body">{c.name}</td>
                      <td className="hidden sm:table-cell py-3 pr-3 text-right text-muted">{c.seasons}</td>
                      <td className="py-3 pr-3 text-right">{rec(c.wins, c.losses, c.ties)}</td>
                      <td className="py-3 pr-3 text-right">{pct(c.winPct)}</td>
                      <td className="hidden sm:table-cell py-3 pr-3 text-right text-muted">{Math.round(c.pointsFor).toLocaleString()}</td>
                      <td className="hidden sm:table-cell py-3 pr-3 text-right text-muted">{Math.round(c.pointsAgainst).toLocaleString()}</td>
                      <td className="py-3 pr-3 text-right font-semibold">{c.titles}</td>
                      <td className="hidden sm:table-cell py-3 pr-3 text-right text-muted">{c.runnerUps}</td>
                      <td className="hidden sm:table-cell py-3 text-right text-muted">{c.firstPlace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Best and worst seasons</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <SeasonTable title="Best records" rows={records.bestSeasons} />
              <SeasonTable title="Worst records" rows={records.worstSeasons} />
              <SeasonTable title="Most points" rows={records.highScoringSeasons} showPoints />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Single-game records</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <GameList title="Highest scores" rows={records.highScores} kind="score" />
              <GameList title="Lowest scores" rows={records.lowScores} kind="score" />
              <GameList title="Biggest blowouts" rows={records.biggestWins} kind="margin" />
              <GameList title="Closest finishes" rows={records.closestGames} kind="margin" />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-1">Head-to-head</h2>
            <p className="text-sm text-muted mb-4 max-w-prose">
              Each row&apos;s record against the manager in that column, regular season only. Green means a winning record.
            </p>
            <div className="overflow-x-auto">
              <table className="text-sm font-tabular border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-ice py-2 pr-3" />
                    {records.h2hOrder.map((id) => (
                      <th key={id} className="py-2 px-2 font-body font-normal text-muted text-center whitespace-nowrap" title={nameOf.get(id)}>
                        {(nameOf.get(id) ?? "").slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.h2hOrder.map((a) => (
                    <tr key={a} className="border-t border-ice-line/60">
                      <th className="sticky left-0 bg-ice py-2 pr-3 font-body font-normal text-left whitespace-nowrap">{nameOf.get(a)}</th>
                      {records.h2hOrder.map((b) => {
                        const r = records.h2h[a]?.[b];
                        return (
                          <td key={b} className="py-2 px-2 text-center whitespace-nowrap">
                            {a === b ? (
                              <span className="text-ice-line">—</span>
                            ) : r ? (
                              <span style={{ color: r.w > r.l ? luckColor(1) : r.w < r.l ? luckColor(-1) : luckColor(0) }}>
                                {rec(r.w, r.l, r.t)}
                              </span>
                            ) : (
                              <span className="text-muted">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
