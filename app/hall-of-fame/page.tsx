import { getLeagueMeta } from "@/lib/espn";
import { AWARD_DEFS, loadHallOfFame, mostDecorated } from "@/lib/hall-of-fame";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {
  const meta = await getLeagueMeta();
  const seasons = (await loadHallOfFame(meta.season)).filter((s) => Object.keys(s.winners).length > 0);
  const decorated = mostDecorated(seasons);
  const rows = (group: "manager" | "player", winners: (typeof seasons)[number]["winners"]) =>
    AWARD_DEFS.filter((d) => d.group === group && winners[d.key]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Hall of Fame</h1>
      <p className="text-sm text-muted mb-8 max-w-prose">
        Every award winner, season by season, newest first. Seasons are named by the year they ended.
      </p>

      {decorated.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl mb-2">Most decorated players</h2>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            {decorated.map((d) => (
              <li key={d.name} className="border border-ice-line bg-white px-3 py-2 flex items-baseline justify-between gap-3">
                <span>
                  <span className="font-body font-medium">{d.name}</span>
                  <span className="block text-xs text-muted">{d.wins.map((w) => `${w.award.replace(" Trophy", "")} ${w.season}`).join(" · ")}</span>
                </span>
                <span className="font-display text-2xl">{d.wins.length}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {seasons.length === 0 ? (
        <p className="text-muted">No winners recorded yet.</p>
      ) : (
        <ol className="relative border-l border-ice-line ml-2">
          {seasons.map((s) => (
            <li key={s.season} className="mb-10 ml-6">
              <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-rink border-2 border-ice" />
              <h2 className="font-display text-2xl mb-3">{s.season}</h2>
              <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                {(["manager", "player"] as const).map((g) => {
                  const list = rows(g, s.winners);
                  if (list.length === 0) return null;
                  return (
                    <div key={g}>
                      <p className="text-xs uppercase tracking-wide text-muted mb-1">{g === "manager" ? "Managers" : "Players"}</p>
                      <dl className="text-sm">
                        {list.map((d) => (
                          <div key={d.key} className="flex justify-between gap-3 py-1.5 border-b border-ice-line/60">
                            <dt className="text-muted">{d.label}</dt>
                            <dd className="text-right">
                              <span className="font-body font-medium">{s.winners[d.key].name}</span>
                              {s.winners[d.key].note && <span className="block text-xs text-muted">{s.winners[d.key].note}</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
