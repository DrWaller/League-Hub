// Client-safe tier names and colours (no server imports), shared by the league tiers and the team makeup page.
export type Tier = "Stream" | "Depth" | "Elite" | "Superstar" | "Franchise";
export const TIERS: Tier[] = ["Franchise", "Superstar", "Elite", "Depth", "Stream"];
// The colours from the commissioner's sheet.
export const TIER_STYLE: Record<Tier, { bg: string; fg: string }> = {
  Franchise: { bg: "#2B6CA3", fg: "#FFFFFF" },
  Superstar: { bg: "#C99B21", fg: "#0C2740" },
  Elite: { bg: "#4DFF9F", fg: "#0C2740" },
  Depth: { bg: "#595959", fg: "#FFFFFF" },
  Stream: { bg: "#B00000", fg: "#FFFFFF" },
};

