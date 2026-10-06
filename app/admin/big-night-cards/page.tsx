import Link from "next/link";
import { currentSeason } from "@/lib/espn-daily";
import { getNight, getRecentNights } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

// Commissioner page: every big-night card for a night, ready to open or save.
// Open /admin/big-night-cards for the latest saved night, or ?date=YYYY-MM-DD.
export default async function BigNightCardsPage({ searchParams }: { searchParams: { date?: string } }) {
  const season = currentSeason();
  const [night, recent] = await Promise.all([getNight(season, searchParams.date), getRecentNights(season, 10)]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Big Night Cards</h1>
        <p className="font-body text-muted mt-1">One card per player who had a big night. Open one full size to save it, or grab its caption.</p>
      </div>

      {recent.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {recent.map((n) => (
            <Link
              key={n.date}
              href={`/admin/big-night-cards?date=${n.date}`}
              className={`font-body text-sm px-3 py-1.5 rounded-sm border ${night?.date === n.date ? "bg-rink text-ice border-rink" : "border-ice-line text-rink hover:bg-ice-panel"}`}
            >
              {prettyDate(n.date)}
            </Link>
          ))}
        </div>
      )}

      {!night ? (
        <p className="font-body text-muted">No big nights saved yet. Save a night first: /api/admin/nightly-blurbs?save=1</p>
      ) : (
        <>
          <h2 className="font-display text-2xl">{prettyDate(night.date)}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {night.blurbs.map((b) => {
              const card = `/api/admin/graphics/big-night?date=${night.date}&playerId=${b.playerId}`;
              return (
                <div key={b.playerId} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a generated image */}
                  <img src={card} alt={`${b.playerName} big night card`} loading="lazy" className="w-full border border-ice-line rounded-sm" />
                  <div className="flex items-baseline justify-between gap-3 font-body text-sm">
                    <span className="font-semibold truncate">{b.playerName}</span>
                    <span className="text-muted shrink-0">{pts(b.points)}</span>
                  </div>
                  <div className="flex gap-4 font-body text-sm">
                    <a href={card} target="_blank" rel="noreferrer" className="text-rink hover:underline">
                      Open full size
                    </a>
                    <a href={`${card}&caption=1`} target="_blank" rel="noreferrer" className="text-rink hover:underline">
                      Caption
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
