import { getLeagueMeta } from "@/lib/espn";
import { loadHallOfFame, mostDecorated } from "@/lib/hall-of-fame";
import HallOfFameView from "@/components/HallOfFameView";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {
  const meta = await getLeagueMeta();
  const seasons = (await loadHallOfFame(meta.season)).filter((s) => Object.keys(s.winners).length > 0);
  return <HallOfFameView seasons={seasons} decorated={mostDecorated(seasons)} />;
}
