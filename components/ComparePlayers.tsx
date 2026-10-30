"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import TierBadge from "@/components/TierBadge";
import type { CompareData, ComparePlayer, DirectoryEntry } from "@/lib/compare";
import type { StatCat, Window } from "@/lib/best-available";
import type { Tier } from "@/lib/tier-style";

const PERIODS: { id: Window; label: string }[] = [
  { id: "season", label: "Season" },
  { id: "l7", label: "L7" },
  { id: "l15", label: "L15" },
  { id: "l30", label: "L30" },
];

type GroupId = "value" | "tier" | "role" | "form" | "stats";
const GROUPS: { id: GroupId; label: string }[] = [
  { id: "value", label: "Value" },
  { id: "tier", label: "Tier & rank" },
  { id: "role", label: "Role & schedule" },
  { id: "form", label: "Recent form" },
  { id: "stats", label: "Scoring stats" },
];

const TIER_RANK: Record<Tier, number> = { Replacement: 0, Depth: 1, Good: 2, Elite: 3, Superstar: 4 };
const f2 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
const mmss = (sec: number) => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const fmtStat = (c: StatCat, v: number | undefined) => {
  if (v === undefined) return "–";
  if (c.id === "11") return v.toFixed(3).replace(/^0/, ""); // SV%
  return c.rate ? v.toFixed(2) : String(Math.round(v * 100) / 100);
};

// One comparison row. `num` is what "best" is judged on (undefined/null = no value); `show` is what is printed.
interface Row {
  key: string;
  label: string;
  num?: (p: ComparePlayer) => number | null | undefined;
  higher?: boolean; // default true
  show: (p: ComparePlayer) => React.ReactNode;
}

