// Server-side only. One "update pickups" step: saves ESPN's adds/drops, the weekly replacement rates, and the
// tracked pickups' day lines (see lib/roster-moves.ts and lib/best-pickup.ts). Safe to call repeatedly: each call
// does one limited batch and says whether anything is still waiting.

import { sql } from "./db";
import { getLeagueMeta } from "./espn";
import { getCurrentScoringPeriod } from "./espn-daily";
import { syncRosterMoves } from "./roster-moves";
import { syncVorRates } from "./vor-rates";
import { syncPickupDays } from "./best-pickup";

export interface PickupSyncResult {
  season: number;
  currentPeriod: number | null;
  currentWeek: number;
  movesSaved: number;
  movesWaiting: number;
  movesFailed: number;
  ratesWaiting: number;
  daysSaved: number;
  daysWaiting: number;
  daysFailed: number;
  done: boolean; // nothing left waiting and nothing failed
  errors: string[];
}

export async function runPickupSyncStep(): Promise<PickupSyncResult> {
  const meta = await getLeagueMeta();
  const period = (await getCurrentScoringPeriod()).current;
  const out: PickupSyncResult = { season: meta.season, currentPeriod: period, currentWeek: meta.currentWeek, movesSaved: 0, movesWaiting: 0, movesFailed: 0, ratesWaiting: 0, daysSaved: 0, daysWaiting: 0, daysFailed: 0, done: false, errors: [] };
  if (!period) {
    out.errors.push("ESPN didn't say what the current scoring day is.");
    return out;
  }
  try {
    const m = await syncRosterMoves(meta.season, period);
    out.movesSaved = m.saved;
    out.movesWaiting = m.waiting;
    out.movesFailed = m.failed;
    if (m.error) out.errors.push(m.error);
  } catch (e) {
    out.errors.push(`Adds and drops: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    out.ratesWaiting = (await syncVorRates(meta.season, meta.currentWeek)).waiting;
  } catch (e) {
    out.errors.push(`Replacement levels: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const d = await syncPickupDays(meta.season, period, meta.currentWeek);
    out.daysSaved = d.saved;
    out.daysWaiting = d.waiting;
    out.daysFailed = d.failed;
  } catch (e) {
    out.errors.push(`Pickup days: ${e instanceof Error ? e.message : String(e)}`);
  }
  out.done = out.errors.length === 0 && out.movesWaiting === 0 && out.movesFailed === 0 && out.ratesWaiting === 0 && out.daysWaiting === 0 && out.daysFailed === 0;
  return out;
}

export interface PickupCounts {
  daysWithMoves: number;
  adds: number;
  drops: number;
  pickupAdds: number; // free-agent / waiver adds
  daysTracked: number; // pickup days saved with a lineup slot
  daysChecked: number;
}

export async function getPickupCounts(season: number): Promise<PickupCounts> {
  const q = async (text: Promise<{ rows: Record<string, unknown>[] }>) => Number((await text).rows[0]?.n ?? 0);
  try {
    return {
      daysWithMoves: await q(sql`SELECT count(*) AS n FROM roster_moves_periods WHERE season = ${season};`),
      adds: await q(sql`SELECT count(*) AS n FROM roster_moves WHERE season = ${season} AND move = 'add';`),
      drops: await q(sql`SELECT count(*) AS n FROM roster_moves WHERE season = ${season} AND move = 'drop';`),
      pickupAdds: await q(sql`SELECT count(*) AS n FROM roster_moves WHERE season = ${season} AND move = 'add' AND source IN ('FREEAGENT','WAIVER','WAIVER_BUDGET');`),
      daysTracked: await q(sql`SELECT count(*) AS n FROM pickup_days WHERE season = ${season};`),
      daysChecked: await q(sql`SELECT count(*) AS n FROM pickup_days_done WHERE season = ${season};`),
    };
  } catch {
    return { daysWithMoves: 0, adds: 0, drops: 0, pickupAdds: 0, daysTracked: 0, daysChecked: 0 }; // tables don't exist until the first update
  }
}

// Wipes the saved adds/drops and tracked days for a season so the next updates read everything from ESPN again.
export async function resetPickupData(season: number) {
  for (const t of ["roster_moves", "roster_moves_periods", "pickup_days", "pickup_days_done"]) {
    try {
      if (t === "roster_moves") await sql`DELETE FROM roster_moves WHERE season = ${season};`;
      else if (t === "roster_moves_periods") await sql`DELETE FROM roster_moves_periods WHERE season = ${season};`;
      else if (t === "pickup_days") await sql`DELETE FROM pickup_days WHERE season = ${season};`;
      else await sql`DELETE FROM pickup_days_done WHERE season = ${season};`;
    } catch {
      /* table not created yet: nothing to clear */
    }
  }
}
