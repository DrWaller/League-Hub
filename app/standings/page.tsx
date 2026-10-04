import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getTeamLogos, getPlayedElsewhereSeasons } from "@/lib/content";
import { getAvailableSeasons } from "@/lib/seasons";
import { getSeasonBundle, byRecord } from "@/lib/season-data";
import PlayedElsewhereNotice from "@/components/PlayedElsewhereNotice";
import TeamLogo from "@/components/TeamLogo";
import { pts, ptsComma } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  id: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak?: string;
}

export default async function StandingsPage({ searchParams }: { searchParams: { season?: string } }) {
  const meta = await getLeagueMeta();
  const season = Number(searchParams.season) || meta.season;
  const isPast = season !== meta.season;
  const playoffLine = 6; // adjust to your league's playoff cutoff (current season only)

  const [seasons, logos, elsewhere] = await Promise.all([
    getAvailableSeasons(meta.season),
    getTeamLogos(),
    getPlayedElsewhereSeasons(),
  ]);

  let rows: Row[] = [];
  let live: boolean;
  let source: "espn" | "manual" | null = null;
  if (isPast) {
    const bundle = await getSeasonBundle(season);
    live = bundle !== null;
    source = bundle?.source ?? null;
    rows = bundle ? [...bundle.teams].sort(byRecord) : [];
  } else {
    const current = await getStandings();
    live = current.live;
    rows = current.teams;
  }
  const noDataElsewhere = isPast && !live && elsewhere.has(season);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Standings{isPast ? ` — ${season}` : ""}</h1>
      <p className="text-muted mb-4">
        {isPast
          ? live
            ? source === "manual"
              ? "Final regular-season standings, worked out from the weekly scores entered for this season (played on Fantrax)."
              : "Final regular-season standings, from ESPN."
            : noDataElsewhere
              ? "Played on another platform."
              : `Couldn't load ${season} from ESPN.`
          : live
            ? "Live from ESPN."
            : "Preview data — connect ESPN for live standings."}
      </p>

      {seasons.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {seasons.map((s) => (
            <Link
              key={s}
              href={s === meta.season ? "/standings" : `/standings?season=${s}`}
              className={`px-3 py-1.5 text-sm border ${
                s === season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {noDataElsewhere ? (
        <PlayedElsewhereNotice season={season} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-tabular border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-ice-line">
                <th className="py-2 pr-4 font-body font-normal">#</th>
                <th className="py-2 pr-4 font-body font-normal">Team</th>
                <th className="py-2 pr-4 font-body font-normal text-right">W</th>
                <th className="py-2 pr-4 font-body font-normal text-right">L</th>
                <th className="py-2 pr-4 font-body font-normal text-right">T</th>
                <th className="py-2 pr-4 font-body font-normal text-right">PF</th>
                <th className="py-2 pr-4 font-body font-normal text-right">PA</th>
                {!isPast && <th className="py-2 pr-4 font-body font-normal text-right">Streak</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-ice-line/60 ${
                    !isPast && i === playoffLine - 1 ? "border-b-2 border-b-center-red" : ""
                  }`}
                >
                  <td className="py-3 pr-4 text-muted">{i + 1}</td>
                  <td className="py-3 pr-4 font-body">
                    <div className="flex items-center gap-2">
                      {/* Logos are matched by team id, which is only trustworthy for the current season */}
                      <TeamLogo url={isPast ? undefined : logos[t.id]} name={t.name} size={24} />
                      {t.name}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">{t.wins}</td>
                  <td className="py-3 pr-4 text-right">{t.losses}</td>
                  <td className="py-3 pr-4 text-right">{t.ties}</td>
                  <td className="py-3 pr-4 text-right">{ptsComma(t.pointsFor)}</td>
                  <td className="py-3 pr-4 text-right">{ptsComma(t.pointsAgainst)}</td>
                  {!isPast && <td className="py-3 pr-4 text-right">{t.streak ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {noDataElsewhere ? null : !isPast ? (
        <p className="text-xs text-muted mt-4">Red line marks the playoff cutoff.</p>
      ) : (
        <p className="text-xs text-muted mt-4">Ranked by regular-season record, then points for.</p>
      )}
    </div>
  );
}
