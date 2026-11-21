// Pure helpers (client-safe) for the per-team views of the draft assessment.
import type { AssessedPick } from "./draft-assessment";
import type { KeeperTeam } from "./draft-keepers-image";
import { TIERS, type Tier } from "./tier-style";

const last = (name: string) => name.split(" ").slice(-1)[0];

// Teams ranked by the combined season VOR of their keepers.
export function keeperTeams(picks: AssessedPick[]): KeeperTeam[] {
  const by = new Map<string, AssessedPick[]>();
  for (const p of picks) if (p.keeper) by.set(p.team, [...(by.get(p.team) ?? []), p]);
  return Array.from(by.entries())
    .map(([team, list]) => {
      const sorted = [...list].sort((a, b) => (b.vor ?? -Infinity) - (a.vor ?? -Infinity));
      const counts = Object.fromEntries(TIERS.map((t) => [t, list.filter((x) => x.tier === t).length])) as Record<Tier, number>;
      return { team, vor: list.reduce((n, x) => n + (x.vor ?? 0), 0), counts, names: sorted.map((x) => last(x.name)) };
    })
    .sort((a, b) => b.vor - a.vor);
}

// Team names in draft order of their first pick.
export function teamNames(picks: AssessedPick[]): string[] {
  return Array.from(new Set(picks.map((p) => p.team).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
