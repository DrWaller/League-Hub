// Placeholder data used whenever ESPN credentials aren't configured yet
// (see lib/espn.ts) or whenever a live fetch fails. This keeps every page
// on the site fully working -- with clearly fake numbers -- before you've
// added ESPN_S2 / ESPN_SWID, and as a safety net afterward.

import { Team, Matchup, Roster, SeasonHistory } from "@/lib/types";

export const MOCK_LEAGUE_NAME = "Fantasy Hockey League";
export const MOCK_LEAGUE_SIZE = 10;
export const MOCK_CURRENT_WEEK = 3;
export const MOCK_SEASON = 2027;

export const MOCK_TEAMS: Team[] = [
  { id: 1, name: "Zamboni Drivers", abbrev: "ZAM", wins: 3, losses: 0, ties: 0, pointsFor: 412, pointsAgainst: 351, streak: "W3" },
  { id: 2, name: "Slapshot Serenade", abbrev: "SLP", wins: 2, losses: 1, ties: 0, pointsFor: 398, pointsAgainst: 372, streak: "W1" },
  { id: 3, name: "Glove Save Gang", abbrev: "GSG", wins: 2, losses: 1, ties: 0, pointsFor: 385, pointsAgainst: 360, streak: "L1" },
  { id: 4, name: "Icing on the Cake", abbrev: "ICE", wins: 2, losses: 1, ties: 0, pointsFor: 379, pointsAgainst: 366, streak: "W1" },
  { id: 5, name: "Fifth Line Heroes", abbrev: "5LH", wins: 2, losses: 1, ties: 0, pointsFor: 370, pointsAgainst: 358, streak: "W2" },
  { id: 6, name: "Offside Trap", abbrev: "OFF", wins: 1, losses: 2, ties: 0, pointsFor: 360, pointsAgainst: 365, streak: "L2" },
  { id: 7, name: "Boarding Pass", abbrev: "BRD", wins: 1, losses: 2, ties: 0, pointsFor: 355, pointsAgainst: 380, streak: "L1" },
  { id: 8, name: "Empty Net Energy", abbrev: "ENE", wins: 1, losses: 2, ties: 0, pointsFor: 340, pointsAgainst: 371, streak: "W1" },
  { id: 9, name: "Hat Trick Heist", abbrev: "HTH", wins: 0, losses: 3, ties: 0, pointsFor: 330, pointsAgainst: 395, streak: "L3" },
  { id: 10, name: "Puck Norris", abbrev: "PKN", wins: 0, losses: 3, ties: 0, pointsFor: 320, pointsAgainst: 388, streak: "L2" },
];

export const MOCK_MATCHUPS: Matchup[] = [
  { week: 3, homeTeamId: 1, homeScore: 148, awayTeamId: 9, awayScore: 121, isFinal: true },
  { week: 3, homeTeamId: 2, homeScore: 139, awayTeamId: 7, awayScore: 133, isFinal: true },
  { week: 3, homeTeamId: 3, homeScore: 129, awayTeamId: 8, awayScore: 118, isFinal: true },
  { week: 3, homeTeamId: 4, homeScore: 126, awayTeamId: 6, awayScore: 124, isFinal: true },
  { week: 3, homeTeamId: 5, homeScore: 131, awayTeamId: 10, awayScore: 109, isFinal: true },
];

export const MOCK_ROSTERS: Roster[] = MOCK_TEAMS.map((t) => ({
  teamId: t.id,
  players: [
    { id: t.id * 100 + 1, name: "Sample Center", position: "C", proTeam: "TOR", points: 42.1 },
    { id: t.id * 100 + 2, name: "Sample Wing", position: "LW", proTeam: "EDM", points: 38.4 },
    { id: t.id * 100 + 3, name: "Sample Defenseman", position: "D", proTeam: "COL", points: 31.7 },
    { id: t.id * 100 + 4, name: "Sample Goalie", position: "G", proTeam: "NYR", points: 22.9 },
  ],
}));

// League history is curated by hand rather than pulled from ESPN, since
// ESPN's own "League History" tab doesn't reflect the one season played
// on Fantrax or accurately caption the COVID-shortened season. Edit this
// array directly to add a season, fix a name, or adjust a note -- nothing
// else in the app needs to change.
export const LEAGUE_HISTORY: SeasonHistory[] = [
  {
    year: 2026,
    champion: "TBD",
    runnerUp: "TBD",
    regularSeasonLeader: "TBD",
    note: "In progress.",
  },
  {
    year: 2025,
    champion: "Sample Champion 2025",
    runnerUp: "Sample Runner-up 2025",
    regularSeasonLeader: "Sample Leader 2025",
  },
  {
    year: 2024,
    champion: "Sample Champion 2024",
    runnerUp: "Sample Runner-up 2024",
    regularSeasonLeader: "Sample Leader 2024",
  },
  {
    year: 2023,
    champion: "Sample Champion 2023",
    runnerUp: "Sample Runner-up 2023",
    regularSeasonLeader: "Sample Leader 2023",
    tags: ["Played on Fantrax"],
    note: "Played on Fantrax instead of ESPN this season.",
  },
  {
    year: 2022,
    champion: "Sample Champion 2022",
    runnerUp: "Sample Runner-up 2022",
    regularSeasonLeader: "Sample Leader 2022",
  },
  {
    year: 2021,
    champion: "Sample Champion 2021",
    runnerUp: "Sample Runner-up 2021",
    regularSeasonLeader: "Sample Leader 2021",
    tags: ["COVID-shortened"],
    note: "Season ended early due to COVID-19.",
  },
];
