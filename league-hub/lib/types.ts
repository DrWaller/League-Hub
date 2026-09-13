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
