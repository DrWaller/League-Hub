import { getTeamMakeup } from "@/lib/team-makeup";
import TeamMakeup from "@/components/TeamMakeup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team Makeup" };

export default async function TeamMakeupPage({ searchParams }: { searchParams: { team?: string } }) {
  const data = await getTeamMakeup().catch((e) => {
    console.error("Team makeup failed", e);
    return null;
  });
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Team Makeup</h1>
      <p className="text-muted mb-5 max-w-prose">
        Every roster by tier, with each player&apos;s last 30 days beside it, so you can see who is worth keeping and who can go. Tiers use fixed cutoffs for the
        whole season, set from the league&apos;s own starter line.
      </p>
      {data ? <TeamMakeup data={data} selected={Number(searchParams.team) || null} /> : <p className="text-muted">Couldn&apos;t load rosters from ESPN right now.</p>}
    </div>
  );
}
