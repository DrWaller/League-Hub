import AwardRaceGraphics from "@/components/AwardRaceGraphics";
import { currentSeason } from "@/lib/espn-daily";
import { getBiggestNights } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AwardGraphicsPage() {
  // The season's biggest nights, each with a one-tap Big Night card (made only when you open it).
  const nights = await getBiggestNights(currentSeason(), 5);
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Award Race Graphics</h1>
      <p className="text-muted mb-1 max-w-prose">One portrait graphic for each season-long award race, with a caption you can copy.</p>
      <p className="text-sm text-muted mb-6 max-w-prose">
        Each one is only made when you press its button, so this page uses no server time until you ask. The graphics read the numbers already saved: open Award Races (or Season Awards) once after a week finishes to refresh them.
      </p>

      {nights.length > 0 && (
        <section className="mb-8 border border-ice-line bg-white p-4">
          <h2 className="font-display text-lg">Biggest Night cards</h2>
          <p className="text-xs text-muted mb-3">A Big Night card for each of the season&apos;s biggest nights. Nothing is made until you open one.</p>
          <ul className="divide-y divide-ice-line">
            {nights.map((n, i) => {
              const card = `/api/admin/graphics/big-night?date=${n.date}&playerId=${n.playerId}`;
              return (
                <li key={`${n.playerId}-${n.date}`} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-5 font-display text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{n.name}</span>
                    <span className="block text-xs text-muted">
                      {prettyDate(n.date)} · {n.teamName} · {pts(n.points)} pts
                    </span>
                  </span>
                  <span className="flex gap-4 text-sm">
                    <a href={card} target="_blank" rel="noreferrer" className="text-rink hover:underline">
                      Card
                    </a>
                    <a href={`${card}&layout=editorial`} target="_blank" rel="noreferrer" className="text-rink hover:underline">
                      Editorial
                    </a>
                    <a href={`${card}&caption=1`} target="_blank" rel="noreferrer" className="text-rink hover:underline">
                      Caption
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AwardRaceGraphics />
    </div>
  );
}
