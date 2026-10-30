import { getCompare, getCompareDirectory, MAX_COMPARE } from "@/lib/compare";
import { getLines } from "@/lib/lines";
import { recentChanges, syncLines } from "@/lib/lines-store";
import { getNhlUsage } from "@/lib/nhl-usage";
import { getShootingBaselines, type ShootingBaseline } from "@/lib/shooting";
import ComparePlayers from "@/components/ComparePlayers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare Players" };

export default async function ComparePage({ searchParams }: { searchParams: { p?: string } }) {
  const ids = (searchParams.p ?? "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_COMPARE);

  let error: string | null = null;
  const [directory, data] = await Promise.all([
    getCompareDirectory(),
    ids.length > 0
      ? getCompare(ids).catch((e) => {
          error = String(e?.message ?? e).slice(0, 300);
          console.error("Compare failed", e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // Line, power-play unit and ice time for each skater (same source as Best Available).
  const roles: Record<number, any> = {};
  const shooting: Record<number, ShootingBaseline> = {};
  if (data) {
    const lines = await getLines().catch(() => null);
    if (lines) await syncLines(lines).catch(() => 0);
    const changes = await recentChanges(3).catch(() => []);
    const usage = await getNhlUsage(data.season, lines, changes).catch(() => null);
    if (usage) for (const p of data.players) if (p.position !== "G") roles[p.id] = usage.lookup(p.name, p.team, p.position);
    // Career and 3-year shooting percentage, by NHL id (found through the same name/team/position match as the roles).
    const nhlIds = data.players.filter((p) => roles[p.id]?.nhlId).map((p) => ({ espn: p.id, nhl: roles[p.id].nhlId as number }));
    if (nhlIds.length > 0) {
      const base = await getShootingBaselines(data.season, nhlIds.map((x) => x.nhl)).catch(() => ({}) as Record<number, ShootingBaseline>);
      for (const x of nhlIds) if (base[x.nhl]) shooting[x.espn] = base[x.nhl];
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Compare Players</h1>
      <p className="text-muted mb-5 max-w-prose">
        Put up to {MAX_COMPARE} players side by side, whoever owns them. Switch the groups on or off to show what matters: value (VOR, points, average), tier and rank,
        role and schedule, recent form, and every scoring stat.
      </p>
      <ComparePlayers directory={directory} data={data} roles={roles} shooting={shooting} selected={ids} max={MAX_COMPARE} loadFailed={ids.length > 0 && !data} error={error} />
    </div>
  );
}
