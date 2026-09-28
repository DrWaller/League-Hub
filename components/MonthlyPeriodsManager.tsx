"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyPeriod } from "@/lib/types";

export default function MonthlyPeriodsManager({ defaultSeason }: { defaultSeason: number }) {
  const [periods, setPeriods] = useState<MonthlyPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  const [season, setSeason] = useState(defaultSeason);
  const [label, setLabel] = useState("");
  const [startWeek, setStartWeek] = useState("");
  const [endWeek, setEndWeek] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/monthly-periods");
      setPeriods(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!label.trim() || !startWeek || !endWeek) return;
    setAdding(true);
    try {
      await fetch("/api/admin/monthly-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, label: label.trim(), startWeek: Number(startWeek), endWeek: Number(endWeek) }),
      });
      setLabel("");
      setStartWeek("");
      setEndWeek("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/monthly-periods?id=${id}`, { method: "DELETE" });
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="border border-ice-line p-5 mb-8">
        <h2 className="font-display text-lg mb-3">Define a Period</h2>
        <p className="text-xs text-muted mb-3">
          A "month" here is just a range of weeks with a label you choose — it doesn't have to line
          up with calendar months exactly.
        </p>
        <div className="grid sm:grid-cols-4 gap-2 mb-2">
          <input
            type="number"
            placeholder="Season"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Label, e.g. October"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Start week"
            value={startWeek}
            onChange={(e) => setStartWeek(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="End week"
            value={endWeek}
            onChange={(e) => setEndWeek(e.target.value)}
            className="border border-ice-line px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-50"
        >
          {adding ? "Saving…" : "Save Period"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted border-b border-ice-line">
              <th className="py-2 pr-4 font-body font-normal">Season</th>
              <th className="py-2 pr-4 font-body font-normal">Label</th>
              <th className="py-2 pr-4 font-body font-normal">Weeks</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-ice-line/60">
                <td className="py-2 pr-4">{p.season}</td>
                <td className="py-2 pr-4 font-body">{p.label}</td>
                <td className="py-2 pr-4 font-tabular">
                  {p.startWeek}–{p.endWeek}
                </td>
                <td className="py-2 pr-4">
                  <button onClick={() => handleDelete(p.id)} className="text-center-red hover:underline text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-muted">
                  No periods defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
