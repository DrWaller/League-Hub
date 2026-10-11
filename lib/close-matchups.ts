// Close-matchup logic shared by the graphic and its caption. Pure functions: no ESPN calls here.
//
// Two modes:
//   "live"  - games that are NOT final yet and are within the margin right now
//             (the "going into Saturday / Sunday" version)
//   "final" - games that ARE final and were decided inside the margin
import type { Matchup } from "./types";

export type CloseMode = "live" | "final";

export interface CloseGame {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  margin: number; // always >= 0, rounded to two decimals
  leaderId: number | null; // null when tied
  tier: 0 | 1 | 2; // 0 = tightest
}

// "Close" = within 3 points, in both modes. Override with ?margin=N on the route.
export const DEFAULT_MARGIN: Record<CloseMode, number> = { final: 3, live: 3 };

// Tiers are "within" limits (inclusive): tier 0 is within 1 point, tier 1 within 2, tier 2 up to the margin (3).
const TIER_LIMITS: [number, number] = [1, 2];

export const TIER_LABELS: Record<CloseMode, [string, string, string]> = {
  final: ["PHOTO FINISH", "NAIL-BITER", "CLOSE ONE"],
  live: ["DEAD HEAT", "TOO CLOSE TO CALL", "TIGHT ONE"],
};

export function pickCloseMatchups(matchups: Matchup[], mode: CloseMode, margin: number): CloseGame[] {
  const games: CloseGame[] = [];
  for (const m of matchups) {
    if (m.homeTeamId == null || m.awayTeamId == null) continue;
    if (mode === "final" ? !m.isFinal : m.isFinal) continue;
    // A week nobody has scored in yet is 0-0 everywhere: that is "not started", not "close".
    if (mode === "live" && m.homeScore + m.awayScore <= 0) continue;

    const diff = Math.round(Math.abs(m.homeScore - m.awayScore) * 100) / 100;
    if (diff > margin) continue;

    games.push({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      margin: diff,
      leaderId: diff === 0 ? null : m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId,
      tier: diff <= TIER_LIMITS[0] ? 0 : diff <= TIER_LIMITS[1] ? 1 : 2,
    });
  }
  games.sort((a, b) => a.margin - b.margin);
  return games;
}

// ---------------------------------------------------------------- days left in the week
const DAY_MS = 86400000;

// Today's date in the league's time zone, as YYYY-MM-DD.
export function torontoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(now);
}

// Whole-day (UTC midnight) value for a date string. ISO strings are read as written; anything
// else goes through Date.parse and uses its local calendar parts.
function dayValue(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

// Days still to play in matchup week `week`, counting today (today's games may not be done).
// Uses the Week Days calendar (start date + each week's length). Returns null when the calendar
// can't answer or the week is already over, so the graphic simply leaves the line off.
export function daysLeftInWeek(
  startDate: unknown,
  lengths: readonly number[] | null | undefined,
  week: number,
  today: string = torontoToday()
): number | null {
  if (!lengths || week < 1 || week > lengths.length) return null;
  const start = dayValue(startDate);
  const now = dayValue(today);
  if (start == null || now == null) return null;
  let daysBefore = 0;
  for (let i = 0; i < week - 1; i++) daysBefore += Number(lengths[i]) || 0;
  const len = Number(lengths[week - 1]) || 0;
  if (len <= 0) return null;
  const lastDay = start + (daysBefore + len - 1) * DAY_MS;
  const left = Math.round((lastDay - now) / DAY_MS) + 1;
  return left >= 1 ? Math.min(left, len) : null;
}

// "2 DAYS LEFT" / "LAST DAY" / "" (unknown or none left).
export function daysLeftText(daysLeft: number | null): string {
  if (daysLeft == null || daysLeft <= 0) return "";
  return daysLeft === 1 ? "LAST DAY" : `${daysLeft} DAYS LEFT`;
}

// Ready-to-post text for the Copy caption button.
export function closeMatchupsCaption(
  week: number,
  mode: CloseMode,
  games: CloseGame[],
  teamName: (id: number) => string,
  daysLeft: number | null,
  gamesLeft?: Record<number, number> // live only: starter-games each team still has to play
): string {
  const left = daysLeftText(daysLeft);
  const head =
    mode === "live"
      ? `Week ${week}: closest matchups right now${left ? ` (${left.toLowerCase()})` : ""}`
      : `Week ${week}: closest finishes`;
  const lines = games.map((g) => {
    const homeLeads = g.homeScore >= g.awayScore;
    const topId = homeLeads ? g.homeTeamId : g.awayTeamId;
    const botId = homeLeads ? g.awayTeamId : g.homeTeamId;
    const top = (homeLeads ? g.homeScore : g.awayScore).toFixed(2);
    const bot = (homeLeads ? g.awayScore : g.homeScore).toFixed(2);
    const gl =
      mode === "live" && gamesLeft && gamesLeft[topId] !== undefined && gamesLeft[botId] !== undefined
        ? ` | Games left: ${teamName(topId)} ${gamesLeft[topId]}, ${teamName(botId)} ${gamesLeft[botId]}`
        : "";
    if (g.margin === 0) return `${teamName(topId)} ${top} - ${teamName(botId)} ${bot} (tied)${gl}`;
    return mode === "live"
      ? `${teamName(topId)} ${top} leads ${teamName(botId)} ${bot} by ${g.margin.toFixed(2)}${gl}`
      : `${teamName(topId)} ${top} def. ${teamName(botId)} ${bot} (by ${g.margin.toFixed(2)})`;
  });
  return [head, "", ...lines].join("\n");
}
