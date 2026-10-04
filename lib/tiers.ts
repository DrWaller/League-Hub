// Player tiers from a percentile: how a player ranks in fantasy points PER GAME against his own position
// group (forwards, defensemen or goalies). The bands are fixed so a tier is never arbitrary.
export type TierName = "Superstar" | "Elite" | "Good" | "Depth" | "Replacement";

export const TIER_ORDER: TierName[] = ["Superstar", "Elite", "Good", "Depth", "Replacement"];

// `min` = the lowest percentile that earns the tier. Colors run strong (gold / blue) to weak (rust).
export const TIERS: Record<TierName, { min: number; bg: string; fg: string; star: boolean; band: string }> = {
  Superstar: { min: 99, bg: "linear-gradient(135deg, #F4C95D 0%, #D9A441 100%)", fg: "#0C2740", star: true, band: "99th percentile and up" },
  Elite: { min: 95, bg: "linear-gradient(135deg, #1B6FB5 0%, #1B6FB5 100%)", fg: "#FFFFFF", star: false, band: "95th to 98th" },
  Good: { min: 75, bg: "linear-gradient(135deg, #4F7FA8 0%, #4F7FA8 100%)", fg: "#FFFFFF", star: false, band: "75th to 94th" },
  Depth: { min: 50, bg: "linear-gradient(135deg, #7C8794 0%, #7C8794 100%)", fg: "#FFFFFF", star: false, band: "50th to 74th" },
  Replacement: { min: 0, bg: "linear-gradient(135deg, #B8574A 0%, #B8574A 100%)", fg: "#FFFFFF", star: false, band: "below 50th" },
};

export function tierOf(percentile: number): TierName {
  for (const name of TIER_ORDER) if (percentile >= TIERS[name].min) return name;
  return "Replacement";
}
