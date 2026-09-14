import Link from "next/link";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getKeepers, getTeamLogos } from "@/lib/content";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function KeepersPage({
  searchParams,
}: {
  searchParams: { season?: string };
}) {
  const meta = await getLeagueMeta();
  const [{ teams }, logos, allKeepers] = await Promise.all([
    getStandings(),
    getTeamLogos(),
    getKeepers(),
  ]);

  const seasons = Array.from(new Set(allKeepers.map((k) => k.season))).sort((a, b) => b - a);
  const season = Number(searchParams.season) || seasons[0] || meta.season;
  const keepers = allKeepers.filter((k) => k.season === season);

  const byTeam = teams
    .map((t) => ({ team: t, keepers: keepers.filter((k) => k.teamId === t.id) }))
    .filter((g) => g.keepers.length > 0);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Keepers</h1>
      <p className="text-muted mb-6">Who each team protected heading into the season.</p>

      {seasons.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap">
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/keepers?season=${s}`}
              className={`px-3 py-1.5 text-sm border ${
                s === season ? "bg-rink text-ice border-rink" : "border-ice-line hover:border-rink-bright"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {byTeam.length === 0 ? (
        <p className="text-muted">No keepers logged for {season} yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {byTeam.map(({ team, keepers }) => (
            <div key={team.id} className="border border-ice-line p-5">
              <div className="flex items-center gap-3 mb-3">
                <TeamLogo url={logos[team.id]} name={team.name} size={28} />
                <h2 className="font-display text-lg">{team.name}</h2>
              </div>
              <ul className="text-sm space-y-1">
                {keepers.map((k) => (
                  <li key={k.id} className="flex justify-between">
                    <span className="font-body">{k.playerName}</span>
                    {k.note && <span className="text-muted">{k.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
