// Every manager against every other manager, from the same regular-season games as the Records page. Pure logic.

import { regularSeasonFinals } from "./luck";
import type { RecSeason } from "./records";

export interface H2HCell {
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
}

export function buildH2HMatrix(seasons: RecSeason[]): Map<string, H2HCell> {
  const out = new Map<string, H2HCell>();
  const add = (a: number, b: number, my: number, their: number) => {
    const k = `${a}|${b}`;
    const c = out.get(k) ?? { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    if (my > their) c.w++;
    else if (my < their) c.l++;
    else c.t++;
    c.pf += my;
    c.pa += their;
    out.set(k, c);
  };
  for (const s of seasons) {
    const mgr = new Map(s.teams.map((t) => [t.id, t.managerId]));
    for (const m of regularSeasonFinals(s.matchups)) {
      const h = mgr.get(m.homeTeamId);
      const a = mgr.get(m.awayTeamId);
      if (h == null || a == null || h === a) continue;
      add(h, a, m.homeScore, m.awayScore);
      add(a, h, m.awayScore, m.homeScore);
    }
  }
  return out;
}

export const cellPct = (c: H2HCell | undefined) => (c && c.w + c.l + c.t > 0 ? (c.w + c.t * 0.5) / (c.w + c.l + c.t) : null);
