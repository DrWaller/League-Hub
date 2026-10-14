import type { DraftValue, PickValue } from "@/lib/draft-value";
import { ordinal } from "@/lib/format";

// A plain-language draft report card: the biggest steal, the biggest bust, and a few of each. Every line reads
// "taken at pick N, finished Mth" so nothing needs explaining.

function Headline({ label, p, tone }: { label: string; p: PickValue; tone: "good" | "bad" }) {
  return (
    <div className={`border-l-4 ${tone === "good" ? "border-rink-bright" : "border-center-red"} bg-ice-panel px-5 py-4`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl leading-tight">{p.name}</p>
      <p className="mt-1 text-sm font-tabular">
        {p.season} draft, taken <span className="font-semibold">{ordinal(p.overall)}</span> overall, finished <span className="font-semibold">{ordinal(p.finish)}</span> in scoring
      </p>
      {tone === "bad" && p.gp < 40 && <p className="text-xs text-muted">Played only {p.gp} games.</p>}
    </div>
  );
}

function ShortList({ title, picks }: { title: string; picks: PickValue[] }) {
  return (
    <div>
      <h3 className="font-display text-lg mb-1">{title}</h3>
      <ul>
        {picks.map((p) => (
          <li key={`${p.season}-${p.overall}`} className="flex items-baseline justify-between gap-4 py-1.5 border-b border-ice-line/60 text-sm">
            <span className="truncate">
              {p.name} <span className="text-xs text-muted">{p.season}</span>
            </span>
            <span className="font-tabular text-muted whitespace-nowrap">
              pick {p.overall} to {ordinal(p.finish)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DraftValueView({ d }: { d: DraftValue }) {
  if (d.evaluated < 5 || d.best.length === 0 || d.worst.length === 0) return null;
  const years = [...d.bySeason].sort((a, b) => b.avgSurplus - a.avgSurplus);
  const bestYear = years[0];
  const worstYear = years[years.length - 1];
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Draft report card</h2>
        <p className="text-sm text-muted max-w-prose">
          Every pick against where the player finished in that season's scoring. Keepers are not counted.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 max-w-3xl mb-6">
        <Headline label="Biggest steal" p={d.best[0]} tone="good" />
        <Headline label="Biggest bust" p={d.worst[0]} tone="bad" />
      </div>
      <p className="mb-6 text-sm">
        <span className="font-semibold">{(d.hitRate * 100).toFixed(0)}%</span> of {d.evaluated} picks scored at least as much as the player who finished at that spot.
        {years.length > 1 && bestYear && worstYear ? ` Best draft: ${bestYear.season}. Worst: ${worstYear.season}.` : ""}
      </p>
      <p className="mb-6 text-sm">
        {d.firstRoundPicks >= 3 && (
          <>
            First-round picks: <span className="font-semibold">{(d.firstRoundHitRate * 100).toFixed(0)}%</span> hit ({d.firstRoundPicks} picks).{" "}
          </>
        )}
        {d.goalieRound != null && (
          <>
            The first goalie goes in round <span className="font-semibold">{d.goalieRound.toFixed(1)}</span> on average
            {d.goalieRound <= 4 ? ", an early goalie drafter." : d.goalieRound >= 8 ? ", waiting on goalies." : "."}
          </>
        )}
      </p>
      <div className="grid gap-8 md:grid-cols-2 max-w-3xl">
        <ShortList title="More steals" picks={d.best.slice(1, 4)} />
        <ShortList title="More busts" picks={d.worst.slice(1, 4)} />
      </div>
    </section>
  );
}
