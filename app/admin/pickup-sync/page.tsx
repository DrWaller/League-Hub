import PickupSync from "@/components/PickupSync";
import { getLeagueMeta } from "@/lib/espn";
import { getPickupCounts } from "@/lib/pickup-sync";

export const dynamic = "force-dynamic";

export default async function PickupSyncPage() {
  const meta = await getLeagueMeta();
  const counts = await getPickupCounts(meta.season);
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Update Pickups</h1>
      <p className="text-muted mb-6 max-w-prose">
        Reads every add and drop from the draft on, then each pickup&apos;s game days (started or benched) until his team dropped him, so pickups made before tracking began are included. It reads ESPN a few days at a time, so press once and wait: it keeps going until it is up to date. After that it updates itself daily and whenever Award Races or the Pickup Log is opened.
      </p>
      <PickupSync initial={counts} />
    </div>
  );
}
