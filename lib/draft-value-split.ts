// Pure helper (safe in client components): splits assessed picks into steals, busts and missed-time picks.
import type { AssessedPick } from "./draft-assessment";
import { TIERS } from "./tier-style";

export type ValueKind = "steals" | "busts" | "missed";
export const VALUE_TITLES: Record<ValueKind, string> = { steals: "Steals", busts: "Busts", missed: "Missed Time" };
export const VALUE_BLURBS: Record<ValueKind, string> = {
  steals: "Scored more than the player currently at his draft slot.",
  busts: "Played at least half the games and didn't live up to the slot: rounds 1 to 3 and not Good, or rounds 4 to 7 and Replacement. Players who are Good or better are never busts.",
  missed: "Played under half the games so far (injured or out of the lineup) and are behind the player currently at their slot.",
};

export function splitValue(picks: AssessedPick[], top = 10): Record<ValueKind, AssessedPick[]> {
  const rated = picks.filter((p) => !p.keeper && p.surplus != null);
  const maxGp = Math.max(0, ...picks.map((p) => p.gp ?? 0));
  const played = (p: AssessedPick) => (p.gp ?? 0) >= maxGp * 0.5;
  // The worst tier a pick can have for his round without it counting as a miss: Good in rounds 1-3, Depth in rounds 4-7, anything later.
  const underdelivered = (p: AssessedPick) => {
    if (p.tier == null) return false;
    const r = p.round ?? Math.ceil(p.overall / 10);
    const need = r <= 3 ? TIERS.indexOf("Good") : r <= 7 ? TIERS.indexOf("Depth") : TIERS.length;
    return TIERS.indexOf(p.tier) > need;
  };
  return {
    steals: rated.filter((p) => p.surplus! > 0).sort((a, b) => b.surplus! - a.surplus!).slice(0, top),
    busts: rated.filter((p) => p.surplus! < 0 && played(p) && underdelivered(p)).sort((a, b) => a.surplus! - b.surplus!).slice(0, top),
    missed: rated.filter((p) => p.surplus! < 0 && !played(p)).sort((a, b) => a.surplus! - b.surplus!).slice(0, top),
  };
}
