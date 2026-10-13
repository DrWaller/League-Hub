"use client";
import { useEffect, useState } from "react";

type Saved = { season: number; periods: number; source: string; savedAt: string };

// Saves each season's rosters once (about a roster look per week), so manager profiles can show how long they've owned players.
export default function OwnershipPage() {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(2027);
  const [redo, setRedo] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/ownership").then((x) => x.json()).catch(() => null);
    if (r?.saved) setSaved(r.saved);
    return (r?.saved ?? []) as Saved[];
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    setLog([]);
    const have = await load();
    for (let s = from; s <= to; s++) {
      if (!redo && have.some((x) => x.season === s)) {
        setLog((l) => [...l, `${s}: already saved, skipped`]);
        continue;
      }
      setLog((l) => [...l, `${s}: reading rosters (this takes a bit)...`]);
      const r = await fetch("/api/admin/ownership", { method: "POST", body: JSON.stringify({ season: s }) }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
      setLog((l) => [...l.slice(0, -1), r.error ? `${s}: ${r.error}` : `${s}: saved ${r.saved} player-seasons from ${r.periods} roster looks. ${r.note ?? ""}`]);
    }
    await load();
    setBusy(false);
  };

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Save Rosters</h1>
      <p className="text-muted mb-4 max-w-prose">
        Reads each season&apos;s rosters from ESPN (one look per week) and saves a tally, so manager profiles can show the players they have owned the longest. A season played on Fantrax uses its end-of-season owners. Seasons already saved are skipped, except the current season, which you can re-run to refresh (tick &quot;Redo saved seasons&quot;).
      </p>
      <p className="text-sm mb-3">Saved so far: {saved.length === 0 ? "none" : saved.map((x) => `${x.season} (${x.source})`).join(", ")}</p>
      <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
        From <input type="number" value={from} onChange={(e) => setFrom(Number(e.target.value))} className="w-24 border border-ice-line px-2 py-1" />
        to <input type="number" value={to} onChange={(e) => setTo(Number(e.target.value))} className="w-24 border border-ice-line px-2 py-1" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={redo} onChange={(e) => setRedo(e.target.checked)} /> Redo saved seasons</label>
        <button disabled={busy} onClick={run} className="px-4 py-2 bg-rink text-white disabled:opacity-50">Save rosters</button>
      </div>
      <ul className="text-sm space-y-0.5">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
