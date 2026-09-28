"use client";

import { useState, useEffect, useCallback } from "react";

type MatchupRow = {
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  preview: string;
  summary: string;
};

export default function MatchupBlurbForm({
  defaultSeason,
  defaultWeek,
}: {
  defaultSeason: number;
  defaultWeek: number;
}) {
  const [season, setSeason] = useState(defaultSeason);
  const [week, setWeek] = useState(defaultWeek);
  const [rows, setRows] = useState<MatchupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const load = useCallback(async (s: number, w: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/matchups?season=${s}&week=${w}`);
      const data = await res.json();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(season, week);
  }, [season, week, load]);

  function updateRow(idx: number, field: "preview" | "summary", value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function handleGenerateDraft(idx: number, mode: "preview" | "summary") {
    const row = rows[idx];
    const key = `${row.homeTeamId}-${row.awayTeamId}-${mode}`;
    setDraftingKey(key);
    setDraftError(null);
    try {
      const res = await fetch("/api/admin/matchups/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error || "Draft generation failed.");
        return;
      }
      updateRow(idx, mode, data.draft);
    } finally {
      setDraftingKey(null);
    }
  }

  async function handleSave(idx: number) {
    const row = rows[idx];
    const key = `${row.homeTeamId}-${row.awayTeamId}`;
    setSavingKey(key);
    try {
      await fetch("/api/admin/matchups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season,
          week,
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          preview: row.preview,
          summary: row.summary,
        }),
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-8 items-end flex-wrap">
        <label className="text-sm">
          <div className="text-muted mb-1">Season</div>
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 w-28"
          />
        </label>
        <label className="text-sm">
          <div className="text-muted mb-1">Week</div>
          <input
            type="number"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 w-24"
          />
        </label>
        {loading && <span className="text-sm text-muted">Loading…</span>}
      </div>

      <div className="space-y-6">
        {rows.map((row, idx) => {
          const key = `${row.homeTeamId}-${row.awayTeamId}`;
          return (
            <div key={key} className="border border-ice-line p-5">
              <h2 className="font-display text-lg mb-3">
                {row.homeTeamName} vs {row.awayTeamName}
              </h2>
              <label className="block text-sm mb-3">
                <div className="text-muted mb-1">Preview (before the matchup)</div>
                <textarea
                  value={row.preview}
                  onChange={(e) => updateRow(idx, "preview", e.target.value)}
                  rows={3}
                  className="w-full border border-ice-line px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleGenerateDraft(idx, "preview")}
                  disabled={draftingKey === `${row.homeTeamId}-${row.awayTeamId}-preview`}
                  className="text-xs text-rink hover:underline mt-1 disabled:opacity-50"
                >
                  {draftingKey === `${row.homeTeamId}-${row.awayTeamId}-preview` ? "Drafting…" : "Generate draft"}
                </button>
              </label>
              <label className="block text-sm mb-3">
                <div className="text-muted mb-1">Summary (after it's final)</div>
                <textarea
                  value={row.summary}
                  onChange={(e) => updateRow(idx, "summary", e.target.value)}
                  rows={3}
                  className="w-full border border-ice-line px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleGenerateDraft(idx, "summary")}
                  disabled={draftingKey === `${row.homeTeamId}-${row.awayTeamId}-summary`}
                  className="text-xs text-rink hover:underline mt-1 disabled:opacity-50"
                >
                  {draftingKey === `${row.homeTeamId}-${row.awayTeamId}-summary` ? "Drafting…" : "Generate draft"}
                </button>
              </label>
              {draftError && <p className="text-xs text-center-red mb-3">{draftError}</p>}
              <button
                onClick={() => handleSave(idx)}
                disabled={savingKey === key}
                className="bg-rink text-ice px-4 py-1.5 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
              >
                {savingKey === key ? "Saving…" : "Save"}
              </button>
            </div>
          );
        })}
        {!loading && rows.length === 0 && (
          <p className="text-muted text-sm">No matchups found for week {week}.</p>
        )}
      </div>
    </div>
  );
}
