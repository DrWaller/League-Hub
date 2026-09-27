"use client";

import { useState } from "react";

export default function ImportRecordsPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    setPreview(null);
    setImported(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/espn-history?season=${season}`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to fetch from ESPN.");
        return;
      }
      setPreview(data);
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setImported(data.imported);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Import Records from ESPN</h1>
      <p className="text-muted mb-2 max-w-prose">
        Pulls the real win-loss-tie record and points for/against for every team in a past season,
        straight from ESPN. This creates or updates each team-season row&apos;s record only — it
        never touches manager assignments, so it&apos;s safe to run before you&apos;ve assigned
        managers to that season. Go to <span className="font-body">Managers</span> afterward to
        connect each row to a person.
      </p>
      <p className="text-xs text-muted mb-8">
        Re-running this for a season you&apos;ve already imported just refreshes the record — it
        won&apos;t create duplicates or wipe out a manager assignment you&apos;ve already made.
      </p>

      <div className="flex gap-2 mb-6 items-end">
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
          disabled={checking}
          className="border border-ice-line px-4 py-2 text-sm hover:border-rink-bright disabled:opacity-50"
        >
          {checking ? "Checking…" : "Preview"}
        </button>
      </div>

      {error && <p className="text-sm text-center-red mb-6">{error}</p>}

      {preview && (
        <div className="border border-ice-line p-5 mb-6">
          <h2 className="font-display text-lg mb-3">Preview — Season {season}</h2>
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="text-left text-muted border-b border-ice-line">
                <th className="py-1 pr-4 font-body font-normal">Team</th>
                <th className="py-1 pr-4 font-body font-normal">Record</th>
                <th className="py-1 pr-4 font-body font-normal">PF</th>
                <th className="py-1 pr-4 font-body font-normal">PA</th>
              </tr>
            </thead>
            <tbody>
              {preview.teams?.map((t: any) => (
                <tr key={t.id} className="border-b border-ice-line/60">
                  <td className="py-1 pr-4 font-body">{t.name}</td>
                  <td className="py-1 pr-4 font-tabular">
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ""}
                  </td>
                  <td className="py-1 pr-4 font-tabular">{t.pointsFor}</td>
                  <td className="py-1 pr-4 font-tabular">{t.pointsAgainst}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${season}'s Records`}
          </button>
        </div>
      )}

      {imported && (
        <div className="border border-center-red/40 bg-ice-panel p-5">
          <p className="text-sm">
            Imported records for {imported.length} team{imported.length === 1 ? "" : "s"} in {season}.
            Head to the <span className="font-body">Managers</span> page to assign owners to these
            rows.
          </p>
        </div>
      )}
    </div>
  );
}
