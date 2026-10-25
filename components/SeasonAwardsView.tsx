import Link from "next/link";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals, computeLuck } from "@/lib/luck";
import { syncSeasonVor } from "@/lib/vor-store";
import { syncLiveVor } from "@/lib/vor-live";
import { syncSeasonLineups, getStoredLineups, summarizeSeason } from "@/lib/lineup-store";
import { getPlayerRaces, buildTandems, getSleepingBeauty, PAST_WINNERS } from "@/lib/season-awards";
import { getAllStored } from "@/lib/vor-store";
import { syncPoolStats, loadPoolStats, buildTrendAwards } from "@/lib/player-trends";
import { fetchLineupSlots } from "@/lib/vor";
import { pts } from "@/lib/format";
import { loadAgeLookup } from "@/lib/trend-ages";
import { addedLabel } from "@/lib/roster-moves";
import { runPickupSyncStep } from "@/lib/pickup-sync";
import { getPickupLog, type PickupLogEntry } from "@/lib/best-pickup";
import { getMonsterCounts, getBiggestNights } from "@/lib/nightly-store";
import { getBiggestWeeks, getBiggestMonths } from "@/lib/vor-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { biggestTeamWeeks, biggestTeamMonths } from "@/lib/manager-bests";
import { getTeamLogos, getMonthlyPeriods } from "@/lib/content";
import PlayerPhoto from "@/components/PlayerPhoto";
import TeamLogo from "@/components/TeamLogo";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Move({ rank, prev }: { rank: number; prev: number | null | undefined }) {
  if (prev === undefined) return <span className="text-muted">-</span>;
  if (prev === null) return <span className="text-green-700">NEW</span>;
  const d = prev - rank;
  if (d === 0) return <span className="text-muted">-</span>;
  return <span className={d > 0 ? "text-green-700" : "text-red-700"}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>;
}

// playerId -> headshot; logo -> team logo (manager races). share (0-1) draws a bar against the leader.
type Row = { key: string; name: string; sub: string; value: string; gap: string; rank: number; prev?: number | null; playerId?: number; logo?: string; share?: number; when?: string };

function Face({ r, size }: { r: Row; size: number }) {
  if (r.playerId) return <PlayerPhoto playerId={r.playerId} name={r.name} size={size} />;
  if (r.logo) return <TeamLogo url={r.logo} name={r.name} size={size} />;
  return null;
}

