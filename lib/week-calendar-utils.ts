export interface WeekCalendar {
  startDate: string | null; // opening night, "YYYY-MM-DD" -- only used to show date ranges
  lengths: number[];
}

export function periodsForWeek(lengths: number[], week: number): number[] | null {
  const len = lengths[week - 1];
  if (!len || len < 1) return null;
  const start = lengths.slice(0, week - 1).reduce((a, b) => a + b, 0) + 1;
  return Array.from({ length: len }, (_, i) => start + i);
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// "Wed Oct 7 - Sun Oct 11" for each week, so the entries can be checked against ESPN's schedule.
export function dateRanges(startDate: string | null, lengths: number[]): string[] {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return lengths.map(() => "");
  const base = new Date(`${startDate}T00:00:00Z`).getTime();
  let day = 0;
  return lengths.map((len) => {
    const from = new Date(base + day * 86400000);
    const to = new Date(base + (day + Math.max(1, len) - 1) * 86400000);
    day += Math.max(1, len);
    return `${fmt(from)} - ${fmt(to)}`;
  });
}


const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Reads the schedule as ESPN's schedule page lists it, e.g.
//   Matchup 1 (Sep 29 - Oct 4)
//   Matchup 14 (Dec 28 - Jan 3)
//   Playoff Round 3 (Mar 22 - Apr 4)
// and returns the opening night plus each period's length in days, in order.
// `startYear` is the calendar year the season opens in (the 2027 season opens in 2026).
export function parseEspnSchedule(text: string, startYear: number): { startDate: string; lengths: number[] } | null {
  const re = /\(\s*([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2})\s*[-\u2013]\s*(?:([A-Za-z]{3})[A-Za-z]*\.?\s+)?(\d{1,2})\s*\)/;
  const lengths: number[] = [];
  let year = startYear;
  let prevMonth = -1;
  let startDate: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const m1 = MONTHS[m[1].toLowerCase()];
    const m2 = m[3] ? MONTHS[m[3].toLowerCase()] : m1;
    if (m1 === undefined || m2 === undefined) continue;
    const d1 = Number(m[2]);
    const d2 = Number(m[4]);
    if (prevMonth !== -1 && m1 < prevMonth) year++; // the schedule rolled into a new calendar year
    const endYear = m2 < m1 ? year + 1 : year;
    const days = Math.round((Date.UTC(endYear, m2, d2) - Date.UTC(year, m1, d1)) / 86400000) + 1;
    if (days < 1 || days > 31) return null;
    if (startDate === null) startDate = `${year}-${String(m1 + 1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`;
    lengths.push(days);
    year = endYear;
    prevMonth = m2;
  }
  return startDate && lengths.length ? { startDate, lengths } : null;
}
