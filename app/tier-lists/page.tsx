import { getTierDirectory } from "@/lib/team-makeup";
import TierLists from "@/components/TierLists";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tier Lists" };

export default async function TierListsPage() {
  const data = await getTierDirectory().catch((e) => {
    console.error("Tier lists failed", e);
    return null;
  });
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Tier Lists</h1>
      <p className="text-muted mb-5 max-w-prose">
        Every league player by tier, rostered or available. Rating, Season or L30 sets how they&apos;re grouped.
      </p>
      {data ? <TierLists data={data} /> : <p className="text-muted">Couldn&apos;t load players from ESPN right now.</p>}
    </div>
  );
}
