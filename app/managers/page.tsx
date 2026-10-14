import Link from "next/link";
import { getManagers, getManagerSeasons, getTeamLogos } from "@/lib/content";
import { getLeagueMeta } from "@/lib/espn";
import { loadRecords } from "@/lib/records-data";
import ManagerCards, { ManagerCardData } from "@/components/ManagerCards";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const meta = await getLeagueMeta();
  const [managers, seasons, logos] = await Promise.all([getManagers(), getManagerSeasons(), getTeamLogos()]);
  // Career totals come from the same games as the Records page; if that fails the cards still show.
  const careers = new Map<number, { wins: number; losses: number; ties: number; winPct: number; titles: number }>();
  try {
    const r = await loadRecords(meta.season);
    for (const c of r.records.careers) careers.set(c.managerId, c);
  } catch (e) {
    console.error("manager records failed", e);
  }

  const latestLeagueSeason = Math.max(0, ...seasons.map((s) => s.season));
  const items: ManagerCardData[] = managers
    .map((m) => {
      const mine = seasons.filter((s) => s.managerId === m.id).sort((a, b) => b.season - a.season);
      const c = careers.get(m.id);
      return {
        id: m.id,
        name: m.name,
        team: mine[0]?.teamName ?? null,
        logoUrl: mine[0] ? logos[mine[0].teamId] : undefined,
        first: mine.length ? mine[mine.length - 1].season : null,
        last: mine[0]?.season ?? null,
        active: mine.length > 0 && mine[0].season >= latestLeagueSeason,
        wins: c?.wins ?? 0,
        losses: c?.losses ?? 0,
        ties: c?.ties ?? 0,
        winPct: c?.winPct ?? 0,
        titles: c?.titles ?? 0,
        hasRecord: !!c && c.wins + c.losses + c.ties > 0,
      };
    })
    .sort((a, b) => b.titles - a.titles || b.winPct - a.winPct || a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="font-display text-4xl mb-1">Managers</h1>
      <p className="text-muted mb-8 max-w-prose">The people behind the teams, across every rename. Open a manager for their full league history.</p>
      <p className="text-sm mb-6 flex gap-6">
        <Link href="/managers/matrix" className="underline">Head-to-head grid</Link>
        <Link href="/managers/compare" className="underline">Compare two managers</Link>
      </p>
      {items.length === 0 ? <p className="text-muted">No managers added yet.</p> : <ManagerCards items={items} />}
    </div>
  );
}
