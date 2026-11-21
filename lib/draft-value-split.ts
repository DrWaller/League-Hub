// Pure helper (safe in client components): splits assessed picks into steals, busts and missed-time picks.
import type { AssessedPick } from "./draft-assessment";

export type ValueKind = "steals" | "busts" | "missed";
export const VALUE_TITLES: Record<ValueKind, string> = { steals: "Steals", busts: "Busts", missed: "Missed Time" };
export const VALUE_BLURBS: Record<ValueKind, string> = {
  steals: "Scored more than the player who finished at his draft slot.",
  busts: "Played at least half the games and still scored less than the player who finished at his slot.",
  missed: "Played under half the games so far (injured or out of the lineup) and are behind the player who finished at their slot.",
};

export function splitValue(picks: AssessedPick[], top = 10): Record<ValueKind, AssessedPick[]> {
  const rated = picks.filter((p) => !p.keeper && p.surplus != null);
  const maxGp = Math.max(0, ...picks.map((p) => p.gp ?? 0));
  const played = (p: AssessedPick) => (p.gp ?? 0) >= maxGp * 0.5;
  return {
    steals: rated.filter((p) => p.surplus! > 0).sort((a, b) => b.surplus! - a.surplus!).slice(0, top),
    busts: rated.filter((p) => p.surplus! < 0 && played(p)).sort((a, b) => a.surplus! - b.surplus!).slice(0, top),
    missed: rated.filter((p) => p.surplus! < 0 && !played(p)).sort((a, b) => a.surplus! - b.surplus!).slice(0, top),
  };
}
