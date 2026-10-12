import Link from "next/link";
import { getLeagueMeta, fetchPoolRaw } from "@/lib/espn";
import { listImportedSeasons } from "@/lib/imported-seasons";
import { fetchEspnDraftPicks } from "@/lib/past-drafts";
import { getSeasonBundle, byRecord as recordOrder } from "@/lib/season-data";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { fetchLineupSlots } from "@/lib/vor";
import { regularSeasonFinals, computeLuck } from "@/lib/luck";
import { syncPoolSeasons, loadPoolStats, buildTrendAwards } from "@/lib/player-trends";
import { seasonLeaders, rosterableBar, sleepingBeautyEstimate, type PastEntry, type DraftPickLite } from "@/lib/past-awards";
import { sql } from "@/lib/db";
import { PAST_WINNERS } from "@/lib/season-awards";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIRST_SEASON = 2020;

type Row = { key: string; name: string; sub: string; value: string; rank: number };

function Card({ title, blurb, rows, recorded, note }: { title: string; blurb: string; rows: Row[]; recorded?: string; note?: string }) {
  return (
    <div className="border border-ice-line bg-white p-4">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-xs text-muted mb-1">{blurb}</p>
      {recorded && <p className="text-xs mb-3"><b>Recorded winner:</b> {recorded}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{note ?? "Nothing to show."}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-ice-line">
                <td className="py-1.5 pr-2 w-6 font-display">{r.rank}</td>
                <td className="py-1.5 pr-2">
                  <div>{r.name}</div>
                  <div className="text-xs text-muted">{r.sub}</div>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap font-bold">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const playerRows = (list: PastEntry[]): Row[] => list.map((e) => ({ key: String(e.id), name: e.name, sub: `${e.position} · ${e.detail}`, value: e.value, rank: e.rank }));

// Rebuilds one finished season's awards from ESPN's saved history. Loads at most one season of player stats per visit
// (three ESPN reads); everything is then kept in the database, so each season is only ever fetched once.
export default async function PastAwardsPage({ searchParams }: { searchParams: { season?: string } }) {
  const meta = await getLeagueMeta();
  const seasons: number[] = [];
  for (let s = meta.season - 1; s >= FIRST_SEASON; s--) seasons.push(s);
  const season = Number(searchParams.season) >= FIRST_SEASON && Number(searchParams.season) < meta.season ? Number(searchParams.season) : seasons[0];

  const notes: string[] = [];
  const needed = [season, season - 1, season - 2, season - 3];
  let missingPriors: number[] = [];
  try {
    const sync = await syncPoolSeasons(needed, meta.season, 1);
    if (sync.waiting > 0) notes.push(`${sync.waiting} more season(s) of player stats to load. Refresh to continue.`);
    if (sync.empty.length > 0) {
      notes.push(`No player stats could be loaded for ${sync.empty.join(", ")}.`);
      if (sync.empty.includes(season)) {
        const diag = await fetchPoolRaw({ players: { limit: 3 } }, season).catch(() => null);
        notes.push(diag ? `ESPN's answer for ${season}: ${diag.status ?? "no response"}${diag.snippet ? ` ${diag.snippet}` : diag.data ? " (it answered, but the season has no player stats)" : ""}.` : "");
      }
    }
  } catch (e) {
    notes.push(`Player stats: ${e instanceof Error ? e.message : String(e)}`);
  }

  let rows: Awaited<ReturnType<typeof loadPoolStats>> = [];
  try {
    rows = await loadPoolStats(season);
  } catch (e) {
    notes.push(`Could not read saved stats: ${e instanceof Error ? e.message : String(e)}`);
  }
  const haveSeason = new Set(rows.map((r) => r.season));
  missingPriors = [season - 1, season - 2, season - 3].filter((s) => !haveSeason.has(s));

  // Standings and matchups come from the same provider as League History: a season played on Fantrax never touches
  // ESPN (it uses the weekly scores entered by hand, or nothing), any other season comes from ESPN.
  const [bundle, imported, elsewhere, seasonSlots, currentSlots] = await Promise.all([
    getSeasonBundle(season).catch(() => null),
    listImportedSeasons().catch(() => [] as number[]),
    getPlayedElsewhereSeasons().catch(() => new Set<number>()),
    fetchLineupSlots(season).catch(() => null),
    fetchLineupSlots(meta.season).catch(() => null),
  ]);
  const playedElsewhere = elsewhere.has(season);
  // A Fantrax season has no ESPN lineup settings, so it borrows the current season's slots.
  const counts = playedElsewhere ? currentSlots : seasonSlots ?? currentSlots;
  const teams = bundle?.teams ?? null;
  const matchupData = { matchups: bundle?.matchups ?? [] };
  const teamName = (id: number) => teams?.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const recordedFor = (key: string) => PAST_WINNERS[key]?.find((w) => w.startsWith(`${season}:`))?.replace(`${season}: `, "");

  const leaders = haveSeason.has(season) ? seasonLeaders(rows, season, counts, teams?.length ?? meta.size) : null;
  const trendsReady = haveSeason.has(season) && missingPriors.length === 0;
  const trends = trendsReady ? buildTrendAwards(rows, season, 5, rosterableBar(rows, season, counts, teams?.length ?? meta.size)) : [];
  const noStats = haveSeason.has(season) ? "" : `Player stats for ${season} are not loaded yet.`;

  // Hard Luck: actual wins against the wins the all-play record says the team earned, as a share of expected wins.
  const finals = regularSeasonFinals(matchupData.matchups);
  const lastWeek = finals.reduce((m, x) => Math.max(m, x.week), 0);
  const hardLuck = lastWeek > 0
    ? computeLuck(matchupData.matchups, lastWeek).rows
        .map((r) => {
          const games = r.actW + r.actL + r.actT;
          const expected = r.expWinPct * games;
          const actual = r.actW + r.actT * 0.5;
          return { ...r, expected, actual, pctGap: expected > 0 ? (actual - expected) / expected : 0 };
        })
        .sort((a, b) => a.pctGap - b.pctGap)
    : [];

  const byRecord = teams ? [...teams].sort(recordOrder) : [];
  const byPoints = teams ? [...teams].sort((a, b) => b.pointsFor - a.pointsFor) : [];
  const rec = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;

  // Sleeping Beauty: this season's draft against the estimated season VOR. The saved draft is used when there is one;
  // otherwise an ESPN season's draft is read from ESPN directly.
  let sleepers: ReturnType<typeof sleepingBeautyEstimate> = [];
  let sleeperNote = "";
  if (leaders) {
    let picks: DraftPickLite[] = [];
    try {
      const d = await sql`SELECT overall_pick, player_id, player_name, position, team_name, is_keeper, source FROM draft_picks WHERE season = ${season} ORDER BY overall_pick;`;
      const source = d.rows.some((r) => r.source === "espn") ? "espn" : d.rows[0]?.source;
      picks = d.rows
        .filter((r) => r.source === source)
        .map((r) => ({ overallPick: Number(r.overall_pick), playerId: r.player_id == null ? null : Number(r.player_id), name: String(r.player_name ?? ""), position: String(r.position ?? ""), teamName: String(r.team_name ?? ""), keeper: Boolean(r.is_keeper) }));
    } catch {
      /* no draft table: handled below */
    }
    if (picks.length === 0 && !playedElsewhere) {
      const live = await fetchEspnDraftPicks(season, rows);
      picks = live.picks;
      sleeperNote = live.note;
    }
    if (picks.length === 0 && !sleeperNote) {
      let saved = "none";
      try {
        const d = await sql`SELECT season, source, COUNT(*)::int AS n FROM draft_picks GROUP BY season, source ORDER BY season DESC;`;
        if (d.rows.length > 0) saved = d.rows.map((r) => `${r.season} (${r.source}, ${r.n} picks)`).join(", ");
      } catch {
        /* leave "none" */
      }
      sleeperNote = `No ${season} draft is saved in the site's database. Drafts saved so far: ${saved}.`;
    }
    sleepers = sleepingBeautyEstimate(picks, leaders.vorAll);
  }

  const estimate = "Estimate: season totals, one replacement level for the whole year.";

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Past Season Awards</h1>
      <p className="text-muted mb-3 max-w-prose">
        Rebuilds a finished season's award races from ESPN's saved history. These are computed leaders, shown next to the winner you recorded where there is one. Where the real award was a manager vote, your recorded winner stands.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {seasons.map((s) => (
          <Link key={s} href={`/admin/past-awards?season=${s}`} className={`px-3 py-1 border text-sm ${s === season ? "bg-ink text-white" : "border-ice-line bg-white"}`}>
            {s}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted mb-1">{season} here means the {season - 1}-{String(season).slice(2)} season, matching your award banners.</p>
      {playedElsewhere && (
        <p className="text-sm mb-1">
          {season} was played on Fantrax. Hard Luck, Presidents&apos; Trophy and Most Points use the weekly scores entered under Fantrax Scores{bundle ? "" : " (none entered yet, so they are empty)"}. {imported.includes(season) ? "The player cards use the Fantrax stats you imported for this season, scored with your league's own scoring." : "The player cards use ESPN's scoring, so they are hypothetical for this year."} Your recorded winners stand.
        </p>
      )}
      {notes.length > 0 && <p className="text-sm text-muted mb-1">{notes.join(" ")}</p>}
      {!haveSeason.has(season) && <p className="text-sm mb-3">Player stats for {season} are not saved yet. Refresh this page to load them (one season per visit).</p>}
      {haveSeason.has(season) && missingPriors.length > 0 && (
        <p className="text-sm text-muted mb-3">Breakout, Bounce Back, Most Improved and Calder need the three earlier seasons ({missingPriors.join(", ")} still missing). Refresh to load them.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 mb-4 mt-3">
        <Card title="Hart Trophy" blurb={`Highest season VOR, any position. ${estimate}`} rows={playerRows(leaders?.hart ?? [])} recorded={recordedFor("hart")} note={noStats || "Needs the league's lineup slots."} />
        <Card title="Art Ross Trophy" blurb="Most fantasy points among skaters (exact)." rows={playerRows(leaders?.artross ?? [])} recorded={recordedFor("artross")} note={noStats || "Nothing to show."} />
        <Card title="Norris Trophy" blurb={`Highest season VOR among D. ${estimate}`} rows={playerRows(leaders?.norris ?? [])} recorded={recordedFor("norris")} note={noStats || "Needs the league's lineup slots."} />
        <Card title="Vezina Trophy" blurb={`Highest season VOR among G. ${estimate}`} rows={playerRows(leaders?.vezina ?? [])} recorded={recordedFor("vezina")} note={noStats || "Needs the league's lineup slots."} />
        <Card title="Forward of the Year" blurb={`Highest season VOR among C, LW and RW. ${estimate}`} rows={playerRows(leaders?.forward ?? [])} note={noStats || "Needs the league's lineup slots."} />
        <Card
          title="Sleeping Beauty"
          blurb={`The drafted player who out-produced his draft slot by the most (draft pick minus his finish by season VOR among everyone drafted; keepers excluded). ${estimate}`}
          rows={sleepers.map((p) => ({ key: `${p.pick}`, name: p.name, sub: `${p.position} · ${p.teamName} · drafted #${p.pick}, finished #${p.finish}`, value: `+${p.margin} spots`, rank: p.rank }))}
          recorded={recordedFor("sleeping")}
          note={noStats || sleeperNote || "No drafted player out-produced his slot."}
        />
        {!trendsReady &&
          ["Breakout Player", "Bounce Back Player", "Most Improved Player", "Calder Trophy"].map((title) => (
            <Card key={title} title={title} blurb="Needs this season and the three before it." rows={[]} note={noStats || `Waiting on earlier seasons (${missingPriors.join(", ")}). Refresh to load them.`} />
          ))}
        {trends.map((t) => (
          <Card
            key={t.key}
            title={t.title}
            blurb={t.blurb}
            rows={t.entries.map((e) => ({ key: String(e.id), name: e.name, sub: `${e.position} · ${e.detail}`, value: e.value, rank: e.rank }))}
            recorded={recordedFor(t.key)}
            note="Nothing qualifies."
          />
        ))}
        <Card
          title="Hard Luck Manager"
          blurb="Actual wins against expected wins (every team against every other team, every week), as a share of expected wins. The biggest shortfall wins."
          rows={hardLuck.slice(0, 5).map((r, i) => ({
            key: String(r.teamId), name: teamName(r.teamId), sub: `${r.actW}-${r.actL}${r.actT ? `-${r.actT}` : ""} actual, ${r.expected.toFixed(1)} expected`,
            value: `${r.pctGap >= 0 ? "+" : "−"}${Math.abs(r.pctGap * 100).toFixed(0)}% xWINS`, rank: i + 1,
          }))}
          recorded={recordedFor("hardluck")}
          note={playedElsewhere ? "Enter this season's weekly scores under Fantrax Scores." : "ESPN has no finished matchups for this season."}
        />
        <Card
          title="Presidents' Trophy"
          blurb="Best regular-season record (wins minus losses, then points for)."
          rows={byRecord.slice(0, 5).map((t, i) => ({ key: String(t.id), name: t.name, sub: `${pts(t.pointsFor)} PF`, value: rec(t), rank: i + 1 }))}
          note={playedElsewhere ? "Enter this season's weekly scores under Fantrax Scores." : "ESPN has no standings for this season."}
        />
        <Card
          title="Most Points Scored"
          blurb="Total regular-season points for."
          rows={byPoints.slice(0, 5).map((t, i) => ({ key: String(t.id), name: t.name, sub: rec(t), value: pts(t.pointsFor), rank: i + 1 }))}
          note={playedElsewhere ? "Enter this season's weekly scores under Fantrax Scores." : "ESPN has no standings for this season."}
        />
      </div>
      <p className="text-xs text-muted max-w-prose">
        Not rebuilt here: William M. Jennings (it needs each team's goalies from week-by-week rosters, which is heavy to pull) and the lineup efficiency award (first year is the current season).
      </p>
    </div>
  );
}
