// One run of the nightly blurbs: find last night, read the stats, pick the big
// nights, write the blurbs, and (optionally) save them. Used by the daily cron
// and by the admin dry run, so both always behave identically.

import { currentSeason, getCurrentScoringPeriod, getDailyPlayerLines } from "./espn-daily";
import { nightDate, scanNight, type NightScan } from "./nightly-blurbs";
import { getNight, saveNight } from "./nightly-store";

export interface NightlyResult {
  ok: boolean;
  error?: string;
  saved: boolean;
  season: number;
  period?: number;
  date?: string;
  espnPeriod?: { current: number | null; source: string | null; candidates: Record<string, number | null> };
  scan?: NightScan;
  diag?: { rosterEntries: number; withStats: number };
  sampleRawStats?: { skater?: unknown; goalie?: unknown }; // to verify the stat ids by eye
}

export async function runNightly(opts: { period?: number; save: boolean }): Promise<NightlyResult> {
  const season = currentSeason();
  const status = await getCurrentScoringPeriod();
  if (!status.connected) {
    return { ok: false, saved: false, season, error: "ESPN isn't connected (missing ESPN_S2 / ESPN_SWID, or ESPN refused the request)." };
  }

  // Default: the scoring day before ESPN's current one = last night.
  const period = opts.period ?? (status.current !== null ? status.current - 1 : null);
  if (period === null || period < 1) {
    return { ok: false, saved: false, season, error: "Couldn't work out which scoring day to read.", espnPeriod: status };
  }
  const date = status.current !== null ? nightDate(status.current, period) : undefined;

  const day = await getDailyPlayerLines(period);
  if (!day.live) {
    return { ok: false, saved: false, season, period, date, espnPeriod: status, error: "ESPN didn't return rosters for that day." };
  }

  const scan = scanNight(day.players, day.teamNames, period);
  const sampleRawStats = {
    skater: day.players.find((p) => p.position !== "G" && p.stats)?.stats,
    goalie: day.players.find((p) => p.position === "G" && p.stats)?.stats,
  };

  // Only save when ESPN really returned that day's stats; an empty read must
  // never wipe a night that was saved earlier.
  let saved = false;
  if (opts.save && date && day.players.length > 0) {
    await saveNight(season, period, date, scan.blurbs);
    saved = true;
  }

  return { ok: true, saved, season, period, date, espnPeriod: status, scan, diag: day.diag, sampleRawStats };
}

// Save any of the last few nights that aren't saved yet (oldest first). A night
// that is already saved is left alone unless force is set. Used by the morning
// job (so one missed day heals itself the next morning) and by the admin
// "Refresh from ESPN" button.
export async function catchUpNights(days: number, force = false): Promise<{ ok: boolean; saved: number; error?: string }> {
  const season = currentSeason();
  const status = await getCurrentScoringPeriod();
  if (!status.connected || status.current === null) return { ok: false, saved: 0, error: "ESPN isn't connected." };
  let saved = 0;
  for (let k = days; k >= 1; k--) {
    const period = status.current - k;
    if (period < 1) continue;
    const date = nightDate(status.current, period);
    if (!force && (await getNight(season, date))) continue;
    const r = await runNightly({ period, save: true });
    if (r.ok && r.saved) saved++;
  }
  return { ok: true, saved };
}
