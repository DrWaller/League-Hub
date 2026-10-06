// Decides which player nights are "big" and writes the blurb for each. Pure
// functions only (no ESPN, no database), so it's easy to test and to tune.
//
// ALL the tunable numbers live in NIGHTLY just below. The fantasy-points
// thresholds are starting guesses: open /api/admin/nightly-blurbs (dry run)
// for a past day to see how many blurbs they'd produce and what a normal
// top score looks like in YOUR league's scoring, then adjust.

import { STAT_ID, statLine } from "./espn-stats";
import { pts } from "./format";
import type { DailyPlayerLine } from "./espn-daily";

export const NIGHTLY = {
  skater: {
    hatTrickGoals: 3, // goals in one night
    goalsPlusAssists: 4, // points in one night
    shots: 8, // shots on goal
    fantasy: 8, // fantasy points (safety net for nights the stat triggers miss)
  },
  goalie: {
    bigSaves: 40, // saves in one night (a shutout always counts, whatever the saves)
    fantasy: 8, // fantasy points
    meltdownGoalsAgainst: 6, // only used when includeMeltdowns is true
  },
  includeMeltdowns: false, // true adds a roast blurb for a goalie who gives up 6+
  maxPerNight: 6, // a heavy slate never floods the page; best nights win
};

export type BlurbKind =
  | "HAT_TRICK"
  | "BIG_POINTS"
  | "SHOT_VOLUME"
  | "BIG_NIGHT"
  | "SHUTOUT"
  | "SAVE_FEST"
  | "GOALIE_BIG"
  | "MELTDOWN";

export interface Candidate {
  player: DailyPlayerLine;
  kind: BlurbKind;
  triggers: string[]; // every rule that fired, for the dry run
}

export interface NightlyBlurb {
  playerId: number;
  playerName: string;
  position: string;
  teamId: number;
  teamName: string;
  points: number;
  active: boolean;
  kind: BlurbKind;
  statLine: string | null;
  text: string;
}

function n(stats: Record<string, number> | undefined, id: string): number {
  const v = Number(stats?.[id]);
  return Number.isFinite(v) ? v : 0;
}

// Returns the one kind that best describes the night (most specific first), or
// null for an ordinary night.
export function classify(p: DailyPlayerLine): Candidate | null {
  const s = p.stats;
  const triggers: string[] = [];

  if (p.position === "G") {
    const saves = n(s, STAT_ID.saves);
    const ga = n(s, STAT_ID.goalsAgainst);
    const shutout = n(s, STAT_ID.shutouts) >= 1;
    if (shutout) triggers.push("shutout");
    if (saves >= NIGHTLY.goalie.bigSaves) triggers.push(`${NIGHTLY.goalie.bigSaves}+ saves`);
    if (p.points >= NIGHTLY.goalie.fantasy) triggers.push(`fantasy >= ${NIGHTLY.goalie.fantasy}`);
    const meltdown = NIGHTLY.includeMeltdowns && ga >= NIGHTLY.goalie.meltdownGoalsAgainst;
    if (meltdown) triggers.push(`${NIGHTLY.goalie.meltdownGoalsAgainst}+ goals against`);
    if (!triggers.length) return null;
    const kind: BlurbKind = shutout
      ? "SHUTOUT"
      : saves >= NIGHTLY.goalie.bigSaves
        ? "SAVE_FEST"
        : p.points >= NIGHTLY.goalie.fantasy
          ? "GOALIE_BIG"
          : "MELTDOWN";
    return { player: p, kind, triggers };
  }

  const g = n(s, STAT_ID.goals);
  const a = n(s, STAT_ID.assists);
  const sog = n(s, STAT_ID.shotsOnGoal);
  if (g >= NIGHTLY.skater.hatTrickGoals) triggers.push("hat trick");
  if (g + a >= NIGHTLY.skater.goalsPlusAssists) triggers.push(`${NIGHTLY.skater.goalsPlusAssists}+ points`);
  if (sog >= NIGHTLY.skater.shots) triggers.push(`${NIGHTLY.skater.shots}+ shots`);
  if (p.points >= NIGHTLY.skater.fantasy) triggers.push(`fantasy >= ${NIGHTLY.skater.fantasy}`);
  if (!triggers.length) return null;
  const kind: BlurbKind =
    g >= NIGHTLY.skater.hatTrickGoals
      ? "HAT_TRICK"
      : g + a >= NIGHTLY.skater.goalsPlusAssists
        ? "BIG_POINTS"
        : sog >= NIGHTLY.skater.shots
          ? "SHOT_VOLUME"
          : "BIG_NIGHT";
  return { player: p, kind, triggers };
}

