import type { SeasonWinners } from "@/lib/hall-of-fame";
import Cup from "./Cup";

const MAJORS: { key: string; label: string }[] = [
  { key: "hart", label: "Hart" },
  { key: "artross", label: "Art Ross" },
  { key: "norris", label: "Norris" },
  { key: "vezina", label: "Vezina" },
];
const HONORS: { key: string; label: string; tone: "merit" | "luck" }[] = [
  { key: "presidents", label: "Presidents' Trophy", tone: "merit" },
  { key: "points", label: "Most points", tone: "merit" },
  { key: "jennings", label: "William M. Jennings", tone: "merit" },
  { key: "hardluck", label: "Hard Luck Manager", tone: "luck" },
];
const OTHERS: { key: string; label: string }[] = [
  { key: "forward", label: "Forward of the Year" },
  { key: "calder", label: "Calder Trophy" },
  { key: "breakout", label: "Breakout Player" },
  { key: "improved", label: "Most Improved" },
  { key: "bounce", label: "Bounce Back Player" },
  { key: "sleeping", label: "Sleeping Beauty" },
];

export interface Decorated {
  name: string;
  wins: { award: string; season: number }[];
}

const short = (award: string) => award.replace(" Trophy", "").replace(" Player", "");

export default function HallOfFameView({ seasons, decorated }: { seasons: SeasonWinners[]; decorated: Decorated[] }) {
  const top = decorated.slice(0, 4);
  return (
    <div>
      {/* The gallery: dark, lit from above like the banner rafters, with the most decorated players on plaques. */}
      <header
        className="rounded-md border border-board px-5 sm:px-8 pt-9 pb-7 mb-8 text-ice"
        style={{
          background:
            "radial-gradient(ellipse at 18% -20%, rgba(217,164,65,0.30), transparent 55%), radial-gradient(ellipse at 88% -20%, rgba(150,180,220,0.22), transparent 50%), linear-gradient(#0a0e13, #18212e)",
        }}
      >
        <h1 className="font-display text-5xl sm:text-6xl tracking-tight leading-none">Hall of Fame</h1>
        <p className="mt-3 max-w-prose text-ice/70">Every award winner, season by season. A season is named for the year it ended.</p>
        {top.length > 0 && (
          <div className="mt-7">
            <p className="mb-2 text-sm text-ice/60">Most decorated players</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {top.map((d) => (
                <li key={d.name} className="border border-gold/40 bg-white/[0.04] px-4 py-3 flex gap-3 items-start">
                  <span className="font-display text-5xl leading-none text-gold">{d.wins.length}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl leading-tight">{d.name}</span>
                    <span className="block mt-1 text-xs leading-snug text-ice/60">{d.wins.map((w) => `${short(w.award)} ${w.season}`).join(", ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {seasons.length > 0 && (
        <nav aria-label="Jump to a season" className="flex flex-wrap gap-1.5 mb-2">
          {seasons.map((s) => (
            <a key={s.season} href={`#y${s.season}`} className="px-2.5 py-1 text-sm border border-ice-line bg-white font-display hover:border-rink-bright hover:text-rink-bright">
              {s.season}
            </a>
          ))}
        </nav>
      )}

      {seasons.length === 0 ? (
        <p className="text-muted mt-8">No winners recorded yet.</p>
      ) : (
        seasons.map((s) => {
          const w = s.winners;
          const majors = MAJORS.filter((m) => w[m.key]);
          const honors = HONORS.filter((h) => w[h.key]);
          const others = OTHERS.filter((o) => w[o.key]);
          return (
            <section key={s.season} id={`y${s.season}`} className="grid gap-4 md:grid-cols-[7.5rem_1fr] py-8 border-t border-ice-line first:border-t-0 scroll-mt-20">
              <h2 className="font-display text-5xl leading-none text-rink md:sticky md:top-20 self-start">{s.season}</h2>
              <div className="space-y-5 min-w-0">
                {w.champion && (
                  <div className="bg-board text-ice border-l-4 border-gold px-5 py-4 flex items-center gap-4">
                    <Cup size={40} className="text-gold shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gold">League champion</p>
                      <p className="font-display text-3xl leading-tight break-words">{w.champion.name}</p>
                    </div>
                  </div>
                )}

                {honors.length > 0 && (
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    {honors.map((h) => (
                      <div key={h.key} className={`border-l-4 pl-3 ${h.tone === "luck" ? "border-center-red" : "border-rink-bright"}`}>
                        <p className="text-xs text-muted">{h.label}</p>
                        <p className="font-body font-semibold leading-snug">{w[h.key].name}</p>
                        {w[h.key].note && <p className="text-xs text-muted">{w[h.key].note}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {majors.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {majors.map((m) => (
                      <div key={m.key} className="bg-white border border-ice-line border-t-2 border-t-gold px-3 py-3">
                        <p className="text-xs text-muted">{m.label}</p>
                        <p className="font-display text-xl leading-tight mt-0.5 break-words">{w[m.key].name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {others.length > 0 && (
                  <dl className="grid sm:grid-cols-2 gap-x-8 text-sm">
                    {others.map((o) => (
                      <div key={o.key} className="flex justify-between gap-3 py-1.5 border-b border-ice-line/70">
                        <dt className="text-muted">{o.label}</dt>
                        <dd className="font-body font-medium text-right">{w[o.key].name}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
