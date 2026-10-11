import Link from "next/link";
import { getGameGrid } from "@/lib/game-grid";
import GameGrid from "@/components/GameGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Game Grid" };

export default async function GameGridPage({ searchParams }: { searchParams: { days?: string; shift?: string } }) {
  const span = Number(searchParams.days) === 10 ? 10 : 7;
  const shift = Math.max(-28, Math.min(56, Math.round(Number(searchParams.shift) || 0)));
  const data = await getGameGrid(span, shift).catch((e) => {
    console.error("Game grid failed", e);
    return null;
  });
  const q = (d: number, s: number) => `/game-grid?days=${d}&shift=${s}`;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl">Game Grid</h1>
        {data && (
          <div className="flex items-center gap-3 font-tabular text-sm">
            <Link href={q(span, shift - 7)} className="px-2 py-1 border border-ice-line hover:border-rink-bright">← Prev</Link>
            <span>{data.from} – {data.to}</span>
            <Link href={q(span, shift + 7)} className="px-2 py-1 border border-ice-line hover:border-rink-bright">Next →</Link>
            <span className="inline-flex border border-ice-line">
              {[7, 10].map((n) => (
                <Link key={n} href={q(n, shift)} className={`px-3 py-1 border-r border-ice-line last:border-r-0 ${span === n ? "bg-rink text-ice" : "bg-white hover:bg-ice-panel"}`}>
                  {n}-day
                </Link>
              ))}
            </span>
          </div>
        )}
      </div>
      <p className="text-muted mb-5 max-w-prose">
        Every NHL team by night. A light night has 8 or fewer NHL games, so a team playing then has less competition for lineup spots.
        Tap a team to see who&apos;s available from it.
      </p>
      {data ? <GameGrid data={data} /> : <p className="text-muted">Couldn&apos;t load the NHL schedule from ESPN right now.</p>}
    </div>
  );
}
