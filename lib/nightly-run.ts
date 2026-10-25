// One run of the nightly blurbs: find last night, read the stats, pick the big
// nights, write the blurbs, and (optionally) save them. Used by the daily cron
// and by the admin dry run, so both always behave identically.

import { currentSeason, getCurrentScoringPeriod, getDailyPlayerLines } from "./espn-daily";
import { nightDate, scanNight, type NightScan } from "./nightly-blurbs";
import { hasTeamNights, saveNight, saveTeamNights } from "./nightly-store";

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
    // Each team's total for the night (active lineup only), for Manager's Biggest Night.
    const totals = new Map<number, number>();
    for (const p of day.players) if (p.active) totals.set(p.teamId, (totals.get(p.teamId) ?? 0) + p.points);
    await saveTeamNights(
      season,
      period,
      date,
      Array.from(totals, ([teamId, points]) => ({ teamId, teamName: day.teamNames[teamId] ?? `Team ${teamId}`, points: Math.round(points * 100) / 100 }))
    );
    saved = true;
  }

  return { ok: true, saved, season, period, date, espnPeriod: status, scan, diag: day.diag, sampleRawStats };
}

// Save any of the last few nights that aren't saved yet (oldest first). A night
// that is already saved is left alone unless force is set. Used by the morning
// job (so one missed day heals itself the next morning) and by the admin
// "Refresh from ESPN" button.
export interface CatchUpResult {
  ok: boolean;
  saved: number;
  checked: number; // nights from the start of the season that were looked at
  alreadyDone: number; // nights that already had their team totals saved
  unreadable: number; // nights ESPN gave nothing usable for
  firstProblem?: string;
  stoppedEarly?: boolean;
  error?: string;
}

export async function catchUpNights(
  days: number,
  force = false,
  budgetMs?: number // stop starting new nights after this long (so a long backfill fits in one request)
): Promise<CatchUpResult> {
  const season = currentSeason();
  const status = await getCurrentScoringPeriod();
  const empty = { saved: 0, checked: 0, alreadyDone: 0, unreadable: 0 };
  if (!status.connected || status.current === null) return { ok: false, ...empty, error: "ESPN isn't connected." };
  const res: CatchUpResult = { ok: true, ...empty };
  const startedAt = Date.now();
  for (let k = days; k >= 1; k--) {
    if (budgetMs && Date.now() - startedAt > budgetMs) return { ...res, stoppedEarly: true };
    const period = status.current - k;
    if (period < 1) continue;
    const date = nightDate(status.current, period);
    res.checked++;
    if (!force && (await hasTeamNights(season, date))) {
      res.alreadyDone++; // team totals are saved with every night, so this also covers nights saved before they existed
      continue;
    }
    const r = await runNightly({ period, save: true });
    if (r.ok && r.saved) res.saved++;
    else {
      res.unreadable++;
      if (!res.firstProblem) res.firstProblem = `${date}: ${r.error ?? "ESPN returned no players for that day"}`;
    }
  }
  return res;
}
