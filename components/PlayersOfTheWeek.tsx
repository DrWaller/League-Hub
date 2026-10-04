import Link from "next/link";
import { getWeeklyPlayerStats } from "@/lib/espn";
import PlayerPhoto from "@/components/PlayerPhoto";
import CardImage from "@/components/CardImage";
import { pts } from "@/lib/format";

// The week's three top fantasy scorers, and the season radar card for the best of them. It is its own
// (async) component so the home page can show everything else immediately and stream this in.
export default async function PlayersOfTheWeek({ week, teamNames }: { week: number; teamNames: Record<number, string> }) {
  let top3: { id: number; name: string; position: string; teamId: number; points: number }[] = [];
  try {
    const { players, live } = await getWeeklyPlayerStats(week);
    if (live) top3 = [...players].sort((a, b) => b.points - a.points).slice(0, 3);
  } catch {
    /* leave empty: the section just doesn't appear */
  }
  if (top3.length === 0) return null;

  const ordinal = ["1st", "2nd", "3rd"];
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl">Players of the Week</h2>
        <Link href="/awards" className="text-sm text-rink hover:underline">
          Weekly awards →
        </Link>
      </div>
      <div className="grid md:grid-cols-[1fr_300px] gap-8 items-start">
        <div>
          <p className="text-sm text-muted mb-3">Week {week}&apos;s top fantasy scorers</p>
          <ol className="divide-y divide-ice-line border-y border-ice-line">
            {top3.map((p, i) => (
              <li key={p.id} className="flex items-center gap-4 py-4">
                <span className="font-display text-xl w-9 text-muted">{ordinal[i]}</span>
                <PlayerPhoto playerId={p.id} name={p.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl leading-tight truncate">{p.name}</div>
                  <div className="text-sm text-muted truncate">
                    {p.position} · {teamNames[p.teamId] ?? ""}
                  </div>
                </div>
                <div className="font-display text-2xl font-tabular text-center-red">{pts(p.points)}</div>
              </li>
            ))}
          </ol>
          <Link href="/players" className="inline-block mt-4 text-sm text-rink hover:underline">
            See any player&apos;s card →
          </Link>
        </div>
        <Link href="/players" className="block mx-auto w-full max-w-[300px]" aria-label={`${top3[0].name}'s player card`}>
          <CardImage src={`/api/cards/player-radar?week=${week}&format=portrait`} alt={`${top3[0].name} player card`} className="w-full border border-ice-line shadow-sm" />
        </Link>
      </div>
    </section>
  );
}
