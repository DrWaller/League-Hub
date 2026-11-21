"use client";

import { useState } from "react";
import PlayerPhoto from "@/components/PlayerPhoto";
import { TIERS, TIER_STYLE, type Tier } from "@/lib/tier-style";
import type { AssessedPick } from "@/lib/draft-assessment";
import { splitValue, valueKinds, VALUE_BLURBS, VALUE_TITLES, type ValueKind } from "@/lib/draft-value-split";
import { teamNames } from "@/lib/draft-teams";

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));

// Same look as the Tier Lists cards: the stripe, tiles and chips use the exact tier colours (Superstar text is white on
// the cards with a faint shadow so it stays readable on the gold).
const SOFT = Object.fromEntries(TIERS.map((t) => [t, { bg: TIER_STYLE[t].bg, fg: t === "Superstar" ? "#FFFFFF" : TIER_STYLE[t].fg }])) as Record<Tier, { bg: string; fg: string }>;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const shadow = (t: Tier | null) => (t === "Superstar" ? "0 1px 1px rgba(60,40,0,0.35)" : undefined);

// Small download icon: saves this pick as its own card image.
function SaveCard({ p }: { p: AssessedPick }) {
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <a href={`/api/cards/draft-pick?pick=${p.overall}`} download={`draft-pick-${p.overall}-${slug}.png`} aria-label={`Download ${p.name} card`} title="Download card" className="shrink-0 flex items-center justify-center w-8 h-8 border border-ice-line rounded text-rink hover:bg-ice-panel">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function Tile({ label, value, sub, tier }: { label: string; value: string; sub?: string; tier: Tier | null }) {
  return (
    <div
      className="px-1 py-1 text-center rounded-lg border-2 border-transparent"
      style={tier ? { background: SOFT[tier].bg, color: SOFT[tier].fg, textShadow: shadow(tier) } : { background: "#EEF2F6", color: "#5B6672" }}
    >
      <div className="text-xs leading-4">{label}</div>
      <div className="h-5 leading-5 whitespace-nowrap text-base font-semibold font-tabular">{value}</div>
      <div className="text-[11px] font-tabular h-4 leading-4 whitespace-nowrap">{sub ?? ""}</div>
    </div>
  );
}

function Card({ p }: { p: AssessedPick }) {
  const g = p.perTeamGame != null;
  return (
    <div className="flex bg-white border border-ice-line rounded-lg overflow-hidden">
      <div className="w-1 shrink-0" style={{ background: p.tier ? SOFT[p.tier].bg : "#C9D1DA" }} />
      <div className="flex-1 min-w-0 px-3 py-2">
        <div className="flex items-center gap-2.5">
          {p.playerId != null && p.playerId > 0 ? <PlayerPhoto playerId={p.playerId} name={p.name} size={36} /> : null}
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">
              {p.keeper ? null : <span className="text-muted font-normal text-sm">#{p.overall} </span>}
              {p.name}
            </div>
            <div className="text-xs text-muted truncate">
              {p.nhl ? `${p.nhl} · ` : ""}
              {p.position} · <span className="text-rink">{p.team}</span>
            </div>
          </div>
          {p.round != null && !p.keeper ? <div className="shrink-0 text-[11px] text-muted font-tabular">Rd {p.round}</div> : null}
          <SaveCard p={p} />
        </div>
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          <Tile label="Season" value={f2(g ? p.perTeamGame : p.avg)} sub={g ? "per team gm" : p.gp != null ? `${p.gp} gp` : undefined} tier={p.tier} />
          <Tile label="Total" value={f2(p.total)} sub={g && p.gp != null ? `${p.gp} gp` : "pts"} tier={p.tier} />
          <div
            className="px-1 py-1 text-center rounded-lg border-2 border-transparent flex flex-col justify-center"
            style={p.tier ? { background: SOFT[p.tier].bg, color: SOFT[p.tier].fg, textShadow: shadow(p.tier) } : { background: "#EEF2F6", color: "#5B6672" }}
          >
            <div className="text-xs leading-4">Tier</div>
            <div className="text-sm font-semibold leading-5 truncate">{p.tier ?? "Not placed"}</div>
            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// A steal or bust: same card as the pick list, with Season / Total tiles in the tier colour and a navy "vs slot" tile
// showing the points above or below what the player who finished at his draft slot scored.
function ValueCard({ p, kind }: { p: AssessedPick; kind: "steal" | "bust" }) {
  const g = p.perTeamGame != null;
  return (
    <div className="flex bg-white border border-ice-line rounded-lg overflow-hidden">
      <div className="w-1 shrink-0" style={{ background: p.tier ? SOFT[p.tier].bg : "#C9D1DA" }} />
      <div className="flex-1 min-w-0 px-3 py-2">
        <div className="flex items-center gap-2.5">
          {p.playerId != null && p.playerId > 0 ? <PlayerPhoto playerId={p.playerId} name={p.name} size={36} /> : null}
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">
              <span className="text-muted font-normal text-sm">#{p.overall}</span> {p.name}
            </div>
            <div className="text-xs text-muted truncate">
              {p.nhl ? `${p.nhl} · ` : ""}
              {p.position} · <span className="text-rink">{p.team}</span>
            </div>
          </div>
          {p.finish != null ? (
            <div className="shrink-0 text-right leading-tight">
              <div className="text-xs font-semibold font-tabular">Current #{p.finish}</div>
              <div className="text-[10px] text-muted">{kind === "steal" ? `beat ${p.outscored} earlier picks` : `${p.outscoredBy} later picks scored more`}</div>
            </div>
          ) : null}
          <SaveCard p={p} />
        </div>
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          <Tile label="Season" value={f2(g ? p.perTeamGame : p.avg)} sub={g ? "per team gm" : p.gp != null ? `${p.gp} gp` : undefined} tier={p.tier} />
          <Tile label="VOR" value={f2(p.vor)} sub="season" tier={p.tier} />
          <div className="px-1 py-1 text-center rounded-lg border-2 border-transparent" style={{ background: "#0C2740", color: "#FFFFFF" }}>
            <div className="text-xs leading-4">vs slot</div>
            <div className="h-5 leading-5 whitespace-nowrap text-base font-semibold font-tabular" style={{ color: kind === "steal" ? "#7BE0A0" : "#FF8FA0" }}>
              {p.surplus != null ? signed(p.surplus) : "–"}
            </div>
            <div className="text-[11px] font-tabular h-4 leading-4 whitespace-nowrap">{p.par != null ? `par ${f2(p.par)}` : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Each team's keepers (no draft rounds), teams ranked by the total season VOR of their keepers.
function KeepersView({ picks }: { picks: AssessedPick[] }) {
  const byTeam = new Map<string, AssessedPick[]>();
  for (const p of picks.filter((x) => x.keeper)) byTeam.set(p.team, [...(byTeam.get(p.team) ?? []), p]);
  const teams = Array.from(byTeam.entries())
    .map(([team, list]) => {
      const sorted = [...list].sort((a, b) => (b.vor ?? -Infinity) - (a.vor ?? -Infinity));
      const counts = Object.fromEntries(TIERS.map((t) => [t, list.filter((x) => x.tier === t).length])) as Record<Tier, number>;
      return { team, manager: list[0]?.manager ?? "", list: sorted, counts, vor: list.reduce((n, x) => n + (x.vor ?? 0), 0) };
    })
    .sort((a, b) => b.vor - a.vor);
  if (teams.length === 0) return <p className="text-muted">No keepers found for this season.</p>;
  return (
    <div>
      <p className="text-xs text-muted mb-3 max-w-prose">
        Teams are ranked by the combined season VOR of their keepers (value over the last league starter at each position, so goalies and skaters share one scale). Tiers are the same Season tiers as everywhere else.
      </p>
      <div className="mb-3">
        <a href="/api/cards/draft-keepers" download="draft-keeper-rankings.png" className="inline-block text-xs uppercase tracking-widest border border-ice-line px-3 py-1.5 text-rink hover:bg-ice-panel">
          Download keeper rankings
        </a>
      </div>
      <div className="flex flex-col gap-4">
        {teams.map((t, i) => (
          <section key={t.team}>
            <div className="bg-rink text-ice px-3 py-2 rounded-lg mb-2 border-l-4 border-gold">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl uppercase tracking-wide truncate">
                  <span className="text-gold mr-2">#{i + 1}</span>
                  {t.team}
                </h2>
                <div className="shrink-0 text-right leading-tight">
                  <div className="font-tabular font-semibold">{signed(t.vor)}</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">keeper VOR</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <div className="flex flex-wrap gap-1">
                  {TIERS.filter((x) => t.counts[x] > 0).map((x) => (
                    <span key={x} className="text-[11px] font-semibold px-1.5 rounded" style={{ background: SOFT[x].bg, color: SOFT[x].fg, textShadow: shadow(x) }}>
                      {t.counts[x]} {x}
                    </span>
                  ))}
                </div>
                <a href={`/api/cards/draft-keepers?team=${encodeURIComponent(t.team)}`} download={`keepers-${t.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} className="shrink-0 text-xs uppercase tracking-widest border border-gold/70 px-3 py-1.5 text-gold hover:bg-white/10">
                  Download
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {t.list.map((p) => {
                const g = p.perTeamGame != null;
                return (
                  <div key={p.overall} className="flex bg-white border border-ice-line rounded-lg overflow-hidden">
                    <div className="w-1 shrink-0" style={{ background: p.tier ? SOFT[p.tier].bg : "#C9D1DA" }} />
                    <div className="flex-1 min-w-0 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {p.playerId != null && p.playerId > 0 ? <PlayerPhoto playerId={p.playerId} name={p.name} size={36} /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{p.name}</div>
                          <div className="text-xs text-muted truncate">
                            {p.nhl ? `${p.nhl} · ` : ""}
                            {p.position}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1.5">
                        <Tile label="Season" value={f2(g ? p.perTeamGame : p.avg)} sub={g ? "per team gm" : p.gp != null ? `${p.gp} gp` : undefined} tier={p.tier} />
                        <Tile label="VOR" value={f2(p.vor)} sub="season" tier={p.tier} />
                        <div
                          className="px-1 py-1 text-center rounded-lg border-2 border-transparent flex flex-col justify-center"
                          style={p.tier ? { background: SOFT[p.tier].bg, color: SOFT[p.tier].fg, textShadow: shadow(p.tier) } : { background: "#EEF2F6", color: "#5B6672" }}
                        >
                          <div className="text-xs leading-4">Tier</div>
                          <div className="text-sm font-semibold leading-5 truncate">{p.tier ?? "Not placed"}</div>
                          <div className="h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// One team's draft: every drafted pick in order, then its steals and busts, with a download of the picks graphic.
function TeamsView({ picks }: { picks: AssessedPick[] }) {
  const names = teamNames(picks);
  const [team, setTeam] = useState(names[0] ?? "");
  const mine = picks.filter((p) => p.team === team && !p.keeper).sort((a, b) => a.overall - b.overall);
  const kinds = valueKinds(picks);
  const listOf = (k: ValueKind) => mine.filter((p) => kinds.get(p.overall) === k).sort((a, b) => (k === "steals" ? b.surplus! - a.surplus! : a.surplus! - b.surplus!));
  const counts: Record<Tier, number> = { Superstar: 0, Elite: 0, Good: 0, Depth: 0, Bench: 0, Replacement: 0 };
  for (const p of mine) if (p.tier) counts[p.tier]++;
  if (names.length === 0) return <p className="text-muted">No picks found.</p>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="flex-1 min-w-0 border border-ice-line rounded px-2 py-2 bg-white text-sm font-semibold">
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <a href={`/api/cards/draft-team?team=${encodeURIComponent(team)}`} download={`draft-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} className="shrink-0 text-xs uppercase tracking-widest border border-ice-line px-3 py-2.5 text-rink hover:bg-ice-panel">
          Download
        </a>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {TIERS.filter((x) => counts[x] > 0).map((x) => (
          <span key={x} className="text-[11px] font-semibold px-1.5 rounded" style={{ background: SOFT[x].bg, color: SOFT[x].fg, textShadow: shadow(x) }}>
            {counts[x]} {x}
          </span>
        ))}
      </div>
      <section className="mb-4">
        <div className="bg-rink text-ice px-3 py-2 rounded-lg mb-2 border-l-4 border-gold">
          <h2 className="font-display text-xl uppercase tracking-wide">Picks in order</h2>
        </div>
        <div className="flex flex-col gap-2">
          {mine.map((p) => (
            <Card key={p.overall} p={p} />
          ))}
        </div>
      </section>
      {(["steals", "busts", "missed"] as ValueKind[]).map((kind) => {
        const list = listOf(kind);
        return (
          <section key={kind} className="mb-4">
            <div className="bg-rink text-ice px-3 py-2 rounded-lg mb-1 border-l-4 border-gold">
              <h2 className="font-display text-xl uppercase tracking-wide">{VALUE_TITLES[kind]}</h2>
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-muted mb-2">None for this team.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {list.map((p) => (
                  <ValueCard key={p.overall} p={p} kind={kind === "steals" ? "steal" : "bust"} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function DraftAssessmentView({ picks }: { picks: AssessedPick[] }) {
  const [tier, setTier] = useState<Tier | "ALL" | "NONE">("ALL");
  const [view, setView] = useState<"picks" | "value" | "keepers" | "teams">("picks");
  const drafted = picks.filter((p) => !p.keeper);
  const counts: Record<Tier, number> = { Superstar: 0, Elite: 0, Good: 0, Depth: 0, Bench: 0, Replacement: 0 };
  let unplaced = 0;
  for (const p of drafted) {
    if (p.tier) counts[p.tier]++;
    else unplaced++;
  }
  const keep = (p: AssessedPick) => tier === "ALL" || (tier === "NONE" ? p.tier === null : p.tier === tier);
  const groups = new Map<string, AssessedPick[]>();
  for (const p of picks.filter(keep)) {
    const k = p.keeper ? "Keepers" : `Round ${p.round ?? Math.ceil(p.overall / 10)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  // Each round downloads as its own graphic (the keepers section is rounds 15 to 18, so it has none here).
  const dl = (label: string) => {
    const m = label.match(/^Round (\d+)$/);
    return m ? `/api/cards/draft-round?round=${m[1]}` : "";
  };
  const value = splitValue(picks);
  const seg = (on: boolean) => `px-3 py-1.5 text-sm border-r border-ice-line last:border-r-0 ${on ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`;
  const btn = (on: boolean) => `shrink-0 px-3 py-2 text-sm font-semibold border-2 ${on ? "border-rink" : "border-transparent"}`;

  return (
    <div>
      <div className="inline-flex border border-ice-line mb-3">
        <button type="button" onClick={() => setView("picks")} className={seg(view === "picks")}>
          Picks
        </button>
        <button type="button" onClick={() => setView("value")} className={seg(view === "value")}>
          Steals &amp; Busts
        </button>
        <button type="button" onClick={() => setView("keepers")} className={seg(view === "keepers")}>
          Keepers
        </button>
        <button type="button" onClick={() => setView("teams")} className={seg(view === "teams")}>
          Teams
        </button>
      </div>

      <div className={view === "teams" ? "" : "hidden"}>
        <TeamsView picks={picks} />
      </div>

      <div className={view === "keepers" ? "" : "hidden"}>
        <KeepersView picks={picks} />
      </div>

      <div className={view === "value" ? "" : "hidden"}>
        <p className="text-xs text-muted mb-3 max-w-prose">
          Ranked by season VOR (value over the last league starter at his position, so every position is on one scale and games played count). Each pick is measured against the player currently ranked at his draft slot; the VOR above or below that player is vs slot. Keepers aren&apos;t assessed.
        </p>
        {(["steals", "busts", "missed"] as ValueKind[]).map((kind) =>
          value[kind].length === 0 ? null : (
            <section key={kind} className="mb-4">
              <div className="flex items-center justify-between gap-3 bg-rink text-ice px-3 py-2 rounded-lg mb-1 border-l-4 border-gold">
                <h2 className="font-display text-xl uppercase tracking-wide">{VALUE_TITLES[kind]}</h2>
                <a href={`/api/cards/draft-value?kind=${kind}`} download={`draft-${kind}.png`} className="shrink-0 text-xs uppercase tracking-widest border border-gold/70 px-3 py-1.5 text-gold hover:bg-white/10">
                  Download
                </a>
              </div>
              <p className="text-xs text-muted mb-2">{VALUE_BLURBS[kind]}</p>
              <div className="flex flex-col gap-2">
                {value[kind].map((p) => (
                  <ValueCard key={p.overall} p={p} kind={kind === "steals" ? "steal" : "bust"} />
                ))}
              </div>
            </section>
          )
        )}
      </div>

      <div className={view === "picks" ? "" : "hidden"}>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
        <button type="button" onClick={() => setTier("ALL")} className={`${btn(tier === "ALL")} bg-white text-rink !border-ice-line ${tier === "ALL" ? "!border-rink" : ""}`}>
          All <span className="font-tabular opacity-90">{picks.length}</span>
        </button>
        {TIERS.map((t) => (
          <button key={t} type="button" onClick={() => setTier(tier === t ? "ALL" : t)} className={btn(tier === t)} style={{ background: SOFT[t].bg, color: SOFT[t].fg, textShadow: shadow(t) }}>
            {t} <span className="font-tabular opacity-90">{counts[t]}</span>
          </button>
        ))}
        {unplaced > 0 ? (
          <button type="button" onClick={() => setTier(tier === "NONE" ? "ALL" : "NONE")} className={`${btn(tier === "NONE")} bg-ice-panel text-muted`}>
            Not placed <span className="font-tabular">{unplaced}</span>
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted mb-3">Tier counts are the drafted picks only; keepers are listed at the end.</p>

      {groups.size === 0 ? (
        <p className="text-muted">No picks match.</p>
      ) : (
        Array.from(groups.entries()).map(([label, list]) => (
          <section key={label} className="mb-4">
            <div className="flex items-center justify-between gap-3 bg-rink text-ice px-3 py-2 rounded-lg mb-2 border-l-4 border-gold">
              <h2 className="font-display text-xl uppercase tracking-wide">{label}</h2>
              {dl(label) ? (
                <a href={dl(label)} download={`draft-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} className="shrink-0 text-xs uppercase tracking-widest border border-gold/70 px-3 py-1.5 text-gold hover:bg-white/10">
                  Download
                </a>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {list.map((p) => (
                <Card key={p.overall} p={p} />
              ))}
            </div>
          </section>
        ))
      )}
      </div>
    </div>
  );
}
