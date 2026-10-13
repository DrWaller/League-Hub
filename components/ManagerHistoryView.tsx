import type { DraftTendencies } from "@/lib/draft-history";
import type { OwnedPlayer } from "@/lib/ownership";
import type { HistGame, ManagerHistory, Streak } from "@/lib/manager-history";
import { pts, ptsComma } from "@/lib/format";

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-ice-line bg-white p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-2xl leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

const gameSub = (g: HistGame) => `${g.season}, week ${g.week} · vs ${g.oppManagerName ?? g.oppTeamName}`;
const streakSub = (s: Streak) =>
  s.from.season === s.to.season
    ? `${s.from.season}, weeks ${s.from.week}–${s.to.week}`
    : `${s.from.season} wk ${s.from.week} to ${s.to.season} wk ${s.to.week}`;

export function OwnedPlayersView({ players, seasons }: { players: OwnedPlayer[]; seasons: number[] }) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl mb-1">Players owned the longest</h2>
      <p className="text-xs text-muted mb-3">Seasons on the roster ({seasons[0]}–{seasons[seasons.length - 1]}), counted once a player was held about two weeks. Weeks are approximate.</p>
      <table className="w-full max-w-xl text-sm font-tabular border-collapse"><tbody>
        {players.map((p) => (
          <tr key={p.name} className="border-b border-ice-line/60 align-top">
            <td className="py-1.5 pr-2 font-body">{p.name}<div className="text-xs text-muted">{p.position} · {p.seasons.join(", ")}</div></td>
            <td className="py-1.5 text-right whitespace-nowrap">{p.seasons.length} season{p.seasons.length === 1 ? "" : "s"}{p.weeks > 0 && <div className="text-xs text-muted">~{p.weeks} weeks</div>}</td>
          </tr>
        ))}
      </tbody></table>
    </section>
  );
}

