import type { ManagerLuckReport } from "@/lib/manager-luck";
import { pts } from "@/lib/format";

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const signed = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}`;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dd className="font-display text-3xl leading-none font-tabular">{value}</dd>
      <dt className="mt-1 text-sm text-muted">{label}</dt>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// Luck and consistency: what a fair schedule would have done to the record, and how swingy the weekly scores are.
export default function LuckView({ r }: { r: ManagerLuckReport }) {
  const m = r.me;
  if (!m || m.games < 10) return null;
  const rankNote = r.ranked > 1 && r.luckRank ? `${ord(r.luckRank)} luckiest of ${r.ranked}` : undefined;
  const steadyNote = r.consistencyRank ? `${ord(r.consistencyRank)} steadiest of ${r.ranked}` : undefined;
  const maxDiff = Math.max(1, ...m.seasons.map((s) => Math.abs(s.diff)));

  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Luck and consistency</h2>
        <p className="text-sm text-muted max-w-prose">
          Fair-schedule wins are what the record would be if every week's score were played against every other team. Boom weeks are scores a standard deviation above the league
          average that season, bust weeks a standard deviation below.
        </p>
      </div>

      {r.style && (
        <p className="mb-5 font-display text-xl">
          {r.style === "Boom or bust" ? "Boom or bust: big weeks and bad weeks." : r.style === "Steady" ? "Steady: the scores barely move week to week." : "In between: some swings, mostly steady."}
        </p>
      )}

      <dl className="flex flex-wrap gap-x-10 gap-y-5 mb-6">
        <Stat label="Wins" value={m.actualWins.toFixed(0)} sub={`${m.expectedWins.toFixed(1)} on a fair schedule`} />
        <Stat label="Wins above fair" value={signed(m.luck)} sub={rankNote} />
        <Stat label="Won with a below-median score" value={String(m.stolenWins)} />
        <Stat label="Lost with an above-median score" value={String(m.robbedLosses)} />
      </dl>

      <dl className="flex flex-wrap gap-x-10 gap-y-5 mb-8">
        <Stat label="Boom weeks" value={pct(m.boomPct)} sub={`${m.boom} of ${m.games}`} />
        <Stat label="Bust weeks" value={pct(m.bustPct)} sub={`${m.bust} of ${m.games}`} />
        <Stat label="Weekly swing" value={`±${pts(m.spread)}`} sub={steadyNote} />
        {m.highWeek && <Stat label="Best week" value={pts(m.highWeek.score)} sub={`${m.highWeek.season}, week ${m.highWeek.week}`} />}
        {m.lowWeek && <Stat label="Worst week" value={pts(m.lowWeek.score)} sub={`${m.lowWeek.season}, week ${m.lowWeek.week}`} />}
      </dl>

      <h3 className="font-display text-lg mb-2">Season by season</h3>
      <ul className="max-w-2xl">
        {m.seasons.map((s) => {
          const lucky = s.diff >= 0;
          return (
            <li key={s.season} className="grid grid-cols-[3.5rem_1fr_9.5rem] sm:grid-cols-[4rem_1fr_11rem] items-center gap-3 py-1.5 border-b border-ice-line/50 text-sm">
              <span className="font-tabular">{s.season}</span>
              <span className="relative h-3 bg-ice-panel" role="img" aria-label={`${s.season}: ${signed(s.diff)} wins versus a fair schedule`}>
                <span
                  className={`absolute top-0 h-3 ${lucky ? "bg-rink-bright" : "bg-center-red"}`}
                  style={lucky ? { left: "50%", width: `${(Math.abs(s.diff) / maxDiff) * 50}%` } : { right: "50%", width: `${(Math.abs(s.diff) / maxDiff) * 50}%` }}
                />
                <span className="absolute left-1/2 -top-0.5 h-4 w-px bg-board/60" />
              </span>
              <span className="text-right font-tabular">
                {s.actualWins.toFixed(0)} wins vs {s.expectedWins.toFixed(1)}
                <span className={`ml-2 text-xs ${lucky ? "text-rink-bright" : "text-center-red"}`}>{signed(s.diff)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Bars to the right mean the schedule helped; to the left, it hurt.</p>
    </section>
  );
}
