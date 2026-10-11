import { getBestAvailable } from "@/lib/best-available";
import BestAvailable from "@/components/BestAvailable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Best Available" };

export default async function BestAvailablePage() {
  const data = await getBestAvailable().catch(() => null);
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Best Available</h1>
      <p className="text-muted mb-5 max-w-prose">
        Every player nobody owns, ranked by value over replacement (VOR). Filter by position, NHL team or a date a team plays, and
        sort by VOR, total points or average over the season, the last 7, 15 or 30 days.
      </p>
      {data ? (
        <BestAvailable data={data} />
      ) : (
        <p className="text-muted">Couldn&apos;t load available players from ESPN right now.</p>
      )}
    </div>
  );
}