export function DraftTendenciesView({ d }: { d: DraftTendencies }) {
  const maxTeam = d.teams[0]?.picks ?? 1;
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl mb-1">Draft tendencies</h2>
      <p className="text-xs text-muted mb-4">{d.picks} drafted picks across {d.seasons.length} draft{d.seasons.length === 1 ? "" : "s"} ({d.seasons[0]}–{d.seasons[d.seasons.length - 1]}). Keepers are not counted as picks.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-display text-xl mb-2">Players drafted the most</h3>
          {d.players.length === 0 ? <p className="text-sm text-muted">Nobody drafted twice yet.</p> : (
            <table className="w-full text-sm font-tabular border-collapse"><tbody>
              {d.players.map((p) => (
                <tr key={p.name} className="border-b border-ice-line/60 align-top">
                  <td className="py-1.5 pr-2 font-body">{p.name}<div className="text-xs text-muted">{p.position} · {p.seasons.join(", ")}</div></td>
                  <td className="py-1.5 text-right whitespace-nowrap">{p.times}x{p.kept > 0 ? <div className="text-xs text-muted">+{p.kept} kept</div> : null}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div>
          <h3 className="font-display text-xl mb-2">NHL teams drafted from the most</h3>
          {d.teams.length === 0 ? <p className="text-sm text-muted">No NHL team data for these drafts.</p> : (
            <ul className="text-sm space-y-1.5">
              {d.teams.map((t) => (
                <li key={t.team} className="flex items-center gap-2">
                  <span className="w-10 font-display">{t.team}</span>
                  <span className="flex-1 h-2 bg-ice-line"><span className="block h-2 bg-rink" style={{ width: `${(t.picks / maxTeam) * 100}%` }} /></span>
                  <span className="w-20 text-right font-tabular text-muted">{t.picks} · {(t.share * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {d.positions[0] && <Stat label="Favorite position" value={d.positions[0].position} sub={`${(d.positions[0].share * 100).toFixed(0)}% of picks`} />}
        {d.highestPick && <Stat label="Highest pick spent" value={`#${d.highestPick.overall}`} sub={`${d.highestPick.name}, ${d.highestPick.season}`} />}
        {d.firstRounders[0] && <Stat label="First-round loyalty" value={`${d.firstRounders[0].times}x`} sub={`${d.firstRounders[0].name} in round 1`} />}
        {d.positions.find((x) => x.position === "G") && <Stat label="Goalies drafted" value={String(d.positions.find((x) => x.position === "G")!.picks)} sub={`${(d.positions.find((x) => x.position === "G")!.share * 100).toFixed(0)}% of picks`} />}
      </div>
    </section>
  );
}

export default function ManagerHistoryView({ h }: { h: ManagerHistory }) {
  const c = h.career;
  if (!c || h.games === 0) return null;
  const nemesis = [...h.vs].filter((v) => v.w + v.l + v.t >= 3).sort((a, b) => a.pct - b.pct || b.l - a.l)[0];
  const victim = h.vs.filter((v) => v.w + v.l + v.t >= 3)[0];

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl mb-1">Career</h2>
      <p className="text-xs text-muted mb-4">Regular season only, every season on record.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Overall record" value={rec(c.wins, c.losses, c.ties)} sub={`${pct(c.winPct)} over ${c.seasons} season${c.seasons === 1 ? "" : "s"}`} />
        <Stat label="Titles" value={String(c.titles)} sub={`${c.runnerUps} runner-up · ${c.firstPlace} first-place finish${c.firstPlace === 1 ? "" : "es"}`} />
        <Stat label="Points for" value={ptsComma(c.pointsFor)} sub={`${pts(h.avgScore)} per game`} />
        <Stat label="Points against" value={ptsComma(c.pointsAgainst)} sub={c.pointsFor >= c.pointsAgainst ? "Outscoring the league" : "Getting outscored"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {h.highScore && <Stat label="High score" value={pts(h.highScore.score)} sub={gameSub(h.highScore)} />}
        {h.lowScore && <Stat label="Low score" value={pts(h.lowScore.score)} sub={gameSub(h.lowScore)} />}
        {h.biggestWin && <Stat label="Biggest blowout win" value={`+${pts(h.biggestWin.score - h.biggestWin.oppScore)}`} sub={gameSub(h.biggestWin)} />}
        {h.worstLoss && <Stat label="Worst beating" value={`−${pts(h.worstLoss.oppScore - h.worstLoss.score)}`} sub={gameSub(h.worstLoss)} />}
        {h.winStreak && h.winStreak.length > 1 && <Stat label="Longest win streak" value={`${h.winStreak.length} games`} sub={streakSub(h.winStreak)} />}
        {h.loseStreak && h.loseStreak.length > 1 && <Stat label="Longest losing streak" value={`${h.loseStreak.length} games`} sub={streakSub(h.loseStreak)} />}
        {h.closestWin && <Stat label="Closest win" value={`by ${pts(h.closestWin.score - h.closestWin.oppScore)}`} sub={gameSub(h.closestWin)} />}
        {h.currentStreak && <Stat label="Current streak" value={`${h.currentStreak.length}${h.currentStreak.kind}`} sub="Counting back from the last game on record" />}
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-8 text-sm">
        {h.unluckyLoss && (
          <div className="border border-ice-line bg-white p-3">
            <div className="text-xs text-muted">Most points in a loss</div>
            <div><span className="font-bold">{pts(h.unluckyLoss.score)}</span> and still lost to {h.unluckyLoss.oppManagerName ?? h.unluckyLoss.oppTeamName} ({pts(h.unluckyLoss.oppScore)})</div>
            <div className="text-xs text-muted">{h.unluckyLoss.season}, week {h.unluckyLoss.week}</div>
          </div>
        )}
        {h.luckyWin && (
          <div className="border border-ice-line bg-white p-3">
            <div className="text-xs text-muted">Fewest points in a win</div>
            <div><span className="font-bold">{pts(h.luckyWin.score)}</span> and still beat {h.luckyWin.oppManagerName ?? h.luckyWin.oppTeamName} ({pts(h.luckyWin.oppScore)})</div>
            <div className="text-xs text-muted">{h.luckyWin.season}, week {h.luckyWin.week}</div>
          </div>
        )}
        {victim && (
          <div className="border border-ice-line bg-white p-3">
            <div className="text-xs text-muted">Favorite opponent</div>
            <div><span className="font-bold">{victim.name}</span> · {rec(victim.w, victim.l, victim.t)} ({pct(victim.pct)})</div>
          </div>
        )}
        {nemesis && nemesis.managerId !== victim?.managerId && (
          <div className="border border-ice-line bg-white p-3">
            <div className="text-xs text-muted">Nemesis</div>
            <div><span className="font-bold">{nemesis.name}</span> · {rec(nemesis.w, nemesis.l, nemesis.t)} ({pct(nemesis.pct)})</div>
          </div>
        )}
      </div>

      <h3 className="font-display text-xl mb-2">Record vs. each manager</h3>
      <table className="w-full max-w-xl text-sm font-tabular border-collapse mb-8">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-ice-line">
            <th className="py-1 pr-2 font-normal">Opponent</th>
            <th className="py-1 pr-2 font-normal">Record</th>
            <th className="py-1 pr-2 font-normal text-right">Win %</th>
            <th className="py-1 font-normal text-right">Pts diff</th>
          </tr>
        </thead>
        <tbody>
          {h.vs.map((v) => (
            <tr key={v.managerId} className="border-b border-ice-line/60">
              <td className="py-1.5 pr-2 font-body">{v.name}</td>
              <td className="py-1.5 pr-2">{rec(v.w, v.l, v.t)}</td>
              <td className="py-1.5 pr-2 text-right">{pct(v.pct)}</td>
              <td className={`py-1.5 text-right ${v.pointsFor >= v.pointsAgainst ? "text-green-700" : "text-red-700"}`}>
                {v.pointsFor >= v.pointsAgainst ? "+" : "−"}{pts(Math.abs(v.pointsFor - v.pointsAgainst))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="font-display text-xl mb-2">Season by season</h3>
      <table className="w-full max-w-xl text-sm font-tabular border-collapse">
        <tbody>
          {[...h.seasons].reverse().map((s) => (
            <tr key={s.season} className="border-b border-ice-line/60">
              <td className="py-1.5 pr-2 font-display">{s.season}</td>
              <td className="py-1.5 pr-2 font-body">{s.teamName}</td>
              <td className="py-1.5 pr-2">{rec(s.wins, s.losses, s.ties)}</td>
              <td className="py-1.5 pr-2 text-muted">{ord(s.rank)} of {s.teamCount}</td>
              <td className="py-1.5 text-right">{ptsComma(s.pointsFor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
