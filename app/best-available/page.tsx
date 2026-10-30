import { getBestAvailable } from "@/lib/best-available";
import { getLines } from "@/lib/lines";
import { recentChanges, syncLines } from "@/lib/lines-store";
import { getNhlUsage } from "@/lib/nhl-usage";
import { getTierIndex } from "@/lib/tier-index";
import BestAvailable from "@/components/BestAvailable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Best Available" };

export default async function BestAvailablePage() {
  const data = await getBestAvailable().catch(() => null);
  // Line, power-play unit and ice time for each skater (real lines from Daily Faceoff).
  if (data) {
    const tierIdx = await getTierIndex();
    for (const p of data.players) p.tier = tierIdx[p.id] ?? null;
    const lines = await getLines().catch(() => null);
    if (lines) await syncLines(lines).catch(() => 0);
    const changes = await recentChanges(3).catch(() => []);
    const usage = await getNhlUsage(data.season, lines, changes).catch(() => null);
    if (usage) for (const p of data.players) p.role = p.position === "G" ? null : usage.lookup(p.name, p.team, p.position);
  }
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Best Available</h1>
      <p className="text-muted mb-5 max-w-prose">
        Every player nobody owns, ranked by value over replacement (VOR). Filter by position, NHL team or a date a team plays, and
        sort by VOR, total points or average over the season, the last 7, 15 or 30 days. Search by line and power-play unit to find who is on L1, PP1 or any combination.
      </p>
      {data ? (
        <BestAvailable data={data} />
      ) : (
        <p className="text-muted">Couldn&apos;t load available players from ESPN right now.</p>
      )}
    </div>
  );
}
