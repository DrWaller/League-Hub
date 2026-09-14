// Shared shapes used across the app. Kept intentionally loose (a lot of
// `?` optional fields) because ESPN's fantasy API is unofficial and
// undocumented -- fields can be missing or renamed without notice.

export interface Team {
  id: number;
  name: string;
  abbrev: string;
  logo?: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak?: string; // e.g. "W3", "L1"
}

export interface Matchup {
  week: number;
  homeTeamId: number;
  homeScore: number;
  awayTeamId: number;
  awayScore: number;
  isFinal: boolean;
}

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  proTeam: string;
  points: number;
}

export interface Roster {
  teamId: number;
  players: RosterPlayer[];
}

export interface PowerRankingEntry {
  teamId: number;
  score: number;
  rank: number;
  previousRank?: number;
}

export type HistoryTag = "COVID-shortened" | "Played on Fantrax";

export interface SeasonHistory {
  year: number;
  champion: string;
  runnerUp: string;
  regularSeasonLeader: string;
  tags?: HistoryTag[];
  note?: string;
}

export interface LeagueMeta {
  name: string;
  size: number;
  currentWeek: number;
  season: number;
  liveDataConnected: boolean;
}

// --- Editorial content (stored in Postgres, edited via /admin) ---

export const AWARD_CATEGORIES = [
  "star1",
  "star2",
  "star3",
  "forward",
  "forward_runner_up",
  "defense",
  "defense_runner_up",
  "goalie",
  "goalie_runner_up",
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export const AWARD_LABELS: Record<AwardCategory, string> = {
  star1: "1st Star",
  star2: "2nd Star",
  star3: "3rd Star",
  forward: "Forward of the Week",
  forward_runner_up: "Forward Runner-up",
  defense: "Defenseman of the Week",
  defense_runner_up: "Defenseman Runner-up",
  goalie: "Goalie of the Week",
  goalie_runner_up: "Goalie Runner-up",
};

export interface WeeklyAward {
  season: number;
  week: number;
  category: AwardCategory;
  playerName: string;
  teamId: number | null;
  note: string | null;
}

export interface MatchupContent {
  season: number;
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  preview: string | null;
  summary: string | null;
}

export interface KeeperRecord {
  id: number;
  season: number;
  teamId: number;
  playerName: string;
  note: string | null;
}
