import SeasonAwardsView from "@/components/SeasonAwardsView";

export const dynamic = "force-dynamic";

// Public version of the season-long award races (Hart, Norris, Vezina, Art Ross, Calder-style trend awards,
// Presidents' Trophy, Hard Luck, Jennings, Sleeping Beauty...). Numbers only: leaders are decided by the stats.
export default function AwardRacesPage() {
  return <SeasonAwardsView />;
}
