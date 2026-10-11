"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import type { Pickup, PickupData } from "@/lib/pickups";

const KEY = "pickups-team";
const POS = ["All", "F", "D", "G"];
const f1 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

function Card({ p, horizon }: { p: Pickup; horizon: number }) {
  return (
    <div className={`border bg-white p-3 flex gap-3 ${p.hot ? "border-gold" : "border-ice-line"}`}>
      <PlayerPhoto playerId={p.id} name={p.name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {p.hot ? <span className="text-gold" title={p.hot}>★ </span> : null}
              {p.name}
            </div>
            <div className="text-xs text-muted">
              {p.team} · {p.position}
              {p.status === "W" ? " · waivers" : ""}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
              {p.owned !== null ? ` · ${p.owned.toFixed(0)}% owned` : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-2xl leading-none text-center-red">{signed(p.net)}</div>
            <div className="text-[11px] text-muted">pts / {horizon}d</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted font-tabular flex flex-wrap gap-x-3 gap-y-1">
          <span>{p.games} games</span>
          <span>{p.lightGames} on open-slot days</span>
          <span>{f1(p.est)} exp/gm</span>
          {p.avgL15 !== null ? <span>L15 {f1(p.avgL15)} avg ({p.gpL15} gp)</span> : null}
          {p.vorSeason !== null ? <span>season VOR {signed(p.vorSeason)}</span> : null}
        </div>
        {p.hot ? <div className="mt-1 text-xs text-gold">{p.hot}</div> : null}
        {p.drop ? (
          <div className="mt-1 text-xs">
            Drop <span className="font-semibold">{p.drop.name}</span>
            <span className="text-muted"> · {signed(p.added)} if you have a free spot</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PickupTool({ data }: { data: PickupData }) {
  const [pos, setPos] = useState("All");

  // Remember my team so the page opens on it next time.
  useEffect(() => {
    try {
      if (data.teamId) localStorage.setItem(KEY, String(data.teamId));
      else {
        const saved = localStorage.getItem(KEY);
        if (saved) window.location.replace(`/pickups?team=${encodeURIComponent(saved)}`);
      }
    } catch {
      /* private mode: fine */
    }
  }, [data.teamId]);

  const picks = useMemo(
    () => data.picks.filter((p) => (pos === "All" ? true : pos === "F" ? ["C", "LW", "RW"].includes(p.position) : p.position === pos)),
    [data.picks, pos]
  );

  return (
    <div>
      <form method="get" className="flex flex-wrap gap-x-4 gap-y-3 items-end mb-6">
        <label className="text-xs text-muted flex flex-col gap-1">
          My team
          <select name="team" defaultValue={data.teamId || ""} className="border border-ice-line bg-white px-2 py-1.5 text-sm" onChange={(e) => e.currentTarget.form?.submit()}>
            <option value="">Choose your team</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Look ahead
          <select name="days" defaultValue={data.horizon} className="border border-ice-line bg-white px-2 py-1.5 text-sm" onChange={(e) => e.currentTarget.form?.submit()}>
            {[3, 7, 14].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </label>
      </form>

      {!data.teamId ? (
        <p className="text-muted">Pick your team to see who to add.</p>
      ) : (
        <>
          <h2 className="font-display text-xl mb-2">The schedule: {data.teamName}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {data.days.map((d) => (
              <div key={d.offset} className={`shrink-0 w-[84px] border p-2 text-center font-tabular ${d.offset < data.horizon ? "bg-white" : "bg-ice-panel opacity-70"} ${d.light ? "border-gold" : "border-ice-line"}`}>
                <div className="text-xs text-muted">{d.label}</div>
                <div className="text-sm">{d.nhlTeams} teams</div>
                <div className={`text-xs ${d.open > 0 ? "text-center-red font-semibold" : "text-muted"}`}>{d.open} open</div>
                {d.light ? <div className="text-[10px] text-gold">light day</div> : null}
              </div>
            ))}
          </div>

          {data.hot.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-xl mb-1">Can&apos;t miss</h2>
              <p className="text-xs text-muted mb-3">Performing at a standout level among available players, so they show up whatever your schedule looks like.</p>
              <div className="grid md:grid-cols-2 gap-3">
                {data.hot.map((p) => (
                  <Card key={p.id} p={p} horizon={data.horizon} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-display text-xl">Best fits for your lineup</h2>
              <div className="inline-flex border border-ice-line">
                {POS.map((x) => (
                  <button key={x} type="button" onClick={() => setPos(x)} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${pos === x ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
            {picks.length === 0 ? (
              <p className="text-muted">No matches.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {picks.map((p) => (
                  <Card key={p.id} p={p} horizon={data.horizon} />
                ))}
              </div>
            )}
            <p className="text-xs text-muted mt-4 max-w-prose">
              Points are the expected extra points over the next {data.horizon} days after dropping the player shown. Expected points per game
              blend each player&apos;s season average with ESPN&apos;s projection. Goalies count for about 60% of their team&apos;s games, since
              they don&apos;t start every night.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
