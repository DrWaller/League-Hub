import type { AllTimeSpot, FranchiseEntry } from "@/lib/franchise-player";

// The all-time team in the NHL's all-star format: a first team and a second team, each with a goalie, two defencemen and a C, LW and RW.

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

export default function AllTimeTeamView({ team, managerId, managerName }: { team: AllTimeSpot[]; managerId: number; managerName: string }) {
  const by = (pos: string) => team.find((t) => t.pos === pos)?.players ?? [];
  const C = by("C"), LW = by("LW"), RW = by("RW"), D = by("D"), G = by("G");
  if (team.every((t) => t.players.length === 0)) return null;
  const total = team.reduce((n, t) => n + t.players.reduce((m, p) => m + p.points, 0), 0);
  const teams = [
    { title: "First team", f: 0, d: 0 },
    { title: "Second team", f: 1, d: 2 },
  ];
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl mb-1">All-time team</h2>
      <p className="text-xs text-muted mb-4 max-w-2xl">
        The top scorers at each position across this manager&apos;s ESPN seasons, picked the way the NHL picks its all-star teams: one goalie, two defencemen, a centre and a left and right wing.
        Points are estimated from weekly roster looks and season totals, and a player listed at two positions fills one spot.
        Together the twelve scored about {Math.round(total).toLocaleString("en-US")} points.
      </p>
      <div className="max-w-3xl space-y-8">
        {teams.map((t) => (
          <div key={t.title} className="space-y-2">
            <h3 className="font-display text-lg">{t.title}</h3>
            <Row cols="grid-cols-3" cells={[{ p: LW[t.f], pos: "LW" }, { p: C[t.f], pos: "C" }, { p: RW[t.f], pos: "RW" }]} />
            <Row cols="grid-cols-2" cells={[{ p: D[t.d], pos: "D" }, { p: D[t.d + 1], pos: "D" }]} />
            <Row cols="grid-cols-1" cells={[{ p: G[t.f], pos: "G" }]} />
          </div>
        ))}
      </div>
      <div className="mt-6 max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
        <img src={`/api/cards/all-time-team?managerId=${managerId}`} alt={`${managerName} all-time team graphic`} loading="lazy" width={540} height={675} className="w-full rounded-xl shadow-lg" />
        <a href={`/api/cards/all-time-team?managerId=${managerId}`} download={`${managerName}-all-time-team.png`} className="mt-3 inline-block text-sm underline">Download the graphic</a>
      </div>
    </section>
  );
}
