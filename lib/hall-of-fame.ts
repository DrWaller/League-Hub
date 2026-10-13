// Server-side only. Every past season's award winners in one place. Player awards come from the winners recorded in
// lib/season-awards.ts, overridden by anything saved on the admin "Past Winners" page; manager awards (champion,
// Presidents' Trophy, Most Points, Hard Luck) are worked out from each season's results unless a winner was saved.

import { sql } from "./db";
import { PAST_WINNERS } from "./season-awards";
import { getSeasonBundle } from "./season-data";
import { getSeasonHistory, getManagers } from "./content";
import { getHistorySeasons } from "./seasons";
import { regularSeasonFinals, computeLuck } from "./luck";

export interface AwardDef {
  key: string;
  label: string;
  group: "manager" | "player";
}

// Display order.
export const AWARD_DEFS: AwardDef[] = [
  { key: "champion", label: "League Champion", group: "manager" },
  { key: "presidents", label: "Presidents' Trophy", group: "manager" },
  { key: "points", label: "Most Points", group: "manager" },
  { key: "hardluck", label: "Hard Luck Manager", group: "manager" },
  { key: "jennings", label: "William M. Jennings", group: "manager" },
  { key: "hart", label: "Hart Trophy", group: "player" },
  { key: "artross", label: "Art Ross Trophy", group: "player" },
  { key: "norris", label: "Norris Trophy", group: "player" },
  { key: "vezina", label: "Vezina Trophy", group: "player" },
  { key: "forward", label: "Forward of the Year", group: "player" },
  { key: "calder", label: "Calder Trophy", group: "player" },
  { key: "breakout", label: "Breakout Player", group: "player" },
  { key: "improved", label: "Most Improved", group: "player" },
  { key: "bounce", label: "Bounce Back Player", group: "player" },
  { key: "sleeping", label: "Sleeping Beauty", group: "player" },
];

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS award_winners (season INTEGER NOT NULL, award TEXT NOT NULL, winner TEXT NOT NULL, PRIMARY KEY (season, award));`;
}

// "2023: Erik Karlsson" -> [2023, "Erik Karlsson"]
function recorded(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [award, list] of Object.entries(PAST_WINNERS)) {
    for (const entry of list) {
      const x = entry.match(/^(\d{4}):\s*(.+)$/);
      if (x) m.set(`${x[1]}|${award}`, x[2].trim());
    }
  }
  return m;
}

export async function loadSavedWinners(): Promise<Map<string, string>> {
  await ensureTable();
  const r = await sql`SELECT season, award, winner FROM award_winners;`;
  return new Map(r.rows.map((x) => [`${x.season}|${x.award}`, String(x.winner)]));
}

export async function saveSeasonWinners(season: number, winners: Record<string, string>) {
  await ensureTable();
  const defaults = recorded();
  for (const def of AWARD_DEFS) {
    if (!(def.key in winners)) continue;
    const v = (winners[def.key] ?? "").trim();
    const base = defaults.get(`${season}|${def.key}`) ?? "";
    // Same as the built-in value (or empty with no built-in): nothing to save, drop any old override.
    if (v === base) {
      await sql`DELETE FROM award_winners WHERE season = ${season} AND award = ${def.key};`;
    } else {
      await sql`INSERT INTO award_winners (season, award, winner) VALUES (${season}, ${def.key}, ${v}) ON CONFLICT (season, award) DO UPDATE SET winner = ${v};`;
    }
  }
}

export interface SeasonWinners {
  season: number;
  winners: Record<string, { name: string; note?: string; computed?: boolean }>;
}

// Manager awards worked out from one finished season's results.
async function computeManagerAwards(season: number, managerName: (id: number | null) => string | null, champion: string | null) {
  const out: SeasonWinners["winners"] = {};
  if (champion) out.champion = { name: champion };
  const bundle = await getSeasonBundle(season).catch(() => null);
  if (!bundle || bundle.teams.length === 0) return out;
  const who = (t: { name: string; managerId: number | null }) => managerName(t.managerId) ?? t.name;
  const rec = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;

  const byRecord = [...bundle.teams].sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor);
  if (byRecord[0] && byRecord[0].wins + byRecord[0].losses > 0) out.presidents = { name: who(byRecord[0]), note: `${byRecord[0].name}, ${rec(byRecord[0])}`, computed: true };
  const byPoints = [...bundle.teams].sort((a, b) => b.pointsFor - a.pointsFor);
  if (byPoints[0] && byPoints[0].pointsFor > 0) out.points = { name: who(byPoints[0]), note: `${byPoints[0].name}, ${byPoints[0].pointsFor.toFixed(2)} pts`, computed: true };

  const lastWeek = regularSeasonFinals(bundle.matchups).reduce((m, x) => Math.max(m, x.week), 0);
  if (lastWeek > 0) {
    const rows = computeLuck(bundle.matchups, lastWeek).rows.map((r) => {
      const games = r.actW + r.actL + r.actT;
      const expected = r.expWinPct * games;
      const actual = r.actW + r.actT * 0.5;
      return { teamId: r.teamId, expected, gap: expected > 0 ? (actual - expected) / expected : 0 };
    }).sort((a, b) => a.gap - b.gap);
    const worst = rows[0];
    const team = worst && bundle.teams.find((t) => t.id === worst.teamId);
    if (team && worst.gap < 0) out.hardluck = { name: who(team), note: `${team.name}, ${Math.abs(worst.gap * 100).toFixed(0)}% under expected wins`, computed: true };
  }
  return out;
}

export async function loadHallOfFame(currentSeason: number): Promise<SeasonWinners[]> {
  const [available, curated, managers, saved] = await Promise.all([
    getHistorySeasons(currentSeason),
    getSeasonHistory(),
    getManagers(),
    loadSavedWinners(),
  ]);
  const defaults = recorded();
  const managerName = (id: number | null) => (id == null ? null : managers.find((m) => m.id === id)?.name ?? null);
  const seasons = new Set<number>(available.filter((s) => s < currentSeason));
  for (const k of [...defaults.keys(), ...saved.keys()]) {
    const s = Number(k.split("|")[0]);
    if (s < currentSeason) seasons.add(s);
  }
  const list = [...seasons].sort((a, b) => b - a);
  return Promise.all(
    list.map(async (season) => {
      const computed = await computeManagerAwards(season, managerName, curated.find((c) => c.season === season)?.champion ?? null).catch(() => ({} as SeasonWinners["winners"]));
      const winners: SeasonWinners["winners"] = { ...computed };
      for (const def of AWARD_DEFS) {
        const k = `${season}|${def.key}`;
        const value = saved.has(k) ? saved.get(k)! : defaults.get(k);
        if (value === undefined) continue;
        if (value === "") delete winners[def.key]; // saved blank: hide
        else winners[def.key] = { name: value };
      }
      return { season, winners };
    })
  );
}

// Everyone's trophy count across all the player awards, most decorated first (names with 2+ wins).
export function mostDecorated(seasons: SeasonWinners[]) {
  const tally = new Map<string, { name: string; wins: { award: string; season: number }[] }>();
  for (const s of seasons) {
    for (const def of AWARD_DEFS.filter((d) => d.group === "player")) {
      const w = s.winners[def.key]?.name;
      if (!w) continue;
      const name = w.replace(/\s*\(.*\)\s*$/, "").trim();
      const e = tally.get(name) ?? { name, wins: [] };
      e.wins.push({ award: def.label, season: s.season });
      tally.set(name, e);
    }
  }
  return [...tally.values()].filter((e) => e.wins.length >= 2).sort((a, b) => b.wins.length - a.wins.length || a.name.localeCompare(b.name)).slice(0, 8);
}
