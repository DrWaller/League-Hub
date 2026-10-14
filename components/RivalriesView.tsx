import type { HistGame, ManagerHistory, VsRow } from "@/lib/manager-history";

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const games = (v: VsRow) => v.w + v.l + v.t;
const margin = (g: HistGame) => Math.abs(g.score - g.oppScore).toFixed(1);
const when = (g: HistGame) => `${g.season}, wk ${g.week}`;

function Spotlight({ label, v, line }: { label: string; v: VsRow | undefined; line: (v: VsRow) => string }) {
  return (
    <li className="py-2 border-b border-ice-line/70 last:border-b-0">
      <p className="text-xs text-muted">{label}</p>
      {v ? (
        <>
          <p className="font-display text-2xl leading-tight">{v.name}</p>
          <p className="text-xs text-muted font-tabular">{line(v)}</p>
        </>
      ) : (
        <p className="text-sm text-muted">Needs at least 3 games against a current manager.</p>
      )}
    </li>
  );
}

function Row({ v }: { v: VsRow }) {
  const cur = v.current;
  return (
    <tr className="border-b border-ice-line/50">
      <td className="py-2 pr-4 font-body whitespace-nowrap">{v.name}</td>
      <td className="py-2 pr-4 font-tabular whitespace-nowrap">{rec(v.w, v.l, v.t)}</td>
      <td className="py-2 pr-4 font-tabular">{(v.pct * 100).toFixed(0)}%</td>
      <td className={`py-2 pr-4 font-tabular whitespace-nowrap ${cur?.kind === "W" ? "text-rink-bright" : cur?.kind === "L" ? "text-center-red" : ""}`}>{cur ? `${cur.kind}${cur.length}` : "–"}</td>
      <td className="py-2 pr-4 font-tabular whitespace-nowrap">{v.bestRun}W / {v.worstRun}L</td>
      <td className={`py-2 pr-4 font-tabular whitespace-nowrap ${v.avgMargin >= 0 ? "text-rink-bright" : "text-center-red"}`}>
        {v.avgMargin >= 0 ? "+" : "−"}
        {Math.abs(v.avgMargin).toFixed(1)}
      </td>
      <td className="py-2 pr-4 text-xs text-muted whitespace-nowrap">{v.closest ? `${v.closest.result} by ${margin(v.closest)} (${when(v.closest)})` : "–"}</td>
      <td className="py-2 text-xs text-muted whitespace-nowrap">{v.lastMeeting ? `${v.lastMeeting.result} ${v.lastMeeting.score.toFixed(1)}-${v.lastMeeting.oppScore.toFixed(1)} (${when(v.lastMeeting)})` : "–"}</td>
    </tr>
  );
}

function Table({ rows }: { rows: VsRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm min-w-max w-full max-w-4xl">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-ice-line">
            <th className="py-1 pr-4 font-normal">Opponent</th>
            <th className="py-1 pr-4 font-normal">Record</th>
            <th className="py-1 pr-4 font-normal">Win %</th>
            <th className="py-1 pr-4 font-normal">Now</th>
            <th className="py-1 pr-4 font-normal">Longest runs</th>
            <th className="py-1 pr-4 font-normal">Avg margin</th>
            <th className="py-1 pr-4 font-normal">Closest game</th>
            <th className="py-1 font-normal">Last meeting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <Row key={v.managerId} v={v} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Rivalries: the head-to-head record against each current manager, with who owns whom right now. Managers who have
// left the league sit in a collapsed list underneath.
export default function RivalriesView({ h, activeIds }: { h: ManagerHistory; activeIds: Set<number> }) {
  const current = h.vs.filter((v) => activeIds.has(v.managerId)).sort((a, b) => games(b) - games(a) || b.pct - a.pct);
  const former = h.vs.filter((v) => !activeIds.has(v.managerId)).sort((a, b) => games(b) - games(a));
  if (current.length === 0) return null;

  const faced = current.filter((v) => games(v) >= 3);
  const victim = [...faced].sort((a, b) => b.pct - a.pct || b.w - a.w)[0];
  const nemesis = [...faced].sort((a, b) => a.pct - b.pct || b.l - a.l)[0];
  // The fiercest rivalry: the most evenly matched, with more games breaking the tie.
  const fiercest = [...current].filter((v) => games(v) >= 4).sort((a, b) => Math.abs(a.pct - 0.5) - Math.abs(b.pct - 0.5) || games(b) - games(a))[0];
  const toughest = [...current].filter((v) => v.worstRun >= 3).sort((a, b) => b.worstRun - a.worstRun)[0];

  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Rivalries</h2>
        <p className="text-sm text-muted max-w-prose">Regular-season games against each current manager. Margin is points scored minus points allowed per game.</p>
      </div>
      <ul className="max-w-md mb-6">
        <Spotlight label="Nemesis" v={nemesis} line={(v) => `${rec(v.w, v.l, v.t)}, ${(v.avgMargin >= 0 ? "+" : "−") + Math.abs(v.avgMargin).toFixed(1)} per game`} />
        <Spotlight label="Favourite victim" v={victim} line={(v) => `${rec(v.w, v.l, v.t)}, ${(v.avgMargin >= 0 ? "+" : "−") + Math.abs(v.avgMargin).toFixed(1)} per game`} />
        <Spotlight label="Fiercest rivalry" v={fiercest} line={(v) => `${rec(v.w, v.l, v.t)} over ${games(v)} games, closest game ${v.closest ? margin(v.closest) : "–"} points`} />
        {toughest ? <Spotlight label="Longest losing run against" v={toughest} line={(v) => `${v.worstRun} straight losses`} /> : null}
      </ul>
      <Table rows={current} />
      {former.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted">Former managers ({former.length})</summary>
          <div className="mt-3">
            <Table rows={former} />
          </div>
        </details>
      )}
    </section>
  );
}
