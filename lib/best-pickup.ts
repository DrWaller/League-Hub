// Server-side only. Best Pickup, tracked the way lineup efficiency is: day by day.
//
// A free-agent or waiver ADD starts tracking the player for the team that added him. From then on, every
// scoring day he is on that team's roster and his team plays, the day is saved with the lineup slot he was in:
//   - in an active slot  -> "started": his points counted for the team, and they count for the race
//   - on the bench / IR  -> "benched": shown, but NOT credited (the points did nothing for the manager)
// Tracking stops the day after the team drops him or trades him away (a later re-add starts it again), and a
// player who arrived by the draft or a trade is never tracked. Race score = VOR of the started games:
// started points - that week's replacement-level points per game x games started (the same bar weekly VOR uses).

import { sql } from "./db";
import { fetchRosterDay } from "./games-played";
import { loadRosterMoves, periodToWeek, PICKUP_SOURCES, type RosterMove } from "./roster-moves";
import { loadRates } from "./vor-rates";

const POS_BY_ID: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const NOT_IN_LINEUP = new Set([7, 8]); // bench, IR

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS pickup_days (
      season INTEGER NOT NULL,
      period INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      active BOOLEAN NOT NULL,
      points REAL NOT NULL,
      PRIMARY KEY (season, period, player_id)
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS pickup_days_done (season INTEGER NOT NULL, period INTEGER NOT NULL, PRIMARY KEY (season, period));`;
}

interface Ev {
  t: number;
  order: number;
  period: number;
  kind: "add" | "drop";
  pickup: boolean;
  source: string;
}

function indexMoves(moves: RosterMove[]): Map<string, Ev[]> {
  const by = new Map<string, Ev[]>();
  for (const m of moves) {
    const k = `${m.teamId}:${m.playerId}`;
    const ev: Ev = { t: m.movedAt, order: m.itemNo, period: m.period || 1, kind: m.move, pickup: m.move === "add" && PICKUP_SOURCES.has(m.source), source: m.source };
    const g = by.get(k);
    if (g) g.push(ev);
    else by.set(k, [ev]);
  }
  for (const g of by.values()) g.sort((a, b) => a.t - b.t || a.order - b.order);
  return by;
}

// Is this player, on this team, being tracked on scoring day `day`? True when the latest add (made on or before
// the day) or drop (made BEFORE the day: a drop after his game still lets that game count) is a pickup add.
export function trackedOn(events: Ev[] | undefined, day: number): boolean {
  if (!events) return false;
  let last: Ev | null = null;
  for (const e of events) {
    if ((e.kind === "add" && e.period <= day) || (e.kind === "drop" && e.period < day)) last = e;
  }
  return last !== null && last.pickup;
}

// Saves the tracked players' day lines for every finished day not saved yet, at most `limit` days per call.
// Days where nobody has been picked up yet cost no ESPN call. Run the moves sync first.
export async function syncPickupDays(season: number, currentPeriod: number, currentWeek: number, limit = 6): Promise<{ saved: number; waiting: number; failed: number }> {
  await ensureTables();
  const weekOf = await periodToWeek(season);
  if (!weekOf || currentPeriod < 2) return { saved: 0, waiting: 0, failed: 0 };
  const done = new Set((await sql`SELECT period FROM pickup_days_done WHERE season = ${season};`).rows.map((r) => Number(r.period)));
  const todo: number[] = [];
  for (let p = 1; p < currentPeriod; p++) if (!done.has(p) && weekOf(p) < currentWeek) todo.push(p);
  if (todo.length === 0) return { saved: 0, waiting: 0, failed: 0 };

  const index = indexMoves(await loadRosterMoves(season));
  const firstPickupPeriod = Math.min(Infinity, ...[...index.values()].flatMap((g) => g.filter((e) => e.pickup).map((e) => e.period)));
  let saved = 0;
  let failed = 0;
  for (const day of todo.slice(0, limit)) {
    if (day < firstPickupPeriod) {
      await sql`INSERT INTO pickup_days_done (season, period) VALUES (${season}, ${day}) ON CONFLICT DO NOTHING;`;
      saved++;
      continue;
    }
    const data = await fetchRosterDay(season, day, true);
    if (!data?.teams) {
      failed++;
      continue;
    }
    const rows: { team_id: number; player_id: number; name: string; position: string; slot_id: number; active: boolean; points: number }[] = [];
    for (const t of data.teams) {
      for (const e of t.roster?.entries ?? []) {
        const pl = e.playerPoolEntry?.player;
        if (!pl) continue;
        if (!trackedOn(index.get(`${t.id}:${pl.id}`), day)) continue;
        const stat = (pl.stats ?? []).find((x: any) => x.scoringPeriodId === day && x.statSourceId === 0);
        if (!stat) continue; // his team didn't play that day
        const slot = Number(e.lineupSlotId);
        rows.push({ team_id: t.id, player_id: pl.id, name: pl.fullName ?? "Unknown Player", position: POS_BY_ID[pl.defaultPositionId] ?? "?", slot_id: slot, active: !NOT_IN_LINEUP.has(slot), points: Number(stat.appliedTotal) || 0 });
      }
    }
    const json = JSON.stringify(rows);
    await sql`DELETE FROM pickup_days WHERE season = ${season} AND period = ${day};`;
    if (rows.length > 0) {
      await sql`
        INSERT INTO pickup_days (season, period, team_id, player_id, name, position, slot_id, active, points)
        SELECT ${season}, ${day}, r.team_id, r.player_id, r.name, r.position, r.slot_id, r.active, r.points
        FROM json_to_recordset(${json}::json) AS r(team_id integer, player_id integer, name text, position text, slot_id integer, active boolean, points real);
      `;
    }
    await sql`INSERT INTO pickup_days_done (season, period) VALUES (${season}, ${day}) ON CONFLICT DO NOTHING;`;
    saved++;
  }
  return { saved, waiting: Math.max(0, todo.length - limit), failed };
}

export interface PickupDay {
  period: number;
  teamId: number;
  playerId: number;
  name: string;
  position: string;
  slotId: number;
  active: boolean;
  points: number;
}

export async function loadPickupDays(season: number): Promise<PickupDay[]> {
  await ensureTables();
  const r = await sql`SELECT period, team_id, player_id, name, position, slot_id, active, points FROM pickup_days WHERE season = ${season} ORDER BY period;`;
  return r.rows.map((x) => ({ period: Number(x.period), teamId: Number(x.team_id), playerId: Number(x.player_id), name: String(x.name), position: String(x.position), slotId: Number(x.slot_id), active: Boolean(x.active), points: Number(x.points) }));
}

export interface PickupLogEntry {
  playerId: number;
  name: string;
  position: string;
  teamId: number;
  source: "Free agent" | "Waivers" | string;
  addedAt: number;
  droppedAt: number | null; // null = still on the team
  games: number; // days his team played while he was tracked
  started: number;
  benched: number;
  pointsCounted: number; // started days
  pointsBench: number; // benched days (did nothing for the team)
  vor: number; // started points - replacement x started games
  avg: number; // counted points per start
  rank: number;
}

const sourceLabel = (s: string) => (s === "FREEAGENT" ? "Free agent" : s.startsWith("WAIVER") ? "Waivers" : s);

// Every tracked pickup, best first (by VOR of his starts, then points).
export function buildPickupLog(days: PickupDay[], moves: RosterMove[], rates: Map<number, Record<string, number>>, weekOf: (p: number) => number): PickupLogEntry[] {
  const index = indexMoves(moves);
  const by = new Map<string, PickupDay[]>();
  for (const d of days) {
    const k = `${d.teamId}:${d.playerId}`;
    const g = by.get(k);
    if (g) g.push(d);
    else by.set(k, [d]);
  }
  const out: Omit<PickupLogEntry, "rank">[] = [];
  for (const [k, list] of by) {
    const events = index.get(k) ?? [];
    const firstAdd = events.find((e) => e.pickup);
    if (!firstAdd) continue;
    const teamId = list[0].teamId;
    const last = events[events.length - 1];
    const stillOn = last.kind === "add" && last.pickup;
    const lastDrop = [...events].reverse().find((e) => e.kind === "drop");
    let started = 0;
    let benched = 0;
    let counted = 0;
    let bench = 0;
    let vor = 0;
    for (const d of list) {
      if (d.active) {
        started++;
        counted += d.points;
        vor += d.points - (rates.get(weekOf(d.period))?.[d.position] ?? 0);
      } else {
        benched++;
        bench += d.points;
      }
    }
    out.push({
      playerId: list[0].playerId,
      name: list[list.length - 1].name,
      position: list[list.length - 1].position,
      teamId,
      source: sourceLabel(firstAdd.source),
      addedAt: firstAdd.t,
      droppedAt: stillOn ? null : lastDrop?.t ?? null,
      games: list.length,
      started,
      benched,
      pointsCounted: counted,
      pointsBench: bench,
      vor,
      avg: started > 0 ? counted / started : 0,
    });
  }
  return out.sort((a, b) => b.vor - a.vor || b.pointsCounted - a.pointsCounted).map((e, i) => ({ ...e, rank: i + 1 }));
}

export async function getPickupLog(season: number): Promise<PickupLogEntry[] | null> {
  const weekOf = await periodToWeek(season);
  if (!weekOf) return null;
  const [days, moves, rates] = await Promise.all([loadPickupDays(season), loadRosterMoves(season), loadRates(season)]);
  return buildPickupLog(days, moves, rates, weekOf);
}
