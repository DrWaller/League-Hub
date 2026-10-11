import { getPickups } from "@/lib/pickups";
import PickupTool from "@/components/PickupTool";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup Targets" };

export default async function PickupsPage({ searchParams }: { searchParams: { team?: string; days?: string } }) {
  const teamId = Number(searchParams.team) || null;
  const horizon = [3, 7, 14].includes(Number(searchParams.days)) ? Number(searchParams.days) : 7;
  const data = await getPickups(teamId, horizon).catch((e) => {
    console.error("Pickups failed", e);
    return null;
  });
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Pickup Targets</h1>
      <p className="text-muted mb-5 max-w-prose">
        Which available player adds the most points to <em>your</em> lineup. It fills your starting slots day by day, so a player whose
        team plays on a light day, when you have empty slots, is worth his full points. Anyone performing at a standout level is
        flagged too, whatever the schedule.
      </p>
      {data ? <PickupTool data={data} /> : <p className="text-muted">Couldn&apos;t load the schedule or rosters from ESPN right now.</p>}
    </div>
  );
}
