// Server-side only. A player's approximate age in a given season, from the draft sheet's current ages (the sheet is
// read once; a player who has left the sheet simply has no age). Used only to give the voters context on finalists:
// a breakout at 22 is a different story from one at 31.

import { loadSheetMap, pickSheet } from "./player-sheet";

export async function loadAgeLookup(currentSeason: number): Promise<(name: string, position: string, season: number) => number | null> {
  const map = await loadSheetMap().catch(() => null);
  return (name, position, season) => {
    if (!map || map.size === 0) return null;
    const p = pickSheet(map, name, position);
    return p && p.age != null ? p.age - (currentSeason - season) : null;
  };
}
