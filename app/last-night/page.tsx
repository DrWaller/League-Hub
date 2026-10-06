import { currentSeason } from "@/lib/espn-daily";
import { getRecentNights } from "@/lib/nightly-store";
import { NightCard } from "@/components/LastNight";

export const dynamic = "force-dynamic";

export default async function LastNightPage() {
  const nights = await getRecentNights(currentSeason(), 7);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Big Nights</h1>
      {nights.length === 0 ? (
        <p className="text-slate-600">No big nights yet this season. They show up here the morning after a standout performance.</p>
      ) : (
        nights.map((n) => <NightCard key={n.date} night={n} title="Big Nights" />)
      )}
    </div>
  );
}
