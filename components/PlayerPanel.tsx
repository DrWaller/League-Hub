"use client";

import { useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import type { AvailablePlayer, BestAvailable as Data, StatCat, Window } from "@/lib/best-available";

export const PERIODS: { id: Window; label: string }[] = [
  { id: "season", label: "Season" },
  { id: "l7", label: "L7" },
  { id: "l15", label: "L15" },
  { id: "l30", label: "L30" },
];
const mmss = (sec: number) => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const fmtStat = (c: StatCat, v: number | undefined) => {
  if (v === undefined) return "–";
  if (c.id === "11") return v.toFixed(3).replace(/^0/, ""); // SV%
  return c.rate ? v.toFixed(2) : String(Math.round(v * 100) / 100);
};
const f2 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

export default function PlayerPanel({ p, data, period, onClose }: { p: AvailablePlayer; data: Pick<Data, "cats" | "days" | "scheduleKnown">; period: Window; onClose: () => void }) {
  const [win, setWin] = useState<Window>(period);
  const s = p.w[win];
  const cats = data.cats.filter((c) => c.goalie === (p.position === "G"));
  const r = p.role;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-ice-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 border-b border-ice-line sticky top-0 bg-white">
          <PlayerPhoto playerId={p.id} name={p.name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl leading-tight">{p.name}</div>
            <div className="text-xs text-muted">
              {p.team} · {p.position}
              {p.status === "W" ? " · waivers" : " · free agent"}
              {p.owned !== null ? ` · ${p.owned.toFixed(1)}% owned` : ""}
              {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
            </div>
            {r ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-tabular">
                <span className="px-1.5 py-0.5 bg-rink text-ice">{r.line ?? "no line"}</span>
                <span className={`px-1.5 py-0.5 ${r.pp ? "bg-gold text-rink font-semibold" : "border border-ice-line text-muted"}`}>{r.pp ?? "no PP"}</span>
                <span>{mmss(r.toi)} TOI</span>
                <span className="text-muted">{Math.round((r.ppShareRecent ?? r.ppShare) * 100)}% of PP time</span>
                {r.change ? <span className="text-green-700 font-semibold">{r.change.text}</span> : null}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none px-2 text-muted hover:text-rink" aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs text-muted mb-1">Value by period</div>
            <table className="w-full text-sm font-tabular">
              <thead>
                <tr className="text-muted text-xs border-b border-ice-line">
                  <th className="text-left py-1">Period</th>
                  <th className="text-right">GP</th>
                  <th className="text-right">PTS</th>
                  <th className="text-right">AVG</th>
                  <th className="text-right">VOR</th>
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((x) => {
                  const w = p.w[x.id];
                  return (
                    <tr key={x.id} className={`border-b border-ice-line last:border-0 ${win === x.id ? "bg-ice-panel" : ""}`}>
                      <td className="py-1">
                        <button type="button" onClick={() => setWin(x.id)} className="hover:underline">
                          {x.label}
                        </button>
                      </td>
                      <td className="text-right">{w ? w.gp : "–"}</td>
                      <td className="text-right">{w ? f2(w.pts) : "–"}</td>
                      <td className="text-right">{w ? f2(w.avg) : "–"}</td>
                      <td className="text-right font-semibold">{w && w.vor !== null ? signed(w.vor) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {p.proj !== null ? <div className="text-xs text-muted mt-1">ESPN projection: {f2(p.proj)} pts per game</div> : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted">All scoring stats</div>
              <div className="inline-flex border border-ice-line">
                {PERIODS.map((x) => (
                  <button key={x.id} type="button" onClick={() => setWin(x.id)} className={`px-2 py-1 text-xs border-r border-ice-line last:border-r-0 ${win === x.id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            {s ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-px bg-ice-line border border-ice-line">
                {cats.map((c) => (
                  <div key={c.id} className="bg-white px-2 py-1.5">
                    <div className="text-[11px] text-muted">{c.label}</div>
                    <div className="font-tabular">{fmtStat(c, s.st[c.id] ?? (c.rate ? undefined : 0))}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No games in this period.</p>
            )}
          </div>

          {data.scheduleKnown && (
            <div>
              <div className="text-xs text-muted mb-1">Game nights, next {data.days.length} days ({p.games.length} games)</div>
              <div className="flex flex-wrap gap-1">
                {data.days.map((d) => {
                  const on = p.games.includes(d.offset);
                  return (
                    <span key={d.date} title={d.label} className={`px-1.5 py-1 text-[11px] font-tabular border ${on ? "bg-rink text-ice border-rink" : "border-ice-line text-muted"}`}>
                      {d.label.replace(",", "")}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
