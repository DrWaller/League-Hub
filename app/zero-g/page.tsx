import { getZeroG } from "@/lib/goalie-starts";
import { PICKUP_WINDOWS, type PickupWindow } from "@/lib/windows";
import { getTierIndex } from "@/lib/tier-index";
import ZeroG from "@/components/ZeroG";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zero G" };

export default async function ZeroGPage({ searchParams }: { searchParams: { window?: string } }) {
  const windowKey = (PICKUP_WINDOWS.includes(searchParams.window as PickupWindow) ? searchParams.window : "current") as PickupWindow;
  const data = await getZeroG(windowKey).catch((e) => {
    console.error("Zero G failed", e);
    return null;
  });
  if (data) {
    const tierIdx = await getTierIndex();
    for (const g of data.goalies) g.player.tier = tierIdx[g.player.id] ?? null;
  }
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Zero G</h1>
      <p className="text-muted mb-5 max-w-prose">
        Available goalies who are starting, or about to. It reads every start from the NHL, flags a takeover quickly (two starts in a row, or the
        old starter missing), and treats back-to-backs the way teams do: the starter often sits one night and the backup gets the other.
      </p>
      {data ? <ZeroG data={data} /> : <p className="text-muted">Couldn&apos;t load goalie starts from the NHL or ESPN right now.</p>}
    </div>
  );
}
