// Client-safe tier names and colours (no server imports), shared by the league tiers and the team makeup page.
// Same five names and colours as the player cards (lib/tiers.ts). The cutoff keys in Cutoffs keep their old names:
// franchise = Superstar, superstar = Elite, elite = Good, depth = Depth.
export type Tier = "Replacement" | "Depth" | "Good" | "Elite" | "Superstar";
export const TIERS: Tier[] = ["Superstar", "Elite", "Good", "Depth", "Replacement"];
// The same colours as the player cards.
export const TIER_STYLE: Record<Tier, { bg: string; fg: string }> = {
  Superstar: { bg: "#D9A441", fg: "#0C2740" },
  Elite: { bg: "#1B6FB5", fg: "#FFFFFF" },
  Good: { bg: "#4F7FA8", fg: "#FFFFFF" },
  Depth: { bg: "#7C8794", fg: "#FFFFFF" },
  Replacement: { bg: "#B8574A", fg: "#FFFFFF" },
};

