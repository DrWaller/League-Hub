"use client";

import { useMemo, useState } from "react";
import TierBadge from "@/components/TierBadge";
import PlayerPhoto from "@/components/PlayerPhoto";
import PlayerPanel, { PERIODS } from "@/components/PlayerPanel";
import { dayShort } from "@/lib/nights";
import type { BestAvailable as Data, AvailablePlayer, StatCat, Window } from "@/lib/best-available";

type SortKey = string; // "vor" | "pts" | "avg" | "s:<stat id>"

const SORTS: { id: string; label: string }[] = [
  { id: "vor", label: "VOR" },
  { id: "pts", label: "Total PTS" },
  { id: "avg", label: "AVG" },
];
const POSITIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "SK", label: "Skaters" },
  { id: "F", label: "F" },
  { id: "D", label: "D" },
  { id: "C", label: "C" },
  { id: "LW", label: "LW" },
  { id: "RW", label: "RW" },
  { id: "G", label: "G" },
];
const SKATERS = ["C", "LW", "RW", "D"];
const LINE_OPTS = ["L1", "L2", "L3", "L4", "D1", "D2", "D3", "none"];
const PP_OPTS = ["PP1", "PP2", "none"];
const PRESETS: { label: string; lines: string[]; pps: string[] }[] = [
  { label: "L1 + PP1", lines: ["L1"], pps: ["PP1"] },
  { label: "L1/L2 + PP1/PP2", lines: ["L1", "L2"], pps: ["PP1", "PP2"] },
  { label: "D1 + PP1", lines: ["D1"], pps: ["PP1"] },
  { label: "Any PP", lines: [], pps: ["PP1", "PP2"] },
];
const mmss = (sec: number) => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const FORWARDS = ["C", "LW", "RW"];
const fmtStat = (c: StatCat, v: number | undefined) => {
  if (v === undefined) return "–";
  if (c.id === "11") return v.toFixed(3).replace(/^0/, ""); // SV%
  return c.rate ? v.toFixed(2) : String(Math.round(v * 100) / 100);
};

