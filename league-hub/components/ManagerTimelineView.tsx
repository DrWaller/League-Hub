import { KeeperRecord, ManagerSeason, Trade } from "@/lib/types";

export default function ManagerTimelineView({
  seasons,
  keepersBySeason,
  tradesBySeason,
  managerName,
}: {
  seasons: ManagerSeason[];
  keepersBySeason: Map<number, KeeperRecord[]>;
  tradesBySeason: Map<number, Trade[]>;
  managerName: (id: number | null) => string;
}) {
  if (seasons.length === 0) {
    return <p className="text-muted">No seasons logged for this manager yet.</p>;
  }

  return (
    <ol className="relative border-l border-ice-line ml-2">
      {seasons.map((s) => {
        const keepers = keepersBySeason.get(s.season) ?? [];
        const trades = tradesBySeason.get(s.season) ?? [];
        return (
          <li key={s.id} className="mb-10 ml-6">
            <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-rink border-2 border-ice" />
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="font-display text-xl">{s.season}</h2>
              <span className="text-sm text-muted">{s.teamName}</span>
            </div>
            {s.recordNote && <p className="text-sm text-muted mb-2">{s.recordNote}</p>}

            {keepers.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted mb-1">Keepers</p>
                <ul className="text-sm space-y-0.5">
                  {keepers.map((k) => (
                    <li key={k.id} className="flex gap-2">
                      <span className="font-body">{k.playerName}</span>
                      {k.note && <span className="text-muted text-xs">({k.note})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trades.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-1">Trades</p>
                <ul className="text-sm space-y-0.5">
                  {trades.map((t) => (
                    <li key={t.id} className="text-muted">
                      {t.playerName}: {managerName(t.fromManagerId)} → {managerName(t.toManagerId)}
                      {t.note && ` — ${t.note}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