// ---------------------------------------------------------------- the words

interface Ctx {
  name: string;
  team: string;
  pts: string; // two decimals, via pts()
  ln: string; // " (4 G · 4 A · 10 SOG)" or "" when ESPN gave no breakdown
  g: number;
  points: number; // goals + assists
  sog: number;
  saves: number;
  ga: number;
}

const TEMPLATES: Record<BlurbKind, ((c: Ctx) => string)[]> = {
  HAT_TRICK: [
    (c) => `${c.name} scored ${c.g} goals for ${c.team}, good for ${c.pts} fantasy points${c.ln}.`,
    (c) => `Hat trick for ${c.name}. ${c.pts} points${c.ln}.`,
    (c) => `${c.name} lit the lamp ${c.g} times for ${c.pts} points${c.ln}.`,
  ],
  BIG_POINTS: [
    (c) => `${c.name} racked up ${c.points} points for ${c.team}: ${c.pts} fantasy points${c.ln}.`,
    (c) => `A ${c.points}-point night for ${c.name}, ${c.pts} fantasy points${c.ln}.`,
    (c) => `${c.name} kept the scoresheet busy: ${c.pts} points${c.ln}.`,
  ],
  SHOT_VOLUME: [
    (c) => `${c.name} fired ${c.sog} shots on goal for ${c.team} and finished with ${c.pts} points${c.ln}.`,
    (c) => `${c.sog} shots on goal for ${c.name}, worth ${c.pts} fantasy points${c.ln}.`,
    (c) => `${c.name} peppered the net with ${c.sog} shots for ${c.pts} points${c.ln}.`,
  ],
  BIG_NIGHT: [
    (c) => `${c.name} put up ${c.pts} fantasy points for ${c.team}${c.ln}.`,
    (c) => `Big night from ${c.name}: ${c.pts} points${c.ln}.`,
    (c) => `${c.name} came up big for ${c.team} with ${c.pts} points${c.ln}.`,
  ],
  SHUTOUT: [
    (c) => `${c.name} posted a shutout for ${c.team}, stopping ${c.saves} shots for ${c.pts} fantasy points.`,
    (c) => `Zero goals against for ${c.name}: ${c.saves} saves, ${c.pts} points.`,
    (c) => `${c.name} slammed the door with ${c.saves} saves and a shutout, worth ${c.pts}.`,
  ],
  SAVE_FEST: [
    (c) => `${c.name} stopped ${c.saves} shots for ${c.team}, finishing with ${c.pts} points${c.ln}.`,
    (c) => `${c.saves} saves from ${c.name}, good for ${c.pts} fantasy points${c.ln}.`,
    (c) => `${c.name} stood on his head: ${c.saves} saves and ${c.ga} goals against, ${c.pts} points.`,
  ],
  GOALIE_BIG: [
    (c) => `${c.name} was strong in net for ${c.team}: ${c.pts} fantasy points${c.ln}.`,
    (c) => `Big night between the pipes for ${c.name}, ${c.pts} points${c.ln}.`,
    (c) => `${c.name} delivered ${c.pts} points for ${c.team}${c.ln}.`,
  ],
  MELTDOWN: [
    (c) => `${c.name} had a rough one for ${c.team}: ${c.ga} goals against, ${c.pts} points${c.ln}.`,
    (c) => `${c.ga} goals against for ${c.name}, and ${c.pts} points to show for it${c.ln}.`,
    (c) => `${c.name} got shelled: ${c.ga} goals allowed, ${c.pts} points${c.ln}.`,
  ],
};

