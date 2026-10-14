import type { PlayoffReport } from "@/lib/manager-playoffs";

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

const TONE: Record<string, string> = {
  Champion: "bg-gold text-board",
  "Runner-up": "bg-rink-bright text-white",
  "Made it": "bg-rink text-white",
  Missed: "bg-ice-panel text-muted",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dd className="font-display text-3xl leading-none font-tabular">{value}</dd>
      <dt className="mt-1 text-sm text-muted">{label}</dt>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// Making the playoffs: the trips, the current streak, the droughts, and every season at a glance.
export default function PlayoffsView({ r }: { r: PlayoffReport }) {
  const m = r.me;
  if (!m || m.seasons < 2) return null;
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Making the playoffs</h2>
        <p className="text-sm text-muted max-w-prose">
          The top 6 teams on regular-season record make the playoffs.
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-5 mb-6">
        <Stat label="Playoff trips" value={`${m.made} of ${m.seasons}`} sub={r.appearancesRank ? `${ord(r.appearancesRank)} most in the league` : undefined} />
        <Stat label="Made it" value={`${(m.pct * 100).toFixed(0)}%`} sub={r.rateRank ? `${ord(r.rateRank)} best rate` : undefined} />
        <Stat label={m.currentStreak > 0 ? "Current run in" : "Seasons since last trip"} value={String(m.currentStreak > 0 ? m.currentStreak : m.currentDrought)} />
        <Stat label="Longest run in" value={String(m.longestStreak)} />
        <Stat label="Longest drought" value={String(m.longestDrought)} sub={m.longestDrought === 1 ? "season" : "seasons"} />
      </dl>
      <ul className="flex flex-wrap gap-3 mb-4" aria-label="Playoff result by season">
        {m.rows.map((s) => (
          <li key={s.season} className={`w-24 px-2 py-2 text-center ${TONE[s.result]}`} title={`${s.teamName}: finished ${ord(s.rank)} of ${s.teamCount}, ${s.spots} playoff spots`}>
            <p className="font-display text-lg leading-none">{s.season}</p>
            <p className="text-xs mt-1">{s.result}</p>
            <p className="text-[11px] opacity-80">
              {ord(s.rank)} of {s.teamCount}
            </p>
            {s.edge ? <p className="text-[11px] font-semibold">{s.edge}</p> : null}
          </li>
        ))}
      </ul>
      {(m.lastSpot > 0 || m.missedByOne > 0) && (
        <p className="text-sm text-muted">
          {m.lastSpot > 0 ? `Squeaked in on the last spot ${m.lastSpot} time${m.lastSpot === 1 ? "" : "s"}. ` : ""}
          {m.missedByOne > 0 ? `Missed by a single place ${m.missedByOne} time${m.missedByOne === 1 ? "" : "s"}.` : ""}
        </p>
      )}
    </section>
  );
}
