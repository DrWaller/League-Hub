"use client";

import { useState } from "react";

interface Row {
  manager: string;
  type: string;
  player: string;
  position: string;
  teamId: number | null;
  assumedTeam: boolean;
  status: "new" | "exists" | "no-team";
}
interface Result {
  season: number;
  rows?: Row[];
  unmatchedManagers?: string[];
  added?: number;
  message?: string;
  error?: string;
}

const SEASONS = [2022, 2023, 2024, 2025, 2026, 2027];
const DEFAULT_SHEET = "https://docs.google.com/spreadsheets/d/1xuYWQoSwFYZg2LTFxPAQsuXn5UVWu_RMQ_cb6epHwPk/edit";

export default function KeeperImportPage() {
  const [sheet, setSheet] = useState(DEFAULT_SHEET);
  const [season, setSeason] = useState<string>("all");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [applied, setApplied] = useState(false);

  async function run(apply: boolean) {
    setBusy(true);
    setResults([]);
    setApplied(apply);
    const list = season === "all" ? SEASONS : [Number(season)];
    const out: Result[] = [];
    for (const s of list) {
      try {
        const res = await fetch("/api/admin/keepers/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season: s, sheet, text: season === "all" ? "" : pasted, apply }),
        });
        const data = await res.json();
        out.push({ season: s, ...data });
      } catch {
        out.push({ season: s, error: "Network error." });
      }
      setResults([...out]);
      if (out[out.length - 1].error && season === "all") break; // same problem would repeat
    }
    setBusy(false);
  }

  const totalNew = results.reduce((n, r) => n + (r.rows?.filter((x) => x.status === "new").length ?? 0), 0);
  const totalAdded = results.reduce((n, r) => n + (r.added ?? 0), 0);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Import Keepers</h1>
      <p className="text-muted mb-6 max-w-prose">
        Pulls keepers from the Keeper History Google Sheet (one tab per season). Always preview first. Keepers already on
        the site are skipped, so you can run this again whenever more 2027 keepers are submitted. The keeper type and
        position go in the keeper&apos;s note.
      </p>

      <div className="space-y-4 max-w-2xl mb-6">
        <label className="block text-sm">
          <div className="text-muted mb-1">Google Sheet link</div>
          <input value={sheet} onChange={(e) => setSheet(e.target.value)} className="border border-ice-line px-3 py-2 w-full" />
        </label>
        <label className="text-sm inline-block">
          <div className="text-muted mb-1">Season</div>
          <select value={season} onChange={(e) => setSeason(e.target.value)} className="border border-ice-line px-3 py-2 w-44 bg-white">
            <option value="all">All seasons (2022-2027)</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {season !== "all" && (
          <label className="block text-sm">
            <div className="text-muted mb-1">Or paste that tab&apos;s cells here (only if the link can&apos;t be read)</div>
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} className="border border-ice-line px-3 py-2 w-full font-mono text-xs" />
          </label>
        )}
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => run(false)} className="px-5 py-2 border border-rink text-rink disabled:opacity-50">
            {busy ? "Working..." : "Preview"}
          </button>
          <button
            disabled={busy || results.length === 0 || applied || totalNew === 0}
            onClick={() => run(true)}
            className="px-5 py-2 bg-rink text-ice disabled:opacity-40"
          >
            Import {totalNew > 0 && !applied ? `${totalNew} new keepers` : ""}
          </button>
        </div>
      </div>

      {applied && !busy && results.length > 0 && <p className="mb-4 text-sm font-semibold text-[#1F7A4D]">Added {totalAdded} keepers.</p>}

      <div className="space-y-8">
        {results.map((r) => (
          <div key={r.season}>
            <h2 className="font-display text-xl mb-2">{r.season}</h2>
            {r.error && <p className="text-sm border border-center-red/40 bg-ice-panel p-3 max-w-2xl">{r.error}</p>}
            {r.message && <p className="text-sm text-muted">{r.message}</p>}
            {r.unmatchedManagers && r.unmatchedManagers.length > 0 && (
              <p className="text-sm border border-center-red/40 bg-ice-panel p-3 max-w-2xl mb-2">
                No manager on the site matches: <b>{r.unmatchedManagers.join(", ")}</b>. Add them under Managers (and link
                their team for {r.season}), then preview again. Their keepers are skipped until then.
              </p>
            )}
            {r.rows && r.rows.length > 0 && (
              <table className="text-sm w-full max-w-3xl border-collapse">
                <tbody>
                  {r.rows.map((x, i) => (
                    <tr key={i} className="border-b border-ice-line">
                      <td className="py-1.5 pr-3 text-muted">{x.manager}</td>
                      <td className="py-1.5 pr-3">{x.player}</td>
                      <td className="py-1.5 pr-3 text-muted">
                        {x.type}
                        {x.position ? ` - ${x.position}` : ""}
                      </td>
                      <td className="py-1.5 text-right text-xs">
                        {x.status === "new" && <span className="text-[#1F7A4D] font-semibold">new{x.assumedTeam ? " (team assumed)" : ""}</span>}
                        {x.status === "exists" && <span className="text-muted">already on site</span>}
                        {x.status === "no-team" && <span className="text-center-red">no team found</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
