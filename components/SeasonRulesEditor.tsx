"use client";

import { useCallback, useEffect, useState } from "react";

interface Overview {
  season: number;
  source: "espn" | "manual";
  lastWeek: number;
  regularWeeks: number;
  regularGames: number;
  playoffGames: number;
  excludedGames: number;
  playoffStartWeek: number | null;
  excludedCount: number;
}
interface Game {
  week: number;
  homeId: number;
  homeName: string;
  homeScore: number;
  awayId: number;
  awayName: string;
  awayScore: number;
  isPlayoff: boolean;
  isExcluded: boolean;
}
interface Detail {
  season: number;
  source: string;
  rules: { playoffStartWeek: number | null };
  summary: { lastWeek: number; regularWeeks: number; regularGames: number; playoffGames: number; excludedGames: number };
  dataPlayoffStartWeek: number | null;
  games: Game[];
}

export default function SeasonRulesEditor() {
  const [overview, setOverview] = useState<Overview[] | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [weekInput, setWeekInput] = useState("");
  const [viewWeek, setViewWeek] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/season-rules");
    setOverview((await res.json()).seasons);
  }, []);

  const loadDetail = useCallback(async (s: number, keepWeek = false) => {
    const res = await fetch(`/api/admin/season-rules?season=${s}`);
    if (!res.ok) return;
    const d: Detail = await res.json();
    setDetail(d);
    setWeekInput(d.rules.playoffStartWeek ? String(d.rules.playoffStartWeek) : "");
    if (!keepWeek) setViewWeek(d.rules.playoffStartWeek ?? d.dataPlayoffStartWeek ?? d.summary.lastWeek);
  }, []);

  useEffect(() => {
    loadOverview().catch(() => setOverview([]));
  }, [loadOverview]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/season-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season, ...body }) });
    if (season) await Promise.all([loadDetail(season, true), loadOverview()]);
    setBusy(false);
  }

  const weeks = detail ? Array.from(new Set(detail.games.map((g) => g.week))).sort((a, b) => a - b) : [];
  const weekGames = detail ? detail.games.filter((g) => g.week === viewWeek) : [];
  const allExcluded = weekGames.length > 0 && weekGames.every((g) => g.isExcluded);
  const btn = "border border-ice-line px-3 py-1.5 text-sm hover:border-rink-bright disabled:opacity-40";

  if (!overview) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg mb-2">Pick a season</h2>
        {overview.length === 0 && <p className="text-sm text-muted">No finished seasons with games found yet.</p>}
        <div className="flex gap-2 flex-wrap">
          {overview.map((o) => (
            <button
              key={o.season}
              onClick={() => {
                setSeason(o.season);
                loadDetail(o.season);
              }}
              className={`px-3 py-2 text-sm border text-left ${season === o.season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
            >
              <div className="font-body">{o.season}</div>
              <div className={`text-xs ${season === o.season ? "text-ice/80" : "text-muted"}`}>
                {o.playoffStartWeek ? `playoffs wk ${o.playoffStartWeek}` : "playoffs: not set"}
                {o.excludedCount ? ` · ${o.excludedCount} excluded` : ""}
              </div>
            </button>
          ))}
        </div>
      </div>

      {detail && season && (
        <>
          <div className="border border-ice-line p-5">
            <h2 className="font-display text-lg mb-1">{season}: when do the playoffs start?</h2>
            <p className="text-xs text-muted mb-4 max-w-prose">
              Games from this week on are playoff games and don&apos;t count toward regular-season records, standings,
              luck, or all-time totals. This overrides whatever ESPN or the pasted scores said.
              {detail.dataPlayoffStartWeek
                ? ` The data itself marks week ${detail.dataPlayoffStartWeek} onward as playoffs (used if you leave this blank).`
                : " The data doesn't mark any playoff games, so leave this blank only if there were none."}
            </p>
            <div className="flex items-end gap-3 flex-wrap mb-3">
              <label className="text-sm">
                <div className="text-muted mb-1">Playoffs start in week</div>
                <input
                  type="number"
                  min={1}
                  className="border border-ice-line px-3 py-2 w-28 text-sm"
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                  placeholder="e.g. 21"
                />
              </label>
              <button className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep disabled:opacity-40" disabled={busy} onClick={() => post({ action: "playoffWeek", week: weekInput === "" ? null : Number(weekInput) })}>
                Save
              </button>
              {detail.rules.playoffStartWeek && (
                <button className={btn} disabled={busy} onClick={() => post({ action: "playoffWeek", week: null })}>
                  Clear
                </button>
              )}
            </div>
            <p className="text-sm">
              <strong>Counts:</strong> {detail.summary.regularGames} regular-season games over {detail.summary.regularWeeks} weeks.{" "}
              <strong>Playoffs:</strong> {detail.summary.playoffGames} games. <strong>Marked not counting:</strong> {detail.summary.excludedGames}.
              <span className="text-muted"> (Data runs through week {detail.summary.lastWeek}.)</span>
            </p>
          </div>

          <div className="border border-ice-line p-5">
            <h2 className="font-display text-lg mb-1">Games that don&apos;t count</h2>
            <p className="text-xs text-muted mb-4 max-w-prose">
              For games before the playoffs that shouldn&apos;t count (for example, played after a team was eliminated). Tick a game to
              leave it out of everything, or use the button to do a whole week. Games in playoff weeks are already left out of the
              regular season, so you don&apos;t need to tick those.
            </p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {weeks.map((w) => {
                const gs = detail.games.filter((g) => g.week === w);
                const playoff = gs.every((g) => g.isPlayoff);
                const ex = gs.filter((g) => g.isExcluded).length;
                return (
                  <button
                    key={w}
                    onClick={() => setViewWeek(w)}
                    className={`px-2.5 py-1 text-sm border font-tabular ${viewWeek === w ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"} ${playoff && viewWeek !== w ? "text-muted" : ""}`}
                    title={playoff ? "playoff week" : undefined}
                  >
                    {w}
                    {ex > 0 ? "•" : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="text-sm font-body font-medium">
                Week {viewWeek} {weekGames.length > 0 && weekGames.every((g) => g.isPlayoff) ? "(playoff week)" : ""}
              </h3>
              <button className={btn} disabled={busy || weekGames.length === 0} onClick={() => post({ action: "excludeWeek", week: viewWeek, excluded: !allExcluded })}>
                {allExcluded ? "Count the whole week again" : "Mark the whole week as not counting"}
              </button>
            </div>
            <ul className="divide-y divide-ice-line/60">
              {weekGames.map((g) => (
                <li key={`${g.homeId}-${g.awayId}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className={`text-sm font-tabular ${g.isExcluded ? "opacity-50 line-through" : ""}`}>
                    <div>
                      {g.homeName} <span className="text-muted">{g.homeScore}</span>
                    </div>
                    <div>
                      {g.awayName} <span className="text-muted">{g.awayScore}</span>
                    </div>
                  </div>
                  <label className="text-sm flex items-center gap-2 shrink-0">
                    <input
                      type="checkbox"
                      checked={g.isExcluded}
                      disabled={busy}
                      onChange={(e) => post({ action: "exclude", week: g.week, teamA: g.homeId, teamB: g.awayId, excluded: e.target.checked })}
                    />
                    Doesn&apos;t count
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
