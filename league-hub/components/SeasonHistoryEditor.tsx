"use client";

import { useCallback, useEffect, useState } from "react";
import { KNOWN_HISTORY_TAGS, SeasonHistoryRecord } from "@/lib/types";

const EMPTY = { season: "", champion: "", runnerUp: "", leader: "", note: "", tags: [] as string[] };

export default function SeasonHistoryEditor() {
  const [entries, setEntries] = useState<SeasonHistoryRecord[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/season-history");
    setEntries(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Suggest that season's actual team names (from ESPN) for the champion /
  // runner-up boxes. Purely a convenience -- typing anything also works.
  async function loadTeamNames(season: string) {
    setTeamNames([]);
    if (!Number(season)) return;
    try {
      const res = await fetch(`/api/admin/espn-history?season=${Number(season)}`);
      const data = await res.json();
      if (data.ok) setTeamNames(data.teams.map((t: { name: string }) => t.name));
    } catch {
      /* suggestions are optional */
    }
  }

  function edit(e: SeasonHistoryRecord) {
    setForm({
      season: String(e.season),
      champion: e.champion ?? "",
      runnerUp: e.runnerUp ?? "",
      leader: e.regularSeasonLeader ?? "",
      note: e.note ?? "",
      tags: e.tags,
    });
    setMsg(null);
    loadTeamNames(String(e.season));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!Number(form.season)) {
      setMsg("Enter a season first.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/season-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: Number(form.season),
          champion: form.champion,
          runnerUp: form.runnerUp,
          regularSeasonLeader: form.leader,
          tags: form.tags,
          note: form.note,
        }),
      });
      if (!res.ok) throw new Error();
      setMsg(`Saved ${form.season}.`);
      setForm({ ...EMPTY });
      setTeamNames([]);
      await load();
    } catch {
      setMsg("Couldn't save -- is the database connected?");
    } finally {
      setSaving(false);
    }
  }

  async function remove(season: number) {
    await fetch(`/api/admin/season-history?season=${season}`, { method: "DELETE" });
    await load();
  }

  const toggleTag = (tag: string) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }));

  const input = "border border-ice-line px-3 py-2 text-sm w-full";

  return (
    <div>
      <datalist id="hist-teams">
        {teamNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-1">Add or edit a season</h2>
        <p className="text-xs text-muted mb-4">
          The standings under each season come from ESPN automatically. This is only for what ESPN
          can&apos;t know: who won it all, and notes on odd seasons. Saving a season that already
          has an entry replaces it.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="text-sm">
            <div className="text-muted mb-1">Season</div>
            <input
              type="number"
              className={input}
              placeholder="e.g. 2026"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
              onBlur={(e) => loadTeamNames(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <div className="text-muted mb-1">Regular-season leader (optional)</div>
            <input
              className={input}
              list="hist-teams"
              placeholder="Leave blank to use the best record"
              value={form.leader}
              onChange={(e) => setForm({ ...form, leader: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <div className="text-muted mb-1">Champion</div>
            <input
              className={input}
              list="hist-teams"
              value={form.champion}
              onChange={(e) => setForm({ ...form, champion: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <div className="text-muted mb-1">Runner-up</div>
            <input
              className={input}
              list="hist-teams"
              value={form.runnerUp}
              onChange={(e) => setForm({ ...form, runnerUp: e.target.value })}
            />
          </label>
        </div>
        <div className="flex gap-4 flex-wrap mb-3">
          {KNOWN_HISTORY_TAGS.map((tag) => (
            <label key={tag} className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={form.tags.includes(tag)} onChange={() => toggleTag(tag)} />
              {tag}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mb-3 max-w-prose">
          Ticking &ldquo;Played on Fantrax&rdquo; hides ESPN&apos;s data for that season everywhere on the
          site (standings, luck chart, matchups, rosters, imports), so nothing from ESPN can affect
          anyone&apos;s records.
        </p>
        <label className="text-sm block mb-4">
          <div className="text-muted mb-1">Note (optional)</div>
          <textarea
            className={input}
            rows={2}
            placeholder="e.g. Played on Fantrax instead of ESPN this season."
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="bg-rink text-ice px-5 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save season"}
          </button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </div>

      <h2 className="font-display text-lg mb-3">Entries</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Seasons still appear on the public page from ESPN even without an entry.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.season} className="border border-ice-line p-4 flex items-start justify-between gap-4">
              <div className="text-sm">
                <div className="font-display text-lg">{e.season}</div>
                <div className="text-muted">
                  Champion: {e.champion ?? "—"} · Runner-up: {e.runnerUp ?? "—"}
                </div>
                {e.tags.length > 0 && <div className="text-xs text-muted">{e.tags.join(", ")}</div>}
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <button onClick={() => edit(e)} className="text-rink hover:underline">
                  Edit
                </button>
                <button onClick={() => remove(e.season)} className="text-center-red hover:underline">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
