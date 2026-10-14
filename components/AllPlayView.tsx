import type { ManagerLuck, ManagerLuckReport } from "@/lib/manager-luck";

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// The all-time all-play standings: every manager's record if each week's score had been played against every other
// team that week. The manager being viewed (if any) is highlighted; managers who have left show in lighter text.
export function AllPlayTable({ rows, highlightId, activeIds }: { rows: ManagerLuck[]; highlightId?: number; activeIds?: Set<number> }) {
  const sorted = [...rows].sort((a, b) => b.allPlayPct - a.allPlayPct);
  const best = sorted[0]?.allPlayPct ?? 1;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full max-w-2xl">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-ice-line">
            <th className="py-1 pr-3 font-normal w-8">#</th>
            <th className="py-1 pr-4 font-normal">Manager</th>
            <th className="py-1 pr-4 font-normal">All-play record</th>
            <th className="py-1 pr-4 font-normal">Win %</th>
            <th className="py-1 font-normal">Real record vs fair</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => {
            const me = m.managerId === highlightId;
            const former = activeIds ? !activeIds.has(m.managerId) : false;
            return (
              <tr key={m.managerId} className={`border-b border-ice-line/50 ${me ? "bg-ice-panel font-semibold" : ""} ${former && !me ? "text-muted" : ""}`}>
                <td className="py-2 pr-3 font-tabular">{i + 1}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {m.name}
                  {former ? <span className="ml-2 text-xs font-normal text-muted">former</span> : null}
                </td>
                <td className="py-2 pr-4 font-tabular whitespace-nowrap">{rec(m.allPlayW, m.allPlayL, m.allPlayT)}</td>
                <td className="py-2 pr-4 font-tabular">
                  <span className="inline-block align-middle mr-2 h-2 bg-rink" style={{ width: `${Math.round((m.allPlayPct / best) * 56)}px` }} />
                  {pct(m.allPlayPct)}
                </td>
                <td className={`py-2 font-tabular whitespace-nowrap ${m.luck >= 0 ? "text-rink-bright" : "text-center-red"}`}>
                  {m.luck >= 0 ? "+" : "−"}
                  {Math.abs(m.luck).toFixed(1)} wins
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// On a manager's page: their all-time all-play record and rank, the league table, and the record year by year.
export default function AllPlayView({ r, activeIds }: { r: ManagerLuckReport; activeIds: Set<number> }) {
  const m = r.me;
  if (!m || m.games < 10) return null;
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">All-play record</h2>
        <p className="text-sm text-muted max-w-prose">
          Every week, every team's score is compared with every other team's. It is the record a perfectly fair schedule would have given, so it measures how good a team really was, not who it happened to play.
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-6">
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{rec(m.allPlayW, m.allPlayL, m.allPlayT)}</dd>
          <dt className="mt-1 text-sm text-muted">All-time all-play record</dt>
        </div>
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{pct(m.allPlayPct)}</dd>
          <dt className="mt-1 text-sm text-muted">All-play win %</dt>
        </div>
        {r.allPlayRank > 0 && (
          <div>
            <dd className="font-display text-3xl leading-none font-tabular">{ord(r.allPlayRank)}</dd>
            <dt className="mt-1 text-sm text-muted">of {r.ranked} managers, all time</dt>
          </div>
        )}
      </dl>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-lg mb-2">All-time standings</h3>
          <AllPlayTable rows={r.all} highlightId={m.managerId} activeIds={activeIds} />
        </div>
        <div>
          <h3 className="font-display text-lg mb-2">Year by year</h3>
          <ul className="max-w-md">
            {m.seasons.map((s) => (
              <li key={s.season} className="grid grid-cols-[3.5rem_1fr_9rem] items-center gap-3 py-1.5 border-b border-ice-line/50 text-sm">
                <span className="font-tabular">{s.season}</span>
                <span className="relative h-3 bg-ice-panel" role="img" aria-label={`${s.season}: all-play ${pct(s.allPlayPct)}`}>
                  <span className={`absolute left-0 top-0 h-3 ${s.allPlayPct >= 0.5 ? "bg-rink-bright" : "bg-center-red"}`} style={{ width: `${s.allPlayPct * 100}%` }} />
                  <span className="absolute left-1/2 -top-0.5 h-4 w-px bg-board/60" />
                </span>
                <span className="text-right font-tabular">
                  {rec(s.allPlayW, s.allPlayL, s.allPlayT)}
                  <span className="ml-2 text-xs text-muted">{pct(s.allPlayPct)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
