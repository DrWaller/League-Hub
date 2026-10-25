import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { luckColor } from "@/lib/luck";
import { GameRecord, SeasonRow } from "@/lib/records";
import { pts, ptsComma } from "@/lib/format";
import { AllPlayTable } from "@/components/AllPlayView";
import { buildManagerLuck } from "@/lib/manager-luck";
import { NIGHT_RECORDS_FROM_SEASON } from "@/lib/records-config";
import { getAllTimeNights } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import Cup from "@/components/Cup";
import PlayerPhoto from "@/components/PlayerPhoto";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const range = (s: number[]) => (s.length === 0 ? "" : s[0] === s[s.length - 1] ? `${s[0]}` : `${s[0]}–${s[s.length - 1]}`);

type RItem = { key: string; name: string; sub: string; value: string; note?: string; weight?: number; playerId?: number };

function SectionHead({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl flex items-center gap-3">
        <span className="inline-block w-1.5 h-6 bg-center-red rounded-full" />
        {title}
      </h2>
      {blurb && <p className="text-sm text-muted mt-1 max-w-prose">{blurb}</p>}
    </div>
  );
}

// One record list: the record-holder gets a hero panel, the rest are ranked rows (optionally with a share bar).
function RecordList({ title, tag, items, bars = true }: { title: string; tag?: string; items: RItem[]; bars?: boolean }) {
  if (items.length === 0) return null;
  const [top, ...rest] = items;
  const maxW = Math.max(...items.map((i) => i.weight ?? 0), 0.0001);
  return (
    <div className="border border-ice-line rounded-md overflow-hidden bg-white shadow-[0_1px_0_rgba(18,58,97,0.04)]">
      <div className="bg-gradient-to-br from-rink to-rink-deep text-ice p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">{title}</h3>
          {tag && <span className="text-[10px] uppercase tracking-widest rounded-full bg-gold/25 text-gold px-2 py-0.5">{tag}</span>}
        </div>
        <div className="flex items-center gap-3">
          {top.playerId ? (
            <PlayerPhoto playerId={top.playerId} name={top.name} size={56} />
          ) : (
            <span className="w-9 h-9 shrink-0 rounded-full bg-gold text-rink-deep font-display flex items-center justify-center">1</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-body font-semibold leading-tight truncate">{top.name}</div>
            <div className="text-xs text-ice/70 leading-snug">{top.sub}</div>
          </div>
          <div className="text-right shrink-0 font-tabular">
            <div className="font-display text-2xl leading-none text-gold">{top.value}</div>
            {top.note && <div className="text-[11px] text-ice/70 mt-1">{top.note}</div>}
          </div>
        </div>
      </div>
      <ol className="divide-y divide-ice-line/60 font-tabular">
        {rest.map((r, i) => (
          <li key={r.key} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-5 text-center text-xs text-muted shrink-0">{i + 2}</span>
              <div className="min-w-0 flex-1 font-body">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-muted leading-snug">{r.sub}</div>
              </div>
              <div className="text-right shrink-0 text-sm">
                {r.value}
                {r.note && <div className="text-[11px] text-muted">{r.note}</div>}
              </div>
            </div>
            {bars && r.weight != null && (
              <div className="ml-8 mt-1.5 h-1 rounded-full bg-ice-line/60 overflow-hidden">
                <div className="h-full bg-rink-bright" style={{ width: `${Math.max(4, (r.weight / maxW) * 100)}%` }} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const seasonItems = (rows: SeasonRow[], showPoints?: boolean): RItem[] =>
  rows.map((r) => ({
    key: `${r.season}-${r.managerId}`,
    name: r.managerName,
    sub: `${r.season} · ${r.teamName}`,
    value: showPoints ? `${ptsComma(r.pointsFor)} pts` : rec(r.wins, r.losses, r.ties),
    note: showPoints ? undefined : pct(r.winPct),
    weight: showPoints ? r.pointsFor : r.winPct,
  }));

const gameItems = (rows: GameRecord[], kind: "score" | "margin"): RItem[] =>
  rows.map((g, i) => ({
    key: `${i}`,
    name: g.managerName ?? g.teamName,
    sub: `${g.season}, week ${g.week} · vs ${g.oppName}`,
    value: kind === "score" ? g.score.toFixed(2) : `${g.score.toFixed(2)}–${g.oppScore.toFixed(2)}`,
    note: kind === "margin" ? `by ${g.margin.toFixed(2)}` : undefined,
    weight: kind === "score" ? g.score : g.margin,
  }));

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-white/5 ring-1 ring-ice/15 px-3 py-2.5 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-ice/60">{label}</div>
      <div className="font-display text-xl leading-tight text-gold truncate">{value}</div>
      {sub && <div className="text-[11px] text-ice/70 truncate">{sub}</div>}
    </div>
  );
}

export default async function RecordsPage() {
  const meta = await getLeagueMeta();
  const { records, seasonsUsed, seasonsSkipped, managerCount, managers, recSeasons } = await loadRecords(meta.season);
  const allPlay = records.careers.length > 0 ? buildManagerLuck(0, managers, recSeasons).all : [];
  const nameOf = new Map(records.careers.map((c) => [c.managerId, c.name]));
  const hasData = records.careers.length > 0;
  const nights = await getAllTimeNights(10);
  const topTitles = [...records.careers].sort((a, b) => b.titles - a.titles)[0];
  const bestPct = [...records.careers].filter((c) => c.wins + c.losses + c.ties >= 20).sort((a, b) => b.winPct - a.winPct)[0];
  const maxPct = Math.max(...records.careers.map((c) => c.winPct), 0.0001);

  return (
    <div>
      <section className="bg-rink text-ice rounded-md overflow-hidden mb-5">
        <div className="p-5 md:p-8">
          <p className="font-body text-xs uppercase tracking-widest text-ice/60 mb-1.5">The record book</p>
          <h1 className="font-display text-[1.9rem] md:text-5xl leading-tight">Records</h1>
          <p className="text-sm text-ice/75 mt-2 max-w-prose">
            All-time numbers across every finished season{seasonsUsed.length ? ` (${range(seasonsUsed)}, ${seasonsUsed.length} seasons)` : ""}, ESPN
            and Fantrax together. Regular season only; championships come from League History.
          </p>
          {hasData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5 font-tabular">
              {topTitles && topTitles.titles > 0 && <Tile label="Most titles" value={`${topTitles.name} · ${topTitles.titles}`} sub="all-time" />}
              {bestPct && <Tile label="Best win %" value={pct(bestPct.winPct)} sub={bestPct.name} />}
              {records.highScores[0] && (
                <Tile label="Highest score" value={records.highScores[0].score.toFixed(2)} sub={`${records.highScores[0].managerName ?? records.highScores[0].teamName}, ${records.highScores[0].season}`} />
              )}
              {nights.players[0] && <Tile label="Biggest night" value={nights.players[0].points.toFixed(2)} sub={nights.players[0].name} />}
            </div>
          )}
        </div>
      </section>

      {seasonsSkipped.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          Not included yet: {seasonsSkipped.join(", ")} (no weekly scores available).
        </p>
      )}
      {records.unlinked.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          {records.unlinked.length} team-season{records.unlinked.length === 1 ? "" : "s"} aren&apos;t linked to a manager yet, so they&apos;re
          left out of the totals.
        </p>
      )}
      {records.unmatchedChampions.length > 0 && (
        <p className="text-xs text-muted mb-2 max-w-prose">
          Couldn&apos;t match {records.unmatchedChampions.map((u) => `${u.season} ${u.role} “${u.name}”`).join("; ")} to a manager&apos;s team, so
          those titles aren&apos;t counted. In League History, use that season&apos;s team name or the manager&apos;s name, and make sure that team is linked to a manager.
        </p>
      )}

      {!hasData ? (
        <p className="text-muted mt-8 max-w-prose">
          {managerCount === 0
            ? "No managers have been added yet. The commissioner needs to add managers and link them to their teams before this page can total anything up."
            : "No team has been linked to a manager yet, so there's nothing to total. The commissioner can do that from the admin area."}
        </p>
      ) : (
        <div className="space-y-14 mt-8">
          <section>
            <SectionHead title="All-time standings" />
            <ol className="space-y-2">
              {records.careers.map((c, i) => (
                <li key={c.managerId} className={`border rounded-md bg-white px-3.5 py-3 font-tabular ${i === 0 ? "border-gold ring-1 ring-gold/40" : "border-ice-line"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-display ${i === 0 ? "bg-gold text-rink-deep" : i < 3 ? "bg-rink text-ice" : "bg-ice-panel text-muted"}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-body font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.seasons} season{c.seasons === 1 ? "" : "s"} · {rec(c.wins, c.losses, c.ties)}
                      </div>
                    </div>
                    {c.titles > 0 && (
                      <span className="flex items-center gap-1 text-gold shrink-0" title={`${c.titles} title${c.titles === 1 ? "" : "s"}`}>
                        <Cup size={18} />
                        <span className="font-display text-lg text-rink">{c.titles}</span>
                      </span>
                    )}
                    <div className="text-right shrink-0 w-14">
                      <div className="font-display text-lg leading-none">{pct(c.winPct)}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted mt-0.5">win</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-ice-line/60 overflow-hidden">
                    <div className="h-full bg-rink-bright" style={{ width: `${(c.winPct / maxPct) * 100}%` }} />
                  </div>
                  <div className="hidden sm:flex gap-6 mt-2 text-xs text-muted">
                    <span>PF {ptsComma(c.pointsFor)}</span>
                    <span>PA {ptsComma(c.pointsAgainst)}</span>
                    <span>Runner-up {c.runnerUps}</span>
                    <span>1st place {c.firstPlace}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {allPlay.length > 0 && (
            <section>
              <SectionHead title="All-time all-play" blurb="Every week, every score against every other team's. The record a perfectly fair schedule would have given." />
              <AllPlayTable rows={allPlay} />
            </section>
          )}

          <section>
            <SectionHead title="Best and worst seasons" />
            <div className="grid md:grid-cols-3 gap-4">
              <RecordList title="Best records" tag="Best" items={seasonItems(records.bestSeasons)} />
              <RecordList title="Worst records" tag="Worst" items={seasonItems(records.worstSeasons)} bars={false} />
              <RecordList title="Most points" tag="Scoring" items={seasonItems(records.highScoringSeasons, true)} />
            </div>
          </section>

          <section>
            <SectionHead title="Single-game records" />
            <div className="grid md:grid-cols-2 gap-4">
              <RecordList title="Highest scores" tag="High" items={gameItems(records.highScores, "score")} />
              <RecordList title="Lowest scores" tag="Low" items={gameItems(records.lowScores, "score")} bars={false} />
              <RecordList title="Biggest blowouts" tag="Margin" items={gameItems(records.biggestWins, "margin")} />
              <RecordList title="Closest finishes" tag="Nail-biters" items={gameItems(records.closestGames, "margin")} bars={false} />
            </div>
          </section>

          {(nights.players.length > 0 || nights.teams.length > 0) && (
            <section>
              <SectionHead
                title="Single-night records"
                blurb={`The biggest single-day scores${nights.seasons.length ? ` across ${range(nights.seasons)}` : ""}, including the current season. Players are any player on any roster; teams count the players in the active lineup that day. Counted from ${NIGHT_RECORDS_FROM_SEASON} on, when the league scoring changed.`}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <RecordList
                  title="Biggest player nights"
                  tag="Players"
                  items={nights.players.map((n) => ({
                    key: `${n.season}-${n.playerId}-${n.date}`,
                    name: n.name,
                    sub: `${n.position} · ${prettyDate(n.date)} ${n.date.slice(0, 4)} · ${n.teamName}${n.statLine ? ` · ${n.statLine}` : ""}`,
                    value: n.points.toFixed(2),
                    weight: n.points,
                    playerId: n.playerId,
                  }))}
                />
                <RecordList
                  title="Biggest team nights"
                  tag="Teams"
                  items={nights.teams.map((n) => ({
                    key: `${n.season}-${n.teamName}-${n.date}`,
                    name: n.teamName,
                    sub: `${prettyDate(n.date)} ${n.date.slice(0, 4)} · ${n.season} season`,
                    value: n.points.toFixed(2),
                    weight: n.points,
                  }))}
                />
              </div>
            </section>
          )}

          <section>
            <SectionHead title="Head-to-head" blurb="Each row's record against the manager in that column, regular season only. Green means a winning record." />
            <div className="overflow-x-auto border border-ice-line rounded-md bg-white p-2">
              <table className="text-sm font-tabular border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white py-2 pr-3" />
                    {records.h2hOrder.map((id) => (
                      <th key={id} className="py-2 px-2 font-body font-normal text-muted text-center whitespace-nowrap" title={nameOf.get(id)}>
                        {(nameOf.get(id) ?? "").slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.h2hOrder.map((a) => (
                    <tr key={a} className="border-t border-ice-line/60">
                      <th className="sticky left-0 bg-white py-2 pr-3 font-body font-normal text-left whitespace-nowrap">{nameOf.get(a)}</th>
                      {records.h2hOrder.map((b) => {
                        const r = records.h2h[a]?.[b];
                        return (
                          <td
                            key={b}
                            className="py-2 px-2 text-center whitespace-nowrap"
                            style={r && a !== b && r.w !== r.l ? { backgroundColor: r.w > r.l ? "rgba(34,150,90,0.10)" : "rgba(200,40,50,0.08)" } : undefined}
                          >
                            {a === b ? (
                              <span className="text-ice-line">—</span>
                            ) : r ? (
                              <span style={{ color: r.w > r.l ? luckColor(1) : r.w < r.l ? luckColor(-1) : luckColor(0) }}>
                                {rec(r.w, r.l, r.t)}
                              </span>
                            ) : (
                              <span className="text-muted">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
