"use client";

import { useEffect, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
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
  return (
    <div className={`px-3 py-2.5 flex gap-3 ${p.slot === "IR" ? "opacity-70" : ""}`}>
      <PlayerPhoto playerId={p.id} name={p.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-xs text-muted">
              {p.nhl} · {p.pos}
              {p.slot !== "Lineup" ? ` · ${p.slot}` : ""}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Badge tier={p.tier} />
            <div className="text-[11px] text-muted font-tabular mt-0.5">{p.est === null ? "no rating" : `${f2(p.est)} rating`}</div>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-tabular text-muted">
          <span>
            Season {p.avg === null ? "–" : f2(p.avg)} ({p.gp} gp)
          </span>
          {p.priorAvg !== null ? <span>Last yr {f2(p.priorAvg)}</span> : null}
          <span className="inline-flex items-center gap-1">
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

export default function TeamMakeup({ data, selected }: { data: Data; selected: number | null }) {
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
        <p className="text-xs text-muted mb-2">Average fantasy points per game, {basis}.</p>
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
                  <td className="text-center">{f2(c[g].depth)}+</td>
                  <td className="text-center">{f2(c[g].elite)}+</td>
                  <td className="text-center">{f2(c[g].superstar)}+</td>
                  <td className="text-center">{f2(c[g].franchise)}+</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl mb-1">All teams</h2>
        <p className="text-xs text-muted mb-2">Players by tier on each roster (injured reserve not counted). Tap a team for its players.</p>
        <div className="border border-ice-line bg-white overflow-x-auto">
          <table className="w-full text-sm font-tabular">
            <thead>
              <tr className="text-muted text-xs border-b border-ice-line">
                <th className="text-left px-3 py-2">Team</th>
                {TIERS.map((t) => (
                  <th key={t} className="px-1.5 py-2 text-center">
                    <span className="inline-block w-3 h-3" style={{ background: TIER_STYLE[t].bg }} title={t} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.teams.map((t) => (
                <tr key={t.id} onClick={() => pick(t.id)} className={`border-b border-ice-line last:border-0 cursor-pointer hover:bg-ice-panel ${t.id === id ? "bg-ice-panel font-semibold" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{t.name}</td>
                  {TIERS.map((k) => (
                    <td key={k} className={`text-center ${t.counts[k] === 0 ? "text-muted/50" : ""}`}>
                      {t.counts[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <h2 className="font-display text-2xl mb-3">{team.name}</h2>
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
            Rating = his average this season pulled toward last season&apos;s, so a few games don&apos;t swing it. L30 shows his last 30 days against the same cutoffs; an arrow means his form is a
            tier or more away from his rating. Core is Elite and above, Keep is Depth, and Drop candidate is Stream with no recent surge. Watch means the rating and the recent form disagree.
            &quot;Available&quot; names the best free agent at his position who rates above him.
          </p>
        </section>
      )}
    </div>
  );
}
