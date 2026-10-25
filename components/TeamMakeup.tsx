"use client";

import { useEffect, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import TeamLogo from "@/components/TeamLogo";
import { TIERS, TIER_STYLE, type Tier } from "@/lib/tier-style";
import type { MakeupPlayer, Signal, TeamMakeup as Data } from "@/lib/team-makeup";

const KEY = "pickups-team"; // the same "my team" the pickup tool remembers
const GROUP_LABEL = { F: "Forwards", D: "Defence", G: "Goalies" } as const;
const f2 = (n: number) => n.toFixed(2);
const SIGNAL_STYLE: Record<Signal, string> = {
  Core: "bg-rink text-ice",
  Keep: "border border-ice-line text-rink",
  Watch: "bg-gold/25 text-rink font-semibold",
  "Drop candidate": "bg-center-red text-white font-semibold",
  IR: "border border-ice-line text-muted",
  Unrated: "border border-ice-line text-muted",
};

// Letter grade colour: A green, B blue, C grey, D amber, F red (the +/- doesn't change it).
const GRADE_COLOR: Record<string, string> = { A: "#26864A", B: "#1B6FB5", C: "#7C8794", D: "#C98A2B", F: "#C41E3A" };
const gradeColor = (grade: string) => GRADE_COLOR[grade[0]?.toUpperCase()] ?? "#7C8794";

function GradeChip({ grade, size = "md" }: { grade: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-display text-white shrink-0 ${size === "lg" ? "w-14 h-14 text-3xl" : "w-10 h-10 text-xl"}`}
      style={{ background: gradeColor(grade) }}
    >
      {grade}
    </span>
  );
}

// 0-100 bar with a tick at 50 (league average).
function RatingBar({ value, color }: { value: number; color: string }) {
  const w = Math.max(2, Math.min(100, value));
  return (
    <div className="relative h-2 rounded-full bg-ice-panel overflow-hidden">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: color }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-board/40" />
    </div>
  );
}

function GroupPill({ label, value }: { label: string; value: number }) {
  const hi = value >= 60;
  const lo = value <= 40;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-tabular ${
        hi ? "bg-green-100 text-green-800" : lo ? "bg-red-100 text-center-red" : "bg-ice-panel text-muted"
      }`}
    >
      <span className="font-semibold">{label}</span> {value}
    </span>
  );
}

