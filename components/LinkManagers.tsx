"use client";

import { useCallback, useEffect, useState } from "react";

interface Manager {
  id: number;
  name: string;
}
interface SeasonInfo {
  season: number;
  source: "espn" | "manual";
  total: number;
  unlinked: number;
}
interface Team {
  id: number;
  name: string;
  managerId: number | null;
}
interface Payload {
  managers: Manager[];
  seasons: SeasonInfo[];
  selected: { season: number; source: "espn" | "manual"; teams: Team[] } | null;
}

export default function LinkManagers() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newNames, setNewNames] = useState("");

  const load = useCallback(async (season?: number) => {
    try {
      const res = await fetch(`/api/admin/link-managers${season ? `?season=${season}` : ""}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError(null);
    } catch {
      setError("Couldn't load the teams -- is ESPN / the database connected?");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    const season = data?.selected?.season;
    setBusy(true);
    const res = await fetch("/api/admin/link-managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season, ...body }),
    });
    const out = await res.json();
    setBusy(false);
    await load(season);
    return { ok: res.ok, out };
  }

  async function addManagers() {
    const names = newNames.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    for (const name of names) {
      await fetch("/api/admin/managers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    }
    setNewNames("");
    setNote(`Added ${names.length} manager${names.length === 1 ? "" : "s"}.`);
    setBusy(false);
    await load(data?.selected?.season);
  }

  if (error) return <p className="text-sm text-center-red">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  const { managers, seasons, selected } = data;
  const sel = "border border-ice-line px-2 py-1.5 text-sm";
  const older = selected ? seasons.filter((s) => s.source === "espn" && s.season < selected.season) : [];
  const prevSeason = older.length ? older[0].season : null; // seasons are newest-first, so the first older one is the year before

  return (
    <div className="space-y-8">
      <div className="border border-ice-line p-5">
        <h2 className="font-display text-lg mb-1">1. Managers</h2>
        <p className="text-xs text-muted mb-3">
          {managers.length > 0 ? `${managers.length} so far: ${managers.map((m) => m.name).join(", ")}. ` : "None yet. "}
          Add any missing ones (including former managers), one name per line.
        </p>
        <textarea
          className="border border-ice-line px-3 py-2 text-sm w-full max-w-sm"
          rows={3}
          value={newNames}
          onChange={(e) => setNewNames(e.target.value)}
          placeholder={"Calder\nBobby\nLucas"}
        />
        <div>
          <button onClick={addManagers} disabled={busy || !newNames.trim()} className="mt-2 bg-rink text-ice px-4 py-2 text-sm hover:bg-rink-deep disabled:opacity-40">
            Add managers
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg mb-1">2. Pick a year, then choose a manager for each team</h2>
        <p className="text-xs text-muted mb-4 max-w-prose">
          Each year shows that year&apos;s own team names. A choice saves the moment you make it. The number on a year is how many of its teams
          still need a manager.
        </p>
        {seasons.length === 0 ? (
          <p className="text-sm text-muted">No past seasons found to link yet.</p>
        ) : (
          <div className="flex gap-2 flex-wrap mb-5">
            {seasons.map((s) => (
              <button
                key={s.season}
                onClick={() => load(s.season)}
                className={`px-3 py-2 text-sm border ${selected?.season === s.season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"}`}
              >
                {s.season}
                {s.source === "manual" ? " (Fantrax)" : ""}
                <span className={`ml-2 text-xs ${s.unlinked === 0 ? "text-lucky" : ""}`} style={s.unlinked === 0 ? { color: selected?.season === s.season ? "#fff" : "#1F7A4D" } : undefined}>
                  {s.unlinked === 0 ? "✓" : s.unlinked}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="border border-ice-line p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h3 className="font-display text-lg">{selected.season}</h3>
              <div className="flex gap-2 flex-wrap">
                {selected.source === "espn" && prevSeason && (
                  <button className="border border-ice-line px-3 py-1.5 text-sm hover:border-rink-bright disabled:opacity-40" disabled={busy} onClick={async () => {
                    const r = await post({ action: "copyFrom", fromSeason: prevSeason });
                    setNote(r.ok ? `Copied ${r.out.linked} link${r.out.linked === 1 ? "" : "s"} from ${prevSeason}.` : "Couldn't copy.");
                  }}>
                    Copy links from {prevSeason}
                  </button>
                )}
                {selected.source === "manual" && (
                  <button className="border border-ice-line px-3 py-1.5 text-sm hover:border-rink-bright disabled:opacity-40" disabled={busy} onClick={async () => {
                    const r = await post({ action: "autoByName" });
                    setNote(r.ok ? `Linked ${r.out.linked} team${r.out.linked === 1 ? "" : "s"} by matching names.` : "Couldn't auto-link.");
                  }}>
                    Auto-link teams named after managers
                  </button>
                )}
              </div>
            </div>
            {note && <p className="text-xs text-muted mb-3">{note}</p>}
            <ul className="divide-y divide-ice-line/60">
              {selected.teams.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-body min-w-0">{t.name}</span>
                  <div className="flex items-center gap-2">
                    <select
                      className={sel}
                      value={t.managerId ?? ""}
                      disabled={busy}
                      onChange={(e) => post({ action: "set", teamId: t.id, managerId: e.target.value })}
                    >
                      <option value="">— choose manager —</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {selected.source === "espn" && t.managerId && seasons.filter((s) => s.source === "espn").length > 1 && (
                      <button
                        title="Use this manager for this team in every other year where it's still unlinked"
                        className="text-xs text-rink hover:underline whitespace-nowrap disabled:opacity-40"
                        disabled={busy}
                        onClick={async () => {
                          const r = await post({ action: "fillOtherYears", teamId: t.id });
                          setNote(r.ok ? `Filled ${r.out.linked} other year${r.out.linked === 1 ? "" : "s"} for ${t.name}.` : "Couldn't fill.");
                        }}
                      >
                        fill other years
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {managers.length === 0 && <p className="text-xs text-muted mt-3">Add managers above first.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
