// Server-side only. One lookup of every player's league tier and rating (rostered and available), so any page
// can show the tier badge next to a name, or compare two players, without rating anyone itself. Cached ten minutes.
import { unstable_cache } from "next/cache";
import { getTierDirectory } from "@/lib/team-makeup";
import type { Tier } from "@/lib/tier-style";

export type TierIndex = Record<number, Tier>;
export type TierDetail = Record<number, { tier: Tier; est: number; group: "F" | "D" | "G" }>; // est: points per game (goalies: per team game)

const load = unstable_cache(
  async (): Promise<TierDetail> => {
    const dir = await getTierDirectory();
    const out: TierDetail = {};
    if (dir) for (const p of dir.players) if (p.tier && p.est !== null) out[p.id] = { tier: p.tier, est: p.est, group: p.group };
    return out;
  },
  ["tier-detail-v1"],
  { revalidate: 600 }
);

export async function getTierDetail(): Promise<TierDetail> {
  try {
    return await load();
  } catch (e) {
    console.error("tier index failed", e);
    return {};
  }
}

export async function getTierIndex(): Promise<TierIndex> {
  const d = await getTierDetail();
  const out: TierIndex = {};
  for (const k of Object.keys(d)) out[Number(k)] = d[Number(k)].tier;
  return out;
}

// Adds `tier` to each player that has an id in the index.
export function withTiers<T extends { id: number }>(players: T[], idx: TierIndex): (T & { tier: Tier | null })[] {
  return players.map((p) => ({ ...p, tier: idx[p.id] ?? null }));
}
