import type { HistGame, ManagerHistory } from "@/lib/manager-history";
import type { ManagerLuck } from "@/lib/manager-luck";

const when = (g: HistGame) => `${g.season}, week ${g.week}`;
const margin = (g: HistGame) => Math.abs(g.score - g.oppScore).toFixed(2);

function Games({ title, note, games, max = 5 }: { title: string; note: string; games: HistGame[]; max?: number }) {
  return (
    <div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="text-xs text-muted mb-2">{note}</p>
      {games.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul>
          {games.slice(0, max).map((g) => (
            <li key={`${g.season}-${g.week}`} className="flex items-baseline justify-between gap-4 py-1.5 border-b border-ice-line/60 text-sm">
              <span className="truncate">
                {when(g)} vs {g.oppManagerName ?? g.oppTeamName}
              </span>
              <span className="font-tabular whitespace-nowrap text-muted">
                {g.score.toFixed(2)} to {g.oppScore.toFixed(2)}
                <span className="ml-2">({g.result === "W" ? "+" : "−"}{margin(g)})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Heartbreakers and robberies: the games decided by the narrowest margins, and the games the schedule gave or took.
export default function HeartbreakersView({ h, luck }: { h: ManagerHistory; luck: ManagerLuck | null }) {
  if (h.games < 10) return null;
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Heartbreakers and robberies</h2>
        <p className="text-sm text-muted max-w-prose">Games lost or won by under a point, and the games where the schedule decided it.</p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4 mb-8">
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{h.closeLosses.length}</dd>
          <dt className="mt-1 text-sm text-muted">Heartbreakers (lost by under a point)</dt>
        </div>
        <div>
          <dd className="font-display text-3xl leading-none font-tabular">{h.closeWins.length}</dd>
          <dt className="mt-1 text-sm text-muted">Escapes (won by under a point)</dt>
        </div>
        {luck && (
          <>
            <div>
              <dd className="font-display text-3xl leading-none font-tabular">{luck.robbedLosses}</dd>
              <dt className="mt-1 text-sm text-muted">Robberies (lost with an above-median score)</dt>
            </div>
            <div>
              <dd className="font-display text-3xl leading-none font-tabular">{luck.stolenWins}</dd>
              <dt className="mt-1 text-sm text-muted">Gifts (won with a below-median score)</dt>
            </div>
          </>
        )}
      </dl>
      <div className="grid gap-8 md:grid-cols-2 max-w-4xl">
        <Games title="Closest losses" note="Lost by under a point." games={h.closeLosses} />
        <Games title="Closest wins" note="Won by under a point." games={h.closeWins} />
        <Games title="Biggest robberies" note="The highest scores that still lost." games={h.robberies} />
        {h.luckyWin ? <Games title="Luckiest win" note="The fewest points in a win." games={[h.luckyWin]} max={1} /> : null}
      </div>
    </section>
  );
}
