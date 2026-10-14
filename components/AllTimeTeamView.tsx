import type { AllTimeSpot, FranchiseEntry } from "@/lib/franchise-player";

// The all-time team, laid out like a game-day lineup: two forward lines, two defence pairs and two goalies.

function Cell({ p, pos }: { p?: FranchiseEntry; pos: string }) {
  return (
    <div className={`min-w-0 border-l-4 px-3 py-2 ${p ? "border-gold bg-ice-panel" : "border-ice-line bg-ice-panel/40"}`}>
      <p className="text-xs text-muted">{pos}</p>
      {p ? (
        <>
          <p className="font-display text-lg sm:text-2xl leading-tight break-words">{p.name}</p>
          <p className="text-xs text-muted font-tabular">
            about {Math.round(p.points).toLocaleString("en-US")} pts, {p.seasons.length} season{p.seasons.length === 1 ? "" : "s"}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted py-2">Open spot</p>
      )}
    </div>
  );
}

function Row({ cells, cols }: { cells: { p?: FranchiseEntry; pos: string }[]; cols: string }) {
  return (
    <div className={`grid gap-2 ${cols}`}>
      {cells.map((c, i) => (
        <Cell key={i} p={c.p} pos={c.pos} />
      ))}
    </div>
  );
}

export default function AllTimeTeamView({ team }: { team: AllTimeSpot[] }) {
  const by = (pos: string) => team.find((t) => t.pos === pos)?.players ?? [];
  const C = by("C"), LW = by("LW"), RW = by("RW"), D = by("D"), G = by("G");
  if (team.every((t) => t.players.length === 0)) return null;
  const total = team.reduce((n, t) => n + t.players.reduce((m, p) => m + p.points, 0), 0);
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl mb-1">All-time team</h2>
      <p className="text-xs text-muted mb-4 max-w-2xl">
        The top scorers at each position across this manager&apos;s ESPN seasons. Points are estimated from weekly roster looks and season totals, and a player listed at two positions fills one spot.
        Together they scored about {Math.round(total).toLocaleString("en-US")} points.
      </p>
      <div className="max-w-3xl space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Forwards</p>
          {[0, 1].map((i) => (
            <Row key={i} cols="grid-cols-3" cells={[{ p: LW[i], pos: "LW" }, { p: C[i], pos: "C" }, { p: RW[i], pos: "RW" }]} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Defence</p>
          {[0, 2].map((i) => (
            <Row key={i} cols="grid-cols-2" cells={[{ p: D[i], pos: "D" }, { p: D[i + 1], pos: "D" }]} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Goalies</p>
          <Row cols="grid-cols-2" cells={[{ p: G[0], pos: "G" }, { p: G[1], pos: "G" }]} />
        </div>
      </div>
    </section>
  );
}
