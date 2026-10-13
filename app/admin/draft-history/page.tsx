"use client";
import { useEffect, useState } from "react";

type Saved = { season: number; source: string; n: number };

// Saves each past ESPN season's draft once, so manager profiles can show who they've drafted most.
export default function DraftHistoryPage() {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(2026);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/draft-history").then((x) => x.json()).catch(() => null);
    if (r?.saved) setSaved(r.saved);
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    setLog([]);
    for (let s = from; s <= to; s++) {
      if (saved.some((x) => x.season === s && x.source !== "fantrax")) {
        setLog((l) => [...l, `${s}: already saved, skipped`]);
        continue;
      }
      setLog((l) => [...l, `${s}: reading ESPN...`]);
      const r = await fetch("/api/admin/draft-history", { method: "POST", body: JSON.stringify({ season: s }) }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
      setLog((l) => [...l.slice(0, -1), r.error ? `${s}: ${r.error}` : `${s}: saved ${r.saved} picks. ${r.note ?? ""}`]);
    }
    await load();
    setBusy(false);
  };

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Save Past Drafts</h1>
      <p className="text-muted mb-4 max-w-prose">
        Reads each past ESPN season&apos;s draft once and saves it, so manager profiles can show who they have drafted most and from which NHL teams. The 2025 Fantrax draft comes from Paste a Draft. Seasons already saved are skipped.
      </p>
      <p className="text-sm mb-3">Saved so far: {saved.length === 0 ? "none" : saved.map((x) => `${x.season} (${x.source}, ${x.n})`).join(", ")}</p>
      <div className="flex items-center gap-2 mb-3 text-sm">
        From <input type="number" value={from} onChange={(e) => setFrom(Number(e.target.value))} className="w-24 border border-ice-line px-2 py-1" />
        to <input type="number" value={to} onChange={(e) => setTo(Number(e.target.value))} className="w-24 border border-ice-line px-2 py-1" />
        <button disabled={busy} onClick={run} className="px-4 py-2 bg-rink text-white disabled:opacity-50">Save drafts</button>
      </div>
      <ul className="text-sm space-y-0.5">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
