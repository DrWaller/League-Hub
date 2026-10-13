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

function parseGeneric(text: string): PasteResult {
  const picks: PastedPick[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const clean = text.replace(/^﻿/, "");
  // Each line is split on tabs if it has any, otherwise as a CSV line (so quoted commas survive).
  const grid: string[][] = clean
    .split(/\r?\n/)
    .map((line) => (line.includes("\t") ? line.split("\t") : (parseCsv(line)[0] ?? [])))
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (grid.length === 0) return { picks, warnings, errors };

  // Header row: the first row where a "player" column is named.
  const headerNorm = grid[0].map(norm);
  const find = (names: string[]) => headerNorm.findIndex((h) => names.includes(h));
  const col = { player: find(HEADERS.player), team: find(HEADERS.team), position: find(HEADERS.position), overall: find(HEADERS.overall), pick: find(HEADERS.pick), round: find(HEADERS.round), keeper: find(HEADERS.keeper) };

  if (col.player >= 0) {
    const body = grid.slice(1);
    const num = (v: string | undefined) => (v && /^#?\d+\.?\d*$/.test(v) ? Math.round(Number(v.replace("#", ""))) : null);
    const teamsInFirstRound = col.round >= 0 && col.pick >= 0 ? body.filter((r) => num(r[col.round]) === 1).length : 0;
    const maxPick = col.pick >= 0 ? Math.max(0, ...body.map((r) => num(r[col.pick]) ?? 0)) : 0;
    const teams = teamsInFirstRound || maxPick || 10;
    body.forEach((r, i) => {
      const { name, position: posFromName } = cleanPlayer(r[col.player] ?? "");
      if (!name) return;
      let overall: number | null = null;
      if (col.overall >= 0) overall = num(r[col.overall]);
      else if (col.round >= 0 && col.pick >= 0) {
        const rd = num(r[col.round]);
        const pk = num(r[col.pick]);
        if (rd != null && pk != null) overall = (rd - 1) * teams + pk;
      } else if (col.pick >= 0) overall = num(r[col.pick]);
      const rawPos = col.position >= 0 ? (r[col.position] ?? "").split(/[\s,\/]+/)[0]?.toUpperCase() : "";
      const position = POSITIONS.has(rawPos) ? (rawPos === "W" ? "RW" : rawPos) : posFromName;
      const keeper = col.keeper >= 0 ? KEEPER_WORDS.has((r[col.keeper] ?? "").trim().toLowerCase()) : false;
      picks.push({ overall: overall ?? i + 1, team: col.team >= 0 ? r[col.team] ?? "" : "", player: name, position, keeper });
    });
    if (col.overall < 0 && col.pick < 0) warnings.push("No pick column found, so picks were numbered in file order.");
  } else {
    // Plain lines, no header.
    grid.forEach((fields0, i) => {
      const fields = fields0.filter((f) => f !== "");
      if (fields.length === 0) return;
      let overall: number | null = null;
      if (/^#?\d+\.?$/.test(fields[0])) overall = Number(fields[0].replace(/\D/g, ""));
      else if (i === 0 && fields.length >= 2 && !/\d/.test(fields.join(""))) return; // header-looking row of words
      const rest = overall !== null ? fields.slice(1) : fields;
      let position = "";
      let keeper = false;
      const names: string[] = [];
      for (const f of rest) {
        if (KEEPER_WORDS.has(f.toLowerCase()) && f.length <= 7) keeper = true;
        else if (POSITIONS.has(f.toUpperCase())) position = f.toUpperCase() === "W" ? "RW" : f.toUpperCase();
        else names.push(f);
      }
      if (names.length === 0) {
        errors.push(`Line ${i + 1}: no player found ("${fields.join(", ").slice(0, 40)}").`);
        return;
      }
      const raw = names.length >= 2 ? names[1] : names[0];
      const { name, position: posFromName } = cleanPlayer(raw);
      picks.push({ overall: overall ?? picks.length + 1, team: names.length >= 2 ? names[0] : "", player: name, position: position || posFromName, keeper });
    });
  }

  return finish(picks, warnings, errors);
}
