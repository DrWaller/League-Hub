import type { ManagerHistory } from "@/lib/manager-history";

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

// Eras: where the team finished every year as a line (1st at the top), with titles marked, and the time since the last one.
export default function ErasView({ h, currentSeason }: { h: ManagerHistory; currentSeason: number }) {
  const rows = h.seasons;
  if (rows.length < 3) return null;
  const W = 360;
  const H = 190;
  const padX = 34;
  const padY = 18;
  const teams = Math.max(...rows.map((r) => r.teamCount), 2);
  const x = (i: number) => padX + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * (W - padX * 2));
  const y = (rank: number) => padY + ((rank - 1) / (teams - 1)) * (H - padY * 2);
  const path = rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(r.rank).toFixed(1)}`).join(" ");
  const titles = rows.filter((r) => r.champion).map((r) => r.season);
  const lastTitle = titles.length ? titles[titles.length - 1] : null;
  const sinceTitle = lastTitle != null ? currentSeason - lastTitle : null;
  const best = [...rows].sort((a, b) => a.rank - b.rank || b.winPct - a.winPct)[0];
  const worst = [...rows].sort((a, b) => b.rank - a.rank || a.winPct - b.winPct)[0];
  const avg = rows.reduce((n, r) => n + r.rank, 0) / rows.length;

  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Eras</h2>
        <p className="text-sm text-muted max-w-prose">Where the team finished each year in the regular season. Higher on the chart is better. Gold marks a title.</p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-6">
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{avg.toFixed(1)}</dd>
          <dt className="mt-1 text-sm text-muted">Average finish</dt>
        </div>
        {best && (
          <div>
            <dd className="font-display text-3xl leading-none font-tabular">{ord(best.rank)}</dd>
            <dt className="mt-1 text-sm text-muted">Best finish ({best.season})</dt>
          </div>
        )}
        {worst && (
          <div>
            <dd className="font-display text-3xl leading-none font-tabular">{ord(worst.rank)}</dd>
            <dt className="mt-1 text-sm text-muted">Worst finish ({worst.season})</dt>
          </div>
        )}
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{sinceTitle == null ? "None yet" : sinceTitle === 0 ? "This year" : sinceTitle}</dd>
          <dt className="mt-1 text-sm text-muted">{sinceTitle == null ? "Titles" : sinceTitle === 0 ? "Title won" : sinceTitle === 1 ? "Season since the last title" : "Seasons since the last title"}</dt>
        </div>
      </dl>
      <div className="max-w-md">
        <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full h-auto" role="img" aria-label={`Regular-season finish by year: ${rows.map((r) => `${r.season} ${ord(r.rank)}`).join(", ")}`}>
          <line x1={padX} x2={W - padX} y1={y(Math.ceil(teams / 2))} y2={y(Math.ceil(teams / 2))} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="4 4" />
          <text x={4} y={y(1) + 4} fontSize="12" fill="currentColor" fillOpacity="0.7">1st</text>
          <text x={4} y={y(teams) + 4} fontSize="12" fill="currentColor" fillOpacity="0.7">{ord(teams)}</text>
          <path d={path} fill="none" stroke="#2B6CB5" strokeWidth="2.5" />
          {rows.map((r, i) => (
            <g key={r.season}>
              <circle cx={x(i)} cy={y(r.rank)} r={r.champion ? 7 : 4.5} fill={r.champion ? "#D9A441" : "#2B6CB5"} stroke={r.champion ? "#8A6513" : "none"} strokeWidth="1.5">
                <title>{`${r.season}: ${ord(r.rank)} of ${r.teamCount}${r.champion ? ", champion" : r.runnerUp ? ", runner-up" : ""}`}</title>
              </circle>
              <text x={x(i)} y={H + 16} textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity="0.7">
                {rows.length <= 7 ? `'${String(r.season).slice(2)}` : String(r.season).slice(2)}
              </text>
            </g>
          ))}
        </svg>
        <p className="text-xs text-muted">The dashed line is the middle of the pack.</p>
      </div>
    </section>
  );
}
