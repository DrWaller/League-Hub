// Style tags: plain labels a manager earns from the numbers, each shown with the numbers behind it. Pure logic.
// Fast or slow starter and strong finisher compare the first and last four regular-season weeks with the rest of the
// year. Clutch compares playoff-field games (both teams inside the playoff spots) with a .500 record.

import { regularSeasonFinals } from "./luck";
import type { RecManager, RecSeason } from "./records";
import { buildRecords } from "./records";
import type { PlayoffReport } from "./manager-playoffs";

export interface StyleTag {
  tag: string;
  detail: string;
  tone: "good" | "bad" | "neutral";
}

const EDGE = 4; // weeks at each end of the season
const MIN_GAMES = 24; // games in the sample before a tag is awarded
const GAP = 0.08; // win % difference needed

const pct = (w: number, g: number) => (g ? w / g : 0);
const show = (w: number, g: number) => `${w}-${g - w}`;

export function buildStyleTags(managerId: number, _managers: RecManager[], seasons: RecSeason[], playoffs: PlayoffReport | null): StyleTag[] {
  const tags: StyleTag[] = [];
  let startW = 0;
  let startG = 0;
  let endW = 0;
  let endG = 0;
  let allW = 0;
  let allG = 0;
  for (const s of seasons) {
    const teamIds = new Set(s.teams.filter((t) => t.managerId === managerId).map((t) => t.id));
    if (teamIds.size === 0) continue;
    const weeks = [...new Set(regularSeasonFinals(s.matchups).map((m) => m.week))].sort((a, b) => a - b);
    const first = new Set(weeks.slice(0, EDGE));
    const last = new Set(weeks.slice(-EDGE));
    for (const m of regularSeasonFinals(s.matchups)) {
      for (const [mine, my, their] of [
        [teamIds.has(m.homeTeamId), m.homeScore, m.awayScore],
        [teamIds.has(m.awayTeamId), m.awayScore, m.homeScore],
      ] as const) {
        if (!mine) continue;
        const win = my > their ? 1 : my === their ? 0.5 : 0;
        allG++;
        allW += win;
        if (first.has(m.week)) {
          startG++;
          startW += win;
        }
        if (last.has(m.week)) {
          endG++;
          endW += win;
        }
      }
    }
  }
  const base = pct(allW, allG);
  if (startG >= MIN_GAMES) {
    const p = pct(startW, startG);
    const detail = `${(p * 100).toFixed(0)}% in the first ${EDGE} weeks, ${(base * 100).toFixed(0)}% overall`;
    if (p - base >= GAP) tags.push({ tag: "Fast starter", detail, tone: "good" });
    else if (base - p >= GAP) tags.push({ tag: "Slow starter", detail, tone: "bad" });
  }
  if (endG >= MIN_GAMES) {
    const p = pct(endW, endG);
    const detail = `${(p * 100).toFixed(0)}% in the last ${EDGE} weeks, ${(base * 100).toFixed(0)}% overall`;
    if (p - base >= GAP) tags.push({ tag: "Strong finisher", detail, tone: "good" });
    else if (base - p >= GAP) tags.push({ tag: "Fades late", detail, tone: "bad" });
  }

  // Clutch: playoff-field games only (consolation games are in the data too).
  if (playoffs) {
    const rec = buildRecords(_managers, seasons);
    const rankOf = new Map(rec.seasonRows.map((r) => [`${r.season}|${r.managerId}`, r.rank]));
    let w = 0;
    let g = 0;
    for (const s of seasons) {
      const spots = playoffs.spotsBySeason[s.season];
      if (!spots) continue;
      const mgrOf = new Map(s.teams.map((t) => [t.id, t.managerId]));
      const inField = (teamId: number) => {
        const mid = mgrOf.get(teamId);
        const r = mid != null ? rankOf.get(`${s.season}|${mid}`) : undefined;
        return r != null && r <= spots;
      };
      for (const m of s.matchups) {
        if (!m.isFinal || !m.isPlayoff || m.isExcluded) continue;
        if (!inField(m.homeTeamId) || !inField(m.awayTeamId)) continue;
        for (const [id, my, their] of [
          [m.homeTeamId, m.homeScore, m.awayScore],
          [m.awayTeamId, m.awayScore, m.homeScore],
        ] as const) {
          if (mgrOf.get(id) !== managerId) continue;
          g++;
          w += my > their ? 1 : my === their ? 0.5 : 0;
        }
      }
    }
    if (g >= 6) {
      const p = pct(w, g);
      const detail = `${show(w, g)} in playoff games (${(p * 100).toFixed(0)}%)`;
      if (p >= 0.6) tags.push({ tag: "Clutch", detail, tone: "good" });
      else if (p <= 0.4) tags.push({ tag: "Playoff struggles", detail, tone: "bad" });
    }
  }
  return tags;
}
