// Server-side only (ESPN cookies + Postgres). Keeps every executed add and drop of the season so the
// "Best Pickup" race can credit a free-agent or waiver add only for the time his team actually held him.
//
// ESPN's transaction list (view=mTransactions2, one scoring day at a time) is saved day by day: finished days
// are saved once, the latest two days are re-read (waiver claims land overnight) at most every 10 minutes.
// If ESPN ever changes the shape, /api/admin/transactions-probe?period=N shows exactly what came back.

import { sql } from "./db";
import { getWeekCalendar } from "./week-calendar";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

export interface RosterMove {
  season: number;
  txId: string;
  itemNo: number;
  period: number; // scoring day
  movedAt: number; // ms since epoch
  teamId: number;
  playerId: number;
  move: "add" | "drop";
  source: string; // FREEAGENT, WAIVER, TRADE, ROSTER...
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS roster_moves (
      season INTEGER NOT NULL,
      tx_id TEXT NOT NULL,
      item_no INTEGER NOT NULL,
      period INTEGER NOT NULL,
      moved_at BIGINT NOT NULL,
      team_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      move TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (season, tx_id, item_no)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS roster_moves_periods (
      season INTEGER NOT NULL,
      period INTEGER NOT NULL,
      final BOOLEAN NOT NULL,
      fetched_at BIGINT NOT NULL,
      PRIMARY KEY (season, period)
    );
  `;
}

export async function fetchTransactionsRaw(season: number, period: number): Promise<{ ok: boolean; status: number | null; data: any | null }> {
  if (!ESPN_S2 || !ESPN_SWID) return { ok: false, status: null, data: null };
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mTransactions2&scoringPeriodId=${period}`;
  try {
    const res = await fetch(url, { headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` }, cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

// Turns ESPN's transaction list into add/drop rows. Only executed transactions count. An ADD item goes to
// toTeamId, a DROP item comes from fromTeamId; a trade gives the player up (a drop for the sending team).
export function parseTransactions(season: number, data: any): RosterMove[] {
  const out: RosterMove[] = [];
  for (const tx of data?.transactions ?? []) {
    const executed = String(tx?.status ?? "").toUpperCase() === "EXECUTED" || (String(tx?.executionType ?? "").toUpperCase() === "EXECUTE" && !tx?.isPending && !tx?.status);
    if (!executed) continue;
    const source = String(tx?.type ?? "").toUpperCase();
    const period = Number(tx?.scoringPeriodId) || 0;
    const movedAt = Number(tx?.processDate) || Number(tx?.proposedDate) || 0;
    const items: any[] = Array.isArray(tx?.items) ? tx.items : [];
    items.forEach((it, i) => {
      const playerId = Number(it?.playerId);
      if (!playerId) return;
      const kind = String(it?.type ?? "").toUpperCase();
      const base = { season, txId: String(tx?.id ?? `${period}-${movedAt}`), period, movedAt, playerId, source };
      if (kind === "ADD") {
        const teamId = Number(it?.toTeamId ?? tx?.teamId);
        if (Number.isFinite(teamId) && teamId > 0) out.push({ ...base, itemNo: i, teamId, move: "add" });
      } else if (kind === "DROP") {
        const teamId = Number(it?.fromTeamId ?? tx?.teamId);
        if (Number.isFinite(teamId) && teamId > 0) out.push({ ...base, itemNo: i, teamId, move: "drop" });
      } else if (kind === "TRADE") {
        const from = Number(it?.fromTeamId);
        const to = Number(it?.toTeamId);
        if (from > 0) out.push({ ...base, itemNo: i * 2, teamId: from, move: "drop", source: "TRADE" });
        if (to > 0) out.push({ ...base, itemNo: i * 2 + 1, teamId: to, move: "add", source: "TRADE" });
      }
    });
  }
  return out;
}

const REFRESH_MS = 10 * 60 * 1000;

// Saves every scoring day up to `currentPeriod` that is not saved yet (at most `limit` per call), and re-reads
// the latest two days. Returns how many days were saved, how many are still waiting, and any trouble.
export async function syncRosterMoves(season: number, currentPeriod: number, limit = 40): Promise<{ saved: number; waiting: number; failed: number; error?: string }> {
  if (!ESPN_S2 || !ESPN_SWID) return { saved: 0, waiting: 0, failed: 0, error: "ESPN isn't connected." };
  if (!currentPeriod || currentPeriod < 1) return { saved: 0, waiting: 0, failed: 0 };
  await ensureTables();
  const have = await sql`SELECT period, final, fetched_at FROM roster_moves_periods WHERE season = ${season};`;
  const state = new Map(have.rows.map((r) => [Number(r.period), { final: Boolean(r.final), at: Number(r.fetched_at) }]));
  const now = Date.now();
  const todo: number[] = [];
  // Day 0 catches adds made between the draft and opening night, if ESPN files them there (a failure on day 0 is ignored).
  for (let p = 0; p <= currentPeriod; p++) {
    const s = state.get(p);
    if (!s || (!s.final && now - s.at > REFRESH_MS)) todo.push(p);
  }
  const batch = todo.slice(0, limit);
  let saved = 0;
  let failed = 0;
  let error: string | undefined;
  for (let i = 0; i < batch.length; i += 5) {
    await Promise.all(
      batch.slice(i, i + 5).map(async (p) => {
        const res = await fetchTransactionsRaw(season, p);
        if (!res.ok && p === 0) {
          await sql`
            INSERT INTO roster_moves_periods (season, period, final, fetched_at) VALUES (${season}, 0, true, ${now})
            ON CONFLICT (season, period) DO UPDATE SET final = true, fetched_at = ${now};
          `;
          return;
        }
        if (!res.ok) {
          failed++;
          error = error ?? `ESPN transactions for day ${p} failed (${res.status ?? "no response"}).`;
          return;
        }
        const moves = parseTransactions(season, res.data);
        for (const m of moves) {
          await sql`
            INSERT INTO roster_moves (season, tx_id, item_no, period, moved_at, team_id, player_id, move, source)
            VALUES (${m.season}, ${m.txId}, ${m.itemNo}, ${m.period || p}, ${m.movedAt}, ${m.teamId}, ${m.playerId}, ${m.move}, ${m.source})
            ON CONFLICT (season, tx_id, item_no) DO UPDATE SET period = EXCLUDED.period, moved_at = EXCLUDED.moved_at, team_id = EXCLUDED.team_id, player_id = EXCLUDED.player_id, move = EXCLUDED.move, source = EXCLUDED.source;
          `;
        }
        const final = p < currentPeriod - 1 && p !== currentPeriod;
        await sql`
          INSERT INTO roster_moves_periods (season, period, final, fetched_at) VALUES (${season}, ${p}, ${final}, ${now})
          ON CONFLICT (season, period) DO UPDATE SET final = ${final}, fetched_at = ${now};
        `;
        saved++;
      })
    );
  }
  return { saved, waiting: Math.max(0, todo.length - batch.length), failed, error };
}

export async function loadRosterMoves(season: number): Promise<RosterMove[]> {
  await ensureTables();
  const r = await sql`SELECT tx_id, item_no, period, moved_at, team_id, player_id, move, source FROM roster_moves WHERE season = ${season} ORDER BY moved_at, tx_id, item_no;`;
  return r.rows.map((x) => ({
    season,
    txId: String(x.tx_id),
    itemNo: Number(x.item_no),
    period: Number(x.period),
    movedAt: Number(x.moved_at),
    teamId: Number(x.team_id),
    playerId: Number(x.player_id),
    move: String(x.move) as "add" | "drop",
    source: String(x.source),
  }));
}

// Scoring day -> matchup week, from the Week Days calendar (the same one the player graphics use).
// Days before day 1 (adds made right after the draft) count as week 1; days past the saved weeks, the last one.
export async function periodToWeek(season: number): Promise<((period: number) => number) | null> {
  const cal = await getWeekCalendar(season);
  if (!cal || cal.lengths.length === 0) return null;
  const ends: number[] = [];
  let total = 0;
  for (const len of cal.lengths) ends.push((total += Math.max(1, len)));
  return (period) => {
    if (period <= 1) return 1;
    const i = ends.findIndex((e) => period <= e);
    return i === -1 ? ends.length : i + 1;
  };
}

export const PICKUP_SOURCES = new Set(["FREEAGENT", "WAIVER", "WAIVER_BUDGET"]);

export const addedLabel = (ms: number) => (ms > 0 ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "");
