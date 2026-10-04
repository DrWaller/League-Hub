// Draft superlatives computed from the stored draft_picks table.
// Pure formulas + templated text, no AI step. Needs lib/draft.ts to have
// stored the draft first (/api/admin/draft-ingest?run=1).
//
// The Homer, Old Man Roster, Youth Movement and Most Hits & Blocks come from
// the projections spreadsheet (lib/player-sheet.ts) and appear only after
// /api/admin/draft-sheet-import?run=1 has been run.

import { sql } from "@/lib/db";
import { SheetMap, pickSheet, loadSheetMap, sheetLoadError } from "@/lib/player-sheet";

export interface PickRow {
  overall_pick: number;
  round: number;
  team_id: number;
  team_name: string;
  manager: string;
  player_name: string;
  position: string;
  is_keeper: boolean;
  auto_draft_type: number;
  adp: number | null;
  value: number | null;
}

// Teams need at least this many hand-made picks to be eligible for awards,
// so a team that was auto-drafted can't win or lose a "decision" award.
const MIN_MANUAL_PICKS = 8;

export async function loadPicks(season: number, source = "espn"): Promise<PickRow[]> {
  const { rows } = await sql`
    SELECT overall_pick, round, team_id, team_name, manager, player_name, position,
           is_keeper, auto_draft_type, adp::float AS adp, value::float AS value
    FROM draft_picks WHERE season = ${season} AND source = ${source}
    ORDER BY overall_pick;
  `;
  const picks = rows as unknown as PickRow[];
  // Attach the projections-sheet data so any caller of loadPicks gets it,
  // without needing to pass it along separately.
  (picks as any).__sheet = await loadSheetMap();
  return picks;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const ord = (n: number) => `pick #${n}`;

export function computeSuperlatives(all: PickRow[], sheetArg?: SheetMap) {
  const sheet: SheetMap | undefined = sheetArg && sheetArg.size > 0 ? sheetArg : (all as any).__sheet;
  const teamIds = Array.from(new Set(all.map((p) => p.team_id))).sort((a, b) => a - b);

  const teams = teamIds.map((id) => {
    const mine = all.filter((p) => p.team_id === id);
    const regular = mine.filter((p) => !p.is_keeper);
    const manual = regular.filter((p) => p.auto_draft_type === 0);
    const goaliesManual = manual.filter((p) => p.position === "G");
    const keeperGoalies = mine.filter((p) => p.is_keeper && p.position === "G").length;
    const adps = mine.map((p) => p.adp).filter((a): a is number => a != null);
    const mean = adps.reduce((t, a) => t + a, 0) / (adps.length || 1);
    const sd = Math.sqrt(adps.reduce((t, a) => t + (a - mean) ** 2, 0) / (adps.length || 1));
    const byAdp = mine.filter((p) => p.adp != null).sort((a, b) => (a.adp as number) - (b.adp as number));
    const autoByType: Record<string, number> = {};
    for (const p of regular) if (p.auto_draft_type) autoByType[String(p.auto_draft_type)] = (autoByType[String(p.auto_draft_type)] ?? 0) + 1;
    const manualValues = manual.map((p) => p.value).filter((v): v is number => v != null);
    // Whole 18-man roster (keepers included) matched to the projections sheet.
    const roster = mine.map((p) => ({ p, s: sheet && sheet.size ? pickSheet(sheet, p.player_name, p.position) : null }));
    const aged = roster.filter((x) => x.s?.age != null);
    const avgAge = aged.length >= 14 ? r2(aged.reduce((t, x) => t + (x.s!.age as number), 0) / aged.length) : null;
    const byAge = [...aged].sort((a, b) => (a.s!.age as number) - (b.s!.age as number));
    const byNhl = new Map<string, string[]>();
    for (const x of roster) {
      const t = x.s?.nhl_team;
      if (!t) continue;
      byNhl.set(t, [...(byNhl.get(t) ?? []), x.p.player_name]);
    }
    const homerTop = Array.from(byNhl.entries()).sort((a, b) => b[1].length - a[1].length)[0];
    const hbPlayers = roster.filter((x) => x.p.position !== "G" && x.s && (x.s.proj.HIT != null || x.s.proj.BLK != null));
    const hitsBlocks = hbPlayers.length >= 12 ? Math.round(hbPlayers.reduce((t, x) => t + (x.s!.proj.HIT ?? 0) + (x.s!.proj.BLK ?? 0), 0)) : null;
    return {
      teamId: id,
      sheetMatched: roster.filter((x) => x.s).length,
      avgAge,
      oldest: byAge.length ? byAge[byAge.length - 1] : null,
      youngest: byAge.length ? byAge[0] : null,
      homer: homerTop ? { team: homerTop[0], n: homerTop[1].length, players: homerTop[1] } : null,
      hitsBlocks,
      manager: mine[0]?.manager ?? `Team ${id}`,
      teamName: mine[0]?.team_name ?? "",
      regularPicks: regular.length,
      manualPicks: manual.length,
      autoPicks: regular.length - manual.length,
      autoByType,
      eligible: manual.length >= MIN_MANUAL_PICKS,
      keeperGoalies,
      goaliesDrafted: regular.filter((p) => p.position === "G").length,
      firstGoalie: goaliesManual[0] ?? null,
      adpSpread: r2(sd),
      stars: byAdp.slice(0, 2),
      scrub: byAdp.length ? byAdp[byAdp.length - 1] : null,
      avgAbsValue: manualValues.length ? r2(manualValues.reduce((t, v) => t + Math.abs(v), 0) / manualValues.length) : null,
      avgValue: manualValues.length ? r2(manualValues.reduce((t, v) => t + v, 0) / manualValues.length) : null,
    };
  });

  const eligible = teams.filter((t) => t.eligible);

  // Goalie Panic: earliest hand-made goalie pick.
  const withGoalie = eligible.filter((t) => t.firstGoalie).sort((a, b) => (a.firstGoalie!.overall_pick - b.firstGoalie!.overall_pick));
  const panic = withGoalie[0];
  const goaliePanic = panic
    ? {
        manager: panic.manager,
        pick: panic.firstGoalie!.overall_pick,
        round: panic.firstGoalie!.round,
        player: panic.firstGoalie!.player_name,
        keeperGoalies: panic.keeperGoalies,
        headline: `${panic.manager} spent ${ord(panic.firstGoalie!.overall_pick)} (round ${panic.firstGoalie!.round}) on ${panic.firstGoalie!.player_name}, the earliest goalie in the draft${
          panic.keeperGoalies > 0 ? `, despite already keeping ${panic.keeperGoalies} goalie${panic.keeperGoalies > 1 ? "s" : ""}` : ""
        }.`,
        runnersUp: withGoalie.slice(1, 3).map((t) => ({ manager: t.manager, pick: t.firstGoalie!.overall_pick, player: t.firstGoalie!.player_name })),
      }
    : null;

  // Goalie Patience: a team that drafted no goalie by hand, else the latest first goalie.
  const noGoalie = eligible.filter((t) => !t.firstGoalie);
  let goaliePatience: { manager: string; headline: string } | null = null;
  if (noGoalie.length) {
    goaliePatience = {
      manager: noGoalie.map((t) => t.manager).join(", "),
      headline: `${noGoalie.map((t) => t.manager).join(" and ")} never drafted a goalie${noGoalie.some((t) => t.keeperGoalies > 0) ? " (leaning on keeper goalies)" : ""}.`,
    };
  } else if (withGoalie.length) {
    const late = withGoalie[withGoalie.length - 1];
    goaliePatience = {
      manager: late.manager,
      headline: `${late.manager} waited until ${ord(late.firstGoalie!.overall_pick)} (round ${late.firstGoalie!.round}) for a first goalie: ${late.firstGoalie!.player_name}${late.keeperGoalies > 0 ? `, with ${late.keeperGoalies} keeper goalie${late.keeperGoalies > 1 ? "s" : ""} already on the roster` : ""}.`,
    };
  }

  // Stars & Scrubs / Balanced: spread of ADP across the whole 18-man roster (keepers included).
  const bySpread = [...eligible].sort((a, b) => b.adpSpread - a.adpSpread);
  const s = bySpread[0];
  const bal = bySpread[bySpread.length - 1];
  const starsAndScrubs = s
    ? {
        manager: s.manager,
        adpSpread: s.adpSpread,
        headline: `${s.manager} built the league's Stars & Scrubs roster: ${s.stars.map((p) => p.player_name).join(" and ")} up top, ${s.scrub ? s.scrub.player_name : "a long tail"} at the bottom.`,
      }
    : null;
  const balanced = bal && bal !== s
    ? { manager: bal.manager, adpSpread: bal.adpSpread, headline: `${bal.manager} has the most balanced roster, with the smallest gap between best and worst player.` }
    : null;

  // Contrarian / Consensus Follower: average distance from consensus on hand-made picks.
  const byDev = eligible.filter((t) => t.avgAbsValue != null).sort((a, b) => (b.avgAbsValue as number) - (a.avgAbsValue as number));
  const contrarian = byDev[0]
    ? { manager: byDev[0].manager, avgAbsValue: byDev[0].avgAbsValue, headline: `${byDev[0].manager} is the draft's Contrarian: on average his picks landed ${byDev[0].avgAbsValue} spots away from consensus.` }
    : null;
  const follower = byDev.length > 1
    ? { manager: byDev[byDev.length - 1].manager, avgAbsValue: byDev[byDev.length - 1].avgAbsValue, headline: `${byDev[byDev.length - 1].manager} stuck closest to consensus, averaging just ${byDev[byDev.length - 1].avgAbsValue} spots off.` }
    : null;

  // Auto-draft flags. Reason is unconfirmed, so wording stays neutral.
  const autoDraft = teams
    .filter((t) => t.autoPicks > 0)
    .sort((a, b) => b.autoPicks - a.autoPicks)
    .map((t) => ({
      manager: t.manager,
      autoPicks: t.autoPicks,
      of: t.regularPicks,
      byType: t.autoByType,
      headline:
        t.autoPicks === t.regularPicks
          ? `${t.manager}'s team was auto-drafted for all ${t.regularPicks} picks.`
          : `${t.manager} had ${t.autoPicks} of ${t.regularPicks} picks made by auto-draft.`,
    }));

  // Sheet-based awards (only when the projections sheet has been imported).
  const sheetReady = !!sheet && sheet.size > 0;
  const homerTeams = eligible.filter((t) => t.homer).sort((a, b) => (b.homer!.n - a.homer!.n));
  const hm = homerTeams[0];
  const theHomer = sheetReady && hm && hm.homer!.n >= 3
    ? { manager: hm.manager, nhlTeam: hm.homer!.team, count: hm.homer!.n, players: hm.homer!.players,
        headline: `${hm.manager} is The Homer: ${hm.homer!.n} of ${hm.sheetMatched} players are from ${hm.homer!.team} (${hm.homer!.players.slice(0, 5).join(", ")}).` }
    : null;
  const byAgeTeams = eligible.filter((t) => t.avgAge != null).sort((a, b) => (b.avgAge as number) - (a.avgAge as number));
  const oldT = byAgeTeams[0];
  const youngT = byAgeTeams[byAgeTeams.length - 1];
  const oldManRoster = sheetReady && oldT
    ? { manager: oldT.manager, avgAge: oldT.avgAge, headline: `${oldT.manager} runs the Old Man Roster, averaging ${oldT.avgAge} years old${oldT.oldest ? `, led by ${oldT.oldest.p.player_name} (${oldT.oldest.s!.age})` : ""}.` }
    : null;
  const youthMovement = sheetReady && youngT && youngT !== oldT
    ? { manager: youngT.manager, avgAge: youngT.avgAge, headline: `${youngT.manager} leads the Youth Movement, averaging just ${youngT.avgAge} years old${youngT.youngest ? `, with ${youngT.youngest.p.player_name} (${youngT.youngest.s!.age}) the youngest` : ""}.` }
    : null;
  const hbTeams = eligible.filter((t) => t.hitsBlocks != null).sort((a, b) => (b.hitsBlocks as number) - (a.hitsBlocks as number));
  const mostHitsBlocks = sheetReady && hbTeams[0]
    ? { manager: hbTeams[0].manager, total: hbTeams[0].hitsBlocks, headline: `${hbTeams[0].manager}'s roster is projected for ${hbTeams[0].hitsBlocks} hits and blocks, the most in the league.` }
    : null;

  return {
    note: "Awards only count teams with at least " + MIN_MANUAL_PICKS + " hand-made picks. Auto-draft type meanings (2 and 3) are unconfirmed.",
    goaliePanic,
    goaliePatience,
    starsAndScrubs,
    balanced,
    contrarian,
    consensusFollower: follower,
    theHomer,
    oldManRoster,
    youthMovement,
    mostHitsBlocks,
    sheetImported: sheetReady,
    sheetDebug: { sheetPlayersLoaded: sheet ? Array.from(sheet.values()).reduce((t, l) => t + l.length, 0) : 0, loadError: sheetLoadError() },
    autoDraft,
    teams: teams.map((t) => ({
      manager: t.manager,
      teamName: t.teamName,
      eligible: t.eligible,
      manualPicks: t.manualPicks,
      autoPicks: t.autoPicks,
      goaliesDrafted: t.goaliesDrafted,
      keeperGoalies: t.keeperGoalies,
      firstGoaliePick: t.firstGoalie?.overall_pick ?? null,
      adpSpread: t.adpSpread,
      avgAbsValue: t.avgAbsValue,
      avgValue: t.avgValue,
      sheetMatched: t.sheetMatched,
      avgAge: t.avgAge,
      nhlTeamMost: t.homer ? `${t.homer.team} x${t.homer.n}` : null,
      projHitsBlocks: t.hitsBlocks,
    })),
  };
}
