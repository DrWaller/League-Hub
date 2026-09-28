"use client";

import { useState, useEffect, useCallback } from "react";
import { KeeperRecord } from "@/lib/types";

type TeamOption = { id: number; name: string };

export default function KeepersManager({
  teams,
  defaultSeason,
}: {
  teams: TeamOption[];
  defaultSeason: number;
}) {
  const [season, setSeason] = useState(defaultSeason);
  const [keepers, setKeepers] = useState<KeeperRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamId, setTeamId] = useState<number | "">("");
  const [playerName, setPlayerName] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (s: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/keepers?season=${s}`);
      setKeepers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(season);
  }, [season, load]);

  async function handleAdd() {
    if (!teamId || !playerName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/admin/keepers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, teamId, playerName: playerName.trim(), note: note || null }),
      });
      setPlayerName("");
      setNote("");
      await load(season);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/keepers?id=${id}`, { method: "DELETE" });
    setKeepers((prev) => prev.filter((k) => k.id !== id));
  }

  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;

  return (
    <div>
      <label className="text-sm inline-block mb-6">
        <div className="text-muted mb-1">Season</div>
        <input
          type="number"
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="border border-ice-line px-3 py-2 w-28"
        />
      </label>

      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-3">Add a Keeper</h2>
        <div className="grid sm:grid-cols-[1fr,1fr,1fr,auto] gap-2 items-start">
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))}
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
            placeholder="Player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted border-b border-ice-line">
              <th className="py-2 pr-4 font-body font-normal">Team</th>
              <th className="py-2 pr-4 font-body font-normal">Player</th>
              <th className="py-2 pr-4 font-body font-normal">Note</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {keepers.map((k) => (
              <tr key={k.id} className="border-b border-ice-line/60">
                <td className="py-2 pr-4">{teamName(k.teamId)}</td>
                <td className="py-2 pr-4 font-body">{k.playerName}</td>
                <td className="py-2 pr-4 text-muted">{k.note ?? "—"}</td>
                <td className="py-2 pr-4">
                  <button onClick={() => handleDelete(k.id)} className="text-center-red hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {keepers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-muted">
                  No keepers logged for {season} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
