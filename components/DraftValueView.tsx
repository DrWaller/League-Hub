import type { DraftValue, PickValue } from "@/lib/draft-value";
import { pts, ordinal } from "@/lib/format";

const signed = (n: number, d = 0) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}`;

function PickList({ title, picks, good }: { title: string; picks: PickValue[]; good: boolean }) {
  return (
    <div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <ol>
        {picks.map((p) => (
          <li key={`${p.season}-${p.overall}`} className="py-2 border-b border-ice-line/60 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl leading-tight">{p.name}</p>
              <p className={`font-tabular text-sm ${good ? "text-rink-bright" : "text-center-red"}`}>{signed(p.surplus)} pts</p>
            </div>
            <p className="text-xs text-muted font-tabular">
              {p.season}, pick {p.overall}
              {p.round ? ` (round ${p.round})` : ""}, finished {ordinal(p.finish)} with {pts(p.points)} in {p.gp} games
              {!good && p.gp < 40 ? ", missed time" : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Bars({ rows, label }: { rows: { key: string; value: number; sub: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="max-w-xl" aria-label={label}>
      {rows.map((r) => {
        const up = r.value >= 0;
        return (
          <li key={r.key} className="grid grid-cols-[4rem_1fr_6.5rem] items-center gap-3 py-1.5 border-b border-ice-line/50 text-sm">
            <span className="font-tabular">{r.key}</span>
            <span className="relative h-3 bg-ice-panel" role="img" aria-label={`${r.key}: ${signed(r.value)} points per pick versus par`}>
              <span className={`absolute top-0 h-3 ${up ? "bg-rink-bright" : "bg-center-red"}`} style={up ? { left: "50%", width: `${(Math.abs(r.value) / max) * 50}%` } : { right: "50%", width: `${(Math.abs(r.value) / max) * 50}%` }} />
              <span className="absolute left-1/2 -top-0.5 h-4 w-px bg-board/60" />
            </span>
            <span className="text-right font-tabular">
              <span className={up ? "text-rink-bright" : "text-center-red"}>{signed(r.value)}</span>
              <span className="ml-2 text-xs text-muted">{r.sub}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Draft hits and busts: each pick against the player who finished at that slot.
export default function DraftValueView({ d }: { d: DraftValue }) {
  if (d.evaluated < 5) return null;
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Draft hits and busts</h2>
        <p className="text-sm text-muted max-w-prose">
          Each pick is compared with the player who finished at that spot in the season's scoring. Pick 12 is par if the player scored what the 12th-highest scorer did. Points above par
          are a hit, below are a bust. Keepers are left out.
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-8">
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{signed(d.avgSurplus)}</dd>
          <dt className="mt-1 text-sm text-muted">Points per pick vs par</dt>
        </div>
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{(d.hitRate * 100).toFixed(0)}%</dd>
          <dt className="mt-1 text-sm text-muted">Picks at or above par</dt>
        </div>
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{d.evaluated}</dd>
          <dt className="mt-1 text-sm text-muted">Picks graded, {d.seasons.length} drafts</dt>
          {d.skipped > 0 && <p className="text-xs text-muted">{d.skipped} not matched to stats</p>}
        </div>
      </dl>
      <div className="grid gap-10 md:grid-cols-2 mb-8">
        <PickList title="Best picks" picks={d.best} good />
        <PickList title="Worst picks" picks={d.worst} good={false} />
      </div>
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="font-display text-lg mb-2">By draft</h3>
          <Bars label="Points per pick versus par, by draft" rows={d.bySeason.map((s) => ({ key: String(s.season), value: s.avgSurplus, sub: `${s.picks} picks` }))} />
        </div>
        {d.byRound.length > 1 && (
          <div>
            <h3 className="font-display text-lg mb-2">By round</h3>
            <Bars label="Points per pick versus par, by round" rows={d.byRound.slice(0, 12).map((r) => ({ key: `Rd ${r.round}`, value: r.avgSurplus, sub: `${r.picks} picks` }))} />
          </div>
        )}
      </div>
    </section>
  );
}
