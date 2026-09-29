// Pure logic for a season played on another platform (Fantrax) whose weekly
// scores are entered by hand: parsing the pasted scores, and working out
// standings from them. No database or network in here, so it's testable.

import { Matchup } from "./types";

export interface ParsedGame {
  week: number;
  home: string;
  homeScore: number;
  away: string;
  awayScore: number;
  playoff: boolean;
}

export interface ParseResult {
  games: ParsedGame[];
  teams: string[]; // canonical team names, in order first seen
  errors: string[]; // anything here blocks saving
  warnings: string[]; // worth a look, but doesn't block
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const keyOf = (s: string) => collapse(s).toLowerCase();

// Splits one line on commas (or tabs), honouring "double quotes" so a team
// name containing a comma can be written as "Name, With Comma".
function splitLine(line: string): string[] {
  const delim = line.includes("\t") ? "\t" : ",";
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const isPlayoffFlag = (v: string) => ["playoff", "playoffs", "p", "yes", "true", "1"].includes(v.trim().toLowerCase());

// One game per line:  week, home team, home score, away team, away score [, playoff]
export function parseScores(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const games: ParsedGame[] = [];
  const canonical = new Map<string, string>(); // normalised key -> first-seen spelling

  const lines = text.split(/\r?\n/);
  let headerSkipped = false;

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    const f = splitLine(line);
    // Allow a header row like "week,home,home score,away,away score"
    if (!headerSkipped && games.length === 0 && Number.isNaN(Number(f[0])) && /week/i.test(f[0])) {
      headerSkipped = true;
      return;
    }
    if (f.length < 5) {
      errors.push(`Line ${lineNo}: expected week, home team, home score, away team, away score (found ${f.length} value${f.length === 1 ? "" : "s"}). If a team name contains a comma, put it in "quotes".`);
      return;
    }
    if (f.length > 6) {
      errors.push(`Line ${lineNo}: too many values (${f.length}). If a team name contains a comma, put it in "quotes".`);
      return;
    }

    const week = Number(f[0]);
    const homeScore = Number(f[2]);
    const awayScore = Number(f[4]);
    const home = collapse(f[1]);
    const away = collapse(f[3]);

    if (!Number.isInteger(week) || week < 1) {
      errors.push(`Line ${lineNo}: "${f[0]}" isn't a valid week number.`);
      return;
    }
    if (!home || !away) {
      errors.push(`Line ${lineNo}: a team name is missing.`);
      return;
    }
    if (f[2] === "" || Number.isNaN(homeScore) || f[4] === "" || Number.isNaN(awayScore)) {
      errors.push(
        `Line ${lineNo}: a score isn't a number ("${f[2]}" / "${f[4]}"). If a team name contains a comma, put that name in "quotes".`
      );
      return;
    }
    if (keyOf(home) === keyOf(away)) {
      errors.push(`Line ${lineNo}: "${home}" is playing itself.`);
      return;
    }

    for (const name of [home, away]) if (!canonical.has(keyOf(name))) canonical.set(keyOf(name), name);
    games.push({
      week,
      home: canonical.get(keyOf(home))!,
      homeScore,
      away: canonical.get(keyOf(away))!,
      awayScore,
      playoff: f[5] !== undefined && isPlayoffFlag(f[5]),
    });
  });

  if (games.length === 0 && errors.length === 0) errors.push("No games found. Paste one game per line.");

  // A team can't play twice in the same regular-season week.
  const seen = new Set<string>();
  for (const g of games.filter((x) => !x.playoff)) {
    for (const t of [g.home, g.away]) {
      const k = `${g.week}|${keyOf(t)}`;
      if (seen.has(k)) errors.push(`Week ${g.week}: "${t}" appears in more than one game.`);
      seen.add(k);
    }
  }

  // Softer sanity checks that usually reveal a typo'd team name or a missing
  // game. Skipped while there are hard errors: they'd be judging a partial paste.
  const regular = errors.length ? [] : games.filter((g) => !g.playoff);
  const perWeek = new Map<number, number>();
  regular.forEach((g) => perWeek.set(g.week, (perWeek.get(g.week) ?? 0) + 1));
  if (perWeek.size) {
    const counts = Array.from(perWeek.values());
    const modal = counts.sort((a, b) => counts.filter((v) => v === b).length - counts.filter((v) => v === a).length)[0];
    const plural = (n: number) => `${n} game${n === 1 ? "" : "s"}`;
    const odd = Array.from(perWeek.entries()).filter(([, c]) => c !== modal).map(([w, c]) => `week ${w} has ${c}`);
    if (odd.length) warnings.push(`Most weeks have ${plural(modal)}, but ${odd.join(", ")}. A game may be missing or doubled.`);
    const regTeams = new Set(regular.flatMap((g) => [keyOf(g.home), keyOf(g.away)]));
    if (regTeams.size > modal * 2)
      warnings.push(`${regTeams.size} different team names appear but ${plural(modal)} a week only fits ${modal * 2} teams. Check for a misspelled or renamed team.`);
  }

  return { games, teams: Array.from(canonical.values()), errors, warnings };
}

export interface StandingsRow {
  id: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

// Regular-season standings worked out from completed games. Ranked by
// win-loss, then points for. Teams with no games still appear.
export function computeStandings(teams: { id: number; name: string }[], matchups: Matchup[]): StandingsRow[] {
  const rows = new Map<number, StandingsRow>(
    teams.map((t) => [t.id, { id: t.id, name: t.name, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }])
  );
  for (const m of matchups) {
    if (!m.isFinal || m.isPlayoff || m.isExcluded) continue;
    const h = rows.get(m.homeTeamId);
    const a = rows.get(m.awayTeamId);
    if (!h || !a) continue;
    h.pointsFor += m.homeScore;
    h.pointsAgainst += m.awayScore;
    a.pointsFor += m.awayScore;
    a.pointsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.wins++;
      a.losses++;
    } else if (m.awayScore > m.homeScore) {
      a.wins++;
      h.losses++;
    } else {
      h.ties++;
      a.ties++;
    }
  }
  return Array.from(rows.values()).sort(
    (x, y) => y.wins - y.losses - (x.wins - x.losses) || y.pointsFor - x.pointsFor
  );
}