// Same player + same night always picks the same wording, so re-running a
// night never shuffles the text, while different players still get variety.
function pick<T>(arr: T[], playerId: number, period: number): T {
  const i = Math.abs(playerId * 31 + period) % arr.length;
  return arr[i];
}

function benchNote(team: string, slotId: number): string {
  return slotId === 8
    ? ` ${team} had him stashed on IR, so none of it counted.`
    : ` ${team} left him on the bench, so none of it counted.`;
}

export function writeBlurb(c: Candidate, teamName: string, period: number): NightlyBlurb {
  const p = c.player;
  const line = statLine(p.position, p.stats);
  const ctx: Ctx = {
    name: p.name,
    team: teamName,
    pts: pts(p.points),
    ln: line ? ` (${line})` : "",
    g: n(p.stats, STAT_ID.goals),
    points: n(p.stats, STAT_ID.goals) + n(p.stats, STAT_ID.assists),
    sog: n(p.stats, STAT_ID.shotsOnGoal),
    saves: n(p.stats, STAT_ID.saves),
    ga: n(p.stats, STAT_ID.goalsAgainst),
  };
  let text = pick(TEMPLATES[c.kind], p.id, period)(ctx);
  if (!p.active) text += benchNote(teamName, p.slotId);
  return {
    playerId: p.id,
    playerName: p.name,
    position: p.position,
    teamId: p.teamId,
    teamName,
    points: p.points,
    active: p.active,
    kind: c.kind,
    statLine: line,
    text,
  };
}

export interface NightScan {
  blurbs: NightlyBlurb[]; // what would be published (capped)
  considered: { name: string; position: string; points: number; kind: BlurbKind; triggers: string[]; cut: boolean }[];
  topScorers: { name: string; position: string; points: string; statLine: string | null; active: boolean }[];
  scanned: number;
}

export function scanNight(players: DailyPlayerLine[], teamNames: Record<number, string>, period: number): NightScan {
  const cands = players
    .map(classify)
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => Math.abs(b.player.points) - Math.abs(a.player.points));
  const kept = cands.slice(0, NIGHTLY.maxPerNight);
  const topScorers = [...players]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)
    .map((p) => ({ name: p.name, position: p.position, points: pts(p.points), statLine: statLine(p.position, p.stats), active: p.active }));
  return {
    blurbs: kept.map((c) => writeBlurb(c, teamNames[c.player.teamId] ?? `Team ${c.player.teamId}`, period)),
    considered: cands.map((c, i) => ({
      name: c.player.name,
      position: c.player.position,
      points: c.player.points,
      kind: c.kind,
      triggers: c.triggers,
      cut: i >= NIGHTLY.maxPerNight,
    })),
    topScorers,
    scanned: players.length,
  };
}

// ---------------------------------------------------------------- dates

function ymdToronto(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// The calendar date (YYYY-MM-DD, Toronto) of a scoring day. A scoring day is
// one calendar day, so it's today's date minus how many days ESPN's current
// day is ahead of it. Label only: the stats themselves never depend on it.
export function nightDate(currentPeriod: number, period: number, now: Date = new Date()): string {
  const [y, m, d] = ymdToronto(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - (currentPeriod - period), 12)).toISOString().slice(0, 10);
}

// Oldest night date still worth calling "last night" on the home page.
export function recentCutoff(daysBack = 2, now: Date = new Date()): string {
  const [y, m, d] = ymdToronto(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysBack, 12)).toISOString().slice(0, 10);
}

export function prettyDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
