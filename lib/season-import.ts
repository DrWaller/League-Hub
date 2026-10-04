// Import a season that was NOT played on ESPN (your 2025 Fantrax season).
//
//  1. The Fantrax player-pool CSV gives the league's real fantasy points per player (FPts, FP/G),
//     which games played can be recovered from (FPts / FP/G) -- but no category stats.
//  2. The NHL's public stats API gives the raw category stats (goals, assists, shots, hits...).
//  3. The two are matched by name + position (games played settles repeated names).
//  4. Because the league's own points are known, the scoring rules are recovered by fitting the NHL
//     stats to them (least squares), and the fit is reported so it can be checked before saving.
//
// Everything here is pure except fetchNhlSeason(), so it can be tested without the network.

import { parseCsv } from "./keeper-import";

// ------------------------------------------------------------------ Fantrax CSV
export interface FantraxRow {
  fid: string;
  name: string;
  team: string;
  position: string; // as exported, e.g. "C,LW"
  group: "F" | "D" | "G";
  positionId: number; // ESPN-style: 1 C, 2 LW, 3 RW, 4 D, 5 G
  owner: string; // owning fantasy team's short name, or "FA"
  age: number;
  rank: number;
  fpts: number;
  fpg: number;
  gp: number; // recovered: FPts / FP/G
}

const POSITION_ID: Record<string, number> = { C: 1, LW: 2, RW: 3, D: 4, G: 5 };

