// Reads the "Keeper History" Google Sheet layout: one tab per season, each
// manager a small block -- their name in a header cell, then one row per keeper
// with the keeper type ("2 Year (Old)", "1 Year", ...) in one cell, the player
// in the next cell and the position in the one after. Two blocks sit side by
// side, and the exact columns differ between years (2022 has no spacer column,
// for example), so this finds every keeper-type cell and reads from there
// instead of assuming fixed columns.

export interface ParsedKeeper {
  manager: string;
  type: string; // "2 Year (Old)", "1 Year", ...
  player: string;
  position: string;
}

const isType = (s: string) => /^\d+\s*year/i.test(s);

export function parseKeeperGrid(grid: string[][]): ParsedKeeper[] {
  const cell = (r: number, c: number) => (grid[r]?.[c] ?? "").trim();
  const out: ParsedKeeper[] = [];

  for (let r = 0; r < grid.length; r++) {
    const width = grid[r]?.length ?? 0;
    for (let c = 0; c < width; c++) {
      const type = cell(r, c);
      if (!isType(type)) continue;

      // The manager's name is the header cell above this block: same column as
      // the player, with nothing in the type column.
      let manager = "";
      for (let r2 = r - 1; r2 >= 0; r2--) {
        if (isType(cell(r2, c))) continue; // another keeper row in the same block
        const v = cell(r2, c + 1);
        if (v) {
          manager = v;
          break;
        }
        if (!cell(r2, c)) break; // blank separator row: no header found
      }

      const player = cell(r, c + 1);
      if (!manager || !player) continue; // not submitted yet / empty slot
      out.push({ manager, type: type.replace(/\s+/g, " "), player, position: cell(r, c + 2) });
    }
  }
  return out;
}

// Minimal CSV reader (quoted fields, doubled quotes, CRLF) for the sheet export.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Text copied straight out of Google Sheets is tab-separated.
export const parseTsv = (text: string): string[][] => text.split(/\r?\n/).map((line) => line.split("\t"));

export function sheetIdFrom(input: string): string | null {
  const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(input.trim()) ? input.trim() : null;
}

export const keeperNote = (k: ParsedKeeper) => (k.position ? `${k.type} - ${k.position}` : k.type);
