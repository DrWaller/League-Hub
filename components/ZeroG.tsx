"use client";

import { useMemo, useState } from "react";
import TierBadge from "@/components/TierBadge";
import PlayerPhoto from "@/components/PlayerPhoto";
import PlayerPanel from "@/components/PlayerPanel";
import { dayShort } from "@/lib/nights";
import type { GoalieRole, ZeroGData, ZeroGoalie } from "@/lib/goalie-starts";

const ROLE_LABEL: Record<GoalieRole, string> = { takeover: "Taking over", starter: "Starter", timeshare: "Timeshare", backup: "Backup", early: "Too early" };
const ROLE_STYLE: Record<GoalieRole, string> = {
  takeover: "bg-gold text-rink font-semibold",
  starter: "bg-rink text-ice",
  timeshare: "border border-ice-line text-rink",
  backup: "border border-ice-line text-muted",
  early: "border border-ice-line text-muted",
};
const f2 = (n: number) => n.toFixed(2);
const pct = (p: number) => `${Math.round(p * 100)}%`;

function Dots({ g }: { g: ZeroGoalie }) {
  return (
    <div className="flex items-center gap-1" aria-label="Last team games: started, relieved or did not play">
      {g.dots.map((d, i) => (
        <span
          key={i}
          title={`${d.date}${d.b2b ? " (2nd night of a back-to-back)" : ""}: ${d.r === "S" ? "started" : d.r === "R" ? "came in relief" : "did not play"}`}
          className={`relative w-4 h-4 inline-block ${d.r === "S" ? "bg-green-600" : d.r === "R" ? "bg-gold/60" : "bg-ice-line"} ${d.b2b ? "ring-1 ring-rink/60" : ""}`}
        />
      ))}
    </div>
  );
}

