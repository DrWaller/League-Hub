import Link from "next/link";
import { getManagers, getManagerSeasons } from "@/lib/content";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import { activeManagerIds } from "@/lib/active-managers";
import { buildH2HMatrix, cellPct } from "@/lib/h2h-matrix";

export const dynamic = "force-dynamic";

// A green-to-red tint from a win percentage (0.5 is neutral).
function tint(p: number | null): string | undefined {
  if (p == null) return undefined;
  const d = Math.max(-1, Math.min(1, (p - 0.5) * 2));
  return d >= 0 ? `rgba(31,122,77,${(d * 0.55).toFixed(2)})` : `rgba(196,30,58,${(-d * 0.55).toFixed(2)})`;
}

export default async function MatrixPage({ searchParams }: { searchParams: { all?: string } }) {
  const showAll = searchParams.all === "1";
  const meta = await getLeagueMeta();
  const [managers, allSeasons, r] = await Promise.all([getManagers(), getManagerSeasons(), loadRecords(meta.season)]);
  const active = activeManagerIds(allSeasons, meta.season, r.recSeasons);
  const matrix = buildH2HMatrix(r.recSeasons);
  const careers = new Map(r.records.careers.map((c) => [c.managerId, c]));
  const people = managers
    .filter((m) => careers.has(m.id) && (showAll || active.has(m.id)))
    .sort((a, b) => (careers.get(b.id)?.winPct ?? 0) - (careers.get(a.id)?.winPct ?? 0));

  return (
    <div>
      <p className="text-sm mb-2">
        <Link href="/managers" className="underline">Managers</Link>
      </p>
      <h1 className="font-display text-4xl mb-1">Head-to-head grid</h1>
      <p className="text-muted mb-2 max-w-prose">
        Each row is a manager's all-time regular-season record against the manager in each column. Green means the row manager is ahead, red means behind. Open a name for their full page.
      </p>
      <p className="text-sm mb-6">
        <Link href={showAll ? "/managers/matrix" : "/managers/matrix?all=1"} className="underline">
          {showAll ? "Current managers only" : "Include former managers"}
        </Link>
      </p>
      {people.length < 2 ? (
        <p className="text-muted">Not enough games yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm font-tabular">
            <thead>
              <tr>
                <th className="p-2" />
                {people.map((m) => (
                  <th key={m.id} className="p-2 text-xs font-normal text-muted align-bottom whitespace-nowrap">
                    <Link href={`/managers/${m.id}`} className="hover:underline">{m.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((row) => (
                <tr key={row.id}>
                  <th className="p-2 text-left font-body font-medium whitespace-nowrap">
                    <Link href={`/managers/${row.id}`} className="hover:underline">{row.name}</Link>
                  </th>
                  {people.map((col) => {
                    if (row.id === col.id) return <td key={col.id} className="p-2 bg-ice-panel" />;
                    const c = matrix.get(`${row.id}|${col.id}`);
                    const p = cellPct(c);
                    return (
                      <td key={col.id} className="p-2 text-center min-w-[4.5rem]" style={{ background: tint(p) }} title={c ? `${row.name} vs ${col.name}: ${c.w}-${c.l}${c.t ? `-${c.t}` : ""}` : "No games"}>
                        {c ? `${c.w}-${c.l}${c.t ? `-${c.t}` : ""}` : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
