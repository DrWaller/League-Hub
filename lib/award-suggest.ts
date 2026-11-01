// Server-side only. Picks award winners from real stats: pure computation, no AI, no extra cost.
// Shared by the admin "Suggest from stats" buttons and the nightly auto-generation, so both always agree.

import { getWeeklyPlayerStats, getMonthlyPlayerStats, getLeagueMeta } from "./espn";
import { getWeekVor, getPeriodVor } from "./vor";
import { AwardCategory } from "./types";

// Best by value over replacement when the players carry it, else by raw points.
type Ranked = { name: string; position: string; teamId: number; points: number; vor?: number };
function top(players: Ranked[], n: number) {
  return [...players].sort((a, b) => (b.vor ?? b.points) - (a.vor ?? a.points) || b.points - a.points).slice(0, n);
}

export type AwardSuggestion = { playerName: string; teamId: number; points: number; vor?: number };
export type AwardSuggestions = Record<AwardCategory, AwardSuggestion | null>;
export type SuggestResult = { live: boolean; suggestions: AwardSuggestions | null; message?: string };

const toEntry = (p?: { name: string; teamId: number; points: number; vor?: number }): AwardSuggestion | null =>
  p ? { playerName: p.name, teamId: p.teamId, points: p.points, vor: p.vor } : null;

// The 3 Stars are the most valuable players over replacement, so a goalie and a forward compete fairly.
// If VOR can't be worked out, fall back to raw points.
function build(players: Ranked[], vorPlayers: Ranked[] | null): AwardSuggestions {
  const [star1, star2, star3] = vorPlayers ? vorPlayers.slice(0, 3) : top(players, 3);
  const ranked: Ranked[] = vorPlayers ?? players;
  const forwards = ranked.filter((p) => ["C", "LW", "RW"].includes(p.position));
  const defense = ranked.filter((p) => p.position === "D");
  const goalies = ranked.filter((p) => p.position === "G");
  const [fwd1, fwd2] = top(forwards, 2);
  const [def1, def2] = top(defense, 2);
  const [g1, g2] = top(goalies, 2);
  return {
    star1: toEntry(star1),
    star2: toEntry(star2),
    star3: toEntry(star3),
    forward: toEntry(fwd1),
    forward_runner_up: toEntry(fwd2),
    defense: toEntry(def1),
    defense_runner_up: toEntry(def2),
    goalie: toEntry(g1),
    goalie_runner_up: toEntry(g2),
  };
}

export async function suggestWeeklyAwards(week: number): Promise<SuggestResult> {
  const { players, live } = await getWeeklyPlayerStats(week);
  if (!live || players.length === 0) {
    return {
      live,
      suggestions: null,
      message: live
        ? "No stats posted for this week yet."
        : "ESPN isn't connected, so there's no real stat data to suggest from.",
    };
  }
  const meta = await getLeagueMeta();
  const vor = await getWeekVor(week, meta.season, meta.season).catch(() => null);
  return { live, suggestions: build(players, vor ? vor.players : null) };
}

export async function suggestMonthlyAwards(startWeek: number, endWeek: number): Promise<SuggestResult> {
  const { players, live } = await getMonthlyPlayerStats(startWeek, endWeek);
  if (!live || players.length === 0) {
    return {
      live,
      suggestions: null,
      message: live ? "No stats posted for this range yet." : "ESPN isn't connected.",
    };
  }
  // 3 Stars of the Month: most total value over replacement across the weeks (fallback: raw points).
  const meta = await getLeagueMeta();
  const vor = await getPeriodVor(startWeek, endWeek, meta.season, meta.season).catch(() => null);
  return { live, suggestions: build(players, vor ? vor.players : null) };
}

// The note saved next to each winner, written exactly like the admin form writes it (two decimals).
export function awardNote(s: AwardSuggestion): string {
  const vor = typeof s.vor === "number" ? ` · ${s.vor >= 0 ? "+" : ""}${s.vor.toFixed(2)} VOR` : "";
  return `${s.points.toFixed(2)} pts${vor}`;
}
