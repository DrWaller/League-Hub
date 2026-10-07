import Link from "next/link";
import type { ReactNode } from "react";
import { currentSeason } from "@/lib/espn-daily";
import { getRecentNights, type StoredNight } from "@/lib/nightly-store";
import { isMonsterNight, prettyDate, recentCutoff } from "@/lib/nightly-blurbs";
import { pts } from "@/lib/format";

// Gold tag for a Monster Night (see NIGHTLY.monster in lib/nightly-blurbs.ts).
function MonsterTag({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      className={`ml-2 align-middle rounded-full border px-2 py-0.5 text-[10px] font-body font-semibold uppercase tracking-widest ${
        onDark ? "border-[#D9A441] text-[#D9A441]" : "border-[#D9A441] text-[#9A6B12]"
      }`}
    >
      Monster Night
    </span>
  );
}

// One night's blurbs: the Game of the Night as a featured panel, then the rest
// as a list. Styled with the site's own look (rink / ice / center-red).
export function NightBlock({
  night,
  heading,
  subheading,
  action,
}: {
  night: StoredNight;
  heading: string;
  subheading?: string;
  action?: ReactNode;
}) {
  const star = night.blurbs.find((b) => b.gameOfNight);
  const rest = night.blurbs.filter((b) => !b.gameOfNight);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 className="font-display text-2xl">
          {heading}
          {subheading && <span className="ml-3 font-body text-sm text-muted">{subheading}</span>}
        </h2>
        {action}
      </div>

      {star && (
        <div className="bg-rink text-ice rounded-sm border-l-4 border-center-red p-6 md:p-8 mb-3">
          <p className="font-body text-sm text-ice/70 mb-1">Game of the Night</p>
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display text-2xl md:text-3xl leading-tight">
              {star.playerName} <span className="font-body text-sm text-ice/60">{star.position}</span>
              {isMonsterNight(star.points, star.position) && <MonsterTag onDark />}
            </p>
            <p className="font-display text-3xl md:text-4xl shrink-0">{pts(star.points)}</p>
          </div>
          <p className="font-body mt-2 text-ice/90">{star.text}</p>
        </div>
      )}

      {rest.length > 0 && (
        <ul className="border-y border-ice-line divide-y divide-ice-line">
          {rest.map((b) => (
            <li key={b.playerId} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-body font-semibold">
                  {b.playerName} <span className="text-xs font-normal text-muted">{b.position}</span>
                  {isMonsterNight(b.points, b.position) && <MonsterTag />}
                </p>
                <p className="font-display text-lg shrink-0">{pts(b.points)}</p>
              </div>
              <p className="font-body text-sm text-muted mt-1">{b.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Home-page section: last night's big performances with a button to the full
// page. Renders nothing on a quiet night (or if the job hasn't run recently).
export default async function LastNight() {
  const [night] = await getRecentNights(currentSeason(), 1);
  if (!night || night.date < recentCutoff(2)) return null;
  return (
    <NightBlock
      night={night}
      heading="Last Night"
      subheading={prettyDate(night.date)}
      action={
        <Link href="/last-night" className="shrink-0 bg-rink text-ice font-body text-sm px-4 py-2 rounded-sm hover:bg-rink-deep">
          All big nights →
        </Link>
      }
    />
  );
}
