"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const same = (a: string, b: string) => a.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase() === b.trim().toLowerCase();

// "Select as winner" for one finalist: saves the winner for that season and award (it then shows on the Hall of Fame).
// Clicking the chosen winner again clears it.
export default function PickWinner({ season, award, name, current }: { season: number; award: string; name: string; current?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isWinner = !!current && same(current, name);

  async function click() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/past-winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, winners: { [award]: isWinner ? "" : name } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) setErr(j.error ?? "Could not save.");
      else router.refresh();
    } catch {
      setErr("Network error.");
    }
    setBusy(false);
  }

  return (
    <span className="inline-block">
      <button
        onClick={click}
        disabled={busy}
        title={isWinner ? "Click to clear this winner" : "Select as the winner"}
        className={`px-2 py-0.5 text-xs border disabled:opacity-50 ${isWinner ? "bg-gold text-board border-gold font-semibold" : "border-ice-line bg-white hover:bg-ice-panel"}`}
      >
        {busy ? "..." : isWinner ? "★ Winner" : "Select winner"}
      </button>
      {err && <span className="block text-xs text-red-700">{err}</span>}
    </span>
  );
}
