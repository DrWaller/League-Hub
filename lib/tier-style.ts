// Client-safe tier names and colours (no server imports), shared by the league tiers and the team makeup page.
// Same five names as the player cards (lib/tiers.ts). The cutoff keys in Cutoffs keep their old names:
// franchise = Superstar, superstar = Elite, elite = Good, depth = Depth.
export type Tier = "Replacement" | "Depth" | "Good" | "Elite" | "Superstar";
export const TIERS: Tier[] = ["Superstar", "Elite", "Good", "Depth", "Replacement"];
// Elite and Good are both green (deep and light) so the tiers that matter stand out at a glance. The player cards
// (lib/tiers.ts) keep their own colours.
export const TIER_STYLE: Record<Tier, { bg: string; fg: string }> = {
  Superstar: { bg: "#D9A441", fg: "#0C2740" },
  Elite: { bg: "#1E7B3A", fg: "#FFFFFF" }, // deep green
  Good: { bg: "#7CC47F", fg: "#0C2740" }, // lighter green, dark text so it stays readable
  Depth: { bg: "#7C8794", fg: "#FFFFFF" },
  Replacement: { bg: "#B8574A", fg: "#FFFFFF" },
};

