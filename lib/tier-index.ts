// Server-side only. One lookup of every player's league tier (rostered and available), so any page can show
// the tier badge next to a name without rating anyone itself. Cached for ten minutes.
import { unstable_cache } from "next/cache";
import { getTierDirectory } from "@/lib/team-makeup";
import type { Tier } from "@/lib/tier-style";

export type TierIndex = Record<number, Tier>;

const load = unstable_cache(
  async (): Promise<TierIndex> => {
    const dir = await getTierDirectory();
    const out: TierIndex = {};
    if (dir) for (const p of dir.players) if (p.tier) out[p.id] = p.tier;
    return out;
  },
  ["tier-index-v1"],
  { revalidate: 600 }
);

export async function getTierIndex(): Promise<TierIndex> {
  try {
    return await load();
  } catch (e) {
    console.error("tier index failed", e);
    return {};
  }
}

// Adds `tier` to each player that has an id in the index.
export function withTiers<T extends { id: number }>(players: T[], idx: TierIndex): (T & { tier: Tier | null })[] {
  return players.map((p) => ({ ...p, tier: idx[p.id] ?? null }));
}
