// Pure helper (safe in client components): splits assessed picks into steals, busts and missed-time picks.
import type { AssessedPick } from "./draft-assessment";
import { TIERS } from "./tier-style";

export type ValueKind = "steals" | "busts" | "missed";
export const VALUE_TITLES: Record<ValueKind, string> = { steals: "Steals", busts: "Busts", missed: "Missed Time" };
export const VALUE_BLURBS: Record<ValueKind, string> = {
  steals: "Beat what his round expects: Elite or better in rounds 1 to 3 (Good is the standard in round 1 and the hope in rounds 2 and 3), or Good or better from round 4 on (Depth is already a win there). Ranked by season VOR above the player currently at his slot.",
  busts: "Skaters who played at least half the games (any goalie) and didn't live up to the slot: round 1 and not Good, or rounds 2 to 7 and Replacement. Depth is a fine result after round 1, and Good or better is never a bust.",
  missed: "Skaters who played under half the games so far (injured or out of the lineup) and are behind the VOR of the player currently ranked at their slot. Goalies who sit are judged as busts instead.",
};

// The steal / bust / missed-time predicates, shared by the league lists and the per-team views.
function makeRules(picks: AssessedPick[]) {
  const maxGp = Math.max(0, ...picks.map((p) => p.gp ?? 0));
  const played = (p: AssessedPick) => (p.gp ?? 0) >= maxGp * 0.5;
  const roundOf = (p: AssessedPick) => p.round ?? Math.ceil(p.overall / 10);
  // A pick beats his round with a tier above what the round expects: Elite+ in rounds 1-3, Good+ from round 4 on.
  const overdelivered = (p: AssessedPick) => {
    if (p.tier == null) return false;
    return TIERS.indexOf(p.tier) <= (roundOf(p) <= 3 ? TIERS.indexOf("Elite") : TIERS.indexOf("Good"));
  };
  // The worst tier a pick can have for his round without it counting as a miss: Good in round 1, Depth in rounds 2-7 (Good is only the hope in rounds 2-3), anything later.
  const underdelivered = (p: AssessedPick) => {
    if (p.tier == null) return false;
    const r = roundOf(p);
    const need = r <= 1 ? TIERS.indexOf("Good") : r <= 7 ? TIERS.indexOf("Depth") : TIERS.length;
    return TIERS.indexOf(p.tier) > need;
  };
  const kindOf = (p: AssessedPick): ValueKind | null => {
    if (p.keeper || p.surplus == null) return null;
    if (overdelivered(p)) return "steals";
    // A goalie who isn't playing is on the bench, not hurt (we can't tell), so he's judged on his tier like anyone else.
    const goalie = p.position === "G";
    if (p.surplus < 0 && (goalie || played(p)) && underdelivered(p)) return "busts";
    if (p.surplus < 0 && !goalie && !played(p)) return "missed";
    return null;
  };
  return { kindOf };
}

// Every pick's label (steal, bust or missed time), with no top-10 cut: used for the team views.
export function valueKinds(picks: AssessedPick[]): Map<number, ValueKind> {
  const { kindOf } = makeRules(picks);
  const out = new Map<number, ValueKind>();
  for (const p of picks) {
    const k = kindOf(p);
    if (k) out.set(p.overall, k);
  }
  return out;
}

export function splitValue(picks: AssessedPick[], top = 10): Record<ValueKind, AssessedPick[]> {
  const kinds = valueKinds(picks);
  const pick = (k: ValueKind, dir: 1 | -1) =>
    picks
      .filter((p) => kinds.get(p.overall) === k)
      .sort((a, b) => dir * (b.surplus! - a.surplus!))
      .slice(0, top);
  return { steals: pick("steals", 1), busts: pick("busts", -1), missed: pick("missed", -1) };
}
