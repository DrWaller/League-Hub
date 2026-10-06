import { currentSeason } from "@/lib/espn-daily";
import { getRecentNights, type StoredNight } from "@/lib/nightly-store";
import { prettyDate, recentCutoff } from "@/lib/nightly-blurbs";
import { pts } from "@/lib/format";

// One night's blurbs. Used by the home-page section and the /last-night page.
export function NightCard({ night, title }: { night: StoredNight; title?: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="border-b-2 border-red-600 bg-slate-900 px-4 py-3 text-white">
        <h2 className="text-base font-bold">{title ?? "Last Night"}</h2>
        <p className="text-xs text-slate-300">{prettyDate(night.date)}</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {night.blurbs.map((b) => (
          <li key={b.playerId} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-slate-900">
                {b.playerName} <span className="text-xs font-normal text-slate-500">{b.position}</span>
              </p>
              <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{pts(b.points)}</p>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{b.text}</p>
            {!b.active && (
              <p className="mt-1 text-xs font-semibold text-amber-700">Not in the active lineup, so these points did not count</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Home-page section: last night's big performances. Renders nothing when
// there's nothing to show (a quiet night, or the job hasn't run recently).
export default async function LastNight() {
  const [night] = await getRecentNights(currentSeason(), 1);
  if (!night || night.date < recentCutoff(2)) return null;
  return <NightCard night={night} />;
}
