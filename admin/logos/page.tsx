import { getStandings } from "@/lib/espn";
import { getTeamLogos, getTeamBannerColors } from "@/lib/content";
import LogosManager from "@/components/LogosManager";

export const dynamic = "force-dynamic";

export default async function AdminLogosPage() {
  const [{ teams }, logos, colors] = await Promise.all([getStandings(), getTeamLogos(), getTeamBannerColors()]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Team Logos</h1>
      <p className="text-muted mb-8">Upload an image for each team. Square images work best. The two colours set the team&apos;s banner on League History and manager pages.</p>
      <LogosManager teams={teams.map((t) => ({ id: t.id, name: t.name }))} initialLogos={logos} initialColors={colors} />
    </div>
  );
}
