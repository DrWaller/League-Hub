// Ready-to-post captions for the weekly graphics. Each graphic route returns one
// when called with &caption=1; the "Copy caption" button on the Graphics page
// fetches it and puts it on the clipboard. Plain text only.

import { getWeekCalendar } from "./week-calendar";
import { dateRanges } from "./week-calendar-utils";

export function captionResponse(text: string) {
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

// "Sep 29 - Oct 4" for a week of the CURRENT season (needs the Week Days calendar); "" otherwise.
export async function weekDatesText(season: number, currentSeason: number, week: number): Promise<string> {
  if (season !== currentSeason || !week) return "";
  try {
    const cal = await getWeekCalendar(season);
    const range = cal ? dateRanges(cal.startDate, cal.lengths)[week - 1] : "";
    return range ? range.replace(/[A-Z][a-z]{2}, /g, "") : "";
  } catch {
    return "";
  }
}

const TAG = "#FantasyHockey";

export function weekLine(season: number, currentSeason: number, week: number, dates: string) {
  const base = season === currentSeason ? `Week ${week}` : `${season} - Week ${week}`;
  return dates ? `${base} (${dates})` : base;
}

export interface CaptionPlayer {
  name: string;
  team: string;
  points: number;
  line?: string | null; // "4 G · 4 A · 10 SOG"
  pos?: string;
}

export function playersCaption(title: string, when: string, players: CaptionPlayer[], numbered = true): string {
  const lines = players.map((p, i) => `${numbered ? `${i + 1}) ` : ""}${p.name} (${p.team}) - ${p.points.toFixed(2)} pts${p.line ? `\n    ${p.line}` : ""}`);
  return [`${title.toUpperCase()}`, when, "", ...lines, "", TAG].join("\n");
}

export function lineupCaption(when: string, lineup: { slot: string; name: string; team: string; points: number }[]): string {
  const best = [...lineup].sort((a, b) => b.points - a.points)[0];
  const lines = lineup.map((l) => `${l.slot}: ${l.name} (${l.team}) - ${l.points.toFixed(2)}`);
  return ["TEAM OF THE WEEK", when, "", ...lines, ...(best ? ["", `Week high: ${best.name} (${best.points.toFixed(2)})`] : []), "", TAG].join("\n");
}

export function standingsCaption(subtitle: string, rows: { name: string; record: string }[], cutoff: number): string {
  const lines: string[] = [];
  rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.name} (${r.record})`);
    if (i + 1 === cutoff && i < rows.length - 1) lines.push("--- playoff line ---");
  });
  return ["STANDINGS", subtitle, "", ...lines, "", TAG].join("\n");
}

export function rankingsCaption(when: string, rows: { rank: number; name: string; change: number | null }[]): string {
  const lines = rows.map((r) => `${r.rank}. ${r.name}${r.change ? ` (${r.change > 0 ? "up" : "down"} ${Math.abs(r.change)})` : ""}`);
  return ["POWER RANKINGS", when, "", ...lines, "", TAG].join("\n");
}

export function scoreboardCaption(when: string, games: { winner: string; winScore: number; loser: string; loseScore: number; tie: boolean }[]): string {
  const lines = games.map((g) => (g.tie ? `${g.winner} ${g.winScore.toFixed(2)}, ${g.loser} ${g.loseScore.toFixed(2)} (tie)` : `${g.winner} ${g.winScore.toFixed(2)} def. ${g.loser} ${g.loseScore.toFixed(2)}`));
  return ["SCOREBOARD", when, "", ...lines, "", TAG].join("\n");
}

export function previewCaption(when: string, games: { a: string; b: string; series?: string }[]): string {
  const lines = games.map((g) => `${g.a} vs ${g.b}${g.series ? `\n    ${g.series}` : ""}`);
  return ["MATCHUPS", when, "", ...lines, "", TAG].join("\n");
}

export function luckCaption(when: string, luckiest: string | null, unluckiest: string | null): string {
  return ["LUCK CHART", when, "", ...(luckiest ? [`Luckiest: ${luckiest}`] : []), ...(unluckiest ? [`Unluckiest: ${unluckiest}`] : []), "", TAG].join("\n");
}
