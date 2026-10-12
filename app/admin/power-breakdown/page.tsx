import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";
import { explainPowerRankings, rankingThroughWeek, teamsThroughWeek, WEIGHTS, RECENCY, ROSTER_LOOKBACK } from "@/lib/power-rankings";
import { getWeeklyRosterStrength } from "@/lib/roster-strength";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;
const tone = (x: number) => (x > 0.005 ? "text-green-700" : x < -0.005 ? "text-red-700" : "text-muted");

export default async function PowerBreakdownPage({ searchParams }: { searchParams: { week?: string } }) {
  const meta = await getLeagueMeta();
  const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);

  const throughWeek = rankingThroughWeek(matchups, Number(searchParams.week) || undefined);
  if (throughWeek === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl mb-1">Power Rankings Breakdown</h1>
        <p className="text-muted">No completed regular-season games yet, so there is nothing to break down.</p>
      </div>
    );
  }

  const ranked = teamsThroughWeek(teams, matchups, throughWeek);
  const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const rec = (id: number) => {
    const t = ranked.find((x) => x.id === id);
    return t ? `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}` : "";
  };

  let strength: Awaited<ReturnType<typeof getWeeklyRosterStrength>>;
  let strengthError = false;
  try {
    strength = await getWeeklyRosterStrength(meta.season, throughWeek);
  } catch {
    strength = undefined;
    strengthError = true;
  }

  const rows = explainPowerRankings(ranked, matchups, throughWeek, strength);
  const without = new Map(explainPowerRankings(ranked, matchups, throughWeek, undefined).map((r) => [r.teamId, r.rank]));
  const hasRoster = rows[0]?.roster !== null && rows[0]?.roster !== undefined;
  const w = rows[0]?.weights;

  // Weekly scores and roster strength, newest week first, so the recency weighting is visible.
  const finals = regularSeasonFinals(matchups).filter((m) => m.week <= throughWeek);
  const weeks = Array.from(new Set(finals.map((m) => m.week))).sort((a, b) => b - a);
  const scoreOf = (teamId: number, week: number) => {
    const g = finals.find((m) => m.week === week && (m.homeTeamId === teamId || m.awayTeamId === teamId));
    return g ? (g.homeTeamId === teamId ? g.homeScore : g.awayScore) : null;
  };
  const strengthWeeks = strength ? Array.from(strength.keys()).filter((wk) => wk <= throughWeek).sort((a, b) => b - a) : [];

  const th = "py-2 pr-4 font-body font-normal text-right whitespace-nowrap";
  const td = "py-2 pr-4 text-right whitespace-nowrap";

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Power Rankings Breakdown</h1>
      <p className="text-muted mb-4 max-w-prose">
        Why each team landed where it did, through week {throughWeek}. Each piece is turned into a score versus the league
        average (positive = above average) and multiplied by its weight; the contributions add up to the final score. Every
        piece counts recent weeks more: each week back is worth {pct(RECENCY)} of the one after it.
      </p>

      {w && (
        <p className="text-sm mb-4">
          <b>Weights in use:</b> all-play {pct(w.allPlay)} · points scored {pct(w.ppg)}
          {w.roster !== null ? ` · roster strength ${pct(w.roster)}` : ""} · actual record {pct(w.winPct)}
          {w.roster === null && (
            <span className="text-muted">
              {" "}
              (roster strength isn&apos;t included{strengthError ? ": ESPN lookup failed" : ": no data"}, so its share is spread
              across the others)
            </span>
          )}
        </p>
      )}

      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ice-line text-muted">
              <th className="py-2 pr-4 font-body font-normal text-left">#</th>
              <th className="py-2 pr-4 font-body font-normal text-left">Team</th>
              <th className={th}>Rec</th>
              <th className={th}>All-play</th>
              <th className={th}>Points</th>
              {hasRoster && <th className={th}>Roster</th>}
              <th className={th}>Record</th>
              <th className={th}>Score</th>
              {hasRoster && <th className={th}>Rank without roster</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-b border-ice-line">
                <td className="py-2 pr-4 font-display">{r.rank}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{name(r.teamId)}</td>
                <td className={td}>{rec(r.teamId)}</td>
                <td className={td}>
                  <div>{pct(r.allPlay)} win</div>
                  <div className={`text-xs ${tone(r.contrib.allPlay)}`}>{signed(r.contrib.allPlay)}</div>
                </td>
                <td className={td}>
                  <div>{pts(r.ppg)} / wk</div>
                  <div className={`text-xs ${tone(r.contrib.ppg)}`}>{signed(r.contrib.ppg)}</div>
                </td>
                {hasRoster && (
                  <td className={td}>
                    <div>{r.roster !== null ? `${r.roster.toFixed(1)} VOR` : "—"}</div>
                    <div className={`text-xs ${tone(r.contrib.roster ?? 0)}`}>{r.contrib.roster !== null ? signed(r.contrib.roster) : ""}</div>
                  </td>
                )}
                <td className={td}>
                  <div>{pct(r.winPct)} win</div>
                  <div className={`text-xs ${tone(r.contrib.winPct)}`}>{signed(r.contrib.winPct)}</div>
                </td>
                <td className={`${td} font-bold`}>{signed(r.score)}</td>
                {hasRoster && (
                  <td className={td}>
                    {without.get(r.teamId)}
                    {without.get(r.teamId) !== r.rank && (
                      <span className="text-xs text-muted"> ({without.get(r.teamId)! > r.rank ? "▲" : "▼"}{Math.abs(without.get(r.teamId)! - r.rank)} with roster)</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-xl mb-1">Weekly scores</h2>
      <p className="text-muted text-sm mb-3">Newest week first. Weight = how much that week counts.</p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ice-line text-muted">
              <th className="py-2 pr-4 font-body font-normal text-left">Team</th>
              {weeks.map((wk) => (
                <th key={wk} className={th}>
                  Wk {wk}
                  <div className="text-xs">weight {(RECENCY ** (throughWeek - wk)).toFixed(2)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="border-b border-ice-line">
                <td className="py-2 pr-4 whitespace-nowrap">{name(r.teamId)}</td>
                {weeks.map((wk) => {
                  const s = scoreOf(r.teamId, wk);
                  return (
                    <td key={wk} className={td}>
                      {s === null ? "—" : pts(s)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {strengthWeeks.length > 0 && (
        <>
          <h2 className="font-display text-xl mb-1">Roster strength by week</h2>
          <p className="text-muted text-sm mb-3 max-w-prose">
            The value over replacement (VOR) of each team&apos;s best possible lineup that week, counting players on the bench
            and anyone who was injured or sitting. Only the last {ROSTER_LOOKBACK} weeks are used. If this is much higher than a
            team&apos;s points for the week, the roster produced more than the owner got out of it. Total weight on the pieces
            is {pct(WEIGHTS.roster)} at most.
          </p>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ice-line text-muted">
                  <th className="py-2 pr-4 font-body font-normal text-left">Team</th>
                  {strengthWeeks.map((wk) => (
                    <th key={wk} className={th}>
                      Wk {wk}
                    </th>
                  ))}
                  <th className={th}>Points that week</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.teamId} className="border-b border-ice-line">
                    <td className="py-2 pr-4 whitespace-nowrap">{name(r.teamId)}</td>
                    {strengthWeeks.map((wk) => {
                      const v = strength!.get(wk)?.get(r.teamId);
                      return (
                        <td key={wk} className={td}>
                          {v === undefined ? "—" : v.toFixed(1)}
                        </td>
                      );
                    })}
                    <td className={td}>{scoreOf(r.teamId, throughWeek) === null ? "—" : pts(scoreOf(r.teamId, throughWeek)!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
