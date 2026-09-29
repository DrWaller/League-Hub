"use client";

import { useState } from "react";

interface Probe {
  ok: boolean;
  totalEntries: number;
  entriesWithAnyStats: number;
  scoringPeriodIdsSeen: number[];
  statSourceIdsSeen: number[];
  matchingRequestedWeek: number;
  samplePlayer: { name: string; statsArrayLength: number; sampleStats: unknown[] } | null;
}

function ProbeResult({ title, p }: { title: string; p: Probe }) {
  return (
    <div className="border border-ice-line p-4">
      <h3 className="font-display text-lg mb-2">{title}</h3>
      {!p.ok ? (
        <p className="text-sm text-center-red">ESPN didn&apos;t return usable data for this request.</p>
      ) : (
        <ul className="text-sm space-y-1 font-tabular">
          <li>Roster entries found: <strong>{p.totalEntries}</strong></li>
          <li>Entries with ANY stats array: <strong>{p.entriesWithAnyStats}</strong></li>
          <li>
            Entries matching the requested week exactly (scoringPeriodId + statSourceId 0):{" "}
            <strong className={p.matchingRequestedWeek > 0 ? "" : "text-center-red"}>{p.matchingRequestedWeek}</strong>
          </li>
          <li>scoringPeriodId values seen: {p.scoringPeriodIdsSeen.length ? p.scoringPeriodIdsSeen.join(", ") : "(none)"}</li>
          <li>statSourceId values seen: {p.statSourceIdsSeen.length ? p.statSourceIdsSeen.join(", ") : "(none)"}</li>
        </ul>
      )}
      {p.samplePlayer && (
        <div className="mt-3 text-xs">
          <div className="text-muted mb-1">
            Sample player: {p.samplePlayer.name} ({p.samplePlayer.statsArrayLength} stat entries total)
          </div>
          <pre className="bg-ice-panel p-2 overflow-x-auto">{JSON.stringify(p.samplePlayer.sampleStats, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function RosterStatsProbePage() {
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [data, setData] = useState<{ withoutScoringPeriodParam: Probe; withScoringPeriodParam: Probe } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/admin/roster-stats-probe?season=${season}&week=${week}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Roster Stats Probe</h1>
      <p className="text-muted mb-8 max-w-prose">
        Diagnostic only. Shows exactly what ESPN returns for player weekly stats on a given season and
        week, tried two ways -- so a real gap between what Graphics expects and what ESPN actually sends
        back shows up directly here, instead of being guessed at.
      </p>

      <div className="flex gap-4 items-end mb-8">
        <label className="text-sm">
          <div className="text-muted mb-1">Season</div>
          <input type="number" value={season} onChange={(e) => setSeason(e.target.value)} className="border border-ice-line px-3 py-2 w-32" placeholder="e.g. 2026" />
        </label>
        <label className="text-sm">
          <div className="text-muted mb-1">Week</div>
          <input type="number" value={week} onChange={(e) => setWeek(e.target.value)} className="border border-ice-line px-3 py-2 w-24" placeholder="e.g. 5" />
        </label>
        <button onClick={run} disabled={loading || !season || !week} className="bg-rink text-ice px-5 py-2 text-sm hover:bg-rink-deep disabled:opacity-40">
          {loading ? "Checking…" : "Check"}
        </button>
      </div>

      {error && <p className="text-sm text-center-red mb-6">{error}</p>}

      {data && (
        <div className="grid md:grid-cols-2 gap-6">
          <ProbeResult title="Normal request (what Graphics does today)" p={data.withoutScoringPeriodParam} />
          <ProbeResult title="With an explicit scoringPeriodId added" p={data.withScoringPeriodParam} />
        </div>
      )}
    </div>
  );
}
