import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { loadPoolStats, buildTrendAwards } from "@/lib/player-trends";
import { fetchLineupSlots } from "@/lib/vor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The whole Calder field (every rookie the award rules let in), split into skaters and goalies. The award itself
// ranks them together by fantasy points; this page just shows where each group stands.
export default async function RookiesPage() {
  const meta = await getLeagueMeta();
  const { teams } = await getStandings();
  let entries: ReturnType<typeof buildTrendAwards>[number]["entries"] = [];
  try {
    const rows = await loadPoolStats(meta.season);
    const slots = await fetchLineupSlots(meta.season).catch(() => null);
    entries = buildTrendAwards(rows, meta.season, 300, { counts: slots, teamCount: teams.length }).find((a) => a.key === "calder")?.entries ?? [];
  } catch {
    /* shown as empty */
  }
  const skaters = entries.filter((e) => e.position !== "G");
  const goalies = entries.filter((e) => e.position === "G");

  const table = (title: string, list: typeof entries, limit: number) => (
    <div className="mb-8">
      <h2 className="font-display text-xl mb-2">{title}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <table className="w-full text-sm border border-ice-line bg-white">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-ice-line">
              <th className="p-2 w-10">#</th>
              <th className="p-2">Player</th>
              <th className="p-2">Games</th>
              <th className="p-2 text-right">Points</th>
              <th className="p-2 text-right">Overall rank</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((e, i) => (
              <tr key={e.id} className="border-t border-ice-line">
                <td className="p-2 font-display">{i + 1}</td>
                <td className="p-2 font-medium">{e.name} <span className="text-xs text-muted">{e.position}</span></td>
                <td className="p-2 text-muted">{e.detail}</td>
                <td className="p-2 text-right font-bold">{e.value}</td>
                <td className="p-2 text-right text-muted">{e.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div>
      <p className="text-sm mb-2"><Link href="/awards/races" className="text-rink underline">← Award Races</Link></p>
      <h1 className="font-display text-3xl mb-1">Rookie board</h1>
      <p className="text-muted mb-5 max-w-prose">Every rookie this season under the NHL rookie rules, skaters and goalies shown separately. The Calder ranks them together by total fantasy points (the "Overall rank" column).</p>
      {table("Rookie skaters", skaters, 40)}
      {table("Rookie goalies", goalies, 20)}
    </div>
  );
}
