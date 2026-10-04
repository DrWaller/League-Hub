"use client";

import { useEffect, useState } from "react";
import GraphicCard from "@/components/GraphicCard";

interface Picked {
  id: number; // ESPN player id; 0 = not on the current ESPN list (e.g. picked from an imported season's ranking)
  name: string;
  fid?: string; // Fantrax id, set when picked from an imported season
}

// Names compared without accents or punctuation.
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const groupOfLabel = (pos: string) => (pos === "G" ? "G" : pos === "D" ? "D" : "F");
interface TeamRoster {
  id: number;
  name: string;
  players: { id: number; name: string; position: string }[];
}

export default function PlayerCardsBrowser({ graphicsBase, playersBase, fresh }: { graphicsBase: string; playersBase: string; fresh: boolean }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [week, setWeek] = useState<number>(1);

  // Previous seasons ESPN still has player data for.
  const [pastSeasons, setPastSeasons] = useState<number[]>([]);
  const [importedSeasons, setImportedSeasons] = useState<number[]>([]);
  const [pastSeason, setPastSeason] = useState<number | "">("");
  useEffect(() => {
    fetch(`${playersBase}/seasons`)
      .then((r) => r.json())
      .then((d) => {
        setPastSeasons(d.past ?? []);
        setImportedSeasons(d.imported ?? []);
      })
      .catch(() => setPastSeasons([]));
  }, []);

  // Search any NHL player by name (includes free agents).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; position: string }[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`${playersBase}/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.players ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Or pick from a fantasy team's roster.
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [live, setLive] = useState(true);
  const [teamId, setTeamId] = useState<number | "">("");
  useEffect(() => {
    fetch(`${playersBase}/rosters`)
      .then((r) => r.json())
      .then((d) => {
        setTeams(d.teams ?? []);
        setLive(Boolean(d.live));
        if (d.defaultWeek) setWeek(d.defaultWeek);
      })
      .catch(() => setLive(false));
  }, []);
  const roster = teams.find((t) => t.id === teamId)?.players ?? [];

  // Or browse the rankings: fantasy points, points per game, or any scoring category.
  const [rankOpen, setRankOpen] = useState(false);
  const [rankGroup, setRankGroup] = useState<"all" | "F" | "D" | "G">("all");
  const [rankBy, setRankBy] = useState("total");
  const [rankStart, setRankStart] = useState(1);
  const [rankSeason, setRankSeason] = useState<number | "">("");
  const [rankError, setRankError] = useState("");
  const [rankList, setRankList] = useState<{ rank: number; id: number; fid?: string; name: string; position: string; gp: number; valueLabel: string; imported?: boolean }[]>([]);
  const [rankCats, setRankCats] = useState<{ id: string; label: string }[]>([]);
  const [rankTotal, setRankTotal] = useState(0);
  const [rankBusy, setRankBusy] = useState(false);
  const RANK_PAGE = 12;
  useEffect(() => {
    if (!rankOpen) return;
    setRankBusy(true);
    const t = setTimeout(() => {
      fetch(`${playersBase}/ranks?group=${rankGroup}&by=${encodeURIComponent(rankBy)}&start=${rankStart}&limit=${RANK_PAGE}${rankSeason ? `&season=${rankSeason}` : ""}`)
        .then((r) => r.json())
        .then((d) => {
          setRankList(d.players ?? []);
          setRankCats(d.categories ?? []);
          setRankTotal(d.total ?? 0);
          setRankError(d.error ?? "");
        })
        .catch(() => setRankList([]))
        .finally(() => setRankBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [rankOpen, rankGroup, rankBy, rankStart, rankSeason]);

  const choose = (p: Picked) => {
    setPicked(p);
    setQuery("");
    setResults([]);
  };

  // The query for a previous season's card. An imported season finds the player by name / Fantrax id;
  // an ESPN season needs his ESPN id.
  const pastQuery = (year: number, who: Picked) => {
    const q = new URLSearchParams();
    if (who.id > 0) q.set("playerId", String(who.id));
    if (importedSeasons.includes(year)) {
      q.set("name", who.name);
      if (who.fid) q.set("fid", who.fid);
    }
    q.set("season", String(year));
    q.set("format", "portrait");
    return q.toString();
  };
  const pastUsable = (year: number, who: Picked) => importedSeasons.includes(year) || who.id > 0;

  // To add another card type later, add it here -- it will show for any picked player.
  const cards = picked
    ? [
        ...(picked.id > 0
          ? [
              { title: `Player Radar - ${picked.name}`, url: `${graphicsBase}/player-radar?playerId=${picked.id}&format=portrait` },
              { title: `Player Bars - ${picked.name}`, url: `${graphicsBase}/player-bars?playerId=${picked.id}&format=portrait` },
              { title: `Player Spotlight - ${picked.name} (week ${week})`, url: `${graphicsBase}/player-spotlight?week=${week}&playerId=${picked.id}&position=any&format=portrait` },
            ]
          : []),
        // A previous season's final cards (the imported 2025 Fantrax season included), each its own card.
        ...(pastSeason && pastUsable(pastSeason, picked)
          ? [
              { title: `Player Radar - ${picked.name} (${pastSeason})`, url: `${graphicsBase}/player-radar?${pastQuery(pastSeason, picked)}` },
              { title: `Player Bars - ${picked.name} (${pastSeason})`, url: `${graphicsBase}/player-bars?${pastQuery(pastSeason, picked)}` },
            ]
          : []),
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap gap-x-8 gap-y-4 mb-6 items-start">
        <div className="text-sm relative">
          <div className="text-muted mb-1">Search any NHL player</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name..."
            className="border border-ice-line px-3 py-2 w-64 bg-white"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 border border-ice-line bg-white shadow">
              {results.map((r) => (
                <button key={r.id} onClick={() => choose({ id: r.id, name: r.name })} className="block w-full text-left px-3 py-2 hover:bg-ice-panel">
                  {r.name} <span className="text-muted">({r.position})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm">
          <div className="text-muted mb-1">Or choose from a team</div>
          <div className="flex flex-wrap gap-2">
            <select value={teamId} onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))} className="border border-ice-line px-3 py-2 w-56 bg-white">
              <option value="">Team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value=""
              disabled={roster.length === 0}
              onChange={(e) => {
                const p = roster.find((x) => x.id === Number(e.target.value));
                if (p) choose({ id: p.id, name: p.name });
              }}
              className="border border-ice-line px-3 py-2 w-56 bg-white disabled:opacity-50"
            >
              <option value="">Player...</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.position})
                </option>
              ))}
            </select>
          </div>
          {!live && <div className="text-xs text-muted mt-1">ESPN isn&apos;t connected, so team rosters aren&apos;t available.</div>}
        </div>

        <label className="text-sm">
          <div className="text-muted mb-1">Add a previous season</div>
          <select value={pastSeason} onChange={(e) => setPastSeason(e.target.value === "" ? "" : Number(e.target.value))} className="border border-ice-line px-3 py-2 w-40 bg-white">
            <option value="">None</option>
            {pastSeasons.map((y) => (
              <option key={y} value={y}>
                {y}{importedSeasons.includes(y) ? " (Fantrax)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="text-muted mb-1">Week (for the weekly card)</div>
          <input
            type="number"
            min={1}
            value={week}
            onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
            className="border border-ice-line px-3 py-2 w-24 bg-white"
          />
        </label>
      </div>

      <div className="mb-6">
        <button onClick={() => setRankOpen(!rankOpen)} className="text-sm text-rink hover:underline">
          {rankOpen ? "Hide rankings" : "Or find a player by rank"}
        </button>
        {rankOpen && (
          <div className="mt-3 border border-ice-line bg-white p-4 max-w-2xl">
            <div className="flex flex-wrap gap-4 mb-3 text-sm">
              <label>
                <div className="text-muted mb-1">Season</div>
                <select
                  value={rankSeason}
                  onChange={(e) => {
                    setRankSeason(e.target.value === "" ? "" : Number(e.target.value));
                    setRankStart(1);
                  }}
                  className="border border-ice-line px-3 py-2 bg-white"
                >
                  <option value="">Current season</option>
                  {pastSeasons.map((y) => (
                    <option key={y} value={y}>
                      {y} {importedSeasons.includes(y) ? "(Fantrax, final)" : "(final)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="text-muted mb-1">Among</div>
                <select
                  value={rankGroup}
                  onChange={(e) => {
                    setRankGroup(e.target.value as "all" | "F" | "D" | "G");
                    setRankBy("total");
                    setRankStart(1);
                  }}
                  className="border border-ice-line px-3 py-2 bg-white"
                >
                  <option value="all">All players</option>
                  <option value="F">Forwards</option>
                  <option value="D">Defensemen</option>
                  <option value="G">Goalies</option>
                </select>
              </label>
              <label>
                <div className="text-muted mb-1">Ranked by</div>
                <select value={rankBy} onChange={(e) => { setRankBy(e.target.value); setRankStart(1); }} className="border border-ice-line px-3 py-2 bg-white">
                  <option value="total">Fantasy points (total)</option>
                  <option value="avg">Fantasy points per game</option>
                  {rankCats.map((c) => (
                    <option key={c.id} value={`stat:${c.id}`}>
                      {c.label} per game
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="text-muted mb-1">Start at rank</div>
                <input type="number" min={1} value={rankStart} onChange={(e) => setRankStart(Math.max(1, Number(e.target.value) || 1))} className="border border-ice-line px-3 py-2 w-24 bg-white" />
              </label>
            </div>
            <div className={rankBusy ? "opacity-50" : ""}>
              {rankList.map((r) => (
                <button
                  key={r.id}
                  onClick={async () => {
                    let espnId = r.id;
                    if (r.imported) {
                      // An imported season's ranking has no ESPN ids: find him on the current ESPN list by name,
                      // so his current cards work too (a retired player simply has none).
                      espnId = 0;
                      try {
                        const d = await (await fetch(`${playersBase}/search?q=${encodeURIComponent(r.name)}`)).json();
                        const hit = (d.players ?? []).find((x: { id: number; name: string; position: string }) => norm(x.name) === norm(r.name) && groupOfLabel(x.position) === groupOfLabel(r.position));
                        if (hit) espnId = hit.id;
                      } catch {
                        /* leave 0 */
                      }
                    }
                    choose({ id: espnId, name: r.name, fid: r.fid });
                    if (rankSeason) setPastSeason(rankSeason); // browsing 2026 / 2025 -> show his cards from that season too
                  }}
                  className="flex items-center w-full text-left px-2 py-2 border-t border-ice-line hover:bg-ice-panel">
                  <span className="w-10 font-tabular text-muted">#{r.rank}</span>
                  <span className="flex-1">
                    {r.name} <span className="text-muted">({r.position})</span>
                  </span>
                  <span className="font-tabular">{r.valueLabel}</span>
                </button>
              ))}
              {rankList.length === 0 && !rankBusy && <p className="text-muted text-sm">{rankError || "No players found. Is ESPN connected?"}</p>}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <button disabled={rankStart <= 1} onClick={() => setRankStart(Math.max(1, rankStart - RANK_PAGE))} className="text-rink hover:underline disabled:opacity-40">
                Previous
              </button>
              <button disabled={rankStart + RANK_PAGE > rankTotal} onClick={() => setRankStart(rankStart + RANK_PAGE)} className="text-rink hover:underline disabled:opacity-40">
                Next
              </button>
              <span className="text-muted">{rankTotal > 0 ? `${rankTotal} players ranked` : ""}</span>
            </div>
          </div>
        )}
      </div>

      {picked && (
        <div className="flex items-center gap-3 mb-8 text-sm">
          <span className="px-3 py-1.5 bg-rink text-ice rounded">{picked.name}</span>
          <button onClick={() => setPicked(null)} className="text-rink hover:underline">
            Clear
          </button>
        </div>
      )}

      {!picked && <p className="text-muted">No player picked yet.</p>}

      <div className="space-y-10">
        {cards.map((c) => (
          <GraphicCard key={c.url} title={c.title} url={c.url} portrait fresh={fresh} />
        ))}
      </div>
    </div>
  );
}
