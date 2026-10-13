// Pure helpers: reads a pasted or uploaded draft (for a season played on another platform) into picks.
//
// Two shapes are understood:
//  1. A CSV or pasted table WITH a header row (like Fantrax's draft-results download): the columns are found by name
//     (Pick / Overall / #, Round, Team, Player, Pos, Keeper). If there is a Round and a within-round Pick, the overall
//     pick is worked out from them.
//  2. Plain lines, one pick each: "pick, team, player, position, keeper". Pick is optional (picks are then numbered in
//     order); position and keeper can be in any order after the team and player.

import { parseCsv } from "./keeper-import";

export interface PastedPick {
  overall: number;
  team: string;
  player: string;
  position: string;
  keeper: boolean;
  nhl?: string; // NHL team abbreviation when the paste includes it (like ESPN's web draft page)
}

export interface PasteResult {
  picks: PastedPick[];
  warnings: string[];
  errors: string[];
}

const POSITIONS = new Set(["C", "LW", "RW", "W", "D", "G", "F", "LD", "RD"]);
const KEEPER_WORDS = new Set(["k", "keeper", "keep", "kept", "yes", "y", "true", "x", "1"]);

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9#]/g, "");
const HEADERS = {
  player: ["player", "name", "playername"],
  team: ["team", "fantasyteam", "franchise", "owner", "manager", "teamname"],
  position: ["pos", "position", "positions"],
  overall: ["overall", "pickoverall", "overallpick", "overallpickno", "#", "no", "pickno", "pick#"],
  pick: ["pick"],
  round: ["round", "rd", "rnd"],
  keeper: ["keeper", "keep", "kept", "iskeeper"],
};

function cleanPlayer(raw: string): { name: string; position: string } {
  let name = raw.trim();
  let position = "";
  const paren = name.match(/\(([^)]*)\)\s*$/);
  if (paren) {
    const bits = paren[1].split(/[\s,\-\/|]+/).filter(Boolean);
    const pos = bits.filter((b) => POSITIONS.has(b.toUpperCase()));
    if (pos.length > 0) position = pos[0].toUpperCase() === "W" ? "RW" : pos[0].toUpperCase();
    name = name.slice(0, paren.index).trim();
  }
  return { name, position };
}

// Old ESPN web abbreviations -> the ones the site uses everywhere else.
const NHL_FIX: Record<string, string> = { VGS: "VGK", CLS: "CBJ", MON: "MTL", WAS: "WSH", PHX: "ARI", TAM: "TB", LAK: "LA", SJS: "SJ", NJD: "NJ", TBL: "TB" };
const nhlAbbrev = (a: string) => {
  const u = a.toUpperCase();
  return NHL_FIX[u] ?? u;
};

// ESPN's draft-results page copied straight off the web: "Round 1", then NO. / Player / Team headings, then for each
// pick three lines: the pick within the round, "Player Name TOR, C", and the fantasy team's name.
function parseEspnWeb(lines: string[]): PasteResult | null {
  if (!lines.some((l) => /^round\s+\d+$/i.test(l))) return null;
  const picks: PastedPick[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let round = 0;
  let teams = 0;
  const rows: { round: number; pick: number; player: string; team: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rm = lines[i].match(/^round\s+(\d+)$/i);
    if (rm) {
      round = Number(rm[1]);
      continue;
    }
    if (/^(no\.?|player|team)$/i.test(lines[i])) continue;
    if (round > 0 && /^\d+$/.test(lines[i]) && i + 2 < lines.length) {
      rows.push({ round, pick: Number(lines[i]), player: lines[i + 1], team: lines[i + 2] });
      i += 2;
    }
  }
  teams = Math.max(0, ...rows.filter((r) => r.round === 1).map((r) => r.pick)) || 10;
  for (const r of rows) {
    const m = r.player.match(/^(.*?)\s+([A-Za-z]{2,4}),\s*([A-Za-z]{1,2})(?:\/[A-Za-z]{1,2})?\s*$/);
    const name = (m ? m[1] : r.player).trim();
    const pos = m ? m[3].toUpperCase() : "";
    picks.push({ overall: (r.round - 1) * teams + r.pick, team: r.team, player: name, position: pos === "W" ? "RW" : pos, keeper: false, nhl: m ? nhlAbbrev(m[2]) : undefined });
    if (!m) warnings.push(`Round ${r.round} pick ${r.pick}: no team/position found on "${r.player.slice(0, 40)}".`);
  }
  warnings.unshift(`Read as ESPN's draft page: ${rows.length} picks, ${teams} teams, ${round} rounds.`);
  return { picks, warnings, errors };
}

export function parseDraftPaste(text: string): PasteResult {
  const pre = parseEspnWeb(text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  if (pre) return finish(pre.picks, pre.warnings, pre.errors);
  return parseGeneric(text);
}

function finish(picks: PastedPick[], warnings: string[], errors: string[]): PasteResult {
  const seen = new Set<number>();
  for (const p of picks) {
    if (seen.has(p.overall)) errors.push(`Pick ${p.overall} appears more than once.`);
    seen.add(p.overall);
  }
  if (picks.length > 0) {
    const max = Math.max(...picks.map((p) => p.overall));
    const missing: number[] = [];
    for (let n = 1; n <= max; n++) if (!seen.has(n)) missing.push(n);
    if (missing.length > 0) warnings.push(`Missing pick number(s): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? "..." : ""}.`);
  }
  if (picks.some((p) => p.team === "")) warnings.push("Some picks have no team name.");
  picks.sort((a, b) => a.overall - b.overall);
  return { picks, warnings, errors };
}
