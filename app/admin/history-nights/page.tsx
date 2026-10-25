import { currentSeason } from "@/lib/espn-daily";
import { getHistorySeasons } from "@/lib/seasons";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { NIGHT_RECORDS_FROM_SEASON } from "@/lib/records-config";
import HistoryNightsRunner from "@/components/HistoryNightsRunner";

export const dynamic = "force-dynamic";

export default async function HistoryNightsPage() {
  const current = currentSeason();
  const [history, elsewhere] = await Promise.all([getHistorySeasons(current), getPlayedElsewhereSeasons()]);
  const seasons = history.filter((s) => s !== current && s >= NIGHT_RECORDS_FROM_SEASON && !elsewhere.has(s)).sort((a, b) => b - a);
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Past Seasons: Nights</h1>
      <p className="text-muted mb-1 max-w-prose">
        Reads every day of each past ESPN season so the all-time biggest nights (players and teams) on the Records page cover the whole league history.
        Seasons played elsewhere (like Fantrax) can&apos;t be read, and seasons before {NIGHT_RECORDS_FROM_SEASON} are skipped because the scoring was different.
      </p>
      <p className="text-sm text-muted mb-6 max-w-prose">
        Keep this page open while it runs. It is safe to stop and start again: days already read are skipped. A season takes a few minutes.
      </p>
      <HistoryNightsRunner seasons={seasons} />
    </div>
  );
}
