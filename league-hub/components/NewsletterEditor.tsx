"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyPeriod } from "@/lib/types";

export default function NewsletterEditor({
  defaultSeason,
  defaultWeek,
  periods,
}: {
  defaultSeason: number;
  defaultWeek: number;
  periods: MonthlyPeriod[];
}) {
  const [periodType, setPeriodType] = useState<"week" | "month">("week");
  const [season, setSeason] = useState(defaultSeason);
  const [week, setWeek] = useState(defaultWeek);
  const seasonPeriods = periods.filter((p) => p.season === season);
  const [periodLabel, setPeriodLabel] = useState(seasonPeriods[0]?.label ?? "");
  const period = seasonPeriods.find((p) => p.label === periodLabel);

  const periodKey = periodType === "week" ? String(week) : periodLabel;

  const [introText, setIntroText] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!periodKey) return;
    setLoading(true);
    setSavedAt(null);
    try {
      const res = await fetch(
        `/api/admin/newsletter-intro?season=${season}&periodType=${periodType}&periodKey=${encodeURIComponent(periodKey)}`
      );
      const data = await res.json();
      setIntroText(data.introText ?? "");
    } finally {
      setLoading(false);
    }
  }, [season, periodType, periodKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    try {
      const body: any = { season, periodType };
      if (periodType === "week") body.week = week;
      else {
        if (!period) {
          setError("Pick a period first.");
          setDrafting(false);
          return;
        }
        body.startWeek = period.startWeek;
        body.endWeek = period.endWeek;
        body.periodLabel = period.label;
      }
      const res = await fetch("/api/admin/newsletter-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Draft generation failed.");
        return;
      }
      setIntroText(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/admin/newsletter-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, periodType, periodKey, introText }),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType("week")}
          className={`px-3 py-1.5 text-sm border ${periodType === "week" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
        >
          Weekly Recap
        </button>
        <button
          onClick={() => setPeriodType("month")}
          className={`px-3 py-1.5 text-sm border ${periodType === "month" ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
        >
          Monthly Wrap-up
        </button>
      </div>

      <div className="flex gap-4 mb-6 items-end flex-wrap">
        <label className="text-sm">
          <div className="text-muted mb-1">Season</div>
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 w-28"
          />
        </label>
        {periodType === "week" ? (
          <label className="text-sm">
            <div className="text-muted mb-1">Week</div>
            <input
              type="number"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="border border-ice-line px-3 py-2 w-24"
            />
          </label>
        ) : (
          <label className="text-sm">
            <div className="text-muted mb-1">Period</div>
            <select
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="border border-ice-line px-3 py-2"
            >
              <option value="">Pick a period…</option>
              {seasonPeriods.map((p) => (
                <option key={p.id} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading && <p className="text-sm text-muted mb-4">Loading…</p>}
      {error && <p className="text-sm text-center-red mb-4">{error}</p>}

      <textarea
        value={introText}
        onChange={(e) => setIntroText(e.target.value)}
        rows={10}
        placeholder="Write the recap yourself, or generate a draft below to start from."
        className="w-full border border-ice-line px-3 py-2 text-sm mb-3"
      />

      <div className="flex items-center gap-4">
        <button
          onClick={handleDraft}
          disabled={drafting}
          className="border border-ice-line px-4 py-2 text-sm hover:border-rink-bright disabled:opacity-50"
        >
          {drafting ? "Drafting…" : "Generate Draft"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </div>
  );
}
