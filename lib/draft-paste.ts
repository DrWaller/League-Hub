// Pure helpers: reads a pasted draft (for a season played on another platform) into picks. One pick per line:
//   pick, team, player, position, keeper
// Separated by tabs or commas. Pick is optional (picks are then numbered in order), position and keeper are optional
// and can be in any order after the team and player. A header row is skipped.

export interface PastedPick {
  overall: number;
  team: string;
  player: string;
  position: string;
  keeper: boolean;
}

export interface PasteResult {
  picks: PastedPick[];
  warnings: string[];
  errors: string[];
}

const POSITIONS = new Set(["C", "LW", "RW", "W", "D", "G", "F", "LD", "RD"]);
const KEEPER_WORDS = new Set(["k", "keeper", "keep", "yes", "y", "true"]);

export function parseDraftPaste(text: string): PasteResult {
  const picks: PastedPick[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, i) => {
    const delim = line.includes("\t") ? "\t" : ",";
    const fields = line.split(delim).map((f) => f.trim().replace(/^"|"$/g, "")).filter((f) => f !== "");
    if (fields.length === 0) return;

    let overall: number | null = null;
    if (/^#?\d+\.?$/.test(fields[0])) overall = Number(fields[0].replace(/\D/g, ""));
    else if (i === 0 && fields.length >= 2) return; // header row
    const rest = overall !== null ? fields.slice(1) : fields;

    let position = "";
    let keeper = false;
    const names: string[] = [];
    for (const f of rest) {
      if (KEEPER_WORDS.has(f.toLowerCase())) keeper = true;
      else if (POSITIONS.has(f.toUpperCase())) position = f.toUpperCase() === "W" ? "RW" : f.toUpperCase();
      else names.push(f);
    }
    if (names.length === 0) {
      errors.push(`Line ${i + 1}: no player found ("${line.slice(0, 40)}").`);
      return;
    }
    const player = names.length >= 2 ? names[1] : names[0];
    const team = names.length >= 2 ? names[0] : "";
    picks.push({ overall: overall ?? picks.length + 1, team, player, position, keeper });
  });

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
