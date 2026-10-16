import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals, computeLuck } from "@/lib/luck";
import { syncSeasonVor } from "@/lib/vor-store";
import { syncSeasonLineups, getStoredLineups, summarizeSeason } from "@/lib/lineup-store";
import { getPlayerRaces, buildTandems, getSleepingBeauty, PAST_WINNERS } from "@/lib/season-awards";
import { getAllStored } from "@/lib/vor-store";
import { syncPoolStats, loadPoolStats, buildTrendAwards } from "@/lib/player-trends";
import { fetchLineupSlots } from "@/lib/vor";
import { pts } from "@/lib/format";
import { loadAgeLookup } from "@/lib/trend-ages";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Move({ rank, prev }: { rank: number; prev: number | null | undefined }) {
  if (prev === undefined) return <span className="text-muted">-</span>;
  if (prev === null) return <span className="text-green-700">NEW</span>;
  const d = prev - rank;
  if (d === 0) return <span className="text-muted">-</span>;
  return <span className={d > 0 ? "text-green-700" : "text-red-700"}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>;
}

type Row = { key: string; name: string; sub: string; value: string; gap: string; rank: number; prev?: number | null };

function Card({ title, blurb, rows, note }: { title: string; blurb: string; rows: Row[]; note?: string }) {
  return (
    <div className="border border-ice-line bg-white p-4">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-xs text-muted mb-3">{blurb}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{note ?? "Nothing to show yet."}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-ice-line">
                <td className="py-1.5 pr-2 w-6 font-display">{r.rank}</td>
                <td className="py-1.5 pr-2 w-8 text-xs"><Move rank={r.rank} prev={r.prev} /></td>
                <td className="py-1.5 pr-2">
                  <div>{r.name}</div>
                  <div className="text-xs text-muted">{r.sub}</div>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <div className="font-bold">{r.value}</div>
                  <div className="text-xs text-muted">{r.gap}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// The season-long award races, updated as each week finishes. Player races use the stored weekly VOR; the manager
// races use the saved lineup efficiency and the standings.
export default async function SeasonAwardsView() {
  const meta = await getLeagueMeta();
  const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week))).sort((a, b) => a - b);

  const notes: string[] = [];
  try {
    const v = await syncSeasonVor(meta.season, meta.currentWeek);
    if (v.waiting > 0) notes.push(`${v.waiting} week(s) of player data still loading`);
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
        {through > 0 ? `Player races through week ${through}.` : "No finished weeks yet."} {notes.length > 0 ? `${notes.join("; ")}: refresh to continue.` : ""}
      </p>
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {playerCards}
        <Card
          title="Most Efficient Lineups"
          blurb="Highest season lineup efficiency: points scored vs. the best possible lineup, night by night."
          rows={top5(managers).map((m, i) => ({
            key: String(m.teamId), name: name(m.teamId), sub: `${pts(m.actual)} of ${pts(m.max)}`, value: pct(m.pct),
            gap: i === 0 ? "leader" : `-${((managers[0].pct - m.pct) * 100).toFixed(1)}%`, rank: i + 1,
          }))}
          note="No finished weeks saved yet."
        />
        <Card
          title="Presidents' Trophy"
          blurb="Best regular-season record (wins minus losses, then points for)."
          rows={top5(byRecord).map((t, i) => ({
            key: String(t.id), name: t.name, sub: `${pts(t.pointsFor)} PF`, value: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
            gap: "", rank: i + 1,
          }))}
        />
        <Card
          title="Most Points Scored"
          blurb="Total regular-season points for."
          rows={top5(byPoints).map((t, i) => ({
            key: String(t.id), name: t.name, sub: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, value: pts(t.pointsFor),
            gap: i === 0 ? "leader" : `-${pts(byPoints[0].pointsFor - t.pointsFor)}`, rank: i + 1,
          }))}
        />
        <Card
          title="Hard Luck Manager"
          blurb={`Actual wins vs. expected wins (every team against every other team, every week). The gap is shown as a share of expected wins (like -16% xWINS). The biggest shortfall wins.`}
          rows={top5(hardLuck).map((r, i) => ({
            key: String(r.teamId), name: name(r.teamId), sub: `${r.actW}-${r.actL}${r.actT ? `-${r.actT}` : ""} actual, ${r.expected.toFixed(1)} expected`,
            value: `${r.gap >= 0 ? "+" : "−"}${r.expected > 0 ? Math.abs((r.gap / r.expected) * 100).toFixed(0) : "0"}% xWINS`, gap: i === 0 ? "most unlucky" : `${(r.gap - hardLuck[0].gap).toFixed(1)} from the top`, rank: i + 1,
          }))}
          note="No finished weeks yet."
        />
        <Card
          title="William M. Jennings"
          blurb={`Most dominant goaltending tandem: each team's two best goalies, by fantasy points. Past winners: ${PAST_WINNERS.jennings.join(", ")}.`}
          rows={tandems.map((t) => ({
            key: String(t.teamId), name: name(t.teamId), sub: t.goalies.map((g) => `${g.name} ${pts(g.points)}`).join(" · "), value: `${pts(t.points)} pts`,
            gap: t.rank === 1 ? "leader" : `-${pts(tandems[0].points - t.points)}`, rank: t.rank,
          }))}
          note="No finished weeks saved yet."
        />
        <Card
          title="Sleeping Beauty"
          blurb={`The drafted player who out-produced his draft slot by the most (draft pick minus his finish by VOR among everyone drafted; keepers excluded). Past winners: ${PAST_WINNERS.sleeping.join(", ")}.`}
          rows={sleepers.map((p) => ({
            key: String(p.id), name: p.name, sub: `${p.position} · ${name(p.teamId)} · drafted #${p.pick}, now #${p.finish}`, value: `+${p.margin} spots`,
            gap: `${p.vor >= 0 ? "+" : ""}${pts(p.vor)} VOR`, rank: p.rank,
          }))}
          note="Needs the draft saved and at least one finished week."
        />
        {trends.map((t) => (
          <Card
            key={t.key}
            title={t.title}
            blurb={`${t.blurb}${PAST_WINNERS[t.key] ? ` Past winners: ${PAST_WINNERS[t.key].join(", ")}.` : ""}`}
            rows={t.entries.map((e) => { const age = ageOf(e.name, e.position, meta.season); return { key: String(e.id), name: e.name, sub: `${e.position}${age ? ` · age ~${age}` : ""} · ${e.detail}`, value: e.value, gap: "", rank: e.rank }; })}
            note="Nothing qualifies yet. Early in the season few players have enough games."
          />
        ))}
      </div>
    </div>
  );
}
