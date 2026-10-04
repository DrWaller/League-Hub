// Reads the 2026-27 projections spreadsheet ("The List" tab) and stores each
// player's NHL team, age and projected stats in player_sheet, so the draft
// recap can use them. Matching to drafted players is by normalized name.
// The sheet must be shared as "Anyone with the link can view".

import { sql } from "@/lib/db";

export const SHEET_ID = process.env.PLAYER_SHEET_ID || "1TCNWcjrVxthZN4T0iy3fpzFEozpstK0Q-bitpMLLHfk";
export const SHEET_TAB = "The List";

// Lowercase, no accents, no periods or apostrophes, hyphens/other punctuation become spaces.
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Add a line here when the preview shows two sources spell a name differently:
// ESPN key -> sheet key (both already normalized with nameKey).
const ALIASES: Record<string, string> = {};

export interface SheetPlayer {
  name_key: string;
  name: string;
  position: string;
  nhl_team: string;
  age: number | null;
  sheet_adp: number | null;
  proj: Record<string, number>;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// gid of the "The List" tab in Dom's sheet. A copy of the sheet normally keeps it.
export const SHEET_GID = 1396113004;

async function getCsv(url: string): Promise<string[][] | string> {
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    const text = await res.text();
    if (!res.ok || text.trimStart().startsWith("<")) return `HTTP ${res.status} (not readable as CSV; check sharing)`;
    return parseCsv(text);
  } catch (e) {
    return String(e instanceof Error ? e.message : e).slice(0, 120);
  }
}

// The tab has a saved filter that hides rows marked KEEP? = Y. The gviz CSV
// leaves those rows out, so we also read the plain export and merge both:
// whichever includes the hidden rows wins. If neither does, make a copy of
// the sheet, remove the filter (Data > Remove filter), share it, and pass
// ?sheet=<copy id> to the import route.
export async function fetchSheetRows(sheetId = SHEET_ID): Promise<{ rows: string[][]; info: Record<string, unknown> }> {
  const g = await getCsv(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`);
  const e = await getCsv(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${SHEET_GID}`);
  const info = { gvizRows: Array.isArray(g) ? g.length : g, exportRows: Array.isArray(e) ? e.length : e };
  const lists = [g, e].filter(Array.isArray) as string[][][];
  if (lists.length === 0) {
    throw new Error(`Could not read the sheet as CSV (${JSON.stringify(info)}). Set sharing to "Anyone with the link can view", or send me an export of the "${SHEET_TAB}" tab.`);
  }
  const [first, ...rest] = lists;
  return { rows: [...first, ...rest.flatMap((r) => r.slice(1))], info };
}

const num = (s: string | undefined) => {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[$,%]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function parseSheetPlayers(rows: string[][]): SheetPlayer[] {
  const header = rows[0] ?? [];
  const idx = (h: string) => header.indexOf(h);
  const iName = idx("NAME"), iPos = idx("POS"), iTeam = idx("TEAM"), iAge = idx("AGE"), iAdp = idx("ADP"), iAdj = idx("ADJ");
  if (iName < 0 || iPos < 0 || iTeam < 0 || iAge < 0 || iAdj < 0) throw new Error("Unexpected sheet layout: NAME/POS/TEAM/AGE/ADJ headers not found.");

  // Stat columns follow ADJ: skater group, a blank column, then goalie group.
  const cols: { i: number; key: string }[] = [];
  let group = 0;
  for (let i = iAdj + 1; i < header.length; i++) {
    const h = (header[i] ?? "").trim();
    if (h === "") {
      group++;
      continue;
    }
    cols.push({ i, key: group >= 1 && h === "GP" ? "gGP" : h });
  }

  const seen = new Set<string>();
  const out: SheetPlayer[] = [];
  for (const r of rows.slice(1)) {
    const name = (r[iName] ?? "").trim();
    if (!name) continue;
    const position = (r[iPos] ?? "").trim();
    const key = nameKey(name);
    const dup = `${key}|${position}`;
    if (seen.has(dup)) continue;
    seen.add(dup);
    const proj: Record<string, number> = {};
    for (const c of cols) {
      const v = num(r[c.i]);
      if (v != null) proj[c.key] = v;
    }
    const age = num(r[iAge]);
    out.push({
      name_key: key,
      name,
      position,
      nhl_team: (r[iTeam] ?? "").trim(),
      age: age != null ? Math.round(age) : null,
      sheet_adp: iAdp >= 0 ? num(r[iAdp]) : null,
      proj,
    });
  }
  return out;
}

export async function ensureSheetSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS player_sheet (
      name_key TEXT NOT NULL,
      position TEXT NOT NULL,
      name TEXT,
      nhl_team TEXT,
      age INT,
      sheet_adp NUMERIC,
      proj JSONB,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (name_key, position)
    );
  `;
}

export async function storeSheetPlayers(players: SheetPlayer[]) {
  await ensureSheetSchema();
  await sql`DELETE FROM player_sheet;`;
  for (let i = 0; i < players.length; i += 20) {
    await Promise.all(
      players.slice(i, i + 20).map(
        (p) => sql`
          INSERT INTO player_sheet (name_key, position, name, nhl_team, age, sheet_adp, proj)
          VALUES (${p.name_key}, ${p.position}, ${p.name}, ${p.nhl_team}, ${p.age}, ${p.sheet_adp}, ${JSON.stringify(p.proj)}::jsonb)
          ON CONFLICT (name_key, position) DO NOTHING;
        `
      )
    );
  }
  return players.length;
}

export type SheetMap = Map<string, SheetPlayer[]>;

let lastLoadError: string | null = null;
export const sheetLoadError = () => lastLoadError;

export async function loadSheetMap(): Promise<SheetMap> {
  const map: SheetMap = new Map();
  try {
    await ensureSheetSchema();
    const { rows } = await sql`SELECT name_key, position, name, nhl_team, age, sheet_adp::float AS sheet_adp, proj FROM player_sheet;`;
    for (const r of rows as any[]) {
      const p: SheetPlayer = { ...r, proj: typeof r.proj === "string" ? JSON.parse(r.proj) : r.proj ?? {} };
      const list = map.get(p.name_key) ?? [];
      list.push(p);
      map.set(p.name_key, list);
    }
  } catch (e) {
    // Table missing or unreadable: callers get an empty map; the reason is kept for diagnostics.
    lastLoadError = String(e instanceof Error ? e.message : e).slice(0, 200);
  }
  return map;
}

// Find the sheet row for a drafted player. When two players share a name
// (two Sebastian Ahos), prefer the one whose sheet position includes ours.
export function pickSheet(map: SheetMap, name: string, position: string): SheetPlayer | null {
  const k0 = nameKey(name);
  const list = map.get(k0) ?? map.get(ALIASES[k0] ?? "");
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];
  return list.find((p) => p.position.split(/[\/,\s]+/).includes(position)) ?? list[0];
}