export function parseFantraxCsv(text: string): { rows: FantraxRow[]; header: string[]; problems: string[] } {
  const grid = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = (grid[0] ?? []).map((h) => h.trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = { fid: col("ID"), name: col("Player"), team: col("Team"), pos: col("Position"), status: col("Status"), age: col("Age"), rank: col("RkOv"), fpts: col("FPts"), fpg: col("FP/G") };
  const problems: string[] = [];
  for (const [k, v] of Object.entries(idx)) if (v === -1 && ["fid", "name", "pos", "fpts", "fpg"].includes(k)) problems.push(`Missing column: ${k}`);
  if (problems.length) return { rows: [], header, problems };

  const rows: FantraxRow[] = [];
  for (const r of grid.slice(1)) {
    const name = (r[idx.name] ?? "").trim();
    if (!name) continue;
    const fpts = Number(r[idx.fpts]);
    const fpg = Number(r[idx.fpg]);
    const posText = (r[idx.pos] ?? "").trim();
    const primary = posText.split(",")[0].trim();
    const positionId = POSITION_ID[primary] ?? 0;
    rows.push({
      fid: (r[idx.fid] ?? "").replace(/\*/g, ""),
      name,
      team: (r[idx.team] ?? "").trim(),
      position: posText,
      group: positionId === 5 ? "G" : positionId === 4 ? "D" : "F",
      positionId,
      owner: (r[idx.status] ?? "").trim() || "FA",
      age: Number(r[idx.age]) || 0,
      rank: Number(r[idx.rank]) || 0,
      fpts: Number.isFinite(fpts) ? fpts : 0,
      fpg: Number.isFinite(fpg) ? fpg : 0,
      gp: fpts && fpg ? Math.round(fpts / fpg) : 0,
    });
  }
  return { rows, header, problems };
}

// ------------------------------------------------------------------ names
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ------------------------------------------------------------------ NHL stats
export interface NhlPlayer {
  nhlId: number;
  name: string;
  team: string; // as listed, e.g. "TOR,COL"
  group: "F" | "D" | "G";
  gp: number;
  stats: Record<string, number>; // candidate stats by short key
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function nhlSeasonId(season: number) {
  return `${season - 1}${season}`; // the 2025 season is 2024-25
}

// Skater keys: G A PPG PPA SHG SHA GWG SOG HIT BLK PIM PM   Goalie keys: W L OTL SO SV GA GS
export function skaterFromRows(summary: any, realtime: any | undefined): NhlPlayer {
  const pp = num(summary.ppGoals);
  const sh = num(summary.shGoals);
  const code = String(summary.positionCode ?? "");
  return {
    nhlId: num(summary.playerId),
    name: String(summary.skaterFullName ?? summary.lastName ?? ""),
    team: String(summary.teamAbbrevs ?? ""),
    group: code === "D" ? "D" : "F",
    gp: num(summary.gamesPlayed),
    stats: {
      G: num(summary.goals),
      A: num(summary.assists),
      PPG: pp,
      PPA: num(summary.ppPoints) - pp,
      SHG: sh,
      SHA: num(summary.shPoints) - sh,
      GWG: num(summary.gameWinningGoals),
      SOG: num(summary.shots),
      HIT: num(realtime?.hits),
      BLK: num(realtime?.blockedShots),
      PIM: num(summary.penaltyMinutes),
      PM: num(summary.plusMinus),
    },
  };
}

export function goalieFromRow(row: any): NhlPlayer {
  return {
    nhlId: num(row.playerId),
    name: String(row.goalieFullName ?? row.lastName ?? ""),
    team: String(row.teamAbbrevs ?? ""),
    group: "G",
    gp: num(row.gamesPlayed),
    stats: { W: num(row.wins), L: num(row.losses), OTL: num(row.otLosses), SO: num(row.shutouts), SV: num(row.saves), GA: num(row.goalsAgainst), GS: num(row.gamesStarted), SA: num(row.shotsAgainst) },
  };
}

export async function fetchNhlSeason(season: number): Promise<{ skaters: NhlPlayer[]; goalies: NhlPlayer[]; fieldsSeen: Record<string, string[]>; errors: string[] }> {
  const base = "https://api.nhle.com/stats/rest/en";
  const q = encodeURIComponent(`seasonId=${nhlSeasonId(season)} and gameTypeId=2`);
  const get = async (path: string) => {
    const res = await fetch(`${base}/${path}?isAggregate=true&isGame=false&start=0&limit=-1&cayenneExp=${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json?.data) ? json.data : []) as any[];
  };
  const errors: string[] = [];
  const safe = async (path: string) => {
    try {
      return await get(path);
    } catch (e) {
      errors.push(String(e));
      return [];
    }
  };
  const [summary, realtime, goalies] = await Promise.all([safe("skater/summary"), safe("skater/realtime"), safe("goalie/summary")]);
  const rt = new Map(realtime.map((r) => [num(r.playerId), r]));
  return {
    skaters: summary.map((s) => skaterFromRows(s, rt.get(num(s.playerId)))),
    goalies: goalies.map(goalieFromRow),
    fieldsSeen: { skaterSummary: Object.keys(summary[0] ?? {}), skaterRealtime: Object.keys(realtime[0] ?? {}), goalieSummary: Object.keys(goalies[0] ?? {}) },
    errors,
  };
}

// ------------------------------------------------------------------ matching
export interface Match {
  fx: FantraxRow;
  nhl: NhlPlayer;
}

export function matchPlayers(fx: FantraxRow[], nhl: NhlPlayer[]) {
  const byKey = new Map<string, NhlPlayer[]>();
  for (const p of nhl) {
    const k = `${p.group}|${normName(p.name)}`;
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  const matched: Match[] = [];
  const unmatched: FantraxRow[] = [];
  const ambiguous: FantraxRow[] = [];
  const used = new Set<number>();
  // Highest points first, so the more important player claims a repeated name.
  for (const row of [...fx].filter((r) => r.gp > 0).sort((a, b) => b.fpts - a.fpts)) {
    const cands = (byKey.get(`${row.group}|${normName(row.name)}`) ?? []).filter((c) => !used.has(c.nhlId));
    if (cands.length === 0) {
      unmatched.push(row);
      continue;
    }
    let best = cands[0];
    if (cands.length > 1) {
      cands.sort((a, b) => Math.abs(a.gp - row.gp) - Math.abs(b.gp - row.gp));
      best = cands[0];
      if (Math.abs(cands[0].gp - row.gp) === Math.abs(cands[1].gp - row.gp)) ambiguous.push(row);
    }
    used.add(best.nhlId);
    matched.push({ fx: row, nhl: best });
  }
  return { matched, unmatched, ambiguous };
}

// ------------------------------------------------------------------ fitting the scoring
export const SKATER_KEYS = ["G", "A", "PPG", "PPA", "SHG", "SHA", "GWG", "SOG", "HIT", "BLK", "PIM", "PM"];
export const GOALIE_KEYS = ["W", "L", "OTL", "SO", "SV", "GA"];

// Solve the normal equations (X'X + ridge) w = X'y by Gaussian elimination.
export function leastSquares(X: number[][], y: number[]): number[] {
  const p = X[0]?.length ?? 0;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p + 1 }, (_, j) => 0 * i * j));
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j];
      A[i][p] += X[r][i] * y[r];
    }
  }
  for (let i = 0; i < p; i++) A[i][i] += 1e-6; // tiny ridge so an all-zero stat can't make it singular
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = c + 1; r < p; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
    }
  }
  const w = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let s = A[i][p];
    for (let j = i + 1; j < p; j++) s -= A[i][j] * w[j];
    w[i] = s / A[i][i];
  }
  return w;
}

// Round a fitted weight to a tidy value (multiples of 0.05) when it is close to one.
export function niceWeight(w: number): number {
  if (Math.abs(w) < 0.02) return 0;
  const r = Math.round(w / 0.05) * 0.05;
  return Math.abs(w - r) < 0.015 ? Math.round(r * 100) / 100 : Math.round(w * 1000) / 1000;
}

export interface Fit {
  keys: string[];
  raw: number[];
  weights: Record<string, number>; // rounded
  n: number;
  r2: number;
  meanAbsError: number;
  within005: number; // share of players predicted to within 0.05 points
  worst: { name: string; actual: number; predicted: number }[];
}

export function fitScoring(matches: Match[], keys: string[]): Fit | null {
  if (matches.length < keys.length + 5) return null;
  const X = matches.map((m) => keys.map((k) => m.nhl.stats[k] ?? 0));
  const y = matches.map((m) => m.fx.fpts);
  const raw = leastSquares(X, y);
  const weights: Record<string, number> = {};
  keys.forEach((k, i) => (weights[k] = niceWeight(raw[i])));
  const pred = X.map((row) => row.reduce((s, v, i) => s + v * weights[keys[i]], 0));
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0) || 1;
  const ssRes = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  const err = y.map((v, i) => Math.abs(v - pred[i]));
  const worst = matches
    .map((m, i) => ({ name: m.fx.name, actual: m.fx.fpts, predicted: Math.round(pred[i] * 100) / 100, e: err[i] }))
    .sort((a, b) => b.e - a.e)
    .slice(0, 8)
    .map(({ name, actual, predicted }) => ({ name, actual, predicted }));
  return {
    keys,
    raw: raw.map((v) => Math.round(v * 10000) / 10000),
    weights,
    n: matches.length,
    r2: Math.round((1 - ssRes / ssTot) * 100000) / 100000,
    meanAbsError: Math.round((err.reduce((a, b) => a + b, 0) / err.length) * 1000) / 1000,
    within005: Math.round((err.filter((e) => e <= 0.05).length / err.length) * 1000) / 1000,
    worst,
  };
}

// ESPN-style stat ids, so the existing percentile code can use the imported season unchanged.
const SKATER_ID: Record<string, string> = { G: "13", A: "14", PM: "15", PIM: "17", PPG: "18", PPA: "19", SHG: "20", SHA: "21", GWG: "22", SOG: "29", HIT: "31", BLK: "32" };
const GOALIE_ID: Record<string, string> = { W: "1", L: "2", SA: "3", GA: "4", SV: "6", SO: "7", OTL: "9", GS: "0" };

export function toEspnStats(p: NhlPlayer): Record<string, number> {
  const out: Record<string, number> = { "34": p.gp };
  const map = p.group === "G" ? GOALIE_ID : SKATER_ID;
  for (const [k, id] of Object.entries(map)) if (p.stats[k] !== undefined) out[id] = p.stats[k];
  if (p.group !== "G") {
    out["38"] = (p.stats.PPG ?? 0) + (p.stats.PPA ?? 0); // power-play points
    out["39"] = (p.stats.SHG ?? 0) + (p.stats.SHA ?? 0); // short-handed points
  } else {
    const sa = p.stats.SA ?? 0;
    if (sa > 0) out["11"] = (p.stats.SV ?? 0) / sa;
    if (p.gp > 0) out["10"] = ((p.stats.GA ?? 0) / p.gp);
  }
  return out;
}

// Turn fitted weights into the same {statId, points} items ESPN's settings use. Equal power-play
// goal and assist weights become one PPP category (same for short-handed).
export function toScoringItems(weights: Record<string, number>, group: "skater" | "goalie"): { statId: number; points: number }[] {
  const items: { statId: number; points: number }[] = [];
  if (group === "goalie") {
    for (const [k, id] of Object.entries(GOALIE_ID)) if (weights[k]) items.push({ statId: Number(id), points: weights[k] });
    return items;
  }
  const add = (statId: number, points: number) => points && items.push({ statId, points });
  for (const k of ["G", "A", "PM", "PIM", "GWG", "SOG", "HIT", "BLK"]) add(Number(SKATER_ID[k]), weights[k] ?? 0);
  // PPG/PPA: a weight on both of them equal to w is a PPP category worth w
  if (Math.abs((weights.PPG ?? 0) - (weights.PPA ?? 0)) < 0.011) add(38, weights.PPG ?? 0);
  else {
    add(18, weights.PPG ?? 0);
    add(19, weights.PPA ?? 0);
  }
  if (Math.abs((weights.SHG ?? 0) - (weights.SHA ?? 0)) < 0.011) add(39, weights.SHG ?? 0);
  else {
    add(20, weights.SHG ?? 0);
    add(21, weights.SHA ?? 0);
  }
  return items;
}
