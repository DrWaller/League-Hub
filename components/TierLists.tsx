"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
// The timeframe decides both which tier a player is in and how players are ordered inside a tier.
type View = "est" | "avg" | "l30";
const VIEWS: { id: View; label: string }[] = [
  { id: "est", label: "Rating" },
  { id: "avg", label: "Season" },
  { id: "l30", label: "L30" },
];
const MIN_GP = 5; // same minimum games the hub already uses for a player's L30 tier
type Cut = { franchise: number; superstar: number; elite: number; depth: number };
type Cuts = Record<"F" | "D" | "G", Cut>;
const tierByCut = (v: number | null, c: Cut): Tier | null => {
  if (v === null || !Number.isFinite(v)) return null;
  return v >= c.franchise ? "Superstar" : v >= c.superstar ? "Elite" : v >= c.elite ? "Good" : v >= c.depth ? "Depth" : "Replacement";
};
// Tier of a player for the chosen timeframe. Goalies are measured per team game (volume counts) and have no L30
// tier, so they stay on their rating tier for L30. Skaters need a few games in the window to get a tier.
function tierFor(p: DirPlayer, view: View, cuts: Cuts): Tier | null {
  if (view === "est") return p.tier;
  if (p.goalie) return view === "avg" ? tierByCut(p.goalie.perTeamGame, cuts.G) : p.tier;
  if (view === "avg") return p.avg !== null && p.gp >= MIN_GP ? tierByCut(p.avg, cuts[p.group]) : null;
  return p.form;
}
function valueFor(p: DirPlayer, view: View): number {
  if (view === "est") return p.est ?? -1;
  if (view === "avg") return (p.goalie ? p.goalie.perTeamGame : p.avg) ?? -1;
  return (p.goalie ? p.est : p.l30?.avg) ?? -1;
}

// The cards use the exact tier colours from the tier buttons (TIER_STYLE): bar = the card stripe and the dots in
// Rows, bg / fg = the stat tiles and the tier header strip. Superstar text is white on the cards (the buttons keep
// their navy), with a faint shadow in the tiles so it stays readable on the gold.
const SOFT = Object.fromEntries(TIERS.map((t) => [t, { bar: TIER_STYLE[t].bg, bg: TIER_STYLE[t].bg, fg: t === "Superstar" ? "#FFFFFF" : TIER_STYLE[t].fg }])) as Record<Tier, { bar: string; bg: string; fg: string }>;

function Trend({ t }: { t: DirPlayer["trend"] }) {
  return t === "up" ? <span className="text-green-700 font-bold"> ↑</span> : t === "down" ? <span className="text-center-red font-bold"> ↓</span> : null;
}

// One of the three Rating / Season / L30 columns on a card: the number and games played, on a tile tinted with the
// tier colour for that timeframe. The tile for the chosen timeframe gets an outline. `tag` names the tier only when it differs from the card's own tier, so a change (say
// Elite over L30 on a Superstar card) is spelled out as well as coloured. `delta` is L30 minus season average.
function Col({ label, value, sub, tier, on, trend, tag, delta, reserveTag }: { label: string; value: string; sub?: string; tier: Tier | null; on: boolean; trend?: DirPlayer["trend"]; tag?: Tier | null; delta?: number | null; reserveTag?: boolean }) {
  return (
    <div
      className="px-1 py-1.5 text-center rounded-lg border-2"
      style={tier ? { background: SOFT[tier].bg, color: SOFT[tier].fg, borderColor: on ? "#0C2740" : "transparent", textShadow: tier === "Superstar" ? "0 1px 1px rgba(60,40,0,0.35)" : undefined } : { background: "#EEF2F6", color: "#5B6672", borderColor: on ? "#5B6672" : "transparent" }}
    >
      <div className="text-xs">{label}</div>
      <div className="h-6 leading-6 whitespace-nowrap text-base font-semibold font-tabular">
        {value}
        {trend === "up" ? " ↑" : trend === "down" ? " ↓" : ""}
        {delta !== null && delta !== undefined && Math.abs(delta) >= 0.05 ? (
          <span className="ml-1 text-[11px] font-normal">
            {delta > 0 ? "+" : "−"}
            {f2(Math.abs(delta))}
          </span>
        ) : null}
      </div>
      {tag || reserveTag ? <div className="text-[11px] font-semibold h-4 leading-4 whitespace-nowrap">{tag ?? ""}</div> : null}
      <div className="text-[11px] font-tabular h-4 leading-4 whitespace-nowrap">{sub ?? ""}</div>
    </div>
  );
}