export default function ComparePlayers({
  directory,
  data,
  roles,
  selected,
  max,
  loadFailed,
}: {
  directory: DirectoryEntry[];
  data: CompareData | null;
  roles: Record<number, any>;
  selected: number[];
  max: number;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [on, setOn] = useState<Record<GroupId, boolean>>({ value: true, tier: true, role: true, form: true, stats: false });
  const [period, setPeriod] = useState<Window>("season");

  const go = (ids: number[]) => start(() => router.replace(ids.length ? `/compare?p=${ids.join(",")}` : "/compare", { scroll: false }));
  const add = (id: number) => {
    if (selected.includes(id) || selected.length >= max) return;
    setQ("");
    go([...selected, id]);
  };
  const remove = (id: number) => go(selected.filter((x) => x !== id));

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return directory.filter((p) => !selected.includes(p.id) && p.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, directory, selected]);
  const names = useMemo(() => new Map(directory.map((p) => [p.id, p] as const)), [directory]);

  const players = data?.players ?? [];
  const mixed = players.some((p) => p.position === "G") && players.some((p) => p.position !== "G");

  const sections: { id: GroupId; title: string; rows: Row[] }[] = [];
  if (data) {
    const w = (p: ComparePlayer, k: Window) => p.w[k];
    sections.push({
      id: "value",
      title: "Value",
      rows: [
        { key: "vor", label: "VOR (season)", num: (p) => w(p, "season")?.vor, show: (p) => (w(p, "season")?.vor != null ? signed(w(p, "season")!.vor as number) : "–") },
        { key: "pts", label: "Fantasy pts", num: (p) => w(p, "season")?.pts, show: (p) => (w(p, "season") ? f2(w(p, "season")!.pts) : "–") },
        { key: "gp", label: "Games played", num: (p) => w(p, "season")?.gp, show: (p) => w(p, "season")?.gp ?? "–" },
        { key: "avg", label: "Pts / game", num: (p) => (w(p, "season")?.gp ? w(p, "season")!.avg : null), show: (p) => (w(p, "season")?.gp ? f2(w(p, "season")!.avg) : "–") },
        { key: "proj", label: "ESPN proj / game", num: (p) => p.proj, show: (p) => (p.proj != null ? f2(p.proj) : "–") },
        { key: "own", label: "% owned", num: (p) => p.owned, show: (p) => (p.owned != null ? `${p.owned.toFixed(1)}%` : "–") },
      ],
    });
    sections.push({
      id: "tier",
      title: "Tier & rank",
      rows: [
        { key: "tier", label: "League tier", num: (p) => (p.tier ? TIER_RANK[p.tier] : null), show: (p) => (p.tier ? <TierBadge tier={p.tier} /> : "–") },
        { key: "est", label: "Rating", num: (p) => p.est, show: (p) => (p.est != null ? f2(p.est) : "–") },
        {
          key: "rank",
          label: "Position rank",
          num: (p) => p.posRank,
          higher: false,
          show: (p) => (p.posRank != null ? `${p.position} #${p.posRank} of ${p.posCount}` : "–"),
        },
        { key: "prior", label: "Last season avg", num: (p) => p.priorAvg, show: (p) => (p.priorAvg != null ? f2(p.priorAvg) : "–") },
        {
          key: "owner",
          label: "Owner",
          show: (p) => <span className="text-xs">{p.owner ?? (p.rosterStatus === "Waivers" ? "Waivers" : "Free agent")}</span>,
        },
      ],
    });
    sections.push({
      id: "role",
      title: "Role & schedule",
      rows: [
        { key: "line", label: "Line", show: (p) => (p.position === "G" ? "–" : roles[p.id]?.line ?? "–") },
        {
          key: "pp",
          label: "Power play",
          num: (p) => (p.position === "G" ? null : roles[p.id]?.pp ? (String(roles[p.id].pp).includes("1") ? 2 : 1) : 0),
          show: (p) => (p.position === "G" ? "–" : roles[p.id]?.pp ?? "none"),
        },
        { key: "toi", label: "Ice time", num: (p) => roles[p.id]?.toi, show: (p) => (roles[p.id]?.toi != null ? mmss(roles[p.id].toi) : "–") },
        {
          key: "ppshare",
          label: "Share of PP time",
          num: (p) => (roles[p.id] ? roles[p.id].ppShareRecent ?? roles[p.id].ppShare : null),
          show: (p) => (roles[p.id] ? `${Math.round((roles[p.id].ppShareRecent ?? roles[p.id].ppShare) * 100)}%` : "–"),
        },
        ...(data.scheduleKnown
          ? [
              { key: "g7", label: "Games, next 7 days", num: (p: ComparePlayer) => p.games.filter((d) => d < 7).length, show: (p: ComparePlayer) => p.games.filter((d) => d < 7).length },
              { key: "g14", label: "Games, next 14 days", num: (p: ComparePlayer) => p.games.filter((d) => d < 14).length, show: (p: ComparePlayer) => p.games.filter((d) => d < 14).length },
              {
                key: "nights",
                label: "Game nights (14 days)",
                show: (p: ComparePlayer) => (
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {data.days.slice(0, 14).map((d) => (
                      <span key={d.date} title={d.label} className={`w-3 h-3 border ${p.games.includes(d.offset) ? "bg-rink border-rink" : "border-ice-line"}`} />
                    ))}
                  </div>
                ),
              },
            ]
          : []),
      ],
    });
    sections.push({
      id: "form",
      title: "Recent form",
      rows: [
        ...(["l7", "l15", "l30"] as Window[]).flatMap((k): Row[] => [
          { key: `${k}vor`, label: `${k.toUpperCase()} VOR`, num: (p) => w(p, k)?.vor, show: (p) => (w(p, k)?.vor != null ? signed(w(p, k)!.vor as number) : "–") },
          { key: `${k}avg`, label: `${k.toUpperCase()} pts / game`, num: (p) => (w(p, k)?.gp ? w(p, k)!.avg : null), show: (p) => (w(p, k)?.gp ? `${f2(w(p, k)!.avg)} (${w(p, k)!.gp} GP)` : "–") },
        ]),
        {
          key: "trend",
          label: "Form tier",
          num: (p) => (p.form ? TIER_RANK[p.form] : null),
          show: (p) => (
            <span>
              {p.form ? <TierBadge tier={p.form} /> : "–"}
              {p.trend === "up" ? <span className="text-green-700 ml-1">▲</span> : p.trend === "down" ? <span className="text-center-red ml-1">▼</span> : null}
            </span>
          ),
        },
      ],
    });
    const skaterCats = data.cats.filter((c) => !c.goalie);
    const goalieCats = data.cats.filter((c) => c.goalie);
    const statRow = (c: StatCat): Row => ({
      key: `st${c.id}`,
      label: c.label,
      higher: c.higherIsBetter,
      num: (p) => (p.position === "G") !== c.goalie ? null : p.w[period] ? p.w[period]!.st[c.id] ?? (c.rate ? null : 0) : null,
      show: (p) => ((p.position === "G") !== c.goalie ? "–" : p.w[period] ? fmtStat(c, p.w[period]!.st[c.id] ?? (c.rate ? undefined : 0)) : "–"),
    });
    const statRows: Row[] = [];
    if (players.some((p) => p.position !== "G")) statRows.push(...skaterCats.map(statRow));
    if (players.some((p) => p.position === "G")) statRows.push(...goalieCats.map(statRow));
    sections.push({ id: "stats", title: `Scoring stats (${PERIODS.find((x) => x.id === period)?.label})`, rows: statRows });
  }

  const best = (row: Row): Set<number> => {
    const out = new Set<number>();
    if (!row.num) return out;
    const vals = players.map((p) => [p.id, row.num!(p)] as const).filter((x): x is readonly [number, number] => typeof x[1] === "number" && Number.isFinite(x[1]));
    if (vals.length < 2) return out;
    const hi = row.higher !== false;
    const target = hi ? Math.max(...vals.map((v) => v[1])) : Math.min(...vals.map((v) => v[1]));
    if (vals.every((v) => v[1] === target)) return out;
    for (const [id, v] of vals) if (v === target) out.add(id);
    return out;
  };

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* Picker */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-rink text-ice text-sm">
              {names.get(id)?.name ?? data?.players.find((p) => p.id === id)?.name ?? `Player ${id}`}
              <button type="button" onClick={() => remove(id)} className="px-1.5 text-lg leading-none hover:text-gold" aria-label="Remove">
                ×
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button type="button" onClick={() => go([])} className="text-sm text-rink hover:underline px-1">
              Clear all
            </button>
          )}
        </div>
        {selected.length < max ? (
          <div className="relative max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={selected.length === 0 ? "Search a player to start…" : `Add a player (${selected.length}/${max})`}
              className="w-full border border-ice-line bg-white px-3 py-2 text-sm"
            />
            {results.length > 0 && (
              <div className="absolute z-20 left-0 right-0 bg-white border border-ice-line border-t-0 shadow">
                {results.map((p) => (
                  <button key={p.id} type="button" onClick={() => add(p.id)} className="flex items-center justify-between gap-2 w-full text-left px-3 py-2 text-sm hover:bg-ice-panel">
                    <span className="truncate">
                      {p.name} <TierBadge tier={p.tier} />
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {p.nhl} · {p.pos} · {p.owner ?? "available"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">Four players is the maximum. Remove one to add another.</p>
        )}
      </div>

      {/* Which groups to show */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={on[g.id]}
            onClick={() => setOn({ ...on, [g.id]: !on[g.id] })}
            className={`px-2.5 py-1 text-xs border ${on[g.id] ? "bg-rink text-ice border-rink" : "bg-white text-muted border-ice-line hover:bg-ice-panel"}`}
          >
            {g.label}
          </button>
        ))}
        {on.stats && (
          <span className="inline-flex border border-ice-line ml-1">
            {PERIODS.map((x) => (
              <button key={x.id} type="button" onClick={() => setPeriod(x.id)} className={`px-2 py-1 text-xs border-r border-ice-line last:border-r-0 ${period === x.id ? "bg-gold text-rink font-semibold" : "bg-white hover:bg-ice-panel"}`}>
                {x.label}
              </button>
            ))}
          </span>
        )}
      </div>

      {selected.length === 0 && <p className="text-muted">Pick two to four players to see them side by side.</p>}
      {loadFailed && <p className="text-muted">Couldn&apos;t load those players from ESPN right now.</p>}
      {data && selected.length === 1 && <p className="text-muted mb-3 text-sm">Add at least one more player to compare.</p>}

      {data && players.length > 0 && (
        <div className="overflow-x-auto border border-ice-line">
          <table className="w-full text-sm font-tabular border-collapse" style={{ minWidth: 120 + players.length * 120 }}>
            <thead>
              <tr className="border-b border-ice-line bg-white">
                <th className="sticky left-0 bg-white w-28" />
                {players.map((p) => (
                  <th key={p.id} className="px-2 py-3 align-top font-normal text-center">
                    <div className="flex flex-col items-center gap-1">
                      <PlayerPhoto playerId={p.id} name={p.name} size={56} />
                      <div className="font-display leading-tight">{p.name}</div>
                      <TierBadge tier={p.tier} />
                      <div className="text-[11px] text-muted">
                        {p.team} · {p.position}
                        {p.injury ? <span className="text-center-red"> · {p.injury}</span> : null}
                      </div>
                      <Link href={`/compare?p=${selected.filter((x) => x !== p.id).join(",")}`} className="text-[11px] text-rink hover:underline">
                        remove
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections
                .filter((s) => on[s.id] && s.rows.length > 0)
                .map((s) => (
                  <SectionRows key={s.id} title={s.title} rows={s.rows} players={players} cols={players.length + 1} best={best} />
                ))}
            </tbody>
          </table>
        </div>
      )}
      {data && mixed && on.stats && <p className="text-xs text-muted mt-2">Skater and goalie stats are listed separately; a dash means the stat doesn&apos;t apply to that player.</p>}
      {data && <p className="text-xs text-muted mt-2">Highlighted = best of the group on that row. VOR is points above a replacement-level player at the same position over the same games.</p>}
    </div>
  );
}

function SectionRows({ title, rows, players, cols, best }: { title: string; rows: Row[]; players: ComparePlayer[]; cols: number; best: (r: Row) => Set<number> }) {
  return (
    <>
      <tr className="bg-ice-panel">
        <td colSpan={cols} className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted sticky left-0">
          {title}
        </td>
      </tr>
      {rows.map((r) => {
        const b = best(r);
        return (
          <tr key={r.key} className="border-b border-ice-line last:border-0">
            <td className="sticky left-0 bg-white px-2 py-1.5 text-xs text-muted whitespace-nowrap">{r.label}</td>
            {players.map((p) => (
              <td key={p.id} className={`px-2 py-1.5 text-center ${b.has(p.id) ? "bg-gold/25 font-semibold" : ""}`}>
                {r.show(p)}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
