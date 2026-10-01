import { sql } from "./db";

// Which scoring DAYS make up each matchup WEEK. ESPN doesn't publish this for
// this league through the API (the schedule has no per-day breakdown), so the
// commissioner enters it once per season at /admin/week-days by copying the
// week lengths from ESPN's own schedule page.
//
// lengths[i] = number of days in matchup week i+1. Scoring day 1 is the first
// day of week 1, so week N starts right after the days of weeks 1..N-1.

import { WeekCalendar } from "./week-calendar-utils";
export { periodsForWeek, dateRanges } from "./week-calendar-utils";
export type { WeekCalendar } from "./week-calendar-utils";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS week_calendar (
      season INTEGER PRIMARY KEY,
      start_date TEXT,
      lengths TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );
  `;
}

export async function getWeekCalendar(season: number): Promise<WeekCalendar | null> {
  try {
    await ensureTable();
    const r = await sql`SELECT start_date, lengths FROM week_calendar WHERE season = ${season};`;
    if (!r.rows.length) return null;
    const lengths = (JSON.parse(r.rows[0].lengths as string) as unknown[]).map(Number).filter((n) => Number.isFinite(n));
    return { startDate: (r.rows[0].start_date as string) ?? null, lengths };
  } catch (err) {
    console.error("getWeekCalendar failed (is Postgres connected?)", err);
    return null;
  }
}

export async function saveWeekCalendar(season: number, cal: WeekCalendar) {
  await ensureTable();
  const lengths = JSON.stringify(cal.lengths);
  await sql`
    INSERT INTO week_calendar (season, start_date, lengths) VALUES (${season}, ${cal.startDate}, ${lengths})
    ON CONFLICT (season) DO UPDATE SET start_date = ${cal.startDate}, lengths = ${lengths}, updated_at = now();
  `;
}
