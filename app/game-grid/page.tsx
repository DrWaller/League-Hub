import Link from "next/link";
import { getGameGrid } from "@/lib/game-grid";
import GameGrid from "@/components/GameGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Game Grid" };

export default async function GameGridPage({ searchParams }: { searchParams: { week?: string; team?: string } }) {
  const team = Number(searchParams.team) || 0;
  const data = await getGameGrid(Number(searchParams.week) || null, team || null).catch((e) => {
    console.error("Game grid failed", e);
    return null;
  });
  const q = (w: number) => `/game-grid?week=${w}${team ? `&team=${team}` : ""}`;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl">Game Grid</h1>
        {data && (
          <div className="flex items-center gap-3 font-tabular text-sm">
            <Link href={q(Math.max(1, data.week - 1))} className="px-2 py-1 border border-ice-line hover:border-rink-bright">← Prev</Link>
            <span>Week {data.week} · {data.from} – {data.to}</span>
            <Link href={q(Math.min(data.maxWeek, data.week + 1))} className="px-2 py-1 border border-ice-line hover:border-rink-bright">Next →</Link>
          </div>
        )}
      </div>
      <p className="text-muted mb-5 max-w-prose">
        Every NHL team by night for a fantasy matchup week, using ESPN&apos;s matchup schedule for the dates. A light night has 8 or fewer NHL games, so a team playing then has less competition for lineup spots.
        Tap a team to see who&apos;s available from it.
      </p>
      {data ? <GameGrid data={data} /> : <p className="text-muted">Couldn&apos;t load the NHL schedule from ESPN right now.</p>}
    </div>
  );
}
