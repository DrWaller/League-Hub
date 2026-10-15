// Client-safe tier names and colours (no server imports), shared by the league tiers and the team makeup page.
// Same five names as the player cards (lib/tiers.ts). The cutoff keys in Cutoffs keep their old names:
// franchise = Superstar, superstar = Elite, elite = Good, depth = Depth.
export type Tier = "Replacement" | "Depth" | "Good" | "Elite" | "Superstar";
export const TIERS: Tier[] = ["Superstar", "Elite", "Good", "Depth", "Replacement"];
// Elite is blue and Good is green, so the two tiers that matter are easy to tell apart at a glance. The player cards
// (lib/tiers.ts) keep their own colours (Good is a muted blue there).
export const TIER_STYLE: Record<Tier, { bg: string; fg: string }> = {
  Superstar: { bg: "#D9A441", fg: "#0C2740" },
  Elite: { bg: "#1B6FB5", fg: "#FFFFFF" }, // blue
  Good: { bg: "#26864A", fg: "#FFFFFF" }, // green
  Depth: { bg: "#7C8794", fg: "#FFFFFF" },
  Replacement: { bg: "#B8574A", fg: "#FFFFFF" },
};

