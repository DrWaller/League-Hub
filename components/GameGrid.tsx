"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import type { GridData } from "@/lib/game-grid";

type SortKey = "team" | "gp" | "off" | "score";
const KEY = "pickups-team";
const SLOT_ORDER = ["C", "LW", "RW", "F", "D", "G", "UTIL"] as const;
const openLabel = (o: Record<string, number>) => {
  const parts = SLOT_ORDER.filter((k) => o[k] > 0).map((k) => `${k === "UTIL" ? "Util" : k}${o[k] > 1 ? `×${o[k]}` : ""}`);
  return parts;
};
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

// Top 10 green, bottom 10 red, the middle gold: the same read as a heat map.
function tone(rank: number, n: number): string {
  if (rank < 10) return "bg-green-100 text-green-900";
  if (rank >= n - 10) return "bg-red-100 text-red-900";
  return "bg-amber-50 text-amber-900";
}

export default function GameGrid({ data }: { data: GridData }) {
  const [sort, setSort] = useState<SortKey>("score");
  const [picked, setPicked] = useState<string | null>(null);
  const [pos, setPos] = useState("All");
  const [fitFirst, setFitFirst] = useState(true);

  // Remember my team (shared with Pickup Targets) so the page opens synced to it.
  useEffect(() => {
    try {
      if (data.teamId) localStorage.setItem(KEY, String(data.teamId));
      else {
        const saved = localStorage.getItem(KEY);
        if (saved) window.location.replace(`/game-grid?days=${data.span}&shift=${data.shift}&team=${encodeURIComponent(saved)}`);
      }
    } catch {
      /* private mode: fine */
    }
  }, [data.teamId, data.span, data.shift]);

  const rows = useMemo(() => {
    const r = [...data.teams];
    r.sort((a, b) => (sort === "team" ? a.abbrev.localeCompare(b.abbrev) : (b[sort] as number) - (a[sort] as number) || b.score - a.score || a.abbrev.localeCompare(b.abbrev)));
    return r;
  }, [data.teams, sort]);

  const rankBy = (key: "gp" | "off" | "score") => {
    const sorted = [...data.teams].sort((a, b) => b[key] - a[key]).map((t) => t.abbrev);
    return (abbrev: string) => sorted.indexOf(abbrev);
  };
  const rGp = rankBy("gp");
  const rOff = rankBy("off");
  const rScore = rankBy("score");

  const panel = useMemo(() => {
    if (!picked) return [];
    return data.players
      .filter((p) => p.team === picked && (pos === "All" ? true : pos === "F" ? ["C", "LW", "RW"].includes(p.position) : p.position === pos))
      .sort((a, b) => (fitFirst && data.open ? Number(b.fits.length > 0) - Number(a.fits.length > 0) : 0) || (b.vor ?? -Infinity) - (a.vor ?? -Infinity) || b.pts - a.pts);
  }, [data.players, data.open, picked, pos, fitFirst]);

  const th = (k: SortKey, label: string) => (
    <th className="px-2 py-2 text-center">
      <button type="button" onClick={() => setSort(k)} className={sort === k ? "text-rink font-semibold" : "hover:text-rink"}>
        {label}
        {sort === k ? " ↓" : ""}
      </button>
    </th>
  );

  return (
    <div>
      <form method="get" className="flex flex-wrap items-end gap-3 mb-4">
        <input type="hidden" name="days" value={data.span} />
        <input type="hidden" name="shift" value={data.shift} />
        <label className="text-xs text-muted flex flex-col gap-1">
          Sync to my team
          <select name="team" defaultValue={data.teamId || ""} className="border border-ice-line bg-white px-2 py-1.5 text-sm" onChange={(e) => e.currentTarget.form?.submit()}>
            <option value="">Not synced</option>
            {data.teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {data.open ? <span className="text-xs text-muted pb-2">Showing open spots for {data.teamName}</span> : null}
      </form>

      <div className="border border-ice-line overflow-x-auto mb-3">
        <table className="w-full text-sm font-tabular">
          <thead>
            <tr className="text-muted border-b border-ice-line">
              <th className="px-2 py-2 text-left sticky left-0 z-10 bg-white shadow-[2px_0_0_0_#CBD6E2]">
                <button type="button" onClick={() => setSort("team")} className={sort === "team" ? "text-rink font-semibold" : "hover:text-rink"}>
                  Team
                </button>
              </th>
              {th("gp", "GP")}
              {th("off", "OFF")}
              {th("score", "Score")}
              {data.days.map((d, i) => (
                <th key={i} className={`px-2 py-2 text-center font-normal whitespace-nowrap ${d.light ? "bg-amber-50" : ""}`}>
                  <div className="text-xs">{d.label}</div>
                  <div className={`text-[11px] ${d.light ? "text-gold font-semibold" : ""}`}>
                    {d.games} games{d.light ? " · light" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.open ? (
              <tr className="border-b-2 border-gold bg-ice-panel">
                <td className="px-2 py-2 font-semibold sticky left-0 z-10 bg-ice-panel shadow-[2px_0_0_0_#CBD6E2] whitespace-nowrap">My open</td>
                <td colSpan={3} className="px-2 py-2 text-[11px] text-muted text-center">empty slots</td>
                {data.open.map((o, i) => {
                  const parts = openLabel(o);
                  return (
                    <td key={i} className={`px-2 py-1.5 text-center text-xs align-top ${parts.length ? "text-center-red font-semibold" : "text-muted"}`}>
                      {parts.length ? parts.map((x) => <div key={x}>{x}</div>) : "full"}
                    </td>
                  );
                })}
              </tr>
            ) : null}
            {rows.map((t) => (
              <tr key={t.abbrev} onClick={() => setPicked(picked === t.abbrev ? null : t.abbrev)} className={`border-b border-ice-line last:border-0 cursor-pointer ${picked === t.abbrev ? "bg-ice-panel" : ""}`}>
                <td className={`px-2 py-1.5 font-semibold sticky left-0 z-10 shadow-[2px_0_0_0_#CBD6E2] ${picked === t.abbrev ? "bg-ice-panel" : "bg-white"}`}>{t.abbrev}</td>
                <td className={`px-2 py-1.5 text-center ${tone(rGp(t.abbrev), data.teams.length)}`}>{t.gp}</td>
                <td className={`px-2 py-1.5 text-center ${tone(rOff(t.abbrev), data.teams.length)}`}>{t.off}</td>
                <td className={`px-2 py-1.5 text-center ${tone(rScore(t.abbrev), data.teams.length)}`}>{signed(t.score)}</td>
                {t.cells.map((c, i) => (
                  <td key={i} className={`px-2 py-1.5 text-center whitespace-nowrap ${data.days[i].light ? "bg-amber-50" : ""}`}>
                    {c.game ? (
                      <span className={c.away === undefined ? "" : c.away ? "text-red-700" : "text-green-700"}>
                        {c.opp ? `${c.away ? "@" : ""}${c.opp}` : "●"}
                      </span>
                    ) : (
                      <span className="text-ice-line">–</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mb-8 max-w-prose">
        GP = games in the window. OFF = games on light nights (8 or fewer NHL games). Score is a simple schedule rating: games above the
        league average count in full, off-night games count half as much. Green = top 10, red = bottom 10. Green opponent = home, red = away.
      </p>

      {picked && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-xl">Available from {picked}</h2>
            {data.open ? (
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={fitFirst} onChange={(e) => setFitFirst(e.target.checked)} />
                Fits my open spots first
              </label>
            ) : null}
            <div className="inline-flex border border-ice-line">
              {["All", "F", "D", "G"].map((x) => (
                <button key={x} type="button" onClick={() => setPos(x)} className={`px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${pos === x ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                  {x}
                </button>
              ))}
            </div>
          </div>
          {panel.length === 0 ? (
            <p className="text-muted">No available players on {picked}.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {panel.map((p) => (
                <div key={p.id} className="border border-ice-line bg-white p-3 flex items-center gap-3">
                  <PlayerPhoto playerId={p.id} name={p.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.position} · {p.gp} gp · {p.pts.toFixed(2)} pts · {p.avg.toFixed(2)} avg
                      {p.owned !== null ? ` · ${p.owned.toFixed(0)}% owned` : ""}
                      {p.status === "W" ? " · waivers" : ""}
                      {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
                    </div>
                    {data.open ? (
                      <div className={`text-xs mt-0.5 ${p.fits.length ? "text-green-700 font-semibold" : "text-muted"}`}>
                        {p.fits.length ? `Fills an open spot ${p.fits.map((i) => data.days[i].label.split(",")[0] + " " + data.days[i].label.split(" ").slice(-1)[0]).join(", ")}` : "No open spot on his game days"}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right font-display text-xl text-center-red">{p.vor === null ? "–" : signed(p.vor)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
