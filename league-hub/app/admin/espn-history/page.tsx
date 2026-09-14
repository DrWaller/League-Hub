"use client";

import { useState } from "react";

export default function EspnHistoryPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleCheck() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/espn-history?season=${season}`);
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">ESPN History Explorer</h1>
      <p className="text-muted mb-2 max-w-prose">
        A diagnostic tool, not a data source of its own. Pick a past season and see exactly what
        ESPN&apos;s API returns for it — team names, ids, and owner info if present. Use what you
        see here to fill in Managers more reliably than guessing from old spreadsheets.
      </p>
      <p className="text-xs text-muted mb-8">
        Note: the season number here is the same one ESPN uses internally — try the year you
        believe a season started in (e.g. 2022 for the 2022-23 season) and adjust if the results
        don&apos;t look right.
      </p>

      <div className="flex gap-2 mb-8 items-end">
        <label className="text-sm">
          <div className="text-muted mb-1">Season</div>
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 w-28"
          />
        </label>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check ESPN"}
        </button>
      </div>

      {result && (
        <div className="border border-ice-line p-5">
          {!result.ok ? (
            <p className="text-center-red text-sm">{result.error}</p>
          ) : (
            <>
              <h2 className="font-display text-lg mb-3">Teams ({result.teams?.length ?? 0})</h2>
              <table className="w-full text-sm border-collapse mb-6">
                <thead>
                  <tr className="text-left text-muted border-b border-ice-line">
                    <th className="py-1 pr-4 font-body font-normal">ID</th>
                    <th className="py-1 pr-4 font-body font-normal">Abbrev</th>
                    <th className="py-1 pr-4 font-body font-normal">Name</th>
                    <th className="py-1 pr-4 font-body font-normal">Owner IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {result.teams?.map((t: any) => (
                    <tr key={t.id} className="border-b border-ice-line/60">
                      <td className="py-1 pr-4">{t.id}</td>
                      <td className="py-1 pr-4">{t.abbrev}</td>
                      <td className="py-1 pr-4 font-body">{t.name}</td>
                      <td className="py-1 pr-4 text-xs text-muted">{(t.ownerIds || []).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className="font-display text-lg mb-3">Members ({result.members?.length ?? 0})</h2>
              {result.members?.length ? (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted border-b border-ice-line">
                      <th className="py-1 pr-4 font-body font-normal">ID</th>
                      <th className="py-1 pr-4 font-body font-normal">Display Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.members.map((m: any) => (
                      <tr key={m.id} className="border-b border-ice-line/60">
                        <td className="py-1 pr-4 text-xs text-muted">{m.id}</td>
                        <td className="py-1 pr-4 font-body">{m.displayName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted">
                  No member/owner names came back for this season — match team IDs by hand instead.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
