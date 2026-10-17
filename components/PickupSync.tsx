"use client";

import { useState } from "react";

interface Result { currentPeriod: number | null; currentWeek: number; movesWaiting: number; movesFailed: number; ratesWaiting: number; daysWaiting: number; daysFailed: number; done: boolean; errors: string[] }
interface Counts { daysWithMoves: number; adds: number; drops: number; pickupAdds: number; daysTracked: number; daysChecked: number }

export default function PickupSync({ initial }: { initial: Counts }) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [status, setStatus] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(reset: boolean) {
    if (reset && !confirm("Clear the saved adds and tracked days for this season and read everything from ESPN again?")) return;
    setBusy(true);
    setErrors([]);
    try {
      for (let i = 0; i < 40; i++) {
        setStatus(i === 0 ? (reset ? "Starting over..." : "Updating...") : `Still reading ESPN (step ${i + 1})...`);
        const res = await fetch(`/api/admin/pickup-sync${reset && i === 0 ? "?reset=1" : ""}`, { method: "POST", cache: "no-store" });
        if (!res.ok) throw new Error(`The server answered ${res.status}. If your admin login expired, reload and log in again.`);
        const { result, counts: c } = (await res.json()) as { result: Result; counts: Counts };
        setCounts(c);
        setErrors(result.errors);
        if (result.done) {
          setStatus("Up to date.");
          return;
        }
        if (result.errors.length > 0 && result.movesWaiting + result.daysWaiting === 0) {
          setStatus("Stopped: ESPN had trouble (see below).");
          return;
        }
      }
      setStatus("Still more to read. Press Update again.");
    } catch (e) {
      setStatus(`Stopped: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => run(false)} disabled={busy} className="bg-rink text-ice px-5 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-40">Update pickups</button>
        <button onClick={() => run(true)} disabled={busy} className="border border-ice-line px-4 py-2 text-sm text-muted hover:text-rink disabled:opacity-40">Start over</button>
        <span className="text-sm text-muted">{status}</span>
      </div>
      {errors.length > 0 && <ul className="text-sm border border-center-red/40 bg-ice-panel p-3 list-disc list-inside">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <table className="text-sm border border-ice-line bg-white">
        <tbody>
          <tr className="border-b border-ice-line"><td className="p-2 text-muted">Scoring days of transactions read</td><td className="p-2 text-right font-bold">{counts.daysWithMoves}</td></tr>
          <tr className="border-b border-ice-line"><td className="p-2 text-muted">Adds found / drops found</td><td className="p-2 text-right font-bold">{counts.adds} / {counts.drops}</td></tr>
          <tr className="border-b border-ice-line"><td className="p-2 text-muted">Free-agent or waiver adds (the ones tracked)</td><td className="p-2 text-right font-bold">{counts.pickupAdds}</td></tr>
          <tr className="border-b border-ice-line"><td className="p-2 text-muted">Days checked for pickups in lineups</td><td className="p-2 text-right font-bold">{counts.daysChecked}</td></tr>
          <tr><td className="p-2 text-muted">Pickup game days saved (starts and bench)</td><td className="p-2 text-right font-bold">{counts.daysTracked}</td></tr>
        </tbody>
      </table>
      {counts.daysWithMoves > 0 && counts.adds === 0 && (
        <p className="text-sm border border-center-red/40 bg-ice-panel p-3 max-w-prose">
          ESPN returned days of transactions but the site found no adds in them. Open <a className="underline" href="/api/admin/transactions-probe">the transactions probe</a> and send it to Claude so the reader can be fixed, then press Start over.
        </p>
      )}
    </div>
  );
}
