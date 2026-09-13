import { LEAGUE_HISTORY } from "@/data/mock-data";
import { HistoryTag } from "@/lib/types";

function TagPill({ tag }: { tag: HistoryTag }) {
  const styles: Record<HistoryTag, string> = {
    "COVID-shortened": "border-center-red text-center-red",
    "Played on Fantrax": "border-muted text-muted",
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 border rounded-full ${styles[tag]}`}>
      {tag}
    </span>
  );
}

export default function HistoryPage() {
  const seasons = [...LEAGUE_HISTORY].sort((a, b) => b.year - a.year);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">League History</h1>
      <p className="text-sm text-muted mb-10 max-w-prose">
        Tracked by hand rather than pulled from ESPN, since one season was played on Fantrax and
        another ended early because of COVID-19 — details ESPN&apos;s own history tab doesn&apos;t
        capture. Edit <code className="text-xs">data/mock-data.ts</code> to add or correct a
        season.
      </p>

      <ol className="relative border-l border-ice-line ml-2">
        {seasons.map((s) => (
          <li key={s.year} className="mb-10 ml-6">
            <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-rink border-2 border-ice" />
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="font-display text-xl">{s.year}</h2>
              {s.tags?.map((tag) => <TagPill key={tag} tag={tag} />)}
            </div>
            <dl className="text-sm grid sm:grid-cols-3 gap-x-6 gap-y-1 mb-2">
              <div>
                <dt className="text-muted">Champion</dt>
                <dd className="font-body font-medium">{s.champion}</dd>
              </div>
              <div>
                <dt className="text-muted">Runner-up</dt>
                <dd className="font-body">{s.runnerUp}</dd>
              </div>
              <div>
                <dt className="text-muted">Regular Season Leader</dt>
                <dd className="font-body">{s.regularSeasonLeader}</dd>
              </div>
            </dl>
            {s.note && <p className="text-sm text-muted italic">{s.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