const f2 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex border border-ice-line">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-sm font-tabular border-r border-ice-line last:border-r-0 ${value === o.id ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BestAvailable({ data }: { data: Data }) {
  const [period, setPeriod] = useState<Window>("season");
  const [sort, setSort] = useState<SortKey>(data.rates ? "vor" : "pts");
  const [pos, setPos] = useState("ALL");
  const [team, setTeam] = useState("ALL");
  const [date, setDate] = useState("ANY");
  const [minGp, setMinGp] = useState(1);
  const [hideInjured, setHideInjured] = useState(false);
  const [q, setQ] = useState("");
  const [lineSel, setLineSel] = useState<string[]>([]);
  const [ppSel, setPpSel] = useState<string[]>([]);
  const [sel, setSel] = useState<AvailablePlayer | null>(null);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.players.filter((p) => {
      const s = p.w[period];
      if (!s || s.gp < minGp) return false;
      if (pos === "SK" ? !SKATERS.includes(p.position) : pos === "F" ? !FORWARDS.includes(p.position) : pos !== "ALL" && p.position !== pos) return false;
      if (team !== "ALL" && p.team !== team) return false;
      if (date !== "ANY" && !p.games.includes(Number(date))) return false;
      if (hideInjured && p.injury) return false;
      if (lineSel.length > 0 && !lineSel.includes(p.role?.line ?? "none")) return false;
      if (ppSel.length > 0 && !ppSel.includes(p.role?.pp ?? "none")) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cat = sort.startsWith("s:") ? data.cats.find((c) => c.id === sort.slice(2)) : undefined;
    const dir = cat && !cat.higherIsBetter ? -1 : 1; // stats that cost points (GA, PIM...) sort fewest first
    const key = (p: AvailablePlayer) => {
      const s = p.w[period]!;
      if (cat) return (s.st[cat.id] ?? 0) * dir;
      return sort === "vor" ? s.vor ?? -Infinity : sort === "pts" ? s.pts : s.avg;
    };
    return list.sort((a, b) => key(b) - key(a) || b.w[period]!.pts - a.w[period]!.pts);
  }, [data.players, data.cats, period, sort, pos, team, date, minGp, hideInjured, q, lineSel, ppSel]);

  // Stat columns: the goalie set when only goalies are showing, the skater set otherwise (goalies show a dash).
  const statCols = useMemo(() => data.cats.filter((c) => c.goalie === (pos === "G")), [data.cats, pos]);
  const [showStats, setShowStats] = useState(true);

  const hasVor = data.rates !== null;
  const th = (k: string, label: string) => (
    <th className="px-3 py-2 text-right">
      <button type="button" onClick={() => setSort(k)} className={`${sort === k ? "text-rink font-semibold" : "hover:text-rink"}`}>
        {label}
        {sort === k ? " ↓" : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4 items-end">
        <label className="text-xs text-muted flex flex-col gap-1">
          Period
          <Chips<Window> value={period} onChange={setPeriod} options={PERIODS} />
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Sort by
          <Chips<string> value={SORTS.some((x) => x.id === sort) ? sort : ""} onChange={setSort} options={hasVor ? SORTS : SORTS.filter((s) => s.id !== "vor")} />
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Position
          <Chips<string> value={pos} onChange={(v) => {
              setPos(v);
              // A stat sort only makes sense for that position group: fall back to the default sort.
              const c = sort.startsWith("s:") ? data.cats.find((x) => x.id === sort.slice(2)) : undefined;
              if (c && c.goalie !== (v === "G")) setSort(data.rates ? "vor" : "pts");
            }} options={POSITIONS} />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-3 mb-5 items-end">
        <label className="text-xs text-muted flex flex-col gap-1">
          NHL team
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="border border-ice-line bg-white px-2 py-1.5 text-sm">
            <option value="ALL">All teams</option>
            {data.teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Plays on
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!data.scheduleKnown}
            className="border border-ice-line bg-white px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="ANY">{data.scheduleKnown ? "Any date" : "Schedule unavailable"}</option>
            {data.days.map((d) => (
              <option key={d.date} value={d.offset}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Min games
          <select value={minGp} onChange={(e) => setMinGp(Number(e.target.value))} className="border border-ice-line bg-white px-2 py-1.5 text-sm">
            {[0, 1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Any" : `${n}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player name" className="border border-ice-line bg-white px-2 py-1.5 text-sm w-44" />
        </label>
        <label className="text-sm flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />
          Stat columns
        </label>
        <label className="text-sm flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={hideInjured} onChange={(e) => setHideInjured(e.target.checked)} />
          Hide injured
        </label>
      </div>

      {data.players.some((p) => p.role) && (
        <div className="mb-5 border border-ice-line bg-white p-3">
          <div className="text-xs text-muted mb-2">Role search: pick any lines and power-play units (a player must match one of each group you pick)</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESETS.map((pr) => (
              <button key={pr.label} type="button" onClick={() => { setLineSel(pr.lines); setPpSel(pr.pps); }} className="px-3 py-1 text-sm border border-ice-line hover:bg-ice-panel">
                {pr.label}
              </button>
            ))}
            <button type="button" onClick={() => { setLineSel([]); setPpSel([]); }} className="px-3 py-1 text-sm text-muted underline">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted mr-1">Line</span>
              {LINE_OPTS.map((o) => (
                <button key={o} type="button" onClick={() => toggle(lineSel, setLineSel, o)} className={`px-2 py-1 text-xs font-tabular border ${lineSel.includes(o) ? "bg-rink text-ice border-rink" : "border-ice-line bg-white hover:bg-ice-panel"}`}>
                  {o === "none" ? "No line" : o}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted mr-1">Power play</span>
              {PP_OPTS.map((o) => (
                <button key={o} type="button" onClick={() => toggle(ppSel, setPpSel, o)} className={`px-2 py-1 text-xs font-tabular border ${ppSel.includes(o) ? "bg-gold text-rink border-gold font-semibold" : "border-ice-line bg-white hover:bg-ice-panel"}`}>
                  {o === "none" ? "No PP" : o}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mb-3 font-tabular">
        {rows.length} players
        {hasVor && data.rates
          ? ` · replacement per game: C ${f2(data.rates.C)} · LW ${f2(data.rates.LW)} · RW ${f2(data.rates.RW)} · D ${f2(data.rates.D)} · G ${f2(data.rates.G)}`
          : " · VOR isn't available yet (it needs a completed week)"}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted">No available players match those filters.</p>
      ) : (
        <div className="border border-ice-line overflow-x-auto">
          <table className="w-full text-sm font-tabular">
            <thead>
              <tr className="text-left text-muted border-b border-ice-line">
                <th className="hidden sm:table-cell px-3 py-2 w-10 min-w-[2.5rem] sticky left-0 z-10 bg-white">#</th>
                <th className="px-2 sm:px-3 py-2 w-[116px] max-w-[116px] sm:w-auto sm:max-w-none sm:min-w-[210px] sticky left-0 sm:left-10 z-10 bg-white shadow-[2px_0_0_0_#CBD6E2]">Player</th>
                <th className="hidden sm:table-cell px-3 py-2">Pos</th>
                <th className="px-3 py-2 text-right">GP</th>
                {th("pts", "PTS")}
                {th("avg", "AVG")}
                {hasVor && th("vor", "VOR")}
                <th className="px-2 py-2 text-center">Line</th>
                <th className="px-2 py-2 text-center">PP</th>
                <th className="px-2 py-2 text-right">TOI</th>
                {showStats && statCols.map((c) => th(`s:${c.id}`, c.label))}
                <th className="px-3 py-2 text-left">Nights (7d)</th>
                <th className="px-3 py-2 text-right">Own %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const s = p.w[period]!;
                const next7 = p.games.filter((g) => g < 7).length;
                return (
                  <tr key={p.id} className="border-b border-ice-line last:border-0">
                    <td className="hidden sm:table-cell px-3 py-2 text-muted sticky left-0 z-10 bg-white">{i + 1}</td>
                    <td className="px-2 sm:px-3 py-2 w-[116px] max-w-[116px] sm:w-auto sm:max-w-none sticky left-0 sm:left-10 z-10 bg-white shadow-[2px_0_0_0_#CBD6E2]">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="hidden sm:block shrink-0">
                          <button type="button" onClick={() => setSel(p)} aria-label={`${p.name} stats`}>
                            <PlayerPhoto playerId={p.id} name={p.name} size={36} />
                          </button>
                        </span>
                        <div className="min-w-0">
                          <button type="button" onClick={() => setSel(p)} className="block max-w-full text-left font-body font-semibold truncate text-xs sm:text-sm hover:text-center-red hover:underline">
                            <span className="text-muted sm:hidden">{i + 1}. </span>
                            {p.name}
                          </button>
                          <div className="text-[11px] sm:text-xs text-muted flex gap-1.5 sm:gap-2 items-center">
                            <span>{p.team} · {p.position}</span>
                            <TierBadge tier={p.tier} />
                            {p.status === "W" ? <span className="px-1.5 border border-ice-line">waivers</span> : null}
                            {p.injury ? <span className="text-center-red">{p.injury}</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2">{p.position}</td>
                    <td className="px-3 py-2 text-right">{s.gp}</td>
                    <td className={`px-3 py-2 text-right ${sort === "pts" ? "font-semibold" : ""}`}>{f2(s.pts)}</td>
                    <td className={`px-3 py-2 text-right ${sort === "avg" ? "font-semibold" : ""}`}>{f2(s.avg)}</td>
                    {hasVor && (
                      <td className={`px-3 py-2 text-right font-display text-base ${sort === "vor" ? "text-center-red" : ""}`}>{s.vor === null ? "–" : signed(s.vor)}</td>
                    )}
                    <td className="px-2 py-2 text-center">
                      {p.role ? <span className={`px-1.5 py-0.5 text-xs ${p.role.line ? "bg-rink text-ice" : "text-muted"}`}>{p.role.line ?? "–"}</span> : <span className="text-muted">–</span>}
                      {p.role?.change ? <span title={p.role.change.text} className="text-green-700"> ↑</span> : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {p.role?.pp ? <span className="px-1.5 py-0.5 text-xs bg-gold text-rink font-semibold">{p.role.pp}</span> : <span className="text-muted">–</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-muted">{p.role ? mmss(p.role.toi) : "–"}</td>
                    {showStats &&
                      statCols.map((c) => (
                        <td key={c.id} className={`px-3 py-2 text-right ${sort === `s:${c.id}` ? "font-semibold" : "text-muted"}`}>
                          {c.goalie === (p.position === "G") ? fmtStat(c, s.st[c.id] ?? (c.rate ? undefined : 0)) : "–"}
                        </td>
                      ))}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.scheduleKnown ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted w-3 text-right">{next7}</span>
                          <span className="font-semibold">
                            {data.days
                              .slice(0, 7)
                              .filter((d) => p.games.includes(d.offset))
                              .map((d, k) => (
                                <span key={d.offset} className={date !== "ANY" && Number(date) === d.offset ? "text-center-red" : ""}>
                                  {k > 0 ? " " : ""}
                                  {dayShort(d.label)}
                                </span>
                              ))}
                          </span>
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">{p.owned === null ? "–" : p.owned.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sel && <PlayerPanel p={sel} data={data} period={period} onClose={() => setSel(null)} />}
    </div>
  );
}
