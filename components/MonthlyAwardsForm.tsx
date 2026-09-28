"use client";

import { useState, useEffect, useCallback } from "react";
import { AWARD_CATEGORIES, AWARD_LABELS, AwardCategory, MonthlyPeriod } from "@/lib/types";

type TeamOption = { id: number; name: string };
type EntryState = Record<AwardCategory, { playerName: string; teamId: number | ""; note: string }>;

function emptyEntries(): EntryState {
  const obj = {} as EntryState;
  for (const cat of AWARD_CATEGORIES) obj[cat] = { playerName: "", teamId: "", note: "" };
  return obj;
}

export default function MonthlyAwardsForm({
  teams,
  periods,
  defaultSeason,
}: {
  teams: TeamOption[];
  periods: MonthlyPeriod[];
  defaultSeason: number;
}) {
  const [season, setSeason] = useState(defaultSeason);
  const seasonPeriods = periods.filter((p) => p.season === season);
  const [periodLabel, setPeriodLabel] = useState(seasonPeriods[0]?.label ?? "");
  const period = seasonPeriods.find((p) => p.label === periodLabel);

  const [entries, setEntries] = useState<EntryState>(emptyEntries());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const [monthSummary, setMonthSummary] = useState<any[] | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const load = useCallback(async (s: number, label: string) => {
    if (!label) {
      setEntries(emptyEntries());
      return;
    }
    setLoading(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/admin/monthly-awards?season=${s}&periodLabel=${encodeURIComponent(label)}`);
      const data = await res.json();
      const next = emptyEntries();
      for (const a of data) {
        next[a.category as AwardCategory] = {
          playerName: a.playerName ?? "",
          teamId: a.teamId ?? "",
          note: a.note ?? "",
        };
      }
      setEntries(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (s: number, p?: MonthlyPeriod) => {
    if (!p) {
      setMonthSummary(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const res = await fetch(
        `/api/admin/manager-month-summary?season=${s}&startWeek=${p.startWeek}&endWeek=${p.endWeek}`
      );
      const data = await res.json();
      setMonthSummary(data.teams ?? []);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    load(season, periodLabel);
    loadSummary(season, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, periodLabel]);

  function updateEntry(cat: AwardCategory, field: "playerName" | "teamId" | "note", value: string) {
    setEntries((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], [field]: field === "teamId" ? (value === "" ? "" : Number(value)) : value },
    }));
  }

  async function handleSuggest() {
    if (!period) return;
    setSuggesting(true);
    setSuggestMsg(null);
    try {
      const res = await fetch(`/api/admin/monthly-awards/suggest?startWeek=${period.startWeek}&endWeek=${period.endWeek}`);
      const data = await res.json();
      if (!data.suggestions) {
        setSuggestMsg(data.message || "No suggestions available.");
        return;
      }
      setEntries((prev) => {
        const next = { ...prev };
        for (const cat of AWARD_CATEGORIES) {
          const s = data.suggestions[cat];
          if (s) next[cat] = { playerName: s.playerName, teamId: s.teamId ?? "", note: `${s.points.toFixed(1)} pts` };
        }
        return next;
      });
      setSuggestMsg("Filled in from this period's actual stats — review before saving.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSave() {
    if (!periodLabel) return;
    setSaving(true);
    setSavedAt(null);
    try {
      const payload = {
        season,
        periodLabel,
        entries: AWARD_CATEGORIES.map((cat) => ({
          category: cat,
          playerName: entries[cat].playerName,
          teamId: entries[cat].teamId === "" ? null : entries[cat].teamId,
          note: entries[cat].note || null,
        })),
      };
      const res = await fetch("/api/admin/monthly-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const groups: { title: string; cats: AwardCategory[] }[] = [
    { title: "3 Stars of the Month", cats: ["star1", "star2", "star3"] },
    { title: "Forward", cats: ["forward", "forward_runner_up"] },
    { title: "Defenseman", cats: ["defense", "defense_runner_up"] },
    { title: "Goalie", cats: ["goalie", "goalie_runner_up"] },
  ];

  if (periods.length === 0) {
    return (
      <p className="text-muted">
        No periods defined yet — add one on the Monthly Periods page first.
      </p>
    );
  }

  return (
    <div>
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
                {p.label} (weeks {p.startWeek}–{p.endWeek})
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="text-sm text-muted">Loading…</span>}
      </div>

      {/* Manager of the Month -- auto-computed, no admin input needed */}
      {period && (
        <div className="border border-ice-line p-5 mb-8">
          <h2 className="font-display text-lg mb-1">Manager of the Month</h2>
          <p className="text-xs text-muted mb-3">
            Computed automatically from real results for weeks {period.startWeek}–{period.endWeek} — best
            record, points for as tiebreaker. Nothing to save here.
          </p>
          {loadingSummary ? (
            <p className="text-sm text-muted">Calculating…</p>
          ) : monthSummary && monthSummary.length > 0 ? (
            <ol className="text-sm space-y-1">
              {monthSummary.slice(0, 3).map((t, i) => (
                <li key={t.teamId} className="flex justify-between">
                  <span>
                    {i + 1}. {t.teamName}
                    {t.managerName ? ` (${t.managerName})` : ""}
                  </span>
                  <span className="font-tabular text-muted">
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ""} · {t.pointsFor} pts
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No final matchups in this range yet.</p>
          )}
        </div>
      )}

      {suggestMsg && <p className="text-sm text-muted mb-4">{suggestMsg}</p>}
      <button
        onClick={handleSuggest}
        disabled={suggesting || !period}
        className="text-sm border border-ice-line px-3 py-2 hover:border-rink-bright disabled:opacity-50 mb-6"
      >
        {suggesting ? "Checking stats…" : "Suggest player awards from stats"}
      </button>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="font-display text-lg mb-3">{group.title}</h2>
            <div className="space-y-3">
              {group.cats.map((cat) => (
                <div key={cat} className="grid sm:grid-cols-[10rem,1fr,10rem,6rem] gap-2 items-start">
                  <div className="text-sm text-muted pt-2">{AWARD_LABELS[cat]}</div>
                  <input
                    type="text"
                    placeholder="Player name"
                    value={entries[cat].playerName}
                    onChange={(e) => updateEntry(cat, "playerName", e.target.value)}
                    className="border border-ice-line px-3 py-2 text-sm"
                  />
                  <select
                    value={entries[cat].teamId}
                    onChange={(e) => updateEntry(cat, "teamId", e.target.value)}
                    className="border border-ice-line px-3 py-2 text-sm"
                  >
                    <option value="">Team…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Note"
                    value={entries[cat].note}
                    onChange={(e) => updateEntry(cat, "note", e.target.value)}
                    className="border border-ice-line px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !periodLabel}
          className="bg-rink text-ice px-5 py-2 hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Period"}
        </button>
        {savedAt && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </div>
  );
}