function Badge({ tier, small }: { tier: Tier | null; small?: boolean }) {
  if (!tier) return <span className={`inline-block px-1.5 py-0.5 text-xs text-muted border border-ice-line ${small ? "" : "w-[74px] text-center"}`}>–</span>;
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold ${small ? "" : "w-[74px] text-center"}`} style={{ background: s.bg, color: s.fg }}>
      {tier}
    </span>
  );
}

function Row({ p }: { p: MakeupPlayer }) {
  const accent = p.tier ? TIER_STYLE[p.tier].bg : "#CBD6E2";
  return (
    <div
      className={`pl-3 pr-3 py-3 flex gap-3 border-l-4 ${p.slot === "IR" ? "opacity-70" : ""} ${p.signal === "Drop candidate" ? "bg-center-red/5" : ""}`}
      style={{ borderLeftColor: accent }}
    >
      <PlayerPhoto playerId={p.id} name={p.name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-xs text-muted">
              {p.nhl} · {p.pos}
              {p.posRank !== null ? (
                <span
                  title={`Rated ${p.posRank} of ${p.posCount} ${p.pos} in the league (rostered and available)`}
                  className={`ml-1.5 px-1.5 py-px rounded-sm font-tabular ${p.posRank <= 10 ? "bg-gold/25 text-rink font-semibold" : "bg-ice-panel text-muted"}`}
                >
                  {p.pos} #{p.posRank}
                </span>
              ) : null}
              {p.slot !== "Lineup" ? ` · ${p.slot}` : ""}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Badge tier={p.tier} />
            {p.goalie ? (
              <>
                <div className="text-[11px] font-semibold font-tabular mt-0.5">≈ {p.goalie.pace} pts projected</div>
                <div className="text-[11px] text-muted font-tabular">{f2(p.goalie.perTeamGame)} per team game · {p.goalie.gamesLeft} left</div>
              </>
            ) : (
              <div className="text-[11px] text-muted font-tabular mt-0.5">{p.est === null ? "no rating" : `${f2(p.est)} rating`}</div>
            )}
          </div>
        </div>
        {p.goalie ? (
          <div className="mt-1.5 text-xs font-tabular text-muted">
            {f2(p.goalie.perStart)} per start · starts {Math.round(p.goalie.share * 100)}%
            {p.goalie.starts !== null && p.goalie.teamGames !== null ? ` (${p.goalie.starts} of ${p.goalie.teamGames})` : ""}
            {p.injury ? " · tier held while injured" : ""}
          </div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-tabular text-muted">
          <span>
            Season {p.avg === null ? "–" : f2(p.avg)} ({p.gp} gp)
          </span>
          {p.priorAvg !== null ? <span>Last yr {f2(p.priorAvg)}</span> : null}
          <span className={`inline-flex items-center gap-1 ${p.goalie ? "hidden" : ""}`}>
            L30 {p.l30 ? `${f2(p.l30.avg)} (${p.l30.gp} gp)` : "–"}
            {p.form ? <Badge tier={p.form} small /> : null}
            {p.trend === "up" ? <span className="text-green-700 font-bold">↑</span> : p.trend === "down" ? <span className="text-center-red font-bold">↓</span> : null}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 ${SIGNAL_STYLE[p.signal]}`}>{p.signal}</span>
          <span className="text-muted">{p.why}</span>
        </div>
        {p.better ? (
          <div className="mt-1 text-xs">
            Available: <span className="font-semibold">{p.better.name}</span> ({p.better.team}) <Badge tier={p.better.tier} small /> <span className="text-muted font-tabular">{f2(p.better.est)} rating</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TeamMakeup({ data, selected, logos }: { data: Data; selected: number | null; logos: Record<number, string> }) {
  const [id, setId] = useState<number | null>(selected);

  useEffect(() => {
    try {
      if (selected) localStorage.setItem(KEY, String(selected));
      else {
        const saved = Number(localStorage.getItem(KEY));
        if (saved && data.teams.some((t) => t.id === saved)) setId(saved);
      }
    } catch {
      /* private mode: fine */
    }
  }, [selected, data.teams]);

  const team = data.teams.find((t) => t.id === id) ?? null;
  const c = data.tiers.cutoffs;
  const basis =
    data.tiers.basis === "last season"
      ? `set from last season's final results (this season has ${data.tiers.gamesPlayed} games so far; they switch to this season at 20)`
      : `set from this season at the ${[0, 20, 40, 60][data.tiers.checkpoint]}-game checkpoint, then frozen until the next one`;

  const pick = (t: number) => {
    setId(t);
    try {
      localStorage.setItem(KEY, String(t));
      history.replaceState(null, "", `/team-makeup?team=${t}`);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <section className="mb-6">
        <h2 className="font-display text-xl mb-1">The cutoffs</h2>
        <p className="text-xs text-muted mb-2">Average fantasy points per game, {basis}. Goalies are on points per team game (points per start × share of starts), with the full-season total underneath ({data.seasonGames} games).</p>
        <div className="border border-ice-line bg-white overflow-x-auto">
          <table className="w-full text-sm font-tabular">
            <thead>
              <tr className="text-muted text-xs border-b border-ice-line">
                <th className="text-left px-3 py-2"></th>
                {[...TIERS].reverse().map((t) => (
                  <th key={t} className="px-2 py-2 text-center">
                    <Badge tier={t} small />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["F", "D", "G"] as const).map((g) => (
                <tr key={g} className="border-b border-ice-line last:border-0">
                  <td className="px-3 py-2 font-semibold">{GROUP_LABEL[g]}</td>
                  <td className="text-center text-muted">under {f2(c[g].depth)}</td>
                  {(["depth", "elite", "superstar", "franchise"] as const).map((k) => (
                    <td key={k} className="text-center">
                      {f2(c[g][k])}+
                      {g === "G" ? <div className="text-[10px] text-muted">≈ {Math.round(c[g][k] * data.seasonGames)} pts</div> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl mb-1">Team ratings</h2>
        <p className="text-xs text-muted mb-2">
          Each roster graded against the other teams (50 = league average). A team&apos;s starters are its best players at each position for the league&apos;s lineup slots, whatever ESPN shows in the lineup today;
          injured reserve doesn&apos;t count. Each starter is worth his rating minus the starter line for his position, so a star counts for the points he scores and a starter below the line counts against the team. Position
          columns use the same scale, so you can see where a team is strong and where it&apos;s thin.
        </p>
        <ol className="border border-ice-line bg-white divide-y divide-ice-line">
          {[...data.teams]
            .filter((t) => t.rating)
            .sort((a, b) => a.rating!.rank - b.rating!.rank)
            .map((t) => {
              const r = t.rating!;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => pick(t.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-ice-panel/60 ${t.id === id ? "bg-ice-panel" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center font-display text-muted shrink-0">{r.rank}</span>
                      <TeamLogo url={logos[t.id]} name={t.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`truncate ${t.id === id ? "font-semibold" : "font-medium"}`}>{t.name}</span>
                          <span className="text-xs text-muted font-tabular shrink-0">{r.rating}</span>
                        </div>
                        <div className="mt-1.5">
                          <RatingBar value={r.rating} color={gradeColor(r.grade)} />
                        </div>
                      </div>
                      <GradeChip grade={r.grade} />
                    </div>
                    <div className="mt-2 pl-8 flex gap-1.5">
                      {(["F", "D", "G"] as const).map((g) => (
                        <GroupPill key={g} label={g} value={r.groups[g]} />
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl mb-1">All teams</h2>
        <p className="text-xs text-muted mb-2">Each bar is a roster split by tier, best on the left (injured reserve not counted). Tap a team for its players.</p>
        <ul className="border border-ice-line bg-white divide-y divide-ice-line">
          {data.teams.map((t) => (
            <li key={t.id}>
              <button onClick={() => pick(t.id)} className={`w-full text-left px-3 py-3 hover:bg-ice-panel/60 ${t.id === id ? "bg-ice-panel" : ""}`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <TeamLogo url={logos[t.id]} name={t.name} size={28} />
                  <span className={`truncate ${t.id === id ? "font-semibold" : "font-medium"}`}>{t.name}</span>
                </div>
                <div className="flex h-7 rounded-md overflow-hidden gap-px bg-white">
                  {TIERS.filter((k) => t.counts[k] > 0).map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-center text-xs font-semibold font-tabular"
                      style={{ flex: t.counts[k], background: TIER_STYLE[k].bg, color: TIER_STYLE[k].fg }}
                      title={`${t.counts[k]} ${k}`}
                    >
                      {t.counts[k]}
                    </div>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {TIERS.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ background: TIER_STYLE[t].bg }} /> {t}
            </span>
          ))}
        </p>
      </section>

      {!team ? (
        <p className="text-muted">Pick a team above to see its players.</p>
      ) : (
        <section>
          <div className="bg-rink text-ice rounded-md p-4 mb-4 flex items-center gap-4">
            <div className="rounded-md bg-white/10 p-1.5 shrink-0">
              <TeamLogo url={logos[team.id]} name={team.name} size={56} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl leading-tight">{team.name}</h2>
              {team.rating ? (
                <>
                  <p className="text-xs text-ice/70 font-tabular mt-0.5">
                    #{team.rating.rank} of {data.teams.length} · rating {team.rating.rating}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {(["F", "D", "G"] as const).map((g) => (
                      <GroupPill key={g} label={g} value={team.rating!.groups[g]} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {team.rating ? <GradeChip grade={team.rating.grade} size="lg" /> : null}
          </div>
          {team.rating ? <p className="text-xs text-muted mb-4">{team.rating.note}</p> : null}
          {(["F", "D", "G"] as const).map((g) => {
            const list = team.players.filter((p) => p.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g} className="mb-6">
                <h3 className="font-display text-lg mb-1">{GROUP_LABEL[g]}</h3>
                <div className="border border-ice-line bg-white divide-y divide-ice-line">
                  {list.map((p) => (
                    <Row key={p.id} p={p} />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted max-w-prose">
            The position badge (e.g. D #1) ranks him by rating against every player at his position in the league, owned or available; gold means top 10.
            Skater rating = his average this season pulled toward last season&apos;s, so a few games don&apos;t swing it. L30 shows his last 30 days against the same cutoffs; an arrow means his form is a
            tier or more away from his rating. Core is Good and above, Keep is Depth, and Drop candidate is Replacement with no recent surge. Watch means the rating and the recent form disagree.
            &quot;Available&quot; names the best free agent at his position who rates above him. Goalies are rated on points per team game: points per start (quality) times his share of his team&apos;s starts (security), so a goalie who starts more climbs; the projection is his points so far plus his team&apos;s real games left in the fantasy regular season at that rate, with his start share pulled toward last season&apos;s and capped. A hurt goalie keeps his season share so his tier holds.
          </p>
        </section>
      )}
    </div>
  );
}
