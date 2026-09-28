// Pure data-shaping helpers (no I/O) shared between the Manager profile
// page and the Keepers page's "By Team" view.

import { KeeperRecord, ManagerSeason, Trade } from "./types";

export function buildManagerTimeline(
  managerId: number,
  allSeasons: ManagerSeason[],
  allKeepers: KeeperRecord[],
  allTrades: Trade[]
) {
  const seasons = allSeasons.filter((s) => s.managerId === managerId).sort((a, b) => b.season - a.season);
  const seasonKey = (teamId: number, season: number) => `${teamId}-${season}`;
  const mySeasonKeys = new Set(seasons.map((s) => seasonKey(s.teamId, s.season)));

  const keepersBySeason = new Map<number, KeeperRecord[]>();
  for (const k of allKeepers) {
    if (mySeasonKeys.has(seasonKey(k.teamId, k.season))) {
      const list = keepersBySeason.get(k.season) ?? [];
      list.push(k);
      keepersBySeason.set(k.season, list);
    }
  }

  const tradesBySeason = new Map<number, Trade[]>();
  for (const t of allTrades) {
    if (t.fromManagerId === managerId || t.toManagerId === managerId) {
      const list = tradesBySeason.get(t.season) ?? [];
      list.push(t);
      tradesBySeason.set(t.season, list);
    }
  }

  return { seasons, keepersBySeason, tradesBySeason };
}
