import { currentSeason } from "@/lib/espn-daily";
import { getRecentNights } from "@/lib/nightly-store";
import { NightBlock } from "@/components/LastNight";
import { prettyDate } from "@/lib/nightly-blurbs";

export const dynamic = "force-dynamic";

export default async function LastNightPage() {
  const nights = await getRecentNights(currentSeason(), 7);
  return (
    <div className="space-y-10">
      <h1 className="font-display text-4xl">Big Nights</h1>
      {nights.length === 0 ? (
        <p className="font-body text-muted">No big nights yet this season. They show up here the morning after a standout performance.</p>
      ) : (
        nights.map((n) => <NightBlock key={n.date} night={n} heading={prettyDate(n.date)} />)
      )}
    </div>
  );
}
