import { KeeperRecord } from "./types";

// Display order for a team's keepers, matching the Keeper History sheet:
// 2 Year (Old), 2 Year (New), 1 Year, 1 Year. Based on the keeper type saved at
// the start of the note ("2 Year (Old) - RW"). Plain "2 Year" (2022) sits with
// the 2 Year group; keepers with no type go last. Ties keep the order they were
// added in, which is the sheet's order for imported keepers.
export function keeperTypeRank(note: string | null): number {
  const n = (note ?? "").trim().toLowerCase();
  if (/^2\s*year\s*\(old\)/.test(n)) return 0;
  if (/^2\s*year\s*\(new\)/.test(n)) return 1;
  if (/^2\s*year/.test(n)) return 2;
  if (/^1\s*year/.test(n)) return 3;
  return 4;
}

export function sortKeepers(list: KeeperRecord[]): KeeperRecord[] {
  return [...list].sort(
    (a, b) => b.season - a.season || a.teamId - b.teamId || keeperTypeRank(a.note) - keeperTypeRank(b.note) || a.id - b.id
  );
}
