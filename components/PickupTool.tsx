"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import type { Pickup, PickupData } from "@/lib/pickups";
import PlayerPanel from "@/components/PlayerPanel";
import { dayShort } from "@/lib/nights";

const KEY = "pickups-team";
const POS = ["All", "F", "D", "G"];
const f1 = (n: number) => n.toFixed(2);
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

function Card({ p, label, days, onOpen }: { p: Pickup; label: string; days: PickupData["days"]; onOpen: (p: Pickup) => void }) {
  const nightList = days.filter((d) => p.nights.includes(d.offset));
  return (
    <div className={`border bg-white p-3 flex gap-3 ${p.hot ? "border-gold" : "border-ice-line"}`}>
      <button type="button" onClick={() => onOpen(p)} aria-label={`${p.name} stats`} className="shrink-0 self-start">
        <PlayerPhoto playerId={p.id} name={p.name} size={44} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {p.hot ? <span className="text-gold" title={p.hot}>★ </span> : null}
              <button type="button" onClick={() => onOpen(p)} className="hover:underline hover:text-center-red">
                {p.name}
              </button>
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
            <div className="text-[11px] text-muted">pts · {label}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted font-tabular flex flex-wrap gap-x-3 gap-y-1">
          <span>{p.games} games</span>
          {nightList.length > 0 ? <span className="font-semibold text-rink">{nightList.map((d) => dayShort(d.label)).join(" ")}</span> : null}
          <span>{p.lightGames} on your open-slot days</span>
          <span>{p.lightDayGames} on light nights</span>
          <span>{f1(p.est)} exp/gm</span>
          {p.avgL15 !== null ? <span>L15 {f1(p.avgL15)} avg ({p.gpL15} gp)</span> : null}
          {p.vorSeason !== null ? <span>season VOR {signed(p.vorSeason)}</span> : null}
        </div>
        {p.role ? (
          <>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-tabular">
            <span className="px-1.5 py-0.5 bg-rink text-ice">{p.role.line ?? (p.role.source === "lines" ? "no line" : "line ?")}</span>
            <span className={`px-1.5 py-0.5 ${p.role.pp ? "bg-gold text-rink font-semibold" : "border border-ice-line text-muted"}`}>{p.role.pp ?? "no PP"}</span>
            <span>{mmss(p.role.toi)} TOI</span>
            {p.role.toiRecent !== null && Math.abs(p.role.toiRecent - p.role.toiSeason) >= 20 ? (
              <span className={p.role.toiRecent > p.role.toiSeason ? "text-green-700" : "text-center-red"}>
                {p.role.toiRecent > p.role.toiSeason ? "↑" : "↓"} {mmss(Math.abs(p.role.toiRecent - p.role.toiSeason))} lately
              </span>
            ) : null}
            <span className="text-muted">{Math.round((p.role.ppShareRecent ?? p.role.ppShare) * 100)}% of PP time</span>
            <span className="text-muted">role {p.role.score}</span>
            {p.role.source === "inferred" ? <span className="text-muted italic">inferred</span> : null}
          </div>
          {p.role.change ? (
            <div className="mt-1 text-xs font-semibold text-green-700">Line change: {p.role.change.text} · {ago(p.role.change.at)}</div>
          ) : null}
          </>
        ) : null}
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
  const [open, setOpen] = useState<Pickup | null>(null);

  // Remember my team so the page opens on it next time.
  useEffect(() => {
    try {
      if (data.teamId) localStorage.setItem(KEY, String(data.teamId));
      else {
        const saved = localStorage.getItem(KEY);
        if (saved) window.location.replace(`/pickups?team=${encodeURIComponent(saved)}&window=${data.windowKey}${data.roleOn ? "" : "&role=off"}`);
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
          Role (TOI, PP, line)
          <select name="role" defaultValue={data.roleOn ? "on" : "off"} className="border border-ice-line bg-white px-2 py-1.5 text-sm" onChange={(e) => e.currentTarget.form?.submit()}>
            <option value="on">Count it in the ranking</option>
            <option value="off">Show only</option>
          </select>
        </label>
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
      </form>

      {!data.teamId ? (
        <p className="text-muted">Pick your team to see who to add.</p>
      ) : (
        <>
          <h2 className="font-display text-xl mb-2">The schedule: {data.teamName}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {data.days.map((d) => (
              <div key={d.offset} className={`shrink-0 w-[84px] border p-2 text-center font-tabular ${"bg-white"} ${d.light ? "border-gold" : "border-ice-line"}`}>
                <div className="text-xs text-muted">{d.label}</div>
                <div className="text-sm">{d.nhlGames} games</div>
                <div className={`text-xs ${d.open > 0 ? "text-center-red font-semibold" : "text-muted"}`}>{d.open} open</div>
                {d.light ? <div className="text-[10px] text-gold">light day</div> : null}
              </div>
            ))}
          </div>

          {data.lineChanges.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-xl mb-1">Line changes: available players</h2>
              <p className="text-xs text-muted mb-3">
                Recent moves in the NHL lines{data.linesUpdated ? ` (Daily Faceoff, updated ${ago(data.linesUpdated)})` : ""}. A promotion is often the first sign a pickup is about to pay off.
              </p>
              <div className="border border-ice-line bg-white divide-y divide-ice-line">
                {data.lineChanges.map((c, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex flex-wrap items-center gap-x-3">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted">{c.team}{c.position ? ` · ${c.position}` : ""}</span>
                    <span>{c.text}</span>
                    <span className="text-xs text-muted ml-auto">{ago(c.at)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.hot.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-xl mb-1">Can&apos;t miss</h2>
              <p className="text-xs text-muted mb-3">Performing at a standout level among available players, so they show up whatever your schedule looks like.</p>
              <div className="grid md:grid-cols-2 gap-3">
                {data.hot.map((p) => (
                  <Card key={p.id} p={p} label={data.windowLabel} days={data.days} onOpen={setOpen} />
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
                  <Card key={p.id} p={p} label={data.windowLabel} days={data.days} onOpen={setOpen} />
                ))}
              </div>
            )}
            <p className="text-xs text-muted mt-4 max-w-prose">
              Points are the expected extra points over {data.windowLabel} after dropping the player shown. Expected points per game
              blend each player&apos;s season average with ESPN&apos;s projection{data.roleOn && data.hasRoles ? ", then scale it 0.85-1.15 by role (ice time, power-play share and line)" : ""}. Goalies count for about 60% of their team&apos;s games, since
              they don&apos;t start every night. Lines and power-play units are the real combinations from Daily Faceoff, refreshed every 15 minutes while you use the page; ice time is from the NHL. If a team&apos;s lines can&apos;t be read, its players show an inferred line (L1 = top 3 forwards by even-strength time) marked as inferred.
            </p>
          </section>
        </>
      )}
      {open && <PlayerPanel p={open.player} data={data.panel} period="season" onClose={() => setOpen(null)} />}
    </div>
  );
}
