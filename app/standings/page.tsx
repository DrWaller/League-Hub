import { Fragment } from "react";
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
  const maxPf = Math.max(1, ...rows.map((t) => t.pointsFor));
  const hasTies = rows.some((t) => t.ties > 0); // the T column only appears once someone has a tie
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
                <th className="py-2 pr-2 md:pr-4 font-body font-normal">#</th>
                <th className="py-2 pr-2 md:pr-4 font-body font-normal">Team</th>
                <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">W</th>
                <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">L</th>
                {hasTies && <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">T</th>}
                <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">PF</th>
                <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">PA</th>
                {!isPast && <th className="py-2 pr-2 md:pr-4 font-body font-normal text-right">Streak</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <Fragment key={t.id}>
                <tr
                  className={`border-b border-ice-line/60 ${
                    !isPast && i === playoffLine - 1 ? "border-b-2 border-b-center-red" : ""
                  }`}
                >
                  <td className="py-2.5 pr-2 md:pr-4 text-muted">{i + 1}</td>
                  <td className="py-2.5 pr-2 md:pr-4 font-body">
                    <div className="flex items-center gap-3">
                      {/* Logos are matched by team id, which is only trustworthy for the current season */}
                      <TeamLogo url={isPast ? undefined : logos[t.id]} name={t.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <span className="leading-tight block">{t.name}</span>
                        <div className="mt-1.5 h-1 rounded-full bg-ice-panel overflow-hidden" title={`${ptsComma(t.pointsFor)} PF`}>
                          <div className="h-full rounded-full bg-rink-bright" style={{ width: `${Math.max(4, (t.pointsFor / maxPf) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-2 md:pr-4 text-right">{t.wins}</td>
                  <td className="py-2.5 pr-2 md:pr-4 text-right">{t.losses}</td>
                  {hasTies && <td className="py-2.5 pr-2 md:pr-4 text-right">{t.ties}</td>}
                  <td className="py-2.5 pr-2 md:pr-4 text-right">{ptsComma(t.pointsFor)}</td>
                  <td className="py-2.5 pr-2 md:pr-4 text-right">{ptsComma(t.pointsAgainst)}</td>
                  {!isPast && (
                    <td className="py-2.5 pr-2 md:pr-4 text-right">
                      {t.streak ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            /^W/i.test(t.streak) ? "bg-green-100 text-green-800" : /^L/i.test(t.streak) ? "bg-red-100 text-center-red" : "bg-ice-panel text-muted"
                          }`}
                        >
                          {t.streak}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
                {!isPast && i === playoffLine - 1 && i < rows.length - 1 && (
                  <tr>
                    <td colSpan={9} className="pt-1 pb-0.5 text-[10px] uppercase tracking-widest text-center-red font-semibold">
                      Playoff line &middot; top {playoffLine} qualify
                    </td>
                  </tr>
                )}
                </Fragment>
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