function Card({ title, blurb, rows, note }: { title: string; blurb: string; rows: Row[]; note?: string }) {
  const [lead, ...rest] = rows;
  return (
    <div className="border border-ice-line bg-white overflow-hidden">
      <div className="p-4 pb-3">
        <h2 className="font-display text-xl">{title}</h2>
        <p className="text-xs text-muted">{blurb}</p>
      </div>
      {!lead ? (
        <p className="text-sm text-muted px-4 pb-4">{note ?? "Nothing to show yet."}</p>
      ) : (
        <>
          <div className="bg-gradient-to-br from-rink to-rink-deep text-ice px-4 py-3.5 border-l-4 border-gold flex items-center gap-3">
            <div className="shrink-0 relative">
              <Face r={lead} size={56} />
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gold text-rink-deep text-[11px] font-display flex items-center justify-center">1</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight truncate">{lead.name}</div>
              {lead.when && <span className="inline-block mt-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{lead.when}</span>}
              <div className="text-xs text-ice/70 break-words">{lead.sub}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-2xl leading-none">{lead.value}</div>
              <div className="text-[11px] text-ice/60 mt-1">{lead.gap}</div>
            </div>
          </div>
          {rest.length > 0 && (
            <ul className="divide-y divide-ice-line">
              {rest.map((r) => (
                <li key={r.key} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-4 font-display text-muted text-center shrink-0">{r.rank}</span>
                    <Face r={r} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      {r.when && <span className="inline-block rounded-full bg-ice-panel px-2 py-px text-[11px] font-semibold text-rink">{r.when}</span>}
                      <div className="text-xs text-muted break-words">{r.sub}</div>
                    </div>
                    <span className="text-xs w-8 text-right shrink-0"><Move rank={r.rank} prev={r.prev} /></span>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">{r.value}</div>
                      <div className="text-[11px] text-muted">{r.gap}</div>
                    </div>
                  </div>
                  {r.share !== undefined && (
                    <div className="mt-1.5 ml-7 h-1 rounded-full bg-ice-panel overflow-hidden">
                      <div className="h-full rounded-full bg-rink-bright" style={{ width: `${Math.max(3, Math.min(100, r.share * 100))}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// The season-long award races, updated as each week finishes. Player races use the stored weekly VOR; the manager
// races use the saved lineup efficiency and the standings.
export default async function SeasonAwardsView() {
  const meta = await getLeagueMeta();
  const [{ teams }, { matchups }, logos] = await Promise.all([getStandings(), getMatchups(), getTeamLogos()]);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week))).sort((a, b) => a - b);

  const notes: string[] = [];
  try {
    const v = await syncSeasonVor(meta.season, meta.currentWeek);
    if (v.waiting > 0) notes.push(`${v.waiting} week(s) of player data still loading`);
    if (v.waiting === 0) await syncLiveVor(meta.season, meta.currentWeek);
  } catch (e) {
    notes.push(`Player data: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const l = await syncSeasonLineups(meta.season, finished);
    if (l.waiting + l.failed.length > 0) notes.push(`${l.waiting + l.failed.length} week(s) of lineup data still loading`);
  } catch (e) {
    notes.push(`Lineup data: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const p = await syncPoolStats(meta.season);
    if (p.waiting > 0) notes.push(`${p.waiting} season(s) of league-wide player stats still loading`);
  } catch (e) {
    notes.push(`League-wide player stats: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const step = await runPickupSyncStep();
    if (step.errors.length > 0) notes.push(...step.errors);
    else if (!step.done) notes.push("Pickup tracking is still catching up");
  } catch (e) {
    notes.push(`Free-agent adds: ${e instanceof Error ? e.message : String(e)}`);
  }

  let races: Awaited<ReturnType<typeof getPlayerRaces>> = [];
  try {
    races = await getPlayerRaces(meta.season);
  } catch {
    /* shown as empty cards */
  }
  let managers: ReturnType<typeof summarizeSeason>["teams"] = [];
  try {
    managers = summarizeSeason(await getStoredLineups(meta.season)).teams;
  } catch {
    /* empty */
  }

  let tandems: ReturnType<typeof buildTandems> = [];
  try {
    tandems = buildTandems(await getAllStored(meta.season));
  } catch {
    /* empty */
  }
  let sleepers: Awaited<ReturnType<typeof getSleepingBeauty>> = [];
  try {
    sleepers = await getSleepingBeauty(meta.season);
  } catch {
    /* empty: the draft may not be stored yet */
  }
  let pickups: PickupLogEntry[] = [];
  try {
    const log = await getPickupLog(meta.season);
    if (log) pickups = log.slice(0, 5);
    else notes.push("Free-agent adds need the Week Days calendar saved (admin: Week Days)");
  } catch {
    /* empty */
  }
  let monsters: Awaited<ReturnType<typeof getMonsterCounts>> = [];
  try {
    monsters = (await getMonsterCounts(meta.season)).slice(0, 5);
  } catch {
    /* empty */
  }
  let teamMonthsSource: Awaited<ReturnType<typeof getMonthlyPeriods>> = [];
  let bigNights: Awaited<ReturnType<typeof getBiggestNights>> = [];
  let bigWeeks: Awaited<ReturnType<typeof getBiggestWeeks>> = [];
  let bigMonths: Awaited<ReturnType<typeof getBiggestMonths>> = [];
  try {
    const periods = await getMonthlyPeriods(meta.season);
    teamMonthsSource = periods;
    [bigNights, bigWeeks, bigMonths] = await Promise.all([getBiggestNights(meta.season, 5), getBiggestWeeks(meta.season, 5), getBiggestMonths(meta.season, periods, 5)]);
  } catch {
    /* empty */
  }
  const teamWeeks = biggestTeamWeeks(matchups, 5);
  const teamMonths = biggestTeamMonths(matchups, teamMonthsSource, 5);
  let trends: ReturnType<typeof buildTrendAwards> = [];
  try {
    const poolRows = await loadPoolStats(meta.season);
    const slots = await fetchLineupSlots(meta.season).catch(() => null);
    trends = buildTrendAwards(poolRows, meta.season, 5, { counts: slots, teamCount: teams.length });
  } catch {
    /* empty */
  }
  const ageOf = await loadAgeLookup(meta.season);
  // Hard Luck: actual wins minus the wins the all-play record says a team earned (most negative = unluckiest).
  const lastWeek = finished[finished.length - 1] ?? 0;
  const hardLuck = lastWeek > 0
    ? computeLuck(matchups, lastWeek).rows
        .map((r) => {
          const games = r.actW + r.actL + r.actT;
          const expected = r.expWinPct * games;
          const actual = r.actW + r.actT * 0.5;
          return { ...r, games, expected, actual, gap: actual - expected };
        })
        .sort((a, b) => a.gap - b.gap)
    : [];

  const byRecord = [...teams].sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor);
  const byPoints = [...teams].sort((a, b) => b.pointsFor - a.pointsFor);
  const top5 = <T,>(a: T[]) => a.slice(0, 5);

  const playerCards = races.map((r) => {
    const lead = r.entries[0];
    const val = (e: (typeof r.entries)[number]) => (r.award.metric === "vor" ? e.vor : e.points);
    const rows: Row[] = r.entries.map((e) => ({
      key: String(e.id),
      name: e.name,
      sub: `${e.position} · ${name(e.teamId)}`,
      value: r.award.metric === "vor" ? `${e.vor >= 0 ? "+" : ""}${pts(e.vor)} VOR` : `${pts(e.points)} pts`,
      gap: e.rank === 1 ? (r.award.metric === "vor" ? `${pts(e.points)} pts` : "leader") : `-${pts(val(lead) - val(e))}`,
      rank: e.rank,
      prev: r.through > 1 ? e.prevRank : undefined,
      playerId: e.id,
      share: val(lead) > 0 ? val(e) / val(lead) : undefined,
    }));
    return <Card key={r.award.key} title={r.award.title} blurb={`${r.award.blurb}${PAST_WINNERS[r.award.key] ? ` Past winners: ${PAST_WINNERS[r.award.key].join(", ")}.` : ""}`} rows={rows} note="No finished weeks saved yet." />;
  });

  const through = races[0]?.through ?? 0;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Season Awards</h1>
      <p className="text-muted mb-1 max-w-prose">
        The year-long races, updated as each week finishes. Arrows show movement since the previous week. Gaps are to the leader.
      </p>
      <p className="text-sm text-muted mb-4">
        {through > 0 ? `Player races through week ${through}${through >= meta.currentWeek ? " (in progress, updated daily)" : ""}.` : "No finished weeks yet."} {notes.length > 0 ? `${notes.join("; ")}: refresh to continue.` : ""}
      </p>
      <p className="text-sm mb-3"><Link href="/awards/pickups" className="text-rink underline">Full pickup log: every add, who started, who sat →</Link></p>
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {playerCards}
        <Card
          title="Most Efficient Lineups"
          blurb="Highest season lineup efficiency: points scored vs. the best possible lineup, night by night."
          rows={top5(managers).map((m, i) => ({
            key: String(m.teamId), name: name(m.teamId), sub: `${pts(m.actual)} of ${pts(m.max)}`, value: pct(m.pct),
            gap: i === 0 ? "leader" : `-${((managers[0].pct - m.pct) * 100).toFixed(1)}%`, rank: i + 1, logo: logos[m.teamId], share: managers[0].pct > 0 ? m.pct / managers[0].pct : undefined,
          }))}
          note="No finished weeks saved yet."
        />
        <Card
          title="Presidents' Trophy"
          blurb="Best regular-season record (wins minus losses, then points for)."
          rows={top5(byRecord).map((t, i) => ({
            key: String(t.id), name: t.name, sub: `${pts(t.pointsFor)} PF`, value: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
            gap: "", rank: i + 1, logo: logos[t.id],
          }))}
        />
        <Card
          title="Most Points Scored"
          blurb="Total regular-season points for."
          rows={top5(byPoints).map((t, i) => ({
            key: String(t.id), name: t.name, sub: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, value: pts(t.pointsFor),
            gap: i === 0 ? "leader" : `-${pts(byPoints[0].pointsFor - t.pointsFor)}`, rank: i + 1, logo: logos[t.id], share: byPoints[0].pointsFor > 0 ? t.pointsFor / byPoints[0].pointsFor : undefined,
          }))}
        />
        <Card
          title="Hard Luck Manager"
          blurb={`Actual wins vs. expected wins (every team against every other team, every week). The gap is shown as a share of expected wins (like -16% xWINS). The biggest shortfall wins.`}
          rows={top5(hardLuck).map((r, i) => ({
            key: String(r.teamId), name: name(r.teamId), sub: `${r.actW}-${r.actL}${r.actT ? `-${r.actT}` : ""} actual, ${r.expected.toFixed(1)} expected`,
            value: `${r.gap >= 0 ? "+" : "−"}${r.expected > 0 ? Math.abs((r.gap / r.expected) * 100).toFixed(0) : "0"}% xWINS`, gap: i === 0 ? "most unlucky" : `${(r.gap - hardLuck[0].gap).toFixed(1)} from the top`, rank: i + 1, logo: logos[r.teamId],
          }))}
          note="No finished weeks yet."
        />
        <Card
          title="William M. Jennings"
          blurb={`Most dominant goaltending tandem: each team's two best goalies, by fantasy points. Past winners: ${PAST_WINNERS.jennings.join(", ")}.`}
          rows={tandems.map((t) => ({
            key: String(t.teamId), name: name(t.teamId), sub: t.goalies.map((g) => `${g.name} ${pts(g.points)}`).join(" · "), value: `${pts(t.points)} pts`,
            gap: t.rank === 1 ? "leader" : `-${pts(tandems[0].points - t.points)}`, rank: t.rank, logo: logos[t.teamId], share: tandems[0].points > 0 ? t.points / tandems[0].points : undefined,
          }))}
          note="No finished weeks saved yet."
        />
        <Card
          title="Sleeping Beauty"
          blurb={`The drafted player who out-produced his draft slot by the most (draft pick minus his finish by VOR among everyone drafted; keepers excluded). Past winners: ${PAST_WINNERS.sleeping.join(", ")}.`}
          rows={sleepers.map((p) => ({
            key: String(p.id), name: p.name, sub: `${p.position} · ${name(p.teamId)} · drafted #${p.pick}, now #${p.finish}`, value: `+${p.margin} spots`,
            gap: `${p.vor >= 0 ? "+" : ""}${pts(p.vor)} VOR`, rank: p.rank, playerId: p.id,
          }))}
          note="Needs the draft saved and at least one finished week."
        />
        <Card
          title="Best Pickup"
          blurb="Best free-agent or waiver add of the season, tracked day by day from the add until the team drops him. Only games he started count (benched games don't), scored as VOR. Draft picks and trades never count."
          rows={pickups.map((p) => ({
            key: `${p.teamId}-${p.playerId}`,
            name: p.name,
            sub: `${p.position} · ${name(p.teamId)} · added ${addedLabel(p.addedAt)} (${p.source.toLowerCase()}) · ${p.started} start${p.started === 1 ? "" : "s"}${p.benched ? `, ${p.benched} benched` : ""}${p.droppedAt ? ` · dropped ${addedLabel(p.droppedAt)}` : ""}`,
            value: `${p.vor >= 0 ? "+" : ""}${pts(p.vor)} VOR`,
            gap: p.rank === 1 ? `${pts(p.pointsCounted)} pts` : `-${pts(pickups[0].vor - p.vor)}`,
            rank: p.rank,
            playerId: p.playerId,
          }))}
          note="No pickup has started a game yet. Adds are tracked from the draft; games show once the week finishes."
        />
        <Card
          title="Fantasy Monster"
          blurb="Most Monster Nights this season (7+ fantasy points for a forward or goalie, 6+ for a defenseman). Any player counts, rostered or not; ties go to the bigger best night."
          rows={monsters.map((m, i) => ({
            key: String(m.playerId),
            name: m.name,
            sub: `${m.position} · ${m.teamName || name(m.teamId)} · best night ${pts(m.best)}`,
            value: `${m.nights} night${m.nights === 1 ? "" : "s"}`,
            gap: i === 0 ? `${pts(m.total)} pts` : `-${monsters[0].nights - m.nights}`,
            rank: i + 1,
            playerId: m.playerId,
            share: monsters[0].nights > 0 ? m.nights / monsters[0].nights : undefined,
          }))}
          note="No Monster Nights yet this season."
        />
        <Card
          title="Biggest Night"
          blurb="The biggest single-night fantasy score of the season, any player, rostered or not."
          rows={bigNights.map((n, i) => ({
            key: `${n.playerId}-${n.date}`,
            name: n.name,
            when: prettyDate(n.date),
            sub: `${n.position} · ${n.teamName || name(n.teamId)}${n.statLine ? ` · ${n.statLine}` : ""}`,
            value: `${pts(n.points)} pts`,
            gap: i === 0 ? "record" : `-${pts(bigNights[0].points - n.points)}`,
            rank: i + 1,
            playerId: n.playerId,
            share: bigNights[0].points > 0 ? n.points / bigNights[0].points : undefined,
          }))}
          note="No nights saved yet."
        />
        <Card
          title="Biggest Week"
          blurb="The biggest single-week VOR of the season (points above a replacement player, so it counts the games he played)."
          rows={bigWeeks.map((w, i) => ({
            key: `${w.playerId}-${w.week}`,
            name: w.name,
            when: `Week ${w.week}`,
            sub: `${w.position} · ${name(w.teamId)}`,
            value: `${w.vor >= 0 ? "+" : ""}${pts(w.vor)} VOR`,
            gap: i === 0 ? `${pts(w.points)} pts` : `-${pts(bigWeeks[0].vor - w.vor)}`,
            rank: i + 1,
            playerId: w.playerId,
            share: bigWeeks[0].vor > 0 ? w.vor / bigWeeks[0].vor : undefined,
          }))}
          note="No finished weeks saved yet."
        />
        <Card
          title="Biggest Month"
          blurb="The biggest monthly VOR of the season (his weekly VOR added up across a Monthly Period)."
          rows={bigMonths.map((m, i) => ({
            key: `${m.playerId}-${m.periodLabel}`,
            name: m.name,
            when: `${m.periodLabel}${m.complete ? "" : " (in progress)"}`,
            sub: `${m.position} · ${name(m.teamId)}`,
            value: `${m.vor >= 0 ? "+" : ""}${pts(m.vor)} VOR`,
            gap: i === 0 ? `${pts(m.points)} pts` : `-${pts(bigMonths[0].vor - m.vor)}`,
            rank: i + 1,
            playerId: m.playerId,
            share: bigMonths[0].vor > 0 ? m.vor / bigMonths[0].vor : undefined,
          }))}
          note="Needs Monthly Periods set up (admin) and at least one finished week."
        />
        <Card
          title="Manager's Biggest Week"
          blurb="The highest single-week score by a team this season (regular-season games only)."
          rows={teamWeeks.map((w, i) => ({
            key: `${w.teamId}-${w.week}`,
            name: name(w.teamId),
            when: `Week ${w.week}`,
            sub: `${w.score > w.oppScore ? "beat" : w.score < w.oppScore ? "lost to" : "tied"} ${name(w.oppId)} ${pts(w.oppScore)}`,
            value: pts(w.score),
            gap: i === 0 ? "record" : `-${pts(teamWeeks[0].score - w.score)}`,
            rank: i + 1,
            logo: logos[w.teamId],
            share: teamWeeks[0].score > 0 ? w.score / teamWeeks[0].score : undefined,
          }))}
          note="No finished weeks yet."
        />
        <Card
          title="Manager's Biggest Month"
          blurb="The most points a team scored across one Monthly Period (weeks finished so far; unfinished months are marked)."
          rows={teamMonths.map((m, i) => ({
            key: `${m.teamId}-${m.periodLabel}`,
            name: name(m.teamId),
            when: `${m.periodLabel}${m.complete ? "" : " (in progress)"}`,
            sub: `${m.weeks} week${m.weeks === 1 ? "" : "s"} counted`,
            value: pts(m.points),
            gap: i === 0 ? "record" : `-${pts(teamMonths[0].points - m.points)}`,
            rank: i + 1,
            logo: logos[m.teamId],
            share: teamMonths[0].points > 0 ? m.points / teamMonths[0].points : undefined,
          }))}
          note="Needs Monthly Periods set up (admin) and at least one finished week."
        />
        {trends.map((t) => (
          <Card
            key={t.key}
            title={t.title}
            blurb={`${t.blurb}${PAST_WINNERS[t.key] ? ` Past winners: ${PAST_WINNERS[t.key].join(", ")}.` : ""}`}
            rows={t.entries.map((e) => { const age = ageOf(e.name, e.position, meta.season); return { key: String(e.id), name: e.name, sub: `${e.position}${age ? ` · age ~${age}` : ""} · ${e.detail}`, value: e.value, gap: "", rank: e.rank, playerId: e.id }; })}
            note="Nothing qualifies yet. Early in the season few players have enough games."
          />
        ))}
      </div>
    </div>
  );
}
