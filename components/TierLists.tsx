"use client";

import { useMemo, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import { TIERS, TIER_STYLE, type Tier } from "@/lib/tier-style";
import type { DirPlayer, TierDirectory } from "@/lib/team-makeup";

const f2 = (n: number) => n.toFixed(2);
const PAGE = 40;
const GROUPS = [
  { id: "ALL", label: "All" },
  { id: "F", label: "Forwards" },
  { id: "D", label: "Defence" },
  { id: "G", label: "Goalies" },
];
const SORTS = [
  { id: "est", label: "Rating" },
  { id: "avg", label: "Season" },
  { id: "l30", label: "L30" },
];

function Badge({ tier, small }: { tier: Tier | null; small?: boolean }) {
  if (!tier) return null;
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold ${small ? "" : "w-[74px] text-center"}`} style={{ background: s.bg, color: s.fg }}>
      {tier}
    </span>
  );
}

function Row({ p }: { p: DirPlayer }) {
  return (
    <div className="px-3 py-2.5 flex gap-3">
      <PlayerPhoto playerId={p.id} name={p.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-xs text-muted">
              {p.nhl} · {p.pos}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Badge tier={p.tier} />
            {p.goalie ? (
              <>
                <div className="text-[11px] font-semibold font-tabular mt-0.5">≈ {p.goalie.pace} pt pace</div>
                <div className="text-[11px] text-muted font-tabular">{f2(p.goalie.perTeamGame)} per team game</div>
              </>
            ) : (
              <div className="text-[11px] text-muted font-tabular mt-0.5">{p.est === null ? "" : `${f2(p.est)} rating`}</div>
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
        <div className="mt-1.5 text-xs">
          {p.owner ? (
            <span className="px-1.5 py-0.5 border border-ice-line text-rink">{p.owner}</span>
          ) : (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 font-semibold">{p.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TierLists({ data }: { data: TierDirectory }) {
  const [tier, setTier] = useState<Tier>("Franchise");
  const [group, setGroup] = useState("ALL");
  const [avail, setAvail] = useState(false);
  const [sort, setSort] = useState("est");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const base = useMemo(
    () =>
      data.players.filter((p) => (group === "ALL" || p.group === group) && (!avail || p.owner === null) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))),
    [data.players, group, avail, q]
  );
  const counts = useMemo(() => {
    const c: Record<Tier, number> = { Franchise: 0, Superstar: 0, Elite: 0, Depth: 0, Stream: 0 };
    for (const p of base) if (p.tier) c[p.tier]++;
    return c;
  }, [base]);
  const list = useMemo(() => {
    const rows = base.filter((p) => p.tier === tier);
    const key = (p: DirPlayer) => (sort === "avg" ? p.avg ?? -1 : sort === "l30" ? p.l30?.avg ?? -1 : p.est ?? -1);
    return [...rows].sort((a, b) => key(b) - key(a));
  }, [base, tier, sort]);

  const c = data.tiers.cutoffs;
  const range = (g: "F" | "D" | "G") => {
    const x = c[g];
    const lo = tier === "Franchise" ? x.franchise : tier === "Superstar" ? x.superstar : tier === "Elite" ? x.elite : tier === "Depth" ? x.depth : null;
    const hi = tier === "Franchise" ? null : tier === "Superstar" ? x.franchise : tier === "Elite" ? x.superstar : tier === "Depth" ? x.elite : x.depth;
    return lo === null ? `under ${f2(hi!)}` : hi === null ? `${f2(lo)}+` : `${f2(lo)} to ${f2(hi - 0.01)}`;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTier(t);
              setShown(PAGE);
            }}
            className={`px-3 py-2 text-sm font-semibold border-2 ${tier === t ? "border-rink" : "border-transparent"}`}
            style={{ background: TIER_STYLE[t].bg, color: TIER_STYLE[t].fg }}
          >
            {t} <span className="font-tabular opacity-90">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-3 items-end mb-3">
        <div className="text-xs text-muted flex flex-col gap-1">
          Position
          <div className="inline-flex border border-ice-line">
            {GROUPS.map((g) => (
              <button key={g.id} type="button" onClick={() => { setGroup(g.id); setShown(PAGE); }} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${group === g.id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted flex flex-col gap-1">
          Sort by
          <div className="inline-flex border border-ice-line">
            {SORTS.map((s) => (
              <button key={s.id} type="button" onClick={() => setSort(s.id)} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${sort === s.id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="text-xs text-muted flex flex-col gap-1">
          Search
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Player name" className="border border-ice-line bg-white px-2 py-1.5 text-sm w-40" />
        </label>
        <label className="text-sm flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={avail} onChange={(e) => { setAvail(e.target.checked); setShown(PAGE); }} />
          Available only
        </label>
      </div>

      <p className="text-xs text-muted mb-3 font-tabular">
        {list.length} {tier} player{list.length === 1 ? "" : "s"} · Forwards {range("F")} · Defence {range("D")} · Goalies {range("G")} per team game · skaters avg pts per game
        {data.tiers.basis === "last season" ? " (cutoffs from last season's final)" : ""}
      </p>

      {list.length === 0 ? (
        <p className="text-muted">No players match.</p>
      ) : (
        <>
          <div className="border border-ice-line bg-white divide-y divide-ice-line">
            {list.slice(0, shown).map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </div>
          {list.length > shown && (
            <button type="button" onClick={() => setShown(shown + PAGE)} className="mt-3 px-4 py-2 text-sm border border-ice-line bg-white hover:bg-ice-panel">
              Show more ({list.length - shown} left)
            </button>
          )}
        </>
      )}
      <p className="text-xs text-muted mt-4 max-w-prose">
        Rating is a player&apos;s average this season pulled toward last season&apos;s, so a few games don&apos;t swing it. Free agents and waiver players come from ESPN&apos;s list of available players, so a rarely owned player with
        few games may be missing.
      </p>
    </div>
  );
}
