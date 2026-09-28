// The regular-season top three for a League History card (1st, 2nd, 3rd),
// taken from a season's final standings. The commissioner's optional "1st
// place override" (for when the league's own tiebreakers put a different team
// first than record-then-points does) becomes 1st, and the next two come from
// the standings with that team removed.

export interface PodiumEntry {
  name: string;
  managerName: string | null;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function buildPodium(rows: PodiumEntry[], firstPlaceOverride: string | null): PodiumEntry[] {
  if (!firstPlaceOverride) return rows.slice(0, 3);
  const match = rows.find((r) => norm(r.name) === norm(firstPlaceOverride));
  const first: PodiumEntry = match ?? { name: firstPlaceOverride, managerName: null };
  return [first, ...rows.filter((r) => norm(r.name) !== norm(firstPlaceOverride))].slice(0, 3);
}
