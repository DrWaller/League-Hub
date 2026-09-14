"use client";

import { useState, useEffect, useCallback } from "react";
import { Manager, Trade } from "@/lib/types";

export default function TradesManager() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [playerName, setPlayerName] = useState("");
  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([fetch("/api/admin/managers"), fetch("/api/admin/trades")]);
      setManagers(await mRes.json());
      setTrades(await tRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!playerName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/admin/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season,
          playerName: playerName.trim(),
          fromManagerId: fromId || null,
          toManagerId: toId || null,
          note: note || null,
        }),
      });
      setPlayerName("");
      setNote("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/trades?id=${id}`, { method: "DELETE" });
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? `#${id}` : "—");

  return (
    <div>
      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-3">Log a Trade</h2>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="Season"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          >
            <option value="">From manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          >
            <option value="">To manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border border-ice-line px-3 py-2 text-sm w-full mb-2"
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {adding ? "Saving…" : "Add Trade"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted border-b border-ice-line">
              <th className="py-2 pr-4 font-body font-normal">Season</th>
              <th className="py-2 pr-4 font-body font-normal">Player</th>
              <th className="py-2 pr-4 font-body font-normal">From</th>
              <th className="py-2 pr-4 font-body font-normal">To</th>
              <th className="py-2 pr-4 font-body font-normal">Note</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-ice-line/60">
                <td className="py-2 pr-4">{t.season}</td>
                <td className="py-2 pr-4 font-body">{t.playerName}</td>
                <td className="py-2 pr-4">{managerName(t.fromManagerId)}</td>
                <td className="py-2 pr-4">{managerName(t.toManagerId)}</td>
                <td className="py-2 pr-4 text-muted">{t.note ?? "—"}</td>
                <td className="py-2 pr-4">
                  <button onClick={() => handleDelete(t.id)} className="text-center-red hover:underline text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-muted">
                  No trades logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
