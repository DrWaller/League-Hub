// Pure helpers (client-safe) for the per-team views of the draft assessment.
import type { AssessedPick } from "./draft-assessment";
import type { KeeperTeam } from "./draft-keepers-image";
import { TIERS, type Tier } from "./tier-style";
import { valueKinds } from "./draft-value-split";

const last = (name: string) => name.split(" ").slice(-1)[0];

// Teams ranked by the combined season VOR of their keepers.
export function keeperTeams(picks: AssessedPick[]): KeeperTeam[] {
  const by = new Map<string, AssessedPick[]>();
  for (const p of picks) if (p.keeper) by.set(p.team, [...(by.get(p.team) ?? []), p]);
  return Array.from(by.entries())
    .map(([team, list]) => {
      const sorted = [...list].sort((a, b) => (b.vor ?? -Infinity) - (a.vor ?? -Infinity));
      const counts = Object.fromEntries(TIERS.map((t) => [t, list.filter((x) => x.tier === t).length])) as Record<Tier, number>;
      return { team, vor: list.reduce((n, x) => n + (x.vor ?? 0), 0), counts, names: sorted.map((x) => last(x.name)) };
    })
    .sort((a, b) => b.vor - a.vor);
}

// Team names in draft order of their first pick.
export function teamNames(picks: AssessedPick[]): string[] {
  return Array.from(new Set(picks.map((p) => p.team).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export interface DraftGradePick {
  name: string;
  overall: number;
  surplus: number;
}
export interface DraftGrade {
  team: string;
  rank: number;
  grade: string; // A+ ... F, by how far the team's draft is above or below the league average
  total: number; // the team's draft picks' season VOR above or below the player ranked at each slot, added up
  vsAvg: number; // total minus the league average total: what the rank and grade are based on
  picks: number;
  steals: number;
  busts: number;
  missed: number;
  best: DraftGradePick | null;
  worst: DraftGradePick | null;
}

function gradeOf(z: number): string {
  const steps: [number, string][] = [[1.4, "A+"], [1.0, "A"], [0.65, "A-"], [0.35, "B+"], [0.1, "B"], [-0.1, "B-"], [-0.35, "C+"], [-0.65, "C"], [-1.0, "C-"], [-1.4, "D"]];
  for (const [min, g] of steps) if (z >= min) return g;
  return "F";
}

// Each team's draft, graded. A team's draft is worth what its picks gave over the player ranked at each pick's slot (the
// same VOR vs slot as Steals & Busts), added up; keepers aren't draft picks and don't count. The grade compares teams with
// each other (a team on the league average is a B-/B), so the sum itself, which is negative for most teams because the
// top-ranked players are the keepers, never has to be read on its own.
export function draftGrades(picks: AssessedPick[]): DraftGrade[] {
  const kinds = valueKinds(picks);
  const by = new Map<string, AssessedPick[]>();
  for (const p of picks) if (!p.keeper && p.team) by.set(p.team, [...(by.get(p.team) ?? []), p]);
  const rows = Array.from(by.entries()).map(([team, list]) => {
    const rated = list.filter((p) => p.surplus != null);
    const sorted = [...rated].sort((a, b) => (b.surplus ?? 0) - (a.surplus ?? 0));
    const pick = (p?: AssessedPick): DraftGradePick | null => (p ? { name: p.name, overall: p.overall, surplus: p.surplus ?? 0 } : null);
    return {
      team,
      total: rated.reduce((n, p) => n + (p.surplus ?? 0), 0),
      picks: list.length,
      steals: list.filter((p) => kinds.get(p.overall) === "steals").length,
      busts: list.filter((p) => kinds.get(p.overall) === "busts").length,
      missed: list.filter((p) => kinds.get(p.overall) === "missed").length,
      best: pick(sorted[0]),
      worst: pick(sorted[sorted.length - 1]),
    };
  });
  if (rows.length === 0) return [];
  const mean = rows.reduce((n, r) => n + r.total, 0) / rows.length;
  const sd = Math.max(5, Math.sqrt(rows.reduce((n, r) => n + (r.total - mean) ** 2, 0) / rows.length));
  return rows
    .map((r) => ({ ...r, vsAvg: r.total - mean, grade: gradeOf((r.total - mean) / sd) }))
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// One colour per letter grade, shared by the page and the graphic.
export function gradeColor(grade: string): { bg: string; fg: string } {
  if (grade.startsWith("A")) return { bg: "#26864A", fg: "#FFFFFF" };
  if (grade.startsWith("B")) return { bg: "#1B6FB5", fg: "#FFFFFF" };
  if (grade.startsWith("C")) return { bg: "#7C8794", fg: "#FFFFFF" };
  return { bg: "#B8574A", fg: "#FFFFFF" };
}
