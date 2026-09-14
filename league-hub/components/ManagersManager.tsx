"use client";

import { useState, useEffect, useCallback } from "react";
import { Manager, ManagerSeason } from "@/lib/types";

type TeamOption = { id: number; name: string };

export default function ManagersManager({ teams }: { teams: TeamOption[] }) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [seasons, setSeasons] = useState<ManagerSeason[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [addingManager, setAddingManager] = useState(false);

  const [selectedManagerId, setSelectedManagerId] = useState<number | "">("");
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [teamId, setTeamId] = useState<number | "">("");
  const [teamName, setTeamName] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [addingSeason, setAddingSeason] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch("/api/admin/managers"),
        fetch("/api/admin/manager-seasons"),
      ]);
      setManagers(await mRes.json());
      setSeasons(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddManager() {
    if (!newName.trim()) return;
    setAddingManager(true);
    try {
      await fetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await load();
    } finally {
      setAddingManager(false);
    }
  }

  async function handleDeleteManager(id: number) {
    await fetch(`/api/admin/managers?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function handleAddSeason() {
    if (!selectedManagerId || !teamId || !teamName.trim()) return;
    setAddingSeason(true);
    try {
      await fetch("/api/admin/manager-seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId: selectedManagerId,
          teamId,
          season: seasonYear,
          teamName: teamName.trim(),
          recordNote: recordNote || null,
        }),
      });
      setTeamName("");
      setRecordNote("");
      await load();
    } finally {
      setAddingSeason(false);
    }
  }

  async function handleDeleteSeason(id: number) {
    await fetch(`/api/admin/manager-seasons?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-3">Add a Manager</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Manager name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm flex-1"
          />
          <button
            onClick={handleAddManager}
            disabled={addingManager}
            className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
          >
            {addingManager ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-3">Assign a Team-Season to a Manager</h2>
        <p className="text-xs text-muted mb-3">
          One row per manager per season — this is what lets a manager&apos;s history follow them
          across team-name changes. Team is the ESPN team slot (id) they controlled that season.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <select
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          >
            <option value="">Manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Season (e.g. 2023)"
            value={seasonYear}
            onChange={(e) => setSeasonYear(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          >
            <option value="">ESPN team slot…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (id {t.id})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Team name that season"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
        </div>
        <input
          type="text"
          placeholder="Record note (optional) — e.g. 24-18-2, lost in semis"
          value={recordNote}
          onChange={(e) => setRecordNote(e.target.value)}
          className="border border-ice-line px-3 py-2 text-sm w-full mb-2"
        />
        <button
          onClick={handleAddSeason}
          disabled={addingSeason}
          className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {addingSeason ? "Saving…" : "Save Season"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          {managers.map((m) => {
            const managerSeasons = seasons
              .filter((s) => s.managerId === m.id)
              .sort((a, b) => b.season - a.season);
            return (
              <div key={m.id} className="border border-ice-line p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg">{m.name}</h3>
                  <button onClick={() => handleDeleteManager(m.id)} className="text-xs text-center-red hover:underline">
                    Remove manager
                  </button>
                </div>
                {managerSeasons.length === 0 ? (
                  <p className="text-sm text-muted">No seasons assigned yet.</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-muted border-b border-ice-line">
                        <th className="py-1 pr-4 font-body font-normal">Season</th>
                        <th className="py-1 pr-4 font-body font-normal">Team Name</th>
                        <th className="py-1 pr-4 font-body font-normal">Record</th>
                        <th className="py-1 pr-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {managerSeasons.map((s) => (
                        <tr key={s.id} className="border-b border-ice-line/60">
                          <td className="py-1 pr-4">{s.season}</td>
                          <td className="py-1 pr-4 font-body">{s.teamName}</td>
                          <td className="py-1 pr-4 text-muted">{s.recordNote ?? "—"}</td>
                          <td className="py-1 pr-4">
                            <button onClick={() => handleDeleteSeason(s.id)} className="text-center-red hover:underline text-xs">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          {managers.length === 0 && <p className="text-sm text-muted">No managers added yet.</p>}
        </div>
      )}
    </div>
  );
}
