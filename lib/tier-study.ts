// Server-side only. A study of fixed average-points-per-game tier cutoffs against a finished season:
// where each cutoff lands (rank, percentile), who is rostered at each tier, and how the points are spread.
// Used to check hand-made cutoffs and to calibrate the ones the hub uses.

import { getImportedSeason, type ImportedPlayer } from "@/lib/imported-seasons";

export type Cutoffs = { depth: number; elite: number; superstar: number; franchise: number };
export const TIER_NAMES = ["Stream", "Depth", "Elite", "Superstar", "Franchise"] as const;

// The cutoffs the commissioner worked out by hand (average fantasy points per game).
export const HAND_CUTOFFS: Record<"F" | "D" | "G", Cutoffs> = {
  F: { depth: 1.69, elite: 1.99, superstar: 2.39, franchise: 2.69 },
  D: { depth: 1.495, elite: 1.695, superstar: 1.995, franchise: 2.395 },
  G: { depth: 1.99, elite: 2.29, superstar: 2.69, franchise: 2.99 },
};

const tierIndex = (avg: number, c: Cutoffs) => (avg >= c.franchise ? 4 : avg >= c.superstar ? 3 : avg >= c.elite ? 2 : avg >= c.depth ? 1 : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const groupOf = (p: ImportedPlayer) => (p.positionId === 5 ? "G" : p.positionId === 4 ? "D" : "F");

export async function runTierStudy(season: number, minGp: number) {
  const imp = await getImportedSeason(season);
  if (!imp) return null;
  const teams = new Set(imp.players.map((p) => p.owner).filter((o) => o && o !== "FA"));
  const out: Record<string, unknown> = { season, minGp, teams: teams.size, players: imp.players.length };

  for (const g of ["F", "D", "G"] as const) {
    const all = imp.players.filter((p) => groupOf(p) === g && p.gp > 0);
    const q = all.filter((p) => p.gp >= minGp).map((p) => ({ p, avg: p.appliedTotal / p.gp })).sort((a, b) => b.avg - a.avg);
    const cut = HAND_CUTOFFS[g];
    const rostered = (p: ImportedPlayer) => p.owner !== "FA" && p.owner !== "";
    const totalPts = q.reduce((s, x) => s + x.p.appliedTotal, 0) || 1;

    const tiers = TIER_NAMES.map((name, i) => {
      const inTier = q.filter((x) => tierIndex(x.avg, cut) === i);
      return {
        tier: name,
        from: i === 0 ? 0 : [cut.depth, cut.elite, cut.superstar, cut.franchise][i - 1],
        players: inTier.length,
        pctOfPlayers: r2((inTier.length / (q.length || 1)) * 100),
        rosteredPct: inTier.length ? Math.round((inTier.filter((x) => rostered(x.p)).length / inTier.length) * 100) : null,
        avgGp: inTier.length ? Math.round(inTier.reduce((s, x) => s + x.p.gp, 0) / inTier.length) : null,
        pointsSharePct: r2((inTier.reduce((s, x) => s + x.p.appliedTotal, 0) / totalPts) * 100),
        examples: inTier.slice(0, 3).map((x) => `${x.p.name} ${r2(x.avg)}`),
      };
    });

    // The average at set ranks, to see where the cutoffs sit in the order and what "startable" costs.
    const atRank: Record<string, number> = {};
    for (const n of [1, 3, 5, 10, 12, 15, 20, 24, 30, 36, 48, 60, 72, 96, 120, 150, 200]) if (q[n - 1]) atRank[`#${n}`] = r2(q[n - 1].avg);

    // Where each cutoff lands in the ranking.
    const cutRank = Object.fromEntries(
      (["depth", "elite", "superstar", "franchise"] as const).map((k) => {
        const above = q.filter((x) => x.avg >= cut[k]).length;
        return [k, { cutoff: cut[k], playersAtOrAbove: above, percentile: r2((1 - above / (q.length || 1)) * 100) }];
      })
    );

    // Histogram (0.1 wide) to see natural breaks between tiers.
    const hist: Record<string, number> = {};
    for (const x of q) {
      const b = (Math.floor(x.avg * 10) / 10).toFixed(1);
      hist[b] = (hist[b] ?? 0) + 1;
    }

    // Rostered vs free agent: where owners actually draw the line.
    const ros = q.filter((x) => rostered(x.p));
    const fa = q.filter((x) => !rostered(x.p));
    const median = (a: number[]) => (a.length ? r2([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]) : null);
    const faTop = [...fa].sort((a, b) => b.avg - a.avg).slice(0, 5).map((x) => `${x.p.name} ${r2(x.avg)} (${x.p.gp} gp)`);
    const rosLow = [...ros].sort((a, b) => a.avg - b.avg).slice(0, 3).map((x) => `${x.p.name} ${r2(x.avg)} (${x.p.gp} gp)`);

    out[g] = {
      qualified: q.length,
      anyGames: all.length,
      tiers,
      cutRank,
      atRank,
      rosteredCount: ros.length,
      rosteredMedian: median(ros.map((x) => x.avg)),
      freeAgentMedian: median(fa.map((x) => x.avg)),
      bestFreeAgents: faTop,
      weakestRostered: rosLow,
      hist,
    };
  }
  return out;
}
