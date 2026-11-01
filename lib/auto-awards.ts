// Server-side only. Saves the weekly and monthly player awards on its own once the games are final, so nobody has
// to open the admin page and press "Suggest from stats" + "Save". Runs from the daily cron (see
// app/api/cron/nightly-blurbs/route.ts) and is safe to run any number of times:
//
//  - Weekly: a week is picked up once every game in it is final (playoff weeks: once the matchup period has moved on).
//  - Monthly: a month is picked up once every week in it is final. Periods you defined on the Monthly Periods page
//    are used as-is; any month you did NOT define is worked out from the week calendar (/admin/week-days) -- each
//    matchup week belongs to the calendar month holding most of its days -- and saved as a period, labelled like
//    "October 2026", so the admin page and newsletter see it too.
//  - Nothing already saved is ever overwritten, so anything you picked by hand stays exactly as you left it.
//  - Manager of the Month needs no saving: it is computed live from results.

import { sql, ensureSchema } from "./db";
import { getLeagueMeta, getMatchups } from "./espn";
import { addMonthlyPeriod, getMonthlyPeriods } from "./content";
import { getWeekCalendar } from "./week-calendar";
import { WeekCalendar } from "./week-calendar-utils";
import { suggestWeeklyAwards, suggestMonthlyAwards, awardNote, AwardSuggestions } from "./award-suggest";
import { AWARD_CATEGORIES, Matchup } from "./types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Period = { label: string; startWeek: number; endWeek: number };

// Weeks whose results are final. Regular-season weeks need every game final; a playoff week (where some
// consolation games may never be played) counts once the league has moved on to a later week.
function finishedWeeks(matchups: Matchup[], currentWeek: number): Set<number> {
  const byWeek = new Map<number, Matchup[]>();
  for (const m of matchups) {
    const list = byWeek.get(m.week) ?? [];
    list.push(m);
    byWeek.set(m.week, list);
  }
  const done = new Set<number>();
  byWeek.forEach((games, week) => {
    if (games.length === 0) return;
    const allFinal = games.every((g) => g.isFinal);
    const playoffWeek = games.some((g) => g.isPlayoff);
    if (allFinal || (playoffWeek && week < currentWeek)) done.add(week);
  });
  return done;
}

