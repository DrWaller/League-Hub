"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeStandings, parseScores } from "@/lib/manual-season";
import { ManualTeam } from "@/lib/types";

interface Manager {
  id: number;
  name: string;
}

const EXAMPLE = `week,home team,home score,away team,away score
1,Farsta Strand Consiglieres,84.5,Toronto Trash Pandas,91
1,Boldy Prediction,102,Randy's 18-Wheelers,77.5
2,Farsta Strand Consiglieres,95,Boldy Prediction,88
# add ,playoff at the end of a line for a playoff game`;

export default function OffEspnEditor() {
  const [season, setSeason] = useState("");
  const [csv, setCsv] = useState("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [teams, setTeams] = useState<ManualTeam[]>([]);
  const [status, setStatus] = useState<{ games: number; weeks: number; taggedFantrax: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const seasonNum = Number(season) || 0;
  const parsed = useMemo(() => (csv.trim() ? parseScores(csv) : null), [csv]);

  const preview = useMemo(() => {
    if (!parsed || parsed.errors.length) return null;
    const idOf = new Map(parsed.teams.map((n, i) => [n, i + 1]));
    const matchups = parsed.games.map((g) => ({
      week: g.week,
      homeTeamId: idOf.get(g.home)!,
      homeScore: g.homeScore,
      awayTeamId: idOf.get(g.away)!,
      awayScore: g.awayScore,
      isFinal: true,
      isPlayoff: g.playoff,
    }));
    const standings = computeStandings(parsed.teams.map((n, i) => ({ id: i + 1, name: n })), matchups);
    const weeks = new Set(parsed.games.filter((g) => !g.playoff).map((g) => g.week)).size;
    return { standings, weeks };
  }, [parsed]);

  const loadSeason = useCallback(async (s: number) => {
    if (!s) {
      setTeams([]);
      setStatus(null);
      return;
    }
    const res = await fetch(`/api/admin/off-espn?season=${s}`);
    const data = await res.json();
    setTeams(data.teams ?? []);
    setStatus({ games: data.games ?? 0, weeks: data.weeks ?? 0, taggedFantrax: Boolean(data.taggedFantrax) });
  }, []);

  useEffect(() => {
    fetch("/api/admin/managers")
      .then((r) => r.json())
      .then(setManagers)
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/off-espn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: seasonNum, csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: [data.error, ...(data.errors ?? [])].filter(Boolean).join(" ") });
      } else {
        setMsg({ ok: true, text: `Saved ${data.games} games for ${seasonNum}. Now link each team to its manager below.` });
        setCsv("");
        await loadSeason(seasonNum);
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't save -- is the database connected?" });
    } finally {
      setSaving(false);
    }
  }

  async function assign(teamId: number, managerId: string) {
    await fetch("/api/admin/off-espn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", teamId, managerId: managerId || null }),
    });
    setTeams((ts) => ts.map((t) => (t.id === teamId ? { ...t, managerId: managerId ? Number(managerId) : null } : t)));
  }

  async function removeSeason() {
    if (!confirm(`Delete all hand-entered games and teams for ${seasonNum}? This can't be undone.`)) return;
    await fetch(`/api/admin/off-espn?season=${seasonNum}`, { method: "DELETE" });
    setMsg({ ok: true, text: `Removed the hand-entered data for ${seasonNum}.` });
    await loadSeason(seasonNum);
  }

  const input = "border border-ice-line px-3 py-2 text-sm w-full";

  return (
    <div className="space-y-8">
      <div className="border border-ice-line p-5">
        <label className="text-sm block mb-4 max-w-xs">
          <div className="text-muted mb-1">Season</div>
          <input
            type="number"
            className={input}
            placeholder="e.g. 2025"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            onBlur={() => loadSeason(seasonNum)}
          />
        </label>

        {status && !status.taggedFantrax && seasonNum > 0 && (
          <p className="text-sm border border-center-red/40 bg-ice-panel p-3 mb-4 max-w-prose">
            {seasonNum} isn&apos;t tagged &ldquo;Played on Fantrax&rdquo; yet. Do that on the <a className="text-rink underline" href="/admin/history">League History</a> admin
            page first &mdash; until then the site would still show ESPN&apos;s data for it, and saving here is blocked.
          </p>
        )}
        {status && status.games > 0 && (
          <p className="text-sm text-muted mb-4">
            Currently saved for {seasonNum}: {status.games} games over {status.weeks} weeks. Pasting again <strong>replaces</strong> them.
          </p>
        )}

        <label className="text-sm block mb-2">
          <div className="text-muted mb-1">Weekly scores &mdash; one game per line</div>
          <textarea
            className={`${input} font-tabular text-xs`}
            rows={10}
            placeholder={EXAMPLE}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted mb-4 max-w-prose">
          Format: week, home team, home score, away team, away score. If a team name has a comma in it, put that name in
          &quot;quotes&quot;. Add <code>,playoff</code> at the end of a line for a playoff game. Spelling and capitalization of a
          team&apos;s name should match on every line.
        </p>

        {parsed && (
          <div className="mb-4 space-y-3">
            {parsed.errors.length > 0 && (
              <ul className="text-sm border border-center-red/40 bg-ice-panel p-3 space-y-1 list-disc pl-6">
                {parsed.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {parsed.warnings.length > 0 && (
              <ul className="text-sm border border-ice-line bg-ice-panel p-3 space-y-1 list-disc pl-6">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {preview && (
              <div>
                <p className="text-sm mb-2">
                  <strong>{parsed.games.length} games</strong>, {preview.weeks} regular-season weeks, {parsed.teams.length} teams. Standings this would give:
                </p>
                <div className="overflow-x-auto">
                  <table className="text-sm font-tabular border-collapse w-full max-w-lg">
                    <tbody>
                      {preview.standings.map((r, i) => (
                        <tr key={r.id} className="border-b border-ice-line/60">
                          <td className="py-1.5 pr-3 text-muted">{i + 1}</td>
                          <td className="py-1.5 pr-3 font-body">{r.name}</td>
                          <td className="py-1.5 pr-3 text-right">
                            {r.wins}-{r.losses}
                            {r.ties ? `-${r.ties}` : ""}
                          </td>
                          <td className="py-1.5 text-right">{Math.round(r.pointsFor)} PF</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted mt-2">Check this against your Fantrax standings before saving.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={save}
            disabled={saving || !seasonNum || !parsed || parsed.errors.length > 0}
            className="bg-rink text-ice px-5 py-2 text-sm hover:bg-rink-deep transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save this season's scores"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-muted" : "text-center-red"}`}>{msg.text}</span>}
        </div>
      </div>

      {teams.length > 0 && (
        <div className="border border-ice-line p-5">
          <h2 className="font-display text-lg mb-1">Link each {seasonNum} team to its manager</h2>
          <p className="text-xs text-muted mb-4 max-w-prose">
            This is what lets the Records page count these games toward each manager&apos;s all-time totals.
          </p>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-body">{t.name}</span>
                <select
                  className="border border-ice-line px-2 py-1.5 text-sm"
                  value={t.managerId ?? ""}
                  onChange={(e) => assign(t.id, e.target.value)}
                >
                  <option value="">— not linked —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {managers.length === 0 && (
            <p className="text-xs text-muted mt-3">No managers yet &mdash; add them on the Link Managers page first.</p>
          )}
          <button onClick={removeSeason} className="text-sm text-center-red hover:underline mt-6">
            Delete all hand-entered data for {seasonNum}
          </button>
        </div>
      )}
    </div>
  );
}