function Card({ p, tier, rank, view, cuts }: { p: DirPlayer; tier: Tier; rank: number; view: View; cuts: Cuts }) {
  const g = p.goalie;
  const seasonTier = tierFor(p, "avg", cuts);
  const rTag = p.tier !== tier ? p.tier : null;
  const sTag = seasonTier !== tier ? seasonTier : null;
  const lTag = !g && p.form !== tier ? p.form : null;
  const anyTag = !!(rTag || sTag || lTag);
  // Goalies have no L30 column, so L30 view highlights their rating.
  const active = view === "est" || (view === "l30" && g) ? 0 : view === "avg" ? 1 : 2;
  return (
    <div className="flex bg-white border border-ice-line rounded-lg overflow-hidden">
      <div className="w-1 shrink-0" style={{ background: SOFT[tier].bar }} />
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <PlayerPhoto playerId={p.id} name={p.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">
              <span className="text-muted font-normal text-sm">#{rank}</span> {p.name}
            </div>
            <div className="text-xs text-muted truncate">
              {p.nhl} · {p.pos} · {p.owner ? <span className="text-rink">{p.owner}</span> : <span className="text-green-700 font-semibold">{p.status}</span>}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-2">
          <Col label="Rating" value={p.est === null ? "–" : f2(p.est)} sub={g ? "per team gm" : p.priorAvg !== null ? `last yr ${f2(p.priorAvg)}` : undefined} tier={p.tier} tag={rTag} reserveTag={anyTag} on={active === 0} />
          <Col label="Season" value={g ? f2(g.perTeamGame) : p.avg === null ? "–" : f2(p.avg)} sub={g ? "per team gm" : `${p.gp} gp`} tier={seasonTier} tag={sTag} reserveTag={anyTag} on={active === 1} />
          {g ? (
            <Col label="Projected" value={`≈ ${g.pace}`} sub={`${g.gamesLeft} left`} tier={null} reserveTag={anyTag} on={false} />
          ) : (
            <Col label="L30" value={p.l30 ? f2(p.l30.avg) : "–"} sub={p.l30 ? `${p.l30.gp} gp` : undefined} tier={p.form} tag={lTag} reserveTag={anyTag} on={active === 2} trend={p.trend} delta={p.l30 && p.avg !== null ? p.l30.avg - p.avg : null} />
          )}
        </div>
        {g ? (
          <div className="mt-1.5 text-xs text-muted font-tabular">
            {f2(g.perStart)} per start · starts {Math.round(g.share * 100)}%
            {g.starts !== null && g.teamGames !== null ? ` (${g.starts} of ${g.teamGames})` : ""}
            {p.injury ? " · tier held while injured" : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Dense one-line layout: rank, name, and Rating / Season / L30 each with a dot in that timeframe's tier colour.
function Num({ value, tier, on, trend }: { value: string; tier: Tier | null; on: boolean; trend?: DirPlayer["trend"] }) {
  return (
    <div className={`w-[46px] shrink-0 text-right text-[13px] font-tabular ${on ? "font-semibold" : "text-muted"}`}>
      {tier ? <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: SOFT[tier].bar }} /> : null}
      {value}
      {trend ? <Trend t={trend} /> : null}
    </div>
  );
}

function DenseRow({ p, rank, view, cuts, first }: { p: DirPlayer; rank: number; view: View; cuts: Cuts; first: boolean }) {
  const g = p.goalie;
  const active = view === "est" || (view === "l30" && g) ? 0 : view === "avg" ? 1 : 2;
  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 ${first ? "" : "border-t border-ice-line"}`}>
      <div className="w-5 shrink-0 text-xs text-muted font-tabular">{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate">{p.name}</span>
          <span className="shrink-0 text-[11px] text-muted">
            {p.nhl} · {p.pos}
          </span>
        </div>
        <div className="text-[11px] truncate">
          {p.owner ? <span className="text-rink">{p.owner}</span> : <span className="text-green-700 font-semibold">{p.status}</span>}
          {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
        </div>
      </div>
      <Num value={p.est === null ? "–" : f2(p.est)} tier={p.tier} on={active === 0} />
      <Num value={g ? f2(g.perTeamGame) : p.avg === null ? "–" : f2(p.avg)} tier={tierFor(p, "avg", cuts)} on={active === 1} />
      {g ? <Num value={`≈${g.pace}`} tier={null} on={false} /> : <Num value={p.l30 ? f2(p.l30.avg) : "–"} tier={p.form} on={active === 2} trend={p.trend} />}
    </div>
  );
}

export default function TierLists({ data }: { data: TierDirectory }) {
  const [tier, setTier] = useState<Tier | "ALL">("Superstar");
  const [group, setGroup] = useState("ALL");
  const [avail, setAvail] = useState(false);
  const [view, setView] = useState<View>("est");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [fOpen, setFOpen] = useState(false);
  const [layout, setLayout] = useState<"cards" | "rows">("cards");
  // Fade the right edge of the tier chips while more of them are scrolled out of sight.
  const chipsRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(true);
  const checkFade = () => {
    const el = chipsRef.current;
    if (el) setFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    checkFade();
    window.addEventListener("resize", checkFade);
    return () => window.removeEventListener("resize", checkFade);
  }, []);
  // Remember the layout on this phone. Storage can be blocked, so every access is wrapped.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("tierListsLayout");
      if (v === "rows" || v === "cards") setLayout(v);
    } catch {}
  }, []);
  const pickLayout = (v: "cards" | "rows") => {
    setLayout(v);
    try {
      window.localStorage.setItem("tierListsLayout", v);
    } catch {}
  };

  const c = data.tiers.cutoffs;
  const viewLabel = VIEWS.find((v) => v.id === view)!.label;

  const base = useMemo(
    () =>
      data.players.filter((p) => (group === "ALL" || p.group === group) && (!avail || p.owner === null) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))),
    [data.players, group, avail, q]
  );
  // Every player with his tier for the chosen timeframe; players with no tier for it (not enough games) are left out.
  const placed = useMemo(
    () => base.map((p) => ({ p, t: tierFor(p, view, c), v: valueFor(p, view) })).filter((x): x is { p: DirPlayer; t: Tier; v: number } => x.t !== null),
    [base, view, c]
  );
  const counts = useMemo(() => {
    const out: Record<Tier, number> = { Superstar: 0, Elite: 0, Good: 0, Depth: 0, Replacement: 0 };
    for (const x of placed) out[x.t]++;
    return out;
  }, [placed]);
  const list = useMemo(() => {
    const rows = tier === "ALL" ? placed : placed.filter((x) => x.t === tier);
    // Best tier first, then highest number for the chosen timeframe.
    return [...rows].sort((a, b) => TIERS.indexOf(a.t) - TIERS.indexOf(b.t) || b.v - a.v);
  }, [placed, tier]);

  // Rank inside the player's own tier (restarts at 1 under each tier header in the All view).
  const ranks = useMemo(() => {
    const seen: Partial<Record<Tier, number>> = {};
    return list.map((x) => (seen[x.t] = (seen[x.t] ?? 0) + 1));
  }, [list]);

  const range = (g: "F" | "D" | "G") => {
    if (tier === "ALL") return "";
    const x = c[g];
    const lo = tier === "Superstar" ? x.franchise : tier === "Elite" ? x.superstar : tier === "Good" ? x.elite : tier === "Depth" ? x.depth : null;
    const hi = tier === "Superstar" ? null : tier === "Elite" ? x.franchise : tier === "Good" ? x.superstar : tier === "Depth" ? x.elite : x.depth;
    return lo === null ? `under ${f2(hi!)}` : hi === null ? `${f2(lo)}+` : `${f2(lo)} to ${f2(hi - 0.01)}`;
  };
  const unrated = base.length - placed.length;
  const activeFilters = (group !== "ALL" ? 1 : 0) + (avail ? 1 : 0) + (q.trim() ? 1 : 0);
  const groupLabel = GROUPS.find((g) => g.id === group)!.label;
  const seg = (on: boolean) => `px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${on ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`;
  const chip = "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ice-panel text-rink";

  return (
    <div>
      <div className="sticky top-0 z-20 bg-ice -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-2 mb-2 border-b border-ice-line">
      <div className="relative mb-2">
      <div ref={chipsRef} onScroll={checkFade} className="-mx-1 px-1 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => {
            setTier("ALL");
            setShown(PAGE);
          }}
          className={`shrink-0 px-3 py-2 text-sm font-semibold border-2 bg-white text-rink ${tier === "ALL" ? "border-rink" : "border-ice-line"}`}
        >
          All <span className="font-tabular opacity-90">{placed.length}</span>
        </button>
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTier(t);
              setShown(PAGE);
            }}
            className={`shrink-0 px-3 py-2 text-sm font-semibold border-2 ${tier === t ? "border-rink" : "border-transparent"}`}
            style={{ background: TIER_STYLE[t].bg, color: TIER_STYLE[t].fg }}
          >
            {t} <span className="font-tabular opacity-90">{counts[t]}</span>
          </button>
        ))}
      </div>
      {fade ? <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-ice to-transparent" /> : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex border border-ice-line">
          {VIEWS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setView(s.id);
                setShown(PAGE);
              }}
              className={seg(view === s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFOpen(!fOpen)} className={`px-3 py-1.5 text-sm border border-ice-line ${fOpen ? "bg-ice-panel" : "bg-white hover:bg-ice-panel"}`}>
            Filters{activeFilters ? ` · ${activeFilters}` : ""}
          </button>
          <div className="inline-flex border border-ice-line" role="group" aria-label="Layout">
            <button type="button" onClick={() => pickLayout("cards")} aria-label="Cards layout" aria-pressed={layout === "cards"} className={`px-2 py-1.5 ${layout === "cards" ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="2" y="2" width="12" height="5" rx="1" />
                <rect x="2" y="9" width="12" height="5" rx="1" />
              </svg>
            </button>
            <button type="button" onClick={() => pickLayout("rows")} aria-label="Rows layout" aria-pressed={layout === "rows"} className={`px-2 py-1.5 border-l border-ice-line ${layout === "rows" ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 3.5h12M2 8h12M2 12.5h12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      </div>

      {fOpen ? (
        <div className="border border-ice-line bg-white p-3 mb-2 flex flex-wrap gap-x-4 gap-y-3 items-end">
          <div className="text-xs text-muted flex flex-col gap-1">
            Position
            <div className="inline-flex border border-ice-line">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGroup(g.id);
                    setShown(PAGE);
                  }}
                  className={seg(group === g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-muted flex flex-col gap-1">
            Search
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Player name"
              className="border border-ice-line bg-white px-2 py-1.5 text-sm w-40"
            />
          </label>
          <label className="text-sm flex items-center gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={avail}
              onChange={(e) => {
                setAvail(e.target.checked);
                setShown(PAGE);
              }}
            />
            Available only
          </label>
        </div>
      ) : null}

      {activeFilters ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {group !== "ALL" ? (
            <button type="button" className={chip} onClick={() => setGroup("ALL")} aria-label={`Clear ${groupLabel} filter`}>
              {groupLabel} <span aria-hidden>×</span>
            </button>
          ) : null}
          {avail ? (
            <button type="button" className={chip} onClick={() => setAvail(false)} aria-label="Clear available only filter">
              Available only <span aria-hidden>×</span>
            </button>
          ) : null}
          {q.trim() ? (
            <button type="button" className={chip} onClick={() => setQ("")} aria-label="Clear search">
              “{q.trim()}” <span aria-hidden>×</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted mb-3 font-tabular">
        {tier === "ALL" ? (
          <>
            {list.length} players, best tier first, sorted by {viewLabel} within each tier
          </>
        ) : (
          <>
            {list.length} {tier} player{list.length === 1 ? "" : "s"} by {viewLabel} · Forwards {range("F")} · Defence {range("D")} · Goalies {range("G")} per team game · skaters avg pts per game
          </>
        )}
        {data.tiers.basis === "last season" ? " (cutoffs from last season's final)" : ""}
        {view === "l30" ? ` · goalies have no L30 tier, so they stay on their rating tier${unrated > 0 ? `; ${unrated} skater${unrated === 1 ? "" : "s"} with fewer than ${MIN_GP} games in the last 30 days aren't placed` : ""}` : ""}
        {view === "avg" && unrated > 0 ? ` · ${unrated} player${unrated === 1 ? "" : "s"} with fewer than ${MIN_GP} games this season aren't placed` : ""}
      </p>

      {list.length === 0 ? (
        <p className="text-muted">No players match.</p>
      ) : (
        <>
          {layout === "rows" ? (
            <div className="border border-ice-line bg-white rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-ice-panel text-[11px] text-muted">
                <div className="w-5 shrink-0">#</div>
                <div className="flex-1">Player</div>
                <div className="w-[46px] shrink-0 text-right">Rating</div>
                <div className="w-[46px] shrink-0 text-right">Season</div>
                <div className="w-[46px] shrink-0 text-right">L30</div>
              </div>
              {list.slice(0, shown).map((x, i, arr) => (
                <div key={x.p.id}>
                  {tier === "ALL" && (i === 0 || arr[i - 1].t !== x.t) ? (
                    <div className={`px-3 py-1 text-xs font-semibold flex items-center justify-between ${i === 0 ? "" : "border-t border-ice-line"}`} style={{ background: SOFT[x.t].bg, color: SOFT[x.t].fg }}>
                      <span>{x.t}</span>
                      <span className="font-tabular">{counts[x.t]}</span>
                    </div>
                  ) : null}
                  <DenseRow p={x.p} rank={ranks[i]} view={view} cuts={c} first={i === 0 || (tier === "ALL" && arr[i - 1].t !== x.t)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {list.slice(0, shown).map((x, i, arr) => (
                <div key={x.p.id}>
                  {tier === "ALL" && (i === 0 || arr[i - 1].t !== x.t) ? (
                    <div className={`px-3 py-1.5 text-xs font-semibold flex items-center justify-between rounded ${i === 0 ? "mb-2" : "mt-3 mb-2"}`} style={{ background: SOFT[x.t].bg, color: SOFT[x.t].fg }}>
                      <span>{x.t}</span>
                      <span className="font-tabular">{counts[x.t]}</span>
                    </div>
                  ) : null}
                  <Card p={x.p} tier={x.t} rank={ranks[i]} view={view} cuts={c} />
                </div>
              ))}
            </div>
          )}
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
