import Link from "next/link";
import { getManagers } from "@/lib/content";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { buildManagerHistory } from "@/lib/manager-history";
import { buildManagerLuck } from "@/lib/manager-luck";
import { buildPlayoffReport } from "@/lib/manager-playoffs";
import { buildH2HMatrix } from "@/lib/h2h-matrix";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

interface Row {
  label: string;
  a: string;
  b: string;
  av: number | null; // numbers to compare (null = not comparable)
  bv: number | null;
  higherIsBetter?: boolean;
}

export default async function ComparePage({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  const meta = await getLeagueMeta();
  const managers = await getManagers();
  const aId = Number(searchParams.a) || 0;
  const bId = Number(searchParams.b) || 0;
  const ready = aId && bId && aId !== bId;

  let rows: Row[] = [];
  let names: [string, string] = ["", ""];
  let meeting: { aw: number; bw: number; t: number; apf: number; bpf: number } | null = null;
  if (ready) {
    const r = await loadRecords(meta.season);
    const ma = managers.find((m) => m.id === aId);
    const mb = managers.find((m) => m.id === bId);
    if (ma && mb) {
      names = [ma.name, mb.name];
      const ha = buildManagerHistory(aId, r.managers, r.recSeasons);
      const hb = buildManagerHistory(bId, r.managers, r.recSeasons);
      const la = buildManagerLuck(aId, r.managers, r.recSeasons);
      const lb = buildManagerLuck(bId, r.managers, r.recSeasons);
      const pa = buildPlayoffReport(aId, r.managers, r.recSeasons);
      const pb = buildPlayoffReport(bId, r.managers, r.recSeasons);
      const ca = ha.career;
      const cb = hb.career;
      const m = buildH2HMatrix(r.recSeasons).get(`${aId}|${bId}`);
      if (m) meeting = { aw: m.w, bw: m.l, t: m.t, apf: m.pf, bpf: m.pa };
      rows = [
        { label: "Seasons", a: String(ca?.seasons ?? 0), b: String(cb?.seasons ?? 0), av: ca?.seasons ?? null, bv: cb?.seasons ?? null },
        { label: "Record", a: ca ? rec(ca.wins, ca.losses, ca.ties) : "–", b: cb ? rec(cb.wins, cb.losses, cb.ties) : "–", av: null, bv: null },
        { label: "Win %", a: ca ? pct(ca.winPct) : "–", b: cb ? pct(cb.winPct) : "–", av: ca?.winPct ?? null, bv: cb?.winPct ?? null },
        { label: "Titles", a: String(ca?.titles ?? 0), b: String(cb?.titles ?? 0), av: ca?.titles ?? 0, bv: cb?.titles ?? 0 },
        { label: "Runner-ups", a: String(ca?.runnerUps ?? 0), b: String(cb?.runnerUps ?? 0), av: ca?.runnerUps ?? 0, bv: cb?.runnerUps ?? 0 },
        { label: "First-place finishes", a: String(ca?.firstPlace ?? 0), b: String(cb?.firstPlace ?? 0), av: ca?.firstPlace ?? 0, bv: cb?.firstPlace ?? 0 },
        { label: "Playoff trips", a: pa?.me ? `${pa.me.made} of ${pa.me.seasons}` : "–", b: pb?.me ? `${pb.me.made} of ${pb.me.seasons}` : "–", av: pa?.me?.pct ?? null, bv: pb?.me?.pct ?? null },
        { label: "Points per game", a: pts(ha.avgScore), b: pts(hb.avgScore), av: ha.avgScore, bv: hb.avgScore },
        { label: "All-play win %", a: la.me ? pct(la.me.allPlayPct) : "–", b: lb.me ? pct(lb.me.allPlayPct) : "–", av: la.me?.allPlayPct ?? null, bv: lb.me?.allPlayPct ?? null },
        { label: "Wins above a fair schedule", a: la.me ? `${la.me.luck >= 0 ? "+" : "−"}${Math.abs(la.me.luck).toFixed(1)}` : "–", b: lb.me ? `${lb.me.luck >= 0 ? "+" : "−"}${Math.abs(lb.me.luck).toFixed(1)}` : "–", av: la.me?.luck ?? null, bv: lb.me?.luck ?? null },
        { label: "Weekly swing (lower is steadier)", a: la.me ? `±${pts(la.me.spread)}` : "–", b: lb.me ? `±${pts(lb.me.spread)}` : "–", av: la.me?.spread ?? null, bv: lb.me?.spread ?? null, higherIsBetter: false },
        { label: "Best season", a: ha.bestSeason ? `${ha.bestSeason.season}, ${rec(ha.bestSeason.wins, ha.bestSeason.losses, ha.bestSeason.ties)}` : "–", b: hb.bestSeason ? `${hb.bestSeason.season}, ${rec(hb.bestSeason.wins, hb.bestSeason.losses, hb.bestSeason.ties)}` : "–", av: null, bv: null },
        { label: "Highest score", a: ha.highScore ? pts(ha.highScore.score) : "–", b: hb.highScore ? pts(hb.highScore.score) : "–", av: ha.highScore?.score ?? null, bv: hb.highScore?.score ?? null },
      ];
    }
  }

  const better = (r: Row, side: "a" | "b") => {
    if (r.av == null || r.bv == null || r.av === r.bv) return false;
    const aWins = r.higherIsBetter === false ? r.av < r.bv : r.av > r.bv;
    return side === "a" ? aWins : !aWins;
  };

  return (
    <div>
      <p className="text-sm mb-2">
        <Link href="/managers" className="underline">Managers</Link>
      </p>
      <h1 className="font-display text-4xl mb-1">Compare managers</h1>
      <p className="text-muted mb-6 max-w-prose">Pick any two managers and see their careers side by side. The better number in each row is in bold.</p>
      <form method="get" className="flex flex-wrap items-end gap-4 mb-8">
        {(["a", "b"] as const).map((k) => (
          <label key={k} className="text-sm">
            <span className="block text-muted mb-1">{k === "a" ? "First manager" : "Second manager"}</span>
            <select name={k} defaultValue={String(k === "a" ? aId || "" : bId || "")} className="border border-ice-line bg-white px-3 py-2 min-w-[12rem]">
              <option value="">Choose…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="bg-rink text-white px-4 py-2 text-sm">Compare</button>
      </form>

      {ready && rows.length > 0 ? (
        <>
          {meeting && meeting.aw + meeting.bw + meeting.t > 0 && (
            <div className="mb-6 border-l-4 border-gold bg-ice-panel px-5 py-4 max-w-xl">
              <p className="text-sm text-muted">Head to head</p>
              <p className="font-display text-3xl leading-tight font-tabular">
                {names[0]} {meeting.aw}, {names[1]} {meeting.bw}{meeting.t ? `, ${meeting.t} tied` : ""}
              </p>
              <p className="text-xs text-muted font-tabular">
                Points: {names[0]} {meeting.apf.toFixed(1)}, {names[1]} {meeting.bpf.toFixed(1)}
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="text-sm w-full max-w-2xl">
              <thead>
                <tr className="text-left border-b border-ice-line">
                  <th className="py-2 pr-4 font-normal text-muted" />
                  <th className="py-2 pr-4 font-display text-xl">{names[0]}</th>
                  <th className="py-2 font-display text-xl">{names[1]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-ice-line/50">
                    <td className="py-2 pr-4 text-muted">{r.label}</td>
                    <td className={`py-2 pr-4 font-tabular ${better(r, "a") ? "font-bold" : ""}`}>{r.a}</td>
                    <td className={`py-2 font-tabular ${better(r, "b") ? "font-bold" : ""}`}>{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : ready ? (
        <p className="text-muted">Couldn&apos;t find one of those managers.</p>
      ) : (
        <p className="text-muted">Choose two different managers.</p>
      )}
    </div>
  );
}
