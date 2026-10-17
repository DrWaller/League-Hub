import TeamLogo from "@/components/TeamLogo";
import { pts } from "@/lib/format";

export interface ProjectionSide {
  name: string;
  logo?: string;
  played: number;
  left: number | null; // null = NHL schedule unavailable
  final: number | null; // projected final score, null = no projection
  win: number | null; // whole-number win %, null = no projection
}

// Win-probability bar plus a projected-final tile for each team. Replaces the old rows of text.
// The first side is drawn blue/left, the second red/right, in the same order as the score rows above.
export default function MatchupProjection({ a, b }: { a: ProjectionSide; b: ProjectionSide }) {
  const hasProj = a.win !== null && b.win !== null && a.final !== null && b.final !== null;
  const aLeads = hasProj ? a.final! >= b.final! : false;

  return (
    <div className="mt-4 rounded-sm bg-ice-panel/60 border border-ice-line p-3">
      {hasProj && (
        <>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
            <span>Win probability</span>
            <span>Projected</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-display text-lg leading-none text-rink-bright font-tabular">
              <TeamLogo url={a.logo} name={a.name} size={16} />
              {a.win}%
            </span>
            <div className="relative flex-1 h-2.5 rounded-full overflow-hidden bg-ice-line flex">
              <div
                className="proj-grow h-full bg-gradient-to-r from-rink to-rink-bright"
                style={{ width: `${a.win}%` }}
              />
              <div className="h-full flex-1 bg-gradient-to-r from-center-red/80 to-center-red" />
              {/* thin divider where the two shares meet */}
              <span
                className="absolute top-0 bottom-0 w-px bg-ice"
                style={{ left: `${a.win}%` }}
                aria-hidden
              />
            </div>
            <span className="flex items-center gap-1.5 font-display text-lg leading-none text-center-red font-tabular">
              {b.win}%
              <TeamLogo url={b.logo} name={b.name} size={16} />
            </span>
          </div>
        </>
      )}

      <div className={`grid grid-cols-2 gap-2 ${hasProj ? "mt-3" : ""}`}>
        {[
          { s: a, lead: aLeads, accent: "border-rink-bright" },
          { s: b, lead: hasProj && !aLeads, accent: "border-center-red" },
        ].map(({ s, lead, accent }, i) => (
          <div
            key={i}
            className={`rounded-sm bg-white/70 border-l-[3px] px-3 py-2 ${accent} ${lead ? "" : "opacity-80"}`}
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted truncate">{s.name}</div>
            {s.final !== null && (
              <div className={`font-display text-xl leading-tight font-tabular ${lead ? "text-board" : "text-muted"}`}>
                {pts(s.final)}
              </div>
            )}
            <div className="text-[11px] text-muted font-tabular mt-0.5">
              {s.played} played{s.left !== null && <> · {s.left} left</>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
