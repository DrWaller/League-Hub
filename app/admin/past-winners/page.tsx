"use client";
import { useEffect, useState } from "react";

type Def = { key: string; label: string; group: string };
type Season = { season: number; winners: Record<string, { name: string; note?: string; computed?: boolean }> };

// Edit any past winner. A blank box on a manager award keeps the automatic answer; a blank player award stays empty.
export default function PastWinnersPage() {
  const [defs, setDefs] = useState<Def[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (keep?: number | null) => {
    const r = await fetch("/api/admin/past-winners").then((x) => x.json()).catch(() => null);
    if (!r?.seasons) return;
    setDefs(r.awards);
    setSeasons(r.seasons);
    const s = keep ?? r.seasons[0]?.season ?? null;
    setPick(s);
    const row = r.seasons.find((x: Season) => x.season === s);
    setVals(Object.fromEntries(r.awards.map((d: Def) => [d.key, row?.winners[d.key]?.computed ? "" : row?.winners[d.key]?.name ?? ""])));
  };
  useEffect(() => { load(); }, []);

  const choose = (s: number) => {
    setPick(s);
    const row = seasons.find((x) => x.season === s);
    setVals(Object.fromEntries(defs.map((d) => [d.key, row?.winners[d.key]?.computed ? "" : row?.winners[d.key]?.name ?? ""])));
    setMsg("");
  };
  const save = async () => {
    if (pick == null) return;
    setBusy(true);
    const r = await fetch("/api/admin/past-winners", { method: "POST", body: JSON.stringify({ season: pick, winners: vals }) }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    setMsg(r.error ?? "Saved.");
    await load(pick);
    setBusy(false);
  };
  const addSeason = () => {
    const y = Number(prompt("Season (the year it ended, like 2019):"));
    if (!Number.isInteger(y) || y < 2000) return;
    if (!seasons.some((x) => x.season === y)) setSeasons([{ season: y, winners: {} }, ...seasons].sort((a, b) => b.season - a.season));
    choose(y);
  };

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Past Winners</h1>
      <p className="text-muted mb-4 max-w-prose">
        Fix or add any award winner; the public Hall of Fame shows what is here. Manager awards (Champion, Presidents&apos; Trophy, Most Points, Hard Luck) fill in automatically from each season&apos;s results, so leave those boxes blank unless the real winner was different.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {seasons.map((s) => (
          <button key={s.season} onClick={() => choose(s.season)} className={`px-3 py-1 border text-sm ${s.season === pick ? "bg-rink text-white" : "border-ice-line bg-white"}`}>{s.season}</button>
        ))}
        <button onClick={addSeason} className="px-3 py-1 border border-ice-line bg-white text-sm">+ Add season</button>
      </div>
      {pick != null && (
        <div className="max-w-xl">
          <ul className="space-y-2 mb-3">
            {defs.map((d) => {
              const auto = seasons.find((x) => x.season === pick)?.winners[d.key];
              return (
                <li key={d.key} className="flex items-center gap-2 text-sm">
                  <label className="w-44 text-muted" htmlFor={d.key}>{d.label}</label>
                  <input id={d.key} value={vals[d.key] ?? ""} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })} placeholder={auto?.computed ? `Automatic: ${auto.name}` : ""} className="flex-1 border border-ice-line px-2 py-1 bg-white" />
                </li>
              );
            })}
          </ul>
          <button disabled={busy} onClick={save} className="px-4 py-2 bg-rink text-white disabled:opacity-50">Save {pick}</button>
          {msg && <p className="text-sm mt-2">{msg}</p>}
        </div>
      )}
    </div>
  );
}
