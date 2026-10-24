import Link from "next/link";
import type { ReactNode } from "react";
import { currentSeason } from "@/lib/espn-daily";
import { getRecentNights, type StoredNight } from "@/lib/nightly-store";
import { isMonsterNight, prettyDate, recentCutoff } from "@/lib/nightly-blurbs";
import { pts } from "@/lib/format";
import { getTeamLogos } from "@/lib/content";
import PlayerPhoto from "@/components/PlayerPhoto";
import TeamLogo from "@/components/TeamLogo";

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

const KIND_LABEL: Partial<Record<string, string>> = {
  HAT_TRICK: "Hat Trick",
  SHUTOUT: "Shutout",
  MELTDOWN: "Meltdown",
};

// "2 G · 0 A · 7 SOG" -> [{value:"2",label:"G"}, ...]
function statChips(line: string | null): { value: string; label: string }[] {
  if (!line) return [];
  return line.split(" \u00b7 ").map((part) => {
    const m = part.trim().match(/^(\S+)\s+(.+)$/);
    return m ? { value: m[1], label: m[2] } : { value: part.trim(), label: "" };
  });
}

function Chips({ line, dark = false, big = false }: { line: string | null; dark?: boolean; big?: boolean }) {
  const chips = statChips(line);
  if (chips.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${big ? "mt-4" : "mt-2"}`}>
      {chips.map((c, i) => (
        <div
          key={i}
          className={`rounded-md text-center font-tabular ${big ? "px-3.5 py-2 min-w-[3.5rem]" : "px-2.5 py-1 min-w-[2.75rem]"} ${
            dark ? "bg-white/10" : "bg-ice-panel"
          }`}
        >
          <div className={`font-display leading-none ${big ? "text-2xl" : "text-base"}`}>{c.value}</div>
          {c.label && (
            <div className={`font-body uppercase tracking-widest mt-1 ${big ? "text-[10px]" : "text-[9px]"} ${dark ? "text-ice/60" : "text-muted"}`}>
              {c.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamLine({ teamId, teamName, logos, dark = false }: { teamId: number; teamName: string; logos?: Record<number, string>; dark?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 min-w-0 font-body text-xs ${dark ? "text-ice/70" : "text-muted"}`}>
      {logos?.[teamId] && <TeamLogo url={logos[teamId]} name={teamName} size={16} />}
      <span className="truncate">{teamName}</span>
    </span>
  );
}

// One night's big performances: the Game of the Night as a featured card with
// a big headshot and stat tiles, then the rest as compact player cards.
export function NightBlock({
  night,
  heading,
  subheading,
  action,
  logos,
}: {
  night: StoredNight;
  heading: string;
  subheading?: string;
  action?: ReactNode;
  logos?: Record<number, string>;
}) {
  const star = night.blurbs.find((b) => b.gameOfNight);
  const rest = night.blurbs.filter((b) => !b.gameOfNight);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 md:gap-4 mb-3 md:mb-4">
        <h2 className="font-display text-xl md:text-2xl">
          {heading}
          {subheading && <span className="ml-3 font-body text-sm text-muted">{subheading}</span>}
        </h2>
        {action}
      </div>

      {star && (
        <div className="relative overflow-hidden bg-gradient-to-br from-rink to-rink-deep text-ice rounded-md border-l-4 border-center-red p-4 md:p-7 mb-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="font-body text-xs uppercase tracking-widest text-gold">&#9733; Game of the Night</p>
            <div className="flex items-center gap-1.5">
              {KIND_LABEL[star.kind] && star.kind !== "MELTDOWN" && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-body font-semibold uppercase tracking-widest">{KIND_LABEL[star.kind]}</span>
              )}
              {isMonsterNight(star.points, star.position) && <MonsterTag onDark />}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <PlayerPhoto playerId={star.playerId} name={star.playerName} size={84} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl md:text-3xl leading-tight">{star.playerName}</p>
              <p className="font-body text-xs text-ice/60 mt-0.5">{star.position}</p>
              <div className="mt-1">
                <TeamLine teamId={star.teamId} teamName={star.teamName} logos={logos} dark />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-4xl md:text-5xl leading-none">{pts(star.points)}</p>
              <p className="font-body text-[10px] uppercase tracking-widest text-ice/60 mt-1">fantasy pts</p>
            </div>
          </div>
          <Chips line={star.statLine} dark big />
        </div>
      )}

      {rest.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-3">
          {rest.map((b) => {
            const bad = b.kind === "MELTDOWN" || b.points < 0;
            return (
              <li key={b.playerId} className={`bg-white border border-ice-line rounded-md p-3 border-l-4 ${bad ? "border-l-center-red" : "border-l-rink-bright"}`}>
                <div className="flex items-center gap-3">
                  <PlayerPhoto playerId={b.playerId} name={b.playerName} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-semibold leading-tight truncate">
                      {b.playerName} <span className="text-xs font-normal text-muted">{b.position}</span>
                    </p>
                    <div className="mt-0.5">
                      <TeamLine teamId={b.teamId} teamName={b.teamName} logos={logos} />
                    </div>
                  </div>
                  <p className={`font-display text-2xl leading-none shrink-0 ${bad ? "text-center-red" : ""}`}>{pts(b.points)}</p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <Chips line={b.statLine} />
                  <div className="flex flex-wrap justify-end gap-1 pb-0.5">
                    {KIND_LABEL[b.kind] && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-body font-semibold uppercase tracking-widest ${bad ? "bg-center-red/10 text-center-red" : "bg-rink/10 text-rink"}`}>
                        {KIND_LABEL[b.kind]}
                      </span>
                    )}
                    {isMonsterNight(b.points, b.position) && <MonsterTag />}
                  </div>
                </div>
                {!b.active && <p className="font-body text-xs text-muted mt-2">Left on the bench &mdash; none of it counted.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Home-page section: last night's big performances with a button to the full
// page. Renders nothing on a quiet night (or if the job hasn't run recently).
export default async function LastNight() {
  const [[night], logos] = await Promise.all([getRecentNights(currentSeason(), 1), getTeamLogos()]);
  if (!night || night.date < recentCutoff(2)) return null;
  return (
    <NightBlock
      night={night}
      logos={logos}
      heading="Last Night"
      subheading={prettyDate(night.date)}
      action={
        <Link href="/last-night" className="shrink-0 bg-rink text-ice font-body text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-sm hover:bg-rink-deep">
          All big nights →
        </Link>
      }
    />
  );
}