function Card({ g, onOpen, sort }: { g: ZeroGoalie; onOpen: (g: ZeroGoalie) => void; sort: "starts" | "value" }) {
  const p = g.player;
  return (
    <div className={`border bg-white p-3 flex gap-3 ${g.role === "takeover" ? "border-gold" : "border-ice-line"}`}>
      <button type="button" onClick={() => onOpen(g)} aria-label={`${p.name} stats`} className="shrink-0 self-start">
        <PlayerPhoto playerId={p.id} name={p.name} size={44} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">
              <button type="button" onClick={() => onOpen(g)} className="hover:underline hover:text-center-red">
                {p.name}
              </button>
            </div>
            <div className="text-xs text-muted">
              {p.team} · G{p.status === "W" ? " · waivers" : ""} <TierBadge tier={p.tier} />
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
              {p.owned !== null ? ` · ${p.owned.toFixed(0)}% owned` : ""}
            </div>
          </div>
          <div className="text-right shrink-0 pl-1">
            <div className="font-display text-2xl leading-none text-center-red">{sort === "starts" ? f2(g.expStarts) : f2(g.expValue)}</div>
            <div className="text-[11px] text-muted">{sort === "starts" ? "exp starts" : "exp pts"}</div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 ${ROLE_STYLE[g.role]}`}>{ROLE_LABEL[g.role]}</span>
          <span className="text-muted">{g.reason}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Dots g={g} />
          <span className="text-xs text-muted font-tabular">
            {g.starts}/{g.games} starts{g.streak >= 2 ? ` · ${g.streak} in a row` : ""}
          </span>
        </div>

        {g.incumbent ? (
          <div className="mt-1 text-xs text-muted">
            {g.incumbent.name}: {g.incumbent.starts} of last {g.games}, {g.incumbent.starts3} of last 3
          </div>
        ) : null}

        <div className="mt-2 text-xs text-muted font-tabular flex flex-wrap gap-x-3 gap-y-1">
          <span>{f2(g.estPerStart)} exp pts/start</span>
          <span>{f2(g.expStarts)} exp starts</span>
          <span>{f2(g.expValue)} exp pts</span>
        </div>

        {g.nights.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-tabular">
            {g.nights.map((n) => (
              <span
                key={n.offset}
                title={`${n.label}: ${pct(n.p)} chance to start${n.b2b ? " (second night of a back-to-back)" : ""}`}
                className={`px-1 ${n.p >= 0.6 ? "bg-green-100 text-green-800 font-bold" : n.p >= 0.35 ? "bg-gold/20 text-rink font-semibold" : "text-muted/70"}`}
              >
                {dayShort(n.label)} {pct(n.p)}
                {n.b2b ? " B2B" : ""}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1.5 text-xs text-muted">No games in this window.</div>
        )}
      </div>
    </div>
  );
}

export default function ZeroG({ data }: { data: ZeroGData }) {
  const [sort, setSort] = useState<"starts" | "value">("starts");
  const [show, setShow] = useState<"likely" | "all">("likely");
  const [open, setOpen] = useState<ZeroGoalie | null>(null);

  const list = useMemo(() => {
    const rows = data.goalies.filter((g) => (show === "all" ? true : g.role === "takeover" || g.role === "starter" || g.role === "timeshare" || g.role === "early"));
    const rank = (g: ZeroGoalie) => (g.role === "takeover" ? 1 : 0);
    return [...rows].sort((a, b) =>
      sort === "starts" ? rank(b) - rank(a) || b.expStarts - a.expStarts || b.expValue - a.expValue : b.expValue - a.expValue || b.expStarts - a.expStarts
    );
  }, [data.goalies, sort, show]);

  const takeovers = data.goalies.filter((g) => g.role === "takeover").length;

  return (
    <div>
      <form method="get" className="flex flex-wrap gap-x-4 gap-y-3 items-end mb-4">
        <label className="text-xs text-muted flex flex-col gap-1">
          Window
          <select name="window" defaultValue={data.windowKey} className="border border-ice-line bg-white px-2 py-1.5 text-sm" onChange={(e) => e.currentTarget.form?.submit()}>
            <option value="3d">Next 3 days</option>
            <option value="current">Current matchup (rest of it)</option>
            <option value="next">Next matchup</option>
            <option value="early">Early week, M-W (this matchup)</option>
            <option value="late">Late week, Th-Su (this matchup)</option>
            <option value="next-early">Early week, M-W (next matchup)</option>
            <option value="next-late">Late week, Th-Su (next matchup)</option>
          </select>
        </label>
        <div className="text-xs text-muted flex flex-col gap-1">
          Rank by
          <div className="inline-flex border border-ice-line">
            {([["starts", "Expected starts"], ["value", "Expected points"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setSort(id)} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${sort === id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted flex flex-col gap-1">
          Show
          <div className="inline-flex border border-ice-line">
            {([["likely", "Starters + timeshares"], ["all", "All goalies"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setShow(id)} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${show === id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>

      <p className="text-xs text-muted mb-1">
        Window: {data.windowLabel}. {takeovers > 0 ? `${takeovers} possible takeover${takeovers === 1 ? "" : "s"} are pinned to the top.` : ""}
        {data.asOf ? ` Starts through ${data.asOf}.` : ""}
      </p>
      <p className="text-xs text-muted mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Last games:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-green-600 inline-block" /> started</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-gold/60 inline-block" /> relief</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-ice-line inline-block" /> didn&apos;t play</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-ice-line inline-block ring-1 ring-rink/60" /> back-to-back, 2nd night</span>
      </p>

      {list.length === 0 ? (
        <p className="text-muted">No available goalies match.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map((g) => (
            <Card key={g.player.id} g={g} onOpen={setOpen} sort={sort} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted mt-4 max-w-prose">
        A goalie is a <strong>starter</strong> with 6+ starts in his team&apos;s last 10 games (or 60%+), a <strong>timeshare</strong> at 30-60%, and a{" "}
        <strong>takeover</strong> when he has started two in a row, or 2 of his team&apos;s last 3, or started while the old starter has missed the last 3.
        Backup starts on the second night of a back-to-back don&apos;t count toward a takeover. The start chance for each night comes from his recent share, and a starter is
        cut in half on the second night of a back-to-back. Expected points = expected starts × his expected points per start (his average blended with ESPN&apos;s projection).
        Tonight&apos;s confirmed starters aren&apos;t included yet.
      </p>

      {open && <PlayerPanel p={open.player} data={{ cats: data.cats, days: data.days, scheduleKnown: data.scheduleKnown }} period="season" onClose={() => setOpen(null)} />}
    </div>
  );
}
