// Backfill a PAST season's nights (player big nights + each team's nightly total) from ESPN's day-by-day lineups,
// so the all-time single-night records cover every ESPN season. Resumable: days already read are skipped, and a
// run stops after its time budget so it fits in one request (run it again until nothing remains).
import { fetchPeriodDates, getDailyPlayerLines } from "./espn-daily";
import { scanNight } from "./nightly-blurbs";
import { getScannedPeriods, markScanned, saveNight, saveTeamNights } from "./nightly-store";

export interface PastBackfill {
  season: number;
  total: number; // scoring days in the season
  scanned: number; // days read so far (this run and earlier ones)
  savedNights: number; // days this run that had games
  remaining: number;
  approxDates: boolean;
  failed: number;
  firstProblem?: string;
  error?: string;
}

export async function backfillPastSeason(season: number, budgetMs = 40000, concurrency = 3): Promise<PastBackfill> {
  const sched = await fetchPeriodDates(season);
  if (!sched) return { season, total: 0, scanned: 0, savedNights: 0, remaining: 0, approxDates: false, failed: 0, error: "Couldn't read that season's schedule from ESPN." };

  const done = await getScannedPeriods(season);
  const todo: number[] = [];
  for (let sp = 1; sp <= sched.maxPeriod; sp++) if (!done.has(sp)) todo.push(sp);

  const out: PastBackfill = { season, total: sched.maxPeriod, scanned: done.size, savedNights: 0, remaining: todo.length, approxDates: sched.approx, failed: 0 };
  const startedAt = Date.now();

  for (let i = 0; i < todo.length && Date.now() - startedAt < budgetMs; i += concurrency) {
    const batch = todo.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (sp) => {
        const date = sched.dates.get(sp) ?? `${season - 1}-10-01`;
        try {
          const day = await getDailyPlayerLines(sp, season);
          if (!day.live) {
            out.failed++;
            out.firstProblem ??= `day ${sp}: ESPN returned no rosters`;
            return;
          }
          if (day.players.length > 0) {
            const scan = scanNight(day.players, day.teamNames, sp);
            await saveNight(season, sp, date, scan.blurbs);
            const totals = new Map<number, number>();
            for (const p of day.players) if (p.active) totals.set(p.teamId, (totals.get(p.teamId) ?? 0) + p.points);
            await saveTeamNights(
              season,
              sp,
              date,
              Array.from(totals, ([teamId, points]) => ({ teamId, teamName: day.teamNames[teamId] ?? `Team ${teamId}`, points: Math.round(points * 100) / 100 }))
            );
            out.savedNights++;
          }
          await markScanned(season, sp);
          out.scanned++;
          out.remaining--;
        } catch (err) {
          out.failed++;
          out.firstProblem ??= `day ${sp}: ${err instanceof Error ? err.message : String(err)}`;
        }
      })
    );
  }
  return out;
}
