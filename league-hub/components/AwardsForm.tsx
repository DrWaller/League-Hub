"use client";

import { useState, useEffect, useCallback } from "react";
import { AWARD_CATEGORIES, AWARD_LABELS, AwardCategory } from "@/lib/types";

type TeamOption = { id: number; name: string };
type EntryState = Record<AwardCategory, { playerName: string; teamId: number | ""; note: string }>;

function emptyEntries(): EntryState {
  const obj = {} as EntryState;
  for (const cat of AWARD_CATEGORIES) obj[cat] = { playerName: "", teamId: "", note: "" };
  return obj;
}

export default function AwardsForm({
  teams,
  defaultSeason,
  defaultWeek,
}: {
  teams: TeamOption[];
  defaultSeason: number;
  defaultWeek: number;
}) {
  const [season, setSeason] = useState(defaultSeason);
  const [week, setWeek] = useState(defaultWeek);
  const [entries, setEntries] = useState<EntryState>(emptyEntries());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const load = useCallback(async (s: number, w: number) => {
    setLoading(true);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/admin/awards?season=${s}&week=${w}`);
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

  useEffect(() => {
    load(season, week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, week]);

  function updateEntry(cat: AwardCategory, field: "playerName" | "teamId" | "note", value: string) {
    setEntries((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: field === "teamId" ? (value === "" ? "" : Number(value)) : value,
      },
    }));
  }

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestMsg(null);
    try {
      const res = await fetch(`/api/admin/awards/suggest?week=${week}`);
      const data = await res.json();
      if (!data.suggestions) {
        setSuggestMsg(data.message || "No suggestions available.");
        return;
      }
      setEntries((prev) => {
        const next = { ...prev };
        for (const cat of AWARD_CATEGORIES) {
          const s = data.suggestions[cat];
          if (s) {
            next[cat] = {
              playerName: s.playerName,
              teamId: s.teamId ?? "",
              note: `${s.points.toFixed(1)} pts`,
            };
          }
        }
        return next;
      });
      setSuggestMsg("Filled in from this week's actual stats — review before saving.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSavedAt(null);
    try {
      const payload = {
        season,
        week,
        entries: AWARD_CATEGORIES.map((cat) => ({
          category: cat,
          playerName: entries[cat].playerName,
          teamId: entries[cat].teamId === "" ? null : entries[cat].teamId,
          note: entries[cat].note || null,
        })),
      };
      const res = await fetch("/api/admin/awards", {
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
    { title: "3 Stars of the Week", cats: ["star1", "star2", "star3"] },
    { title: "Forward", cats: ["forward", "forward_runner_up"] },
    { title: "Defenseman", cats: ["defense", "defense_runner_up"] },
    { title: "Goalie", cats: ["goalie", "goalie_runner_up"] },
  ];

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
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          className="text-sm border border-ice-line px-3 py-2 hover:border-rink-bright disabled:opacity-50"
        >
          {suggesting ? "Checking stats…" : "Suggest from stats"}
        </button>
      </div>
      {suggestMsg && <p className="text-sm text-muted mb-6">{suggestMsg}</p>}

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
          disabled={saving}
          className="bg-rink text-ice px-5 py-2 hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Week"}
        </button>
        {savedAt && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </div>
  );
}
