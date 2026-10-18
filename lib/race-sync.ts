// Server-side only. One daily pass that keeps every award race's data current without anyone opening a page:
// finished weeks of player VOR and lineup efficiency, the week in progress, league-wide player stats and the
// pickup log. Each part is a small limited step (best effort), so the daily run stays quick; whatever is still
// waiting is picked up by the next run or the next visit to the races page.

import { getLeagueMeta, getMatchups } from "./espn";
import { regularSeasonFinals } from "./luck";
import { syncSeasonVor } from "./vor-store";
import { syncLiveVor } from "./vor-live";
import { syncSeasonLineups } from "./lineup-store";
import { syncPoolStats } from "./player-trends";
import { runPickupSyncStep } from "./pickup-sync";

export async function runRaceSync(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const meta = await getLeagueMeta();
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (e) {
      out[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  };
  let waitingWeeks = 0;
  await step("vor", async () => {
    const v = await syncSeasonVor(meta.season, meta.currentWeek);
    waitingWeeks = v.waiting;
    return v;
  });
  if (waitingWeeks === 0) await step("liveWeek", () => syncLiveVor(meta.season, meta.currentWeek, true));
  await step("lineups", async () => {
    const { matchups } = await getMatchups();
    const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week))).sort((a, b) => a - b);
    return syncSeasonLineups(meta.season, finished);
  });
  await step("poolStats", () => syncPoolStats(meta.season));
  await step("pickups", async () => {
    const p = await runPickupSyncStep();
    return { done: p.done, errors: p.errors };
  });
  return out;
}
