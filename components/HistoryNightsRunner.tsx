"use client";

import { useRef, useState } from "react";

interface Row {
  season: number;
  status: "waiting" | "running" | "done" | "problem";
  scanned: number;
  total: number;
  nights: number;
  note?: string;
}

// Calls the backfill for one season at a time, again and again, until that season has nothing left.
export default function HistoryNightsRunner({ seasons }: { seasons: number[] }) {
  const [rows, setRows] = useState<Row[]>(seasons.map((season) => ({ season, status: "waiting", scanned: 0, total: 0, nights: 0 })));
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const patch = (season: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.season === season ? { ...r, ...p } : r)));

  async function run() {
    stop.current = false;
    setRunning(true);
    for (const season of seasons) {
      let stalls = 0;
      let nights = 0;
      patch(season, { status: "running" });
      while (!stop.current) {
        try {
          const res = await fetch(`/api/admin/history-nights?season=${season}`, { cache: "no-store" });
          const d = await res.json();
          if (!res.ok || d.error) {
            patch(season, { status: "problem", note: d.error ?? `HTTP ${res.status}` });
            break;
          }
          nights += d.savedNights ?? 0;
          patch(season, { scanned: d.scanned, total: d.total, nights, note: d.approxDates ? "dates estimated" : d.firstProblem });
          if (d.remaining <= 0) {
            patch(season, { status: "done" });
            break;
          }
          stalls = d.savedNights === 0 && d.failed > 0 ? stalls + 1 : 0;
          if (stalls >= 3) {
            patch(season, { status: "problem", note: d.firstProblem ?? "ESPN stopped answering" });
            break;
          }
        } catch (e) {
          patch(season, { status: "problem", note: e instanceof Error ? e.message : String(e) });
          break;
        }
      }
      if (stop.current) break;
    }
    setRunning(false);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-3">
        <button onClick={run} disabled={running} className="bg-rink text-ice px-4 py-2 rounded-sm hover:bg-rink-deep disabled:opacity-50">
          {running ? "Running..." : "Read all past seasons"}
        </button>
        {running && (
          <button onClick={() => (stop.current = true)} className="px-4 py-2 border border-ice-line rounded-sm hover:bg-ice-panel">
            Stop
          </button>
        )}
      </div>
      <ul className="divide-y divide-ice-line border border-ice-line bg-white">
        {rows.map((r) => (
          <li key={r.season} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-lg">{r.season}</span>
              <span className="text-sm text-muted font-tabular">
                {r.status === "waiting" ? "waiting" : r.status === "done" ? `done, ${r.total} days` : r.status === "problem" ? "problem" : `${r.scanned} of ${r.total || "?"} days`}
              </span>
            </div>
            {r.total > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-ice-panel overflow-hidden">
                <div className={`h-full rounded-full ${r.status === "problem" ? "bg-center-red" : "bg-rink-bright"}`} style={{ width: `${Math.round((r.scanned / r.total) * 100)}%` }} />
              </div>
            )}
            {r.note && <p className={`mt-1 text-xs ${r.status === "problem" ? "text-center-red" : "text-muted"}`}>{r.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
