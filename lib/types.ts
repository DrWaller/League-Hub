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
  isPlayoff?: boolean; // true for postseason games (left out of every regular-season total)
  isExcluded?: boolean; // the commissioner marked this game as not counting (e.g. played after elimination)
}

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  proTeam: string;
  points: number;
}

export interface WeeklyPlayerStat {
  id: number;
  name: string;
  position: string; // C, LW, RW, D, G
  teamId: number;
  points: number; // actual fantasy points for that one specific week
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

// --- Managers (persistent owner identity across team-name/ID changes) ---

export interface Manager {
  id: number;
  name: string;
  notes: string | null;
}

export interface ManagerSeason {
  id: number;
  managerId: number | null; // null until someone assigns a manager to this row
  teamId: number; // ESPN team id for that season
  season: number;
  teamName: string; // team's display name that specific season
  recordNote: string | null; // free text, e.g. "lost in semis" -- separate from the real record below
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
}

export interface Trade {
  id: number;
  season: number;
  week: number | null;
  playerName: string;
  fromManagerId: number | null;
  toManagerId: number | null;
  note: string | null;
}

// --- Monthly awards ---

export interface MonthlyPeriod {
  id: number;
  season: number;
  label: string; // e.g. "October 2026" -- admin's own wording
  startWeek: number;
  endWeek: number;
}

export interface MonthlyAward {
  season: number;
  periodLabel: string;
  category: AwardCategory;
  playerName: string;
  teamId: number | null;
  note: string | null;
}

// --- Newsletter ---

export type NewsletterPeriodType = "week" | "month";

export interface NewsletterIntro {
  season: number;
  periodType: NewsletterPeriodType;
  periodKey: string; // a week number as a string, or a monthly period's label
  introText: string;
}


// League History entries the commissioner writes by hand (champion, runner-up,
// notes on odd seasons). The standings under each season come from ESPN.
export const KNOWN_HISTORY_TAGS = ["COVID-shortened", "Played on Fantrax"] as const;

// A season carrying this tag was played somewhere other than ESPN, so the
// site must never show ESPN's data for it (standings, records, luck charts,
// matchups, rosters) -- whatever ESPN happens to hold for that year isn't
// the league's real history.
export const PLAYED_ELSEWHERE_TAG = "Played on Fantrax";

export interface SeasonHistoryRecord {
  season: number;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null; // playoff third-place finisher (the third-place game winner)
  tags: string[];
  note: string | null;
}


// --- Seasons played on another platform, entered by hand ---

export interface ManualTeam {
  id: number;
  season: number;
  name: string;
  managerId: number | null;
}