// One period per calendar month, from the week calendar. Week N covers its own run of days; the month with the
// most of those days owns the week (a tie goes to the later month), so a week of Sep 29 - Oct 4 counts as October.
export function derivePeriods(cal: WeekCalendar | null): Period[] {
  if (!cal || !cal.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(cal.startDate) || cal.lengths.length === 0) return [];
  const base = Date.parse(`${cal.startDate}T00:00:00Z`);
  const out: (Period & { key: string })[] = [];
  let day = 0;
  cal.lengths.forEach((len, i) => {
    const n = Math.max(1, len);
    const counts = new Map<string, { y: number; m: number; n: number }>();
    for (let d = 0; d < n; d++) {
      const dt = new Date(base + (day + d) * 86400000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const key = `${y}-${m}`;
      const c = counts.get(key) ?? { y, m, n: 0 };
      c.n++;
      counts.set(key, c);
    }
    day += n;
    let best: { y: number; m: number; n: number } | null = null;
    counts.forEach((c) => {
      if (!best || c.n >= best.n) best = c; // dates run in order, so >= hands ties to the later month
    });
    if (!best) return;
    const { y, m } = best as { y: number; m: number };
    const key = `${y}-${m}`;
    const week = i + 1;
    const last = out[out.length - 1];
    if (last && last.key === key) last.endWeek = week;
    else out.push({ key, label: `${MONTH_NAMES[m]} ${y}`, startWeek: week, endWeek: week });
  });
  return out.map(({ label, startWeek, endWeek }) => ({ label, startWeek, endWeek }));
}

// ---------- weekly ----------

async function saveWeekly(season: number, week: number, s: AwardSuggestions): Promise<number> {
  let saved = 0;
  for (const cat of AWARD_CATEGORIES) {
    const pick = s[cat];
    if (!pick) continue;
    const r = await sql`
      INSERT INTO weekly_awards (season, week, category, player_name, team_id, note, updated_at)
      VALUES (${season}, ${week}, ${cat}, ${pick.playerName}, ${pick.teamId}, ${awardNote(pick)}, now())
      ON CONFLICT (season, week, category) DO NOTHING
      RETURNING category;
    `;
    saved += r.rows.length;
  }
  return saved;
}

async function runWeekly(season: number, finished: Set<number>, limit: number) {
  const out: { generated: number[]; waiting: number[]; alreadyDone: number } = { generated: [], waiting: [], alreadyDone: 0 };
  // Newest finished week first, so the week that just ended is never stuck behind older gaps.
  const weeks = Array.from(finished).sort((a, b) => b - a);
  let attempts = 0;
  for (const week of weeks) {
    const have = await sql`SELECT 1 FROM weekly_awards WHERE season = ${season} AND week = ${week} LIMIT 1;`;
    if (have.rows.length > 0) {
      out.alreadyDone++;
      continue;
    }
    if (attempts >= limit) break;
    attempts++;
    const result = await suggestWeeklyAwards(week);
    if (!result.suggestions) {
      out.waiting.push(week); // stats not posted yet -- the next run tries again
      continue;
    }
    if ((await saveWeekly(season, week, result.suggestions)) > 0) out.generated.push(week);
  }
  return out;
}

// ---------- monthly ----------

async function saveMonthly(season: number, label: string, s: AwardSuggestions): Promise<number> {
  let saved = 0;
  for (const cat of AWARD_CATEGORIES) {
    const pick = s[cat];
    if (!pick) continue;
    const r = await sql`
      INSERT INTO monthly_awards (season, period_label, category, player_name, team_id, note, updated_at)
      VALUES (${season}, ${label}, ${cat}, ${pick.playerName}, ${pick.teamId}, ${awardNote(pick)}, now())
      ON CONFLICT (season, period_label, category) DO NOTHING
      RETURNING category;
    `;
    saved += r.rows.length;
  }
  return saved;
}

async function runMonthly(season: number, finished: Set<number>, limit: number) {
  const out: { generated: string[]; waiting: string[]; createdPeriods: string[]; alreadyDone: number; note?: string } = {
    generated: [],
    waiting: [],
    createdPeriods: [],
    alreadyDone: 0,
  };

  const defined = await getMonthlyPeriods(season);
  const cal = await getWeekCalendar(season);
  const derived = derivePeriods(cal);
  if (defined.length === 0 && derived.length === 0) {
    out.note = "No monthly periods defined and no week calendar saved (/admin/week-days), so there is nothing to work out months from.";
    return out;
  }

  // Your own periods win. A derived month is used only if it doesn't share a label or any week with one of yours.
  const overlaps = (a: Period, b: Period) => a.startWeek <= b.endWeek && b.startWeek <= a.endWeek;
  const candidates: (Period & { derived: boolean })[] = [
    ...defined.map((p) => ({ label: p.label, startWeek: p.startWeek, endWeek: p.endWeek, derived: false })),
    ...derived
      .filter((d) => !defined.some((p) => p.label === d.label || overlaps(p, d)))
      .map((d) => ({ ...d, derived: true })),
  ].sort((a, b) => b.startWeek - a.startWeek); // newest month first

  let attempts = 0;
  for (const p of candidates) {
    const have = await sql`SELECT 1 FROM monthly_awards WHERE season = ${season} AND period_label = ${p.label} LIMIT 1;`;
    if (have.rows.length > 0) {
      out.alreadyDone++;
      continue;
    }
    let complete = true;
    for (let w = p.startWeek; w <= p.endWeek; w++) {
      if (!finished.has(w)) {
        complete = false;
        break;
      }
    }
    if (!complete) continue; // the month isn't over yet
    if (attempts >= limit) break;
    attempts++;

    const result = await suggestMonthlyAwards(p.startWeek, p.endWeek);
    if (!result.suggestions) {
      out.waiting.push(p.label);
      continue;
    }
    if (p.derived) {
      await addMonthlyPeriod(season, p.label, p.startWeek, p.endWeek);
      out.createdPeriods.push(p.label);
    }
    if ((await saveMonthly(season, p.label, result.suggestions)) > 0) out.generated.push(p.label);
  }
  return out;
}

// ---------- entry point ----------

export async function runAutoAwards(opts: { weeklyLimit?: number; monthlyLimit?: number; skipMonthlyIf?: () => boolean } = {}) {
  const { weeklyLimit = 1, monthlyLimit = 1, skipMonthlyIf } = opts;
  await ensureSchema();
  const meta = await getLeagueMeta();
  if (!meta.liveDataConnected) return { ok: false, skipped: "ESPN isn't connected." };
  const { matchups, live } = await getMatchups();
  if (!live || matchups.length === 0) return { ok: false, skipped: "No live schedule from ESPN." };

  const finished = finishedWeeks(matchups, meta.currentWeek);
  const out: Record<string, unknown> = { ok: true, season: meta.season, currentWeek: meta.currentWeek };
  try {
    out.weekly = await runWeekly(meta.season, finished, weeklyLimit);
  } catch (e) {
    out.weekly = { error: e instanceof Error ? e.message : String(e) };
  }
  if (skipMonthlyIf?.()) {
    out.monthly = { skipped: "Ran out of time this run -- the next run picks it up." };
  } else {
    try {
      out.monthly = await runMonthly(meta.season, finished, monthlyLimit);
    } catch (e) {
      out.monthly = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}
