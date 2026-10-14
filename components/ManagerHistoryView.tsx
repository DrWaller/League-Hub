import type { DraftTendencies } from "@/lib/draft-history";
import type { OwnedPlayer } from "@/lib/ownership";
import type { HistGame, ManagerHistory, Streak } from "@/lib/manager-history";
import { pts, ptsComma } from "@/lib/format";
import Cup from "./Cup";
import type { FranchiseEntry } from "@/lib/franchise-player";

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const gameSub = (g: HistGame) => `${g.season}, week ${g.week}, vs ${g.oppManagerName ?? g.oppTeamName}`;
const streakSub = (s: Streak) =>
  s.from.season === s.to.season ? `${s.from.season}, weeks ${s.from.week} to ${s.to.week}` : `${s.from.season} week ${s.from.week} to ${s.to.season} week ${s.to.week}`;

function H2({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl leading-tight">{children}</h2>
      {note && <p className="text-sm text-muted max-w-prose">{note}</p>}
    </div>
  );
}

function Moment({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <li className="py-2 border-b border-ice-line/70 last:border-b-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl leading-tight font-tabular">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </li>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Career: points, best and worst moments, rivalries and the season-by-season bars.

export default function ManagerHistoryView({ h }: { h: ManagerHistory }) {
  const c = h.career;
  if (!c || h.games === 0) return null;
  const maxPct = 1;

  return (
    <>
      <section className="mb-12">
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {[
            ["Points for", ptsComma(c.pointsFor)],
            ["Points against", ptsComma(c.pointsAgainst)],
            ["Per game", pts(h.avgScore)],
            ["First-place finishes", String(c.firstPlace)],
          ].map(([k, v]) => (
            <div key={k}>
              <dd className="font-display text-3xl leading-none font-tabular">{v}</dd>
              <dt className="mt-1 text-sm text-muted">{k}</dt>
            </div>
          ))}
          {h.currentStreak && (
            <div>
              <dd className={`font-display text-3xl leading-none ${h.currentStreak.kind === "W" ? "text-rink-bright" : h.currentStreak.kind === "L" ? "text-center-red" : ""}`}>
                {h.currentStreak.length}
                {h.currentStreak.kind}
              </dd>
              <dt className="mt-1 text-sm text-muted">Current streak</dt>
            </div>
          )}
        </dl>
      </section>

      <section className="mb-12">
        <H2 note="Regular season games only, every season on record.">Highs and lows</H2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border-l-4 border-rink-bright pl-4">
            <h3 className="font-display text-lg text-rink">At their best</h3>
            <ul>
              {h.highScore && <Moment label="High score" value={pts(h.highScore.score)} sub={gameSub(h.highScore)} />}
              {h.biggestWin && <Moment label="Biggest win" value={`by ${pts(h.biggestWin.score - h.biggestWin.oppScore)}`} sub={gameSub(h.biggestWin)} />}
              {h.winStreak && h.winStreak.length > 1 && <Moment label="Longest win streak" value={`${h.winStreak.length} games`} sub={streakSub(h.winStreak)} />}
              {h.luckyWin && <Moment label="Fewest points in a win" value={pts(h.luckyWin.score)} sub={`Still beat ${h.luckyWin.oppManagerName ?? h.luckyWin.oppTeamName} (${pts(h.luckyWin.oppScore)}), ${h.luckyWin.season} week ${h.luckyWin.week}`} />}
            </ul>
          </div>
          <div className="border-l-4 border-center-red pl-4">
            <h3 className="font-display text-lg text-center-red-dim">At their worst</h3>
            <ul>
              {h.lowScore && <Moment label="Low score" value={pts(h.lowScore.score)} sub={gameSub(h.lowScore)} />}
              {h.worstLoss && <Moment label="Worst beating" value={`by ${pts(h.worstLoss.oppScore - h.worstLoss.score)}`} sub={gameSub(h.worstLoss)} />}
              {h.loseStreak && h.loseStreak.length > 1 && <Moment label="Longest losing streak" value={`${h.loseStreak.length} games`} sub={streakSub(h.loseStreak)} />}
              {h.unluckyLoss && <Moment label="Most points in a loss" value={pts(h.unluckyLoss.score)} sub={`Still lost to ${h.unluckyLoss.oppManagerName ?? h.unluckyLoss.oppTeamName} (${pts(h.unluckyLoss.oppScore)}), ${h.unluckyLoss.season} week ${h.unluckyLoss.week}`} />}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <H2 note="Win percentage against each manager. Bars to the right of the line are a winning record against them.">Head to head</H2>
        <ul className="max-w-2xl">
          {h.vs.map((v) => {
            const right = v.pct >= 0.5;
            return (
              <li key={v.managerId} className="grid grid-cols-[6.5rem_1fr_7.5rem] sm:grid-cols-[9rem_1fr_9rem] items-center gap-3 py-1.5 border-b border-ice-line/50 text-sm">
                <span className="font-body truncate">{v.name}</span>
                <span className="relative h-3 bg-ice-panel" role="img" aria-label={`${v.name}: ${rec(v.w, v.l, v.t)}, ${pct(v.pct)}`}>
                  <span
                    className={`absolute top-0 h-3 ${right ? "bg-rink-bright" : "bg-center-red"}`}
                    style={right ? { left: "50%", width: `${(v.pct - 0.5) * 100 * maxPct}%` } : { left: `${v.pct * 100}%`, width: `${(0.5 - v.pct) * 100}%` }}
                  />
                  <span className="absolute left-1/2 -top-0.5 h-4 w-px bg-board/60" />
                </span>
                <span className="text-right font-tabular">
                  {rec(v.w, v.l, v.t)}
                  <span className={`ml-2 text-xs ${v.pointsFor >= v.pointsAgainst ? "text-rink-bright" : "text-center-red"}`}>
                    {v.pointsFor >= v.pointsAgainst ? "+" : "−"}
                    {Math.abs(v.pointsFor - v.pointsAgainst).toFixed(0)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-12">
        <H2 note="Bar height is win percentage. Gold marks a title and light blue a runner-up.">Season by season</H2>
        <div className="overflow-x-auto pb-2">
          <ol className="flex items-end gap-2 min-w-max">
            {h.seasons.map((s) => (
              <li key={s.season} className="w-16 text-center">
                <p className="h-5 text-gold flex justify-center">{s.champion ? <Cup size={18} /> : null}</p>
                <div className="h-36 flex items-end justify-center" title={`${s.teamName}: ${rec(s.wins, s.losses, s.ties)}, ${pct(s.winPct)}, ${s.season}`}>
                  <div
                    className={`w-10 ${s.champion ? "bg-gold" : s.runnerUp ? "bg-rink-bright" : "bg-rink"}`}
                    style={{ height: `${Math.max(4, s.winPct * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-tabular">{rec(s.wins, s.losses, s.ties)}</p>
                <p className="font-display text-base leading-tight">{s.season}</p>
                <p className="text-xs text-muted">{ord(s.rank)} of {s.teamCount}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function OwnedPlayersView({ players, seasons, franchise }: { players: OwnedPlayer[]; seasons: number[]; franchise?: FranchiseEntry[] }) {
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const star = franchise?.[0];
  return (
    <section className="mb-12">
      <H2 note="The player who has scored the most points while on this manager's roster, estimated from weekly roster looks and season totals.">Franchise player</H2>
      {star && (
        <div className="max-w-2xl mb-8 border-l-4 border-gold bg-ice-panel px-5 py-4">
          <p className="text-sm text-muted">The franchise player</p>
          <p className="font-display text-4xl leading-tight">{star.name}</p>
          <p className="text-sm font-tabular">
            About <span className="font-semibold">{ptsComma(star.points)}</span> points for this team
          </p>
          <p className="text-xs text-muted font-tabular">
            {star.position}, {star.seasons.length} season{star.seasons.length === 1 ? "" : "s"} ({star.seasons[0]} to {star.seasons[star.seasons.length - 1]}), about {star.weeks} weeks
            {star.best ? `, best year ${star.best.season} with about ${ptsComma(star.best.points)}` : ""}
          </p>
          {franchise && franchise.length > 1 && (
            <ol className="mt-3 text-sm">
              {franchise.slice(1).map((p, i) => (
                <li key={p.name} className="flex justify-between gap-4 py-1 border-t border-ice-line/60">
                  <span>
                    {i + 2}. {p.name} <span className="text-xs text-muted">{p.position}</span>
                  </span>
                  <span className="font-tabular text-muted">about {ptsComma(p.points)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <h3 className="font-display text-lg mb-1">Owned the longest</h3>
      <p className="text-xs text-muted mb-2">One square per season, filled when the player was on the roster for about two weeks or more.</p>
      <ul className="max-w-2xl">
        {players.map((p) => (
          <li key={p.name} className="grid grid-cols-[1fr_auto] gap-x-4 items-center py-2 border-b border-ice-line/60">
            <div className="min-w-0">
              <p className="font-body font-medium truncate">
                {p.name} <span className="text-xs text-muted font-normal">{p.position}</span>
              </p>
              <div className="mt-1 flex gap-[3px]" role="img" aria-label={`Owned in ${p.seasons.join(", ")}`}>
                {span.map((y) => (
                  <span key={y} title={String(y)} className={`h-4 w-3.5 ${p.seasons.includes(y) ? "bg-rink" : "bg-ice-panel"}`} />
                ))}
              </div>
            </div>
            <p className="text-right">
              <span className="font-display text-3xl leading-none">{p.seasons.length}</span>
              <span className="block text-xs text-muted">{p.seasons.length === 1 ? "season" : "seasons"}{p.weeks > 0 ? `, about ${p.weeks} weeks` : ""}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-1 flex justify-between max-w-2xl text-xs text-muted font-tabular"><span>{first}</span><span>{last}</span></p>
    </section>
  );
}

const POS_COLOR: Record<string, string> = { C: "#123A61", LW: "#2B6CB5", RW: "#8DB4DC", D: "#D9A441", G: "#C41E3A" };

export function DraftTendenciesView({ d }: { d: DraftTendencies }) {
  const maxTeam = d.teams[0]?.picks ?? 1;
  const posOrder = ["C", "LW", "RW", "D", "G"].map((p) => d.positions.find((x) => x.position === p)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <section className="mb-12">
      <H2 note={`${d.picks} picks across ${d.seasons.length} draft${d.seasons.length === 1 ? "" : "s"}, ${d.seasons[0]} to ${d.seasons[d.seasons.length - 1]}. Keepers are not counted.`}>Draft tendencies</H2>

      {posOrder.length > 0 && (
        <div className="max-w-2xl mb-8">
          <p className="text-sm mb-1.5">What they draft</p>
          <div className="flex h-5 overflow-hidden" role="img" aria-label={posOrder.map((p) => `${p.position} ${(p.share * 100).toFixed(0)}%`).join(", ")}>
            {posOrder.map((p) => <span key={p.position} style={{ width: `${p.share * 100}%`, background: POS_COLOR[p.position] }} title={`${p.position}: ${p.picks} picks`} />)}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {posOrder.map((p) => (
              <li key={p.position} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5" style={{ background: POS_COLOR[p.position] }} />
                {p.position} <span className="font-tabular">{(p.share * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="font-display text-lg mb-2">Drafted the most</h3>
          {d.players.length === 0 ? (
            <p className="text-sm text-muted">Nobody has been drafted twice yet.</p>
          ) : (
            <ul>
              {d.players.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2 border-b border-ice-line/60">
                  <span className="min-w-0">
                    <span className="block font-body font-medium truncate">{p.name}</span>
                    <span className="block text-xs text-muted">{p.position}, {p.seasons.join(", ")}{p.kept > 0 ? `, kept ${p.kept}` : ""}</span>
                  </span>
                  <span className="font-display text-3xl leading-none">{p.times}<span className="text-base text-muted">x</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-display text-lg mb-2">NHL teams they go back to</h3>
          {d.teams.length === 0 ? (
            <p className="text-sm text-muted">No NHL team data for these drafts.</p>
          ) : (
            <ul className="space-y-2">
              {d.teams.map((t) => (
                <li key={t.team} className="grid grid-cols-[2.75rem_1fr_4.5rem] items-center gap-2">
                  <span className="font-display text-lg">{t.team}</span>
                  <span className="h-3 bg-ice-panel"><span className="block h-3 bg-rink" style={{ width: `${(t.picks / maxTeam) * 100}%` }} /></span>
                  <span className="text-right text-sm font-tabular text-muted">{t.picks}, {(t.share * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(d.highestPick || d.firstRounders[0]) && (
        <p className="mt-6 text-sm text-muted max-w-prose">
          {d.highestPick && <>Highest pick spent: <b className="text-board">{d.highestPick.name}</b> at #{d.highestPick.overall} in {d.highestPick.season}. </>}
          {d.firstRounders[0] && <>Most often taken in round 1: <b className="text-board">{d.firstRounders[0].name}</b>, {d.firstRounders[0].times} times.</>}
        </p>
      )}
    </section>
  );
}
