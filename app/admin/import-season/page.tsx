"use client";

import { useState } from "react";

interface Fit {
  keys: string[];
  weights: Record<string, number>;
  raw: number[];
  n: number;
  r2: number;
  meanAbsError: number;
  within005: number;
  within05: number;
  worst: { name: string; actual: number; predicted: number }[];
}
interface Report {
  error?: string;
  nhlErrors?: string[];
  season: number;
  saved: boolean;
  csv: { rows: number; withGames: number; forwards: number; defensemen: number; goalies: number };
  nhl: { skaters: number; goalies: number; errors: string[]; fieldsSeen: Record<string, string[]> };
  match: { matched: number; unmatched: number; ambiguous: number; nameVariants: string[]; gamesPlayedDisagree: number; unmatchedTop: string[]; disagreeTop: string[] };
  fit: { forwards: Fit | null; defensemen: Fit | null; goalies: Fit | null };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const weightsLine = (f: Fit) =>
  f.keys
    .filter((k) => f.weights[k])
    .map((k) => `${k} ${f.weights[k]}`)
    .join("  \u00b7  ") || "(none)";

function FitBlock({ title, fit }: { title: string; fit: Fit | null }) {
  if (!fit) return <p className="text-sm text-muted">{title}: not enough matched players to fit.</p>;
  const exact = fit.within005 >= 0.9;
  const close = fit.within05 >= 0.9;
  return (
    <div className="border border-ice-line bg-white p-4 mb-4">
      <div className="font-display text-lg mb-1">{title}</div>
      <p className="text-sm mb-2">
        {fit.n} players matched. Recovered point values: <b>{weightsLine(fit)}</b>
      </p>
      <p className="text-sm mb-2">
        Fit check: <b className={exact ? "text-[#1F7A4D]" : close ? "text-rink" : "text-center-red"}>{pct(fit.within005)}</b> of players come out within 0.05 of the real Fantrax points and{" "}
        <b>{pct(fit.within05)}</b> within half a point (average miss {fit.meanAbsError}, R&sup2; {fit.r2}).{" "}
        {exact
          ? "That is an essentially exact match: the scoring rules were recovered."
          : close
          ? "That is a close match. Small leftovers are expected, because the hit and block counts Fantrax uses can differ slightly from the NHL's."
          : "That is not a clean match: a scored category is probably missing from the data, or counted differently."}
      </p>
      {!close && fit.worst.length > 0 && (
        <div className="text-xs text-muted">Biggest misses: {fit.worst.map((w) => `${w.name} (real ${w.actual}, ours ${w.predicted})`).join("; ")}</div>
      )}
    </div>
  );
}

export default function ImportSeasonPage() {
  const [season, setSeason] = useState("2025");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    if (!apply) setReport(null);
    try {
      const res = await fetch("/api/admin/import-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: Number(season), text, apply }),
      });
      const data = await res.json();
      setReport(res.ok ? data : { ...(data as Report), error: data.error ?? `HTTP ${res.status}` });
    } catch {
      setReport({ error: "Network error." } as Report);
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Import a Season</h1>
      <p className="text-muted mb-6 max-w-prose">
        For a season that wasn&apos;t played on ESPN (your 2025 Fantrax season). Upload the Fantrax player CSV for that season; the site fetches the NHL&apos;s raw
        stats, matches the two lists, and works out your scoring rules from your real Fantrax points. <b>Analyze</b> only reports; nothing is saved until you press Save.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-4 text-sm">
        <label>
          <div className="text-muted mb-1">Season</div>
          <input value={season} onChange={(e) => setSeason(e.target.value)} className="border border-ice-line px-3 py-2 w-24 bg-white" />
        </label>
        <label>
          <div className="text-muted mb-1">Fantrax player CSV</div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              setText(await f.text());
              setReport(null);
            }}
            className="text-sm"
          />
        </label>
        <button disabled={busy || !text} onClick={() => run(false)} className="px-5 py-2 border border-rink text-rink disabled:opacity-40">
          {busy ? "Working..." : "Analyze"}
        </button>
        <button disabled={busy || !report || Boolean(report.error) || report.saved} onClick={() => run(true)} className="px-5 py-2 bg-rink text-ice disabled:opacity-40">
          Save this import
        </button>
      </div>
      {fileName && <p className="text-xs text-muted mb-4">{fileName} loaded ({text.length.toLocaleString()} characters)</p>}

      {report?.error && (
        <div className="border border-center-red/40 bg-ice-panel p-4 text-sm max-w-2xl whitespace-pre-wrap">
          {report.error}
          {report.nhlErrors?.length ? `\n${report.nhlErrors.join("\n")}` : ""}
        </div>
      )}

      {report && !report.error && (
        <div className="max-w-3xl">
          {report.saved && <p className="mb-4 text-sm font-semibold text-[#1F7A4D]">Saved. The {report.season} season is stored.</p>}

          <div className="border border-ice-line bg-white p-4 mb-4 text-sm">
            <div className="font-display text-lg mb-1">1. Your file</div>
            {report.csv.rows.toLocaleString()} players listed, {report.csv.withGames} with games played ({report.csv.forwards} forwards, {report.csv.defensemen} defensemen, {report.csv.goalies} goalies).
          </div>

          <div className="border border-ice-line bg-white p-4 mb-4 text-sm">
            <div className="font-display text-lg mb-1">2. NHL stats for {report.season}</div>
            {report.nhl.skaters} skaters and {report.nhl.goalies} goalies fetched.
            {report.nhl.errors.length > 0 && <div className="text-center-red">Problems: {report.nhl.errors.join("; ")}</div>}
            <details className="mt-2">
              <summary className="cursor-pointer text-rink">Field names the NHL returned</summary>
              <div className="text-xs text-muted mt-1 space-y-1">
                {Object.entries(report.nhl.fieldsSeen).map(([k, v]) => (
                  <div key={k}>
                    <b>{k}:</b> {v.join(", ")}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="border border-ice-line bg-white p-4 mb-4 text-sm">
            <div className="font-display text-lg mb-1">3. Matching the two lists</div>
            <b>{report.match.matched}</b> matched, <b>{report.match.unmatched}</b> not found, {report.match.ambiguous} ambiguous, {report.match.gamesPlayedDisagree} where the games played disagree by more than 3.
            {report.match.nameVariants.length > 0 && (
              <div className="mt-2 text-xs text-muted">
                Matched as the same player despite different spellings ({report.match.nameVariants.length}): {report.match.nameVariants.join("; ")}
              </div>
            )}
            {report.match.unmatchedTop.length > 0 && (
              <div className="mt-2 text-xs text-muted">
                Not found (highest points first): {report.match.unmatchedTop.join("; ")}
              </div>
            )}
            {report.match.disagreeTop.length > 0 && <div className="mt-1 text-xs text-muted">Games disagree: {report.match.disagreeTop.join("; ")}</div>}
          </div>

          <h2 className="font-display text-xl mb-2">4. Your 2025 scoring, recovered from the points</h2>
          <FitBlock title="Forwards" fit={report.fit.forwards} />
          <FitBlock title="Defensemen" fit={report.fit.defensemen} />
          <FitBlock title="Goalies" fit={report.fit.goalies} />
        </div>
      )}
    </div>
  );
}
